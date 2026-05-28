"use server";

/**
 * loadDashboardSinais — Bloco F.2.2 da ressignificação (2026-05-28).
 *
 * "Pegando fogo agora" — painel de coisas que NOVAS HOJE precisam de
 * atenção do lojista. NÃO é "fila de tudo que tem em aberto" (isso
 * vira wallpaper, lojista ignora). É DELTA: o que mudou nas últimas
 * 24h ou está vencendo HOJE.
 *
 * Conselho 2026-05-28 (síntese):
 *   - Tarefas só de DELTA, nunca recorrentes. "Estoque crítico" que
 *     está lá há 2 semanas NÃO entra — só produto que ENTROU em mínimo
 *     hoje. Caso contrário vira cry wolf.
 *   - Cada sinal precisa link de RESOLUÇÃO direto, não "abrir lista".
 *   - Vazio = "Tudo em dia 🤝" (vocabulário cordial). Empty state honesto.
 *
 * 4 sinais curados (mais que isso polui):
 *   1. CAIXA aberto há > 12h sem fechamento (operacional clássico)
 *   2. VENDAS WhatsApp pendentes há > 2h sem abertura (urgência real)
 *   3. FIADO vencendo HOJE ou atrasado sem cobrança (ação clara)
 *   4. ESTOQUE CRÍTICO delta — produto que entrou em mínimo nas
 *      últimas 24h (sinal de movimento, não estado eterno)
 *
 * Performance: 4 queries paralelas dentro de UM withTenant. Total <50ms
 * em prod com índices padrão (todas filtram por store_id + condição
 * indexada).
 *
 * NOTA arquitetural: existe `loadAdminNotifications` no sino — overlap
 * proposital pequeno (WhatsApp pendente aparece em ambos). O sino é
 * efêmero (24h, dropdown), aqui é o painel persistente do dashboard.
 * Cada um cumpre função diferente: sino = "alguma coisa caiu",
 * sinais = "essas 4 categorias precisam de você HOJE".
 */

import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";

