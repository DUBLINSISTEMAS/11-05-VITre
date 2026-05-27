"use server";

/**
 * exportOrdersCsv — S4.4 do Plano de Endurecimento.
 *
 * Server action que gera CSV completo das vendas com os MESMOS filtros
 * que a página /admin/pedidos aplica. Antes o botão "Exportar CSV"
 * exportava só a página atual (50 linhas) — lojista exportava 5x pra
 * cobrir um mês. Agora retorna até 5000 linhas com filtro inteiro.
 *
 * Cap em 5000 pra evitar OOM no Vercel serverless (memory limit). Se
 * lojista quer mais, refina filtro ou exporta por período.
 *
 * Retorna CSV string + nome do arquivo. UI baixa via Blob no client.
 */
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import {
  orderTable,
  receivableTable,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { buildCsv } from "@/lib/csv";
import { logger } from "@/lib/logger";
import { formatBRL } from "@/lib/pricing";
import {
  checkRateLimit,
  RateLimitError,
  rateLimits,
} from "@/lib/rate-limit";
import { safeUserMessage } from "@/lib/safe-error";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const MAX_ROWS = 5000;

const inputSchema = z.object({
  q: z.string().optional(),
  channel: z.enum(["balcao", "whatsapp"]).optional(),
  status: z
    .enum([
      "quote",
      "awaiting_whatsapp",
      "confirmed",
      "fulfilled",
      "canceled",
      "expired",
      "returned",
    ])
    .optional(),
  fiado: z.enum(["pendente"]).optional(),
  /** ISO date inclusive */
  from: z.string().date().optional(),
  /** ISO date inclusive */
  to: z.string().date().optional(),
});

export type ExportOrdersInput = z.input<typeof inputSchema>;

export type ExportOrdersResult =
  | { ok: true; csv: string; filename: string; rowCount: number; truncated: boolean }
  | { ok: false; error: string };

const CHANNEL_LABEL: Record<string, string> = {
  balcao: "Balcão",
  whatsapp: "Loja online",
};

const STATUS_LABEL: Record<string, string> = {
  quote: "Orçamento",
  awaiting_whatsapp: "Aguardando WhatsApp",
  confirmed: "Confirmada",
  fulfilled: "Entregue",
  canceled: "Cancelada",
  expired: "Expirada",
  returned: "Devolvida",
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
  other: "Outro",
};

export async function exportOrdersCsv(
  input: ExportOrdersInput,
): Promise<ExportOrdersResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "Sessão expirada." };
  const userId = session.user.id;

  try {
    await checkRateLimit(rateLimits.mutation, userId);
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Filtros inválidos." };
  const filters = parsed.data;

  const store = await getCurrentStore(userId);
  if (!store) return { ok: false, error: "Loja não encontrada." };

  try {
    const result = await withTenant(store.id, userId, async (tx) => {
      const conds: SQL[] = [eq(orderTable.storeId, store.id)];
      if (filters.channel) {
        conds.push(eq(orderTable.channel, filters.channel));
      }
      if (filters.q) {
        const safeQ = filters.q.replace(/[\\%_]/g, "\\$&");
        const cond = or(
          ilike(orderTable.shortCode, `${safeQ}%`),
          ilike(orderTable.customerName, `%${safeQ}%`),
        );
        if (cond) conds.push(cond);
      }
      if (filters.from) {
        conds.push(gte(orderTable.createdAt, new Date(filters.from)));
      }
      if (filters.to) {
        // toEnd: dia inteiro
        const end = new Date(filters.to);
        end.setUTCHours(23, 59, 59, 999);
        conds.push(lte(orderTable.createdAt, end));
      }
      if (filters.status) {
        conds.push(eq(orderTable.status, filters.status));
      }
      if (filters.fiado === "pendente") {
        conds.push(
          sql`EXISTS (
            SELECT 1 FROM ${receivableTable} r
            WHERE r.order_id = ${orderTable.id}
              AND r.store_id = ${orderTable.storeId}
              AND r.paid_at IS NULL
          )`,
        );
      }

      const orders = await tx
        .select({
          id: orderTable.id,
          shortCode: orderTable.shortCode,
          customerName: orderTable.customerName,
          customerPhone: orderTable.customerPhone,
          totalInCents: orderTable.totalInCents,
          status: orderTable.status,
          channel: orderTable.channel,
          paymentMethod: orderTable.paymentMethod,
          externalFiscalDoc: orderTable.externalFiscalDoc,
          createdAt: orderTable.createdAt,
        })
        .from(orderTable)
        .where(and(...conds))
        .orderBy(desc(orderTable.createdAt))
        .limit(MAX_ROWS + 1); // +1 pra detectar truncate

      return orders;
    });

    const truncated = result.length > MAX_ROWS;
    const rows = truncated ? result.slice(0, MAX_ROWS) : result;

    const headersRow = [
      "Código",
      "Data",
      "Cliente",
      "Telefone",
      "Canal",
      "Status",
      "Pagamento",
      "Total (R$)",
      "Total (centavos)",
      "NF externa",
    ];

    const csvRows = rows.map((o) => [
      `#${o.shortCode}`,
      o.createdAt.toISOString().slice(0, 19).replace("T", " "),
      o.customerName,
      o.customerPhone ?? "",
      CHANNEL_LABEL[o.channel ?? "whatsapp"] ?? o.channel ?? "",
      STATUS_LABEL[o.status] ?? o.status,
      o.paymentMethod ? PAYMENT_LABEL[o.paymentMethod] ?? "—" : "—",
      formatBRL(o.totalInCents),
      String(o.totalInCents),
      o.externalFiscalDoc ?? "",
    ]);

    const csv = buildCsv(headersRow, csvRows);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const periodSuffix = filters.from
      ? `-${filters.from.replace(/-/g, "")}-${(filters.to ?? today).replace(/-/g, "")}`
      : "";
    const filename = `vendas-${store.slug}${periodSuffix}-${today}`;

    return {
      ok: true,
      csv,
      filename,
      rowCount: rows.length,
      truncated,
    };
  } catch (e) {
    logger.error("orders.export_csv_failed", { err: e, storeId: store.id });
    return {
      ok: false,
      error: safeUserMessage(e, "Falha ao exportar CSV. Tente novamente."),
    };
  }
}
