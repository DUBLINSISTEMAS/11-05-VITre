/**
 * ADR-0034 Camada 2 Onda D — `/admin/estoque/relatorio`.
 *
 * Primeira aplicação do <ReportLayout /> universal. Lojista clica
 * "Gerar relatório" em /admin/estoque, abre essa rota, vê página A4
 * com logo da loja + dados + tabela ref/nome/qtd/un/total + soma geral.
 * Imprime ou exporta CSV. Discute com contador/sócio/banco.
 */

import { and, asc, eq, isNotNull, sql } from "drizzle-orm";

import { StockReportClient } from "@/components/admin/stock-report-client";
import { productTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export const metadata = {
  title: "Relatório de Estoque — Mangos Pay",
};

interface SearchParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EstoqueRelatorioPage({ searchParams }: SearchParams) {
  const params = await searchParams;
  const onlyTracked = params.tracked !== "all"; // default: só rastreados
  const onlyWithStock = params.stock === "positive"; // default: incluir zero

  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-ink-3 text-sm">Loja não encontrada.</p>
      </div>
    );
  }

  // Onda 1.6 — limit defensivo. Catálogo de 10k SKUs causava 8-12s
  // de render + payload pesado pro relatório imprimível. 2000 é teto
  // razoável de uma página A4 navegável; lojista com catálogo maior
  // refina via filtros (apenas com saldo > 0, etc).
  const STOCK_REPORT_LIMIT = 2000;

  const { rows, totalRows } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      const conditions = [eq(productTable.storeId, store.id)];
      if (onlyTracked) conditions.push(eq(productTable.trackStock, true));
      if (onlyWithStock) {
        conditions.push(isNotNull(productTable.stockQuantity));
        conditions.push(sql`${productTable.stockQuantity} > 0`);
      }

      const rows = await tx
        .select({
          id: productTable.id,
          name: productTable.name,
          brand: productTable.brand,
          internalCode: productTable.internalCode,
          gtin: productTable.gtin,
          unit: productTable.unit,
          stockQuantity: productTable.stockQuantity,
          basePriceInCents: productTable.basePriceInCents,
          costPriceInCents: productTable.costPriceInCents,
        })
        .from(productTable)
        .where(and(...conditions))
        .orderBy(asc(productTable.name))
        .limit(STOCK_REPORT_LIMIT);

      const [countRow] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(productTable)
        .where(and(...conditions));

      return { rows, totalRows: countRow?.value ?? 0 };
    },
  );
  const truncated = totalRows > rows.length;

  const storeAddress = [
    store.addressStreet
      ? `${store.addressStreet}${store.addressNumber ? ", " + store.addressNumber : ""}`
      : null,
    store.addressNeighborhood,
    store.addressCity && store.addressState
      ? `${store.addressCity}/${store.addressState}`
      : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="mx-auto max-w-[1200px] space-y-3 p-4 sm:p-6">
      {truncated ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 print:hidden dark:bg-amber-950/20 dark:text-amber-200">
          Mostrando os primeiros {rows.length.toLocaleString("pt-BR")} de{" "}
          {totalRows.toLocaleString("pt-BR")} produtos. Refine os filtros
          (somente com saldo &gt; 0, marca, etc) pra ver o restante.
        </div>
      ) : null}
      <StockReportClient
        rows={rows}
        storeInfo={{
          name: store.name,
          logoUrl: store.logoUrl,
          address: storeAddress || null,
          whatsapp: store.whatsappDisplay,
        }}
      />
    </div>
  );
}