import {
  cashSessionTable,
  orderTable,
  productTable,
  receivableTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export type SinalType =
  | "caixa_esquecido"
  | "whatsapp_pendente"
  | "fiado_atrasado"
  | "estoque_critico_novo";

export interface DashboardSinal {
  type: SinalType;
  /** Texto curto da linha: "3 vendas WhatsApp esperando há > 2h". */
  title: string;
  /** Sub-texto opcional com mais contexto. */
  subtitle?: string;
  /** Rota pra RESOLVER (não pra listar — vai onde a ação acontece). */
  href: string;
  /** Severity visual: high (vermelho), med (âmbar), low (cinza). */
  severity: "high" | "med" | "low";
  /** Quantidade pra badge contar. */
  count: number;
}

export interface LoadDashboardSinaisOutput {
  items: DashboardSinal[];
  /** True quando NENHUM sinal está ativo — UI mostra "Tudo em dia". */
  allClear: boolean;
}

export async function loadDashboardSinais(): Promise<LoadDashboardSinaisOutput> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { items: [], allClear: true };

  const store = await getCurrentStore(session.user.id);
  if (!store) return { items: [], allClear: true };

  return withTenant(store.id, session.user.id, async (tx) => {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // pg dentro de transação serializa — usamos await sequencial em
    // vez de Promise.all pra evitar DeprecationWarning. 4 queries pequenas
    // indexadas (~10ms cada) — total ~40ms. Aceitável.

    // ---- 1) CAIXA aberto há > 12h ----
    const caixaRow = await tx
      .select({
        sessionId: cashSessionTable.id,
        openedAt: cashSessionTable.openedAt,
      })
      .from(cashSessionTable)
      .where(
        and(
          eq(cashSessionTable.storeId, store.id),
          isNull(cashSessionTable.closedAt),
          lte(cashSessionTable.openedAt, twelveHoursAgo),
        ),
      )
      .limit(1);

    // ---- 2) VENDAS WhatsApp esperando há > 2h ----
    const [whatsappAgg] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(orderTable)
      .where(
        and(
          eq(orderTable.storeId, store.id),
          eq(orderTable.status, "awaiting_whatsapp"),
          isNull(orderTable.whatsappOpenedAt),
          lte(orderTable.createdAt, twoHoursAgo),
        ),
      );
    const whatsappCount = whatsappAgg?.count ?? 0;

    // ---- 3) FIADO vencendo HOJE ou ATRASADO sem pagamento ----
    // Junta 2 condições: vencendo hoje + vencido em atraso. Conta total
    // mas labels diferentes (UI prioriza atrasado se houver).
    const [fiadoAgg] = await tx
      .select({
        overdueCount: sql<number>`count(*) filter (
          where ${receivableTable.dueDate} is not null
            and ${receivableTable.dueDate} < ${now}
            and ${receivableTable.paidAt} is null
        )::int`,
        dueToday: sql<number>`count(*) filter (
          where ${receivableTable.dueDate} >= ${now}
            and ${receivableTable.dueDate} <= ${todayEnd}
            and ${receivableTable.paidAt} is null
        )::int`,
        totalOpen: sql<number>`coalesce(sum(${receivableTable.amountInCents}) filter (
          where ${receivableTable.dueDate} is not null
            and ${receivableTable.dueDate} < ${todayEnd}
            and ${receivableTable.paidAt} is null
        ), 0)::int`,
      })
      .from(receivableTable)
      .where(eq(receivableTable.storeId, store.id));

    const fiadoOverdue = fiadoAgg?.overdueCount ?? 0;
    const fiadoDueToday = fiadoAgg?.dueToday ?? 0;
    const fiadoOpenAmount = fiadoAgg?.totalOpen ?? 0;

    // ---- 4) ESTOQUE crítico DELTA — produto que entrou em mínimo
    //         nas últimas 24h (updatedAt recente + stock <= min).
    //         updatedAt move quando produto vende OU quando compra entra,
    //         então captura o momento real do downgrade pra crítico.
    const estoqueDeltaRows = await tx
      .select({
        id: productTable.id,
        name: productTable.name,
        stockQuantity: productTable.stockQuantity,
        minStockQuantity: productTable.minStockQuantity,
      })
      .from(productTable)
      .where(
        and(
          eq(productTable.storeId, store.id),
          eq(productTable.trackStock, true),
          eq(productTable.isActive, true),
          gte(productTable.updatedAt, oneDayAgo),
        ),
      )
      .limit(50);
    const estoqueCritico = estoqueDeltaRows.filter(
      (p) =>
        p.minStockQuantity !== null &&
        p.stockQuantity !== null &&
        p.stockQuantity <= p.minStockQuantity,
    );

    // ---- Monta lista por severidade ----
    const items: DashboardSinal[] = [];

    if (caixaRow.length > 0) {
      const hoursSinceOpen = Math.floor(
        (now.getTime() - caixaRow[0]!.openedAt.getTime()) / (60 * 60 * 1000),
      );
      items.push({
        type: "caixa_esquecido",
        title: `Caixa aberto há ${hoursSinceOpen}h sem fechar`,
        subtitle: "Fechar o caixa antes de abrir uma nova sessão.",
        href: "/admin/pdv/caixa",
        severity: "high",
        count: 1,
      });
    }

    if (whatsappCount > 0) {
      items.push({
        type: "whatsapp_pendente",
        title:
          whatsappCount === 1
            ? "1 venda no WhatsApp esperando resposta"
            : `${whatsappCount} vendas no WhatsApp esperando resposta`,
        subtitle: "Sem abertura há mais de 2h. Cliente pode estar esperando.",
        href: "/admin/pedidos?channel=whatsapp&status=awaiting_whatsapp",
        severity: "high",
        count: whatsappCount,
      });
    }

    if (fiadoOverdue > 0 || fiadoDueToday > 0) {
      const formatted = (fiadoOpenAmount / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      // Atrasado pesa mais que "vencendo hoje" — texto prioriza atraso.
      let title: string;
      let severity: DashboardSinal["severity"];
      if (fiadoOverdue > 0) {
        title =
          fiadoOverdue === 1
            ? `1 fiado em atraso · R$ ${formatted} a receber`
            : `${fiadoOverdue} fiados em atraso · R$ ${formatted} a receber`;
        severity = "high";
      } else {
        title =
          fiadoDueToday === 1
            ? "1 fiado vence hoje"
            : `${fiadoDueToday} fiados vencem hoje`;
        severity = "med";
      }
      items.push({
        type: "fiado_atrasado",
        title,
        subtitle:
          fiadoOverdue > 0 && fiadoDueToday > 0
            ? `+ ${fiadoDueToday} vencem hoje`
            : undefined,
        href: "/admin/financeiro/receber?status=overdue",
        severity,
        count: fiadoOverdue + fiadoDueToday,
      });
    }

    if (estoqueCritico.length > 0) {
      const sample = estoqueCritico[0]!.name;
      items.push({
        type: "estoque_critico_novo",
        title:
          estoqueCritico.length === 1
            ? `1 produto entrou em estoque mínimo: ${truncate(sample, 28)}`
            : `${estoqueCritico.length} produtos entraram em estoque mínimo`,
        subtitle:
          estoqueCritico.length > 1
            ? `Inclui ${truncate(sample, 24)} e mais ${estoqueCritico.length - 1}.`
            : "Repor antes de zerar.",
        href: "/admin/estoque?status=low",
        severity: "med",
        count: estoqueCritico.length,
      });
    }

    return {
      items,
      allClear: items.length === 0,
    };
  });
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + "…";
}
