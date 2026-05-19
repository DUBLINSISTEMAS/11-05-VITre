/**
 * ADR-0034 Camada 2 Onda C — `/admin/produtos/custos`.
 *
 * Grid bulk-edit estilo planilha. Lojista preenche custo + comissão em
 * massa pra destravar relatório de margem (Camada 5). Sem esta tela,
 * lojista não preenche 200 produtos um por um e a Camada 5 nasce vazia.
 *
 * Server: query todos os produtos do tenant ativos, ordenados:
 *   1. Sem custo primeiro (cost_price IS NULL DESC)
 *   2. Por nome ASC
 * Client: <CostGridClient /> com inputs inline editáveis + auto-save
 * debounced + batch via `updateProductCostBatch` action.
 */

import { asc, eq, sql } from "drizzle-orm";
import { CalculatorIcon } from "lucide-react";

import { CostGridClient } from "@/components/admin/cost-grid-client";
import { productTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export const metadata = {
  title: "Custo & Margem — Vitrê",
};

export default async function ProdutosCustosPage() {
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
    return tx
      .select({
        id: productTable.id,
        name: productTable.name,
        basePriceInCents: productTable.basePriceInCents,
        costPriceInCents: productTable.costPriceInCents,
        defaultCommissionBps: productTable.defaultCommissionBps,
        brand: productTable.brand,
        internalCode: productTable.internalCode,
      })
      .from(productTable)
      .where(eq(productTable.storeId, store.id))
      // Sem custo primeiro (NULL aparece como 1, valor preenchido como 0)
      .orderBy(
        sql`(${productTable.costPriceInCents} IS NULL) DESC`,
        asc(productTable.name),
      );
  });

  const totalProducts = rows.length;
  const withoutCost = rows.filter((r) => r.costPriceInCents === null).length;
  const withCost = totalProducts - withoutCost;

  return (
    <div className="mx-auto max-w-[1360px] space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalculatorIcon className="size-4 text-ink-3" aria-hidden />
            <h1 className="text-[15px] font-semibold tracking-tight text-ink-1">
              Custo & Margem
            </h1>
          </div>
          <p className="text-ink-4 text-[12.5px] leading-snug">
            Preencha o custo e a comissão de vários produtos de uma vez.
            Use Tab pra pular pra próxima linha. Salva automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-4 text-[12px] tabular-nums">
          <div className="flex flex-col items-end">
            <span className="text-ink-4 text-[11px] uppercase tracking-wide">
              Total
            </span>
            <span className="font-semibold text-ink-1">{totalProducts}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-ink-4 text-[11px] uppercase tracking-wide">
              Com custo
            </span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              {withCost}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-ink-4 text-[11px] uppercase tracking-wide">
              Sem custo
            </span>
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              {withoutCost}
            </span>
          </div>
        </div>
      </header>

      {totalProducts === 0 ? (
        <div className="b3-card flex flex-col items-center gap-2 rounded-2xl p-12 text-center">
          <p className="text-ink-2 font-medium">Nenhum produto cadastrado ainda.</p>
          <p className="text-ink-4 text-[12.5px]">
            Cadastre produtos em &ldquo;Produtos&rdquo; pra começar a preencher
            custo e comissão.
          </p>
        </div>
      ) : (
        <CostGridClient initialRows={rows} />
      )}
    </div>
  );
}
