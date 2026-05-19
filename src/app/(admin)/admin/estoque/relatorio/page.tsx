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
  title: "Relatório de Estoque — Vitrê",
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

  const rows = await withTenant(store.id, session.user.id, async (tx) => {
    const conditions = [eq(productTable.storeId, store.id)];
    if (onlyTracked) conditions.push(eq(productTable.trackStock, true));
    if (onlyWithStock) {
      conditions.push(isNotNull(productTable.stockQuantity));
      conditions.push(sql`${productTable.stockQuantity} > 0`);
    }

    return tx
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
      .orderBy(asc(productTable.name));
  });

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
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6">
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
