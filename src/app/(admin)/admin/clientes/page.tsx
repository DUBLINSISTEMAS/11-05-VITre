import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { SearchXIcon, UsersIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import { CustomerCreateButton } from "@/components/admin/customer-create-button";
import {
  type CustomersKpis,
  CustomersKpiStrip,
} from "@/components/admin/customers-kpi-strip";
import { CustomersTable } from "@/components/admin/customers-table";
import { CustomersToolbar } from "@/components/admin/customers-toolbar";
import { PrintPageButton } from "@/components/admin/print/print-page-button";
import { Pagination } from "@/components/common/pagination";
import {
  customerTable,
  orderTable,
  receivablePaymentTable,
  receivableTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { normalizeDocument } from "@/lib/document";
import { pageNumberSchema, searchTextSchema } from "@/lib/page-search-params";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const PAGE_SIZE = 20;

const clientesSearchSchema = z.object({
  q: searchTextSchema,
  page: pageNumberSchema,
  /** ADR-0021 — filtro PF/PJ. Vazio/inválido = todos. */
  type: z.enum(["individual", "company"]).nullish().catch(null),
});

interface ClientesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Listagem de clientes — port Dublin v3 (ADR-0019, Onda A.9). Continua
 * URL-driven (CLAUDE.md #11). Busca cobre nome E telefone (ilike substring,
 * escape de wildcards). Ordenação default por createdAt desc.
 *
 * Decisões pixel-perfect vs handoff (B3ClientesScreen):
 * - H1 inline 24px font-bold tracking -0.025em (substitui AdminPageHeader)
 * - CTA "Adicionar cliente" → `b3-btn b3-btn--cta` (Link prefetch pra /novo)
 * - `b3-card` envolvendo helpbar + toolbar + tabela + pager
 * - Tabs (Todos/Ativos/Inativos) OMITIDAS — schema customer não tem campo
 *   status. Quando ADR futuro introduzir soft-delete, abrir como Onda separada
 *   (memory `handoff-vs-schema-respect-data-model`).
 */
export default async function ClientesPage({
  searchParams,
}: ClientesPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: clientes page sem loja");
  }

  const {
    q: rawQ,
    page,
    type: typeFilter,
  } = clientesSearchSchema.parse(await searchParams);
  const q = rawQ.trim();

  const conditions: SQL[] = [eq(customerTable.storeId, store.id)];
  if (q) {
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    // ADR-0021 — busca por documento (só dígitos). Se a query for >=3
    // dígitos numéricos, casa também contra document. Vazio = ignora.
    const queryDigits = normalizeDocument(q);
    const docMatch =
      queryDigits.length >= 3
        ? ilike(customerTable.document, `%${queryDigits}%`)
        : undefined;
    const condition = or(
      ilike(customerTable.name, `%${safeQ}%`),
      ilike(customerTable.phone, `%${safeQ}%`),
      docMatch,
    );
    if (condition) conditions.push(condition);
  }
  if (typeFilter) {
    conditions.push(eq(customerTable.type, typeFilter));
  }
  const whereClause = and(...conditions);

  const offset = (page - 1) * PAGE_SIZE;
  // Janela de 30 dias pra "Novos esse mês" + "Ticket médio do mês" — alinhado
  // com a forma como o lojista pensa ("últimos 30 dias" > "mês civil arbitrário").
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const { customers, total, kpis, perCustomerAgg } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      // SÉRIE — `pg` deprecou queries paralelas no mesmo client tx.
      const customers = await tx
        .select({
          id: customerTable.id,
          name: customerTable.name,
          phone: customerTable.phone,
          email: customerTable.email,
          type: customerTable.type,
          document: customerTable.document,
          addressCity: customerTable.addressCity,
          addressState: customerTable.addressState,
          createdAt: customerTable.createdAt,
        })
        .from(customerTable)
        .where(whereClause)
        .orderBy(desc(customerTable.createdAt), asc(customerTable.name))
        .limit(PAGE_SIZE)
        .offset(offset);

      const totalRows = await tx
        .select({ value: count() })
        .from(customerTable)
        .where(whereClause);

      // PP8 (handoff 2026-05-25) — agregações por-customer pras 3 colunas
      // novas (Último pedido / Pedidos / Fiado). Restringe aos clientes
      // visíveis da página + storeId pra não escanear toda a base.
      const customerIds = customers.map((c) => c.id);
      const orderAggByCustomer = new Map<
        string,
        { orderCount: number; lastOrderAt: Date | null }
      >();
      const fiadoByCustomer = new Map<string, number>();
      if (customerIds.length > 0) {
        const orderRows = await tx
          .select({
            customerId: orderTable.customerId,
            cnt: sql<number>`COUNT(*)::int`,
            lastAt: sql<Date | null>`MAX(${orderTable.createdAt})`,
          })
          .from(orderTable)
          .where(
            and(
              eq(orderTable.storeId, store.id),
              inArray(orderTable.customerId, customerIds),
              sql`${orderTable.status} NOT IN ('canceled','expired')`,
            ),
          )
          .groupBy(orderTable.customerId);
        for (const r of orderRows) {
          if (r.customerId) {
            orderAggByCustomer.set(r.customerId, {
              orderCount: Number(r.cnt),
              lastOrderAt: r.lastAt,
            });
          }
        }

        const fiadoRows = await tx
          .select({
            customerId: receivableTable.customerId,
            outstanding: sql<string>`
              COALESCE(SUM(${receivableTable.amountInCents}), 0)
              - COALESCE(SUM(
                  CASE WHEN ${receivablePaymentTable.id} IS NULL THEN 0
                       ELSE ${receivablePaymentTable.amountInCents}
                  END
                ), 0)
            `,
          })
          .from(receivableTable)
          .leftJoin(
            receivablePaymentTable,
            eq(receivablePaymentTable.receivableId, receivableTable.id),
          )
          .where(
            and(
              eq(receivableTable.storeId, store.id),
              inArray(receivableTable.customerId, customerIds),
              isNull(receivableTable.paidAt),
            ),
          )
          .groupBy(receivableTable.customerId);
        for (const r of fiadoRows) {
          if (r.customerId) {
            const v = Number(r.outstanding);
            if (v > 0) fiadoByCustomer.set(r.customerId, v);
          }
        }
      }

      // ---- KPIs — handoff Passo 11 ----
      // Total de clientes SEM filtros (universo da loja, não do filtro
      // corrente — KPI deve refletir o universo do lojista).
      const [totalCustomersRow] = await tx
        .select({ value: count() })
        .from(customerTable)
        .where(eq(customerTable.storeId, store.id));

      // Fiado em aberto: SUM(amount - SUM(payment.amount)) WHERE paid_at NULL.
      // LEFT JOIN porque receivable pode ter 0 payments (saldo total devido)
      // OU N payments parciais (saldo = amount - SUM payments).
      const [creditAgg] = await tx
        .select({
          outstanding: sql<string>`
            COALESCE(SUM(${receivableTable.amountInCents}), 0)
            - COALESCE(SUM(
                CASE WHEN ${receivablePaymentTable.id} IS NULL THEN 0
                     ELSE ${receivablePaymentTable.amountInCents}
                END
              ), 0)
          `,
          debtors: sql<number>`
            COUNT(DISTINCT ${receivableTable.customerId}) FILTER (
              WHERE ${receivableTable.customerId} IS NOT NULL
            )::int
          `,
        })
        .from(receivableTable)
        .leftJoin(
          receivablePaymentTable,
          eq(receivablePaymentTable.receivableId, receivableTable.id),
        )
        .where(
          and(
            eq(receivableTable.storeId, store.id),
            isNull(receivableTable.paidAt),
          ),
        );

      // Ticket médio últimos 30 dias — venda não cancelada/expirada.
      const [ticketAgg] = await tx
        .select({
          avg: sql<string | null>`
            CASE WHEN COUNT(*) = 0 THEN NULL
                 ELSE AVG(${orderTable.totalInCents})::bigint
            END
          `,
        })
        .from(orderTable)
        .where(
          and(
            eq(orderTable.storeId, store.id),
            gte(orderTable.createdAt, thirtyDaysAgo),
            sql`${orderTable.status} NOT IN ('canceled','expired')`,
          ),
        );

      // Novos clientes nos últimos 30 dias.
      const [newAgg] = await tx
        .select({ value: count() })
        .from(customerTable)
        .where(
          and(
            eq(customerTable.storeId, store.id),
            gte(customerTable.createdAt, thirtyDaysAgo),
          ),
        );

      const kpis: CustomersKpis = {
        totalCustomers: Number(totalCustomersRow?.value ?? 0),
        creditOutstandingInCents: Math.max(
          0,
          Number(creditAgg?.outstanding ?? 0),
        ),
        customersWithDebt: Number(creditAgg?.debtors ?? 0),
        ticketAverageInCents:
          ticketAgg?.avg !== null && ticketAgg?.avg !== undefined
            ? Number(ticketAgg.avg)
            : null,
        newThisMonth: Number(newAgg?.value ?? 0),
      };

      return {
        customers,
        total: totalRows[0]?.value ?? 0,
        kpis,
        perCustomerAgg: { orderAggByCustomer, fiadoByCustomer },
      };
    },
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = q !== "" || typeFilter != null;

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);
  const rangeLabel =
    total === 0 ? "0 de 0" : `${rangeStart} – ${rangeEnd} de ${total}`;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (typeFilter) usp.set("type", typeFilter);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* H1 + subtítulo dinâmico + CTA Dublin v3. Handoff Passo 11.
          S9 (handoff pixel-perfect 2026-05-25): vira `.b3-page-title` +
          `.b3-page-sub` (handoff clientes.jsx:11-12). */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="b3-page-title">Clientes</h1>
          <p className="b3-page-sub">
            {kpis.totalCustomers}{" "}
            {kpis.totalCustomers === 1
              ? "cliente cadastrado"
              : "clientes cadastrados"}
            {kpis.customersWithDebt > 0
              ? ` · ${kpis.customersWithDebt} com fiado em aberto`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintPageButton label="Imprimir lista" />
          <CustomerCreateButton />
        </div>
      </div>

      {/* KPI strip — 4 cards horizontais sempre visíveis (também na busca
          vazia pra dar contexto). */}
      <CustomersKpiStrip kpis={kpis} />

      {customers.length === 0 && !hasFilters ? (
        <EmptyState />
      ) : (
        <div className="b3-card overflow-hidden">
          {/* Onda 2.11: helpbar com link de vídeo removido — sem href real
              o link só frustrava. Volta quando houver vídeo. */}

          {/* Toolbar: busca + ordenar/filtros + counter */}
          <Suspense fallback={<div className="bg-bg-app h-14 animate-pulse" />}>
            <CustomersToolbar rangeLabel={rangeLabel} />
          </Suspense>

          {customers.length === 0 ? (
            <NoResults />
          ) : (
            <CustomersTable
              customers={customers.map((c) => {
                const orderAgg = perCustomerAgg.orderAggByCustomer.get(c.id);
                return {
                  ...c,
                  // PP8 — agregações por-customer pra colunas Último pedido /
                  // Pedidos / Fiado (handoff 2026-05-25).
                  orderCount: orderAgg?.orderCount ?? 0,
                  lastOrderAt: orderAgg?.lastOrderAt ?? null,
                  fiadoOutstandingInCents:
                    perCustomerAgg.fiadoByCustomer.get(c.id) ?? 0,
                };
              })}
            />
          )}

          {customers.length > 0 ? (
            <div className="border-line border-t p-3">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                buildHref={buildHref}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
        <UsersIcon className="size-6" />
      </div>
      <h2 className="text-ink-1 text-lg font-semibold">
        Cadastre seu primeiro cliente
      </h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Telefone é a chave. Vai ser útil pra venda balcão, follow-up no WhatsApp
        e histórico de compras.
      </p>
      <CustomerCreateButton />
    </div>
  );
}

function NoResults() {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
      <div className="bg-bg-app text-ink-4 flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-ink-1 text-lg font-semibold">
        Nenhum cliente encontrado
      </h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Confira nome ou telefone, ou limpe a busca.
      </p>
    </div>
  );
}
