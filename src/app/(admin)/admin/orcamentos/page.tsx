/**
 * /admin/orcamentos — Listagem dedicada de orçamentos
 * (Semana 5 da ressignificação — 2026-05-28).
 *
 * Por que página separada? Orçamento e venda têm "tempos diferentes":
 *   - Venda  = passado/presente (já aconteceu).
 *   - Orçamento = futuro (cliente ainda decidindo).
 * Misturados na mesma listagem, joalheiro perde o follow-up — orçamento
 * fica enterrado entre 200 vendas do mês. Aqui ele tem uma página onde
 * cada linha grita "Quanto tempo ainda vale?".
 *
 * Filtro principal é VALIDADE (não data de criação): Todos / Ativos /
 * Expirados. Drawer global continua sendo o de venda — click abre
 * inline. Imprimir continua via /admin/pedidos/[id]/imprimir.
 */
import { and, count, eq, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { FileTextIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import { PrintPageButton } from "@/components/admin/print/print-page-button";
import {
  QuotesTable,
  type QuoteTableRow,
} from "@/components/admin/quotes-table";
import { Pagination } from "@/components/common/pagination";
import {
  orderItemTable,
  orderTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import {
  enumOrNull,
  idOrNullSchema,
  pageNumberSchema,
  searchTextSchema,
} from "@/lib/page-search-params";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

import { OrcamentosToolbar } from "./toolbar";

const PAGE_SIZE = 20;

const VALIDITY_VALUES = ["ativos", "expirados"] as const;
type ValidityFilter = (typeof VALIDITY_VALUES)[number];

const orcamentosSearchSchema = z.object({
  q: searchTextSchema,
  validade: enumOrNull(VALIDITY_VALUES),
  page: pageNumberSchema,
  detail: idOrNullSchema,
});

interface OrcamentosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrcamentosPage({
  searchParams,
}: OrcamentosPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: orcamentos page sem loja");
  }

  const {
    q: rawQ,
    validade,
    page,
  } = orcamentosSearchSchema.parse(await searchParams);
  const q = rawQ.trim();
  const now = new Date();

  // ---- WHERE base (storeId + status=quote + busca) ----
  const baseConditions = [
    eq(orderTable.storeId, store.id),
    eq(orderTable.status, "quote"),
  ];
  if (q) {
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    baseConditions.push(
      or(
        ilike(orderTable.customerName, `%${safeQ}%`),
        ilike(orderTable.shortCode, `%${safeQ}%`),
      )!,
    );
  }

  // ---- Filtro de validade ----
  // ativos:    quoteValidUntil IS NULL OR >= now
  // expirados: quoteValidUntil IS NOT NULL AND < now
  const validityConditions = (v: ValidityFilter | null) => {
    if (v === "ativos") {
      return [
        or(
          sql`${orderTable.quoteValidUntil} is null`,
          sql`${orderTable.quoteValidUntil} >= ${now}`,
        )!,
      ];
    }
    if (v === "expirados") {
      return [
        sql`${orderTable.quoteValidUntil} is not null`,
        lte(orderTable.quoteValidUntil, now),
      ];
    }
    return [];
  };

  const listConditions = [
    ...baseConditions,
    ...validityConditions(validade),
  ];
  const whereClause = and(...listConditions);

  const offset = (page - 1) * PAGE_SIZE;

  const { quotes, total, tabCounts } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      // Counts por aba via FILTER agregado (1 query). Bate o pattern
      // de /admin/pedidos.
      const expCond = sql`${orderTable.quoteValidUntil} is not null and ${orderTable.quoteValidUntil} < ${now}`;
      const ativoCond = sql`${orderTable.quoteValidUntil} is null or ${orderTable.quoteValidUntil} >= ${now}`;

      const [counts] = await tx
        .select({
          all: sql<number>`count(*)::int`,
          ativos: sql<number>`count(*) filter (where ${ativoCond})::int`,
          expirados: sql<number>`count(*) filter (where ${expCond})::int`,
        })
        .from(orderTable)
        .where(and(...baseConditions));

      const totalRow = await tx
        .select({ n: count() })
        .from(orderTable)
        .where(whereClause);
      const total = Number(totalRow[0]?.n ?? 0);

      const rows = await tx.query.orderTable.findMany({
        where: whereClause,
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit: PAGE_SIZE,
        offset,
        columns: {
          id: true,
          shortCode: true,
          customerName: true,
          customerPhone: true,
          totalInCents: true,
          createdAt: true,
          quoteValidUntil: true,
        },
      });

      // Soma quantity de itens em 1 batch — orçamento exibe "Itens".
      // order_item NÃO tem store_id (FK -> order.id) — RLS filtra via order
      // (CASCADE de tenant policy). Pattern bate /admin/pedidos.
      const itemQtyByOrderId = new Map<string, number>();
      if (rows.length > 0) {
        const orderIds = rows.map((r) => r.id);
        const itemRows = await tx
          .select({
            orderId: orderItemTable.orderId,
            qty: sql<number>`coalesce(sum(${orderItemTable.quantity}), 0)::int`,
          })
          .from(orderItemTable)
          .where(inArray(orderItemTable.orderId, orderIds))
          .groupBy(orderItemTable.orderId);
        for (const r of itemRows) {
          itemQtyByOrderId.set(r.orderId, Number(r.qty));
        }
      }

      const quotes: QuoteTableRow[] = rows.map((r) => ({
        id: r.id,
        shortCode: r.shortCode,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        totalInCents: r.totalInCents,
        itemQuantity: itemQtyByOrderId.get(r.id) ?? 0,
        createdAt: r.createdAt,
        quoteValidUntil: r.quoteValidUntil,
      }));

      return {
        quotes,
        total,
        tabCounts: {
          all: Number(counts?.all ?? 0),
          ativos: Number(counts?.ativos ?? 0),
          expirados: Number(counts?.expirados ?? 0),
        },
      };
    },
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="b3-main-card">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <h1 className="b3-page-title flex items-center gap-2">
            <FileTextIcon className="h-5 w-5 text-mangos-yellow-hover" aria-hidden />
            Orçamentos
          </h1>
          <p className="text-ink-4 mt-0.5 text-[12.5px]">
            Propostas em aberto. Crie pelo PDV → &quot;Salvar como orçamento&quot;.
          </p>
        </div>
        <PrintPageButton />
      </header>

      {/* Toolbar com abas de validade + busca */}
      <Suspense fallback={<div className="b3-toolbar h-14" />}>
        <OrcamentosToolbar
          tabCounts={tabCounts}
          currentValidade={validade}
          initialQ={q}
          rangeLabel={
            total === 0
              ? "Sem resultados"
              : `${rangeStart} – ${rangeEnd} de ${total}`
          }
        />
      </Suspense>

      <div className="p-4 sm:p-6">
        <QuotesTable quotes={quotes} />
      </div>

      {totalPages > 1 ? (
        <div className="border-t border-line p-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            buildHref={(p) => {
              const usp = new URLSearchParams();
              if (q) usp.set("q", q);
              if (validade) usp.set("validade", validade);
              if (p > 1) usp.set("page", String(p));
              const qs = usp.toString();
              return qs ? `/admin/orcamentos?${qs}` : "/admin/orcamentos";
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

