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
import { ProductCreateButton } from "@/components/admin/product-create-button";
import { productTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

export const metadata = {
  title: "Preencher custos — Mangos Pay",
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

  // Onda 1.6 — limit defensivo. Loja com 5k SKUs estourava render
  // (2.5MB payload, ~12s). 1500 é teto razoável da UI de bulk-edit;
  // acima disso, lojista usa filtros (Sprint 3+).
  const PRODUCTS_LIMIT = 1500;

  const { rows, totalRows } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      const rows = await tx
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
        )
        .limit(PRODUCTS_LIMIT);

      const [countRow] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(productTable)
        .where(eq(productTable.storeId, store.id));

      return { rows, totalRows: countRow?.value ?? 0 };
    },
  );

  const totalProducts = totalRows;
  const withoutCost = rows.filter((r) => r.costPriceInCents === null).length;
  const withCost = rows.filter((r) => r.costPriceInCents !== null).length;
  const truncated = totalRows > PRODUCTS_LIMIT;

  return (
    <div className="mx-auto max-w-[1360px] space-y-4 p-4 sm:p-6">
      {/* S18 (handoff pixel-perfect 2026-05-25): h1+sub viram b3-page-title +
          b3-page-sub. O design anterior usava h1 15px (estilo planilha) que
          desconectava visualmente do resto do admin. Normalizado pra 24px
          (handoff stub-pages.jsx:168 "Custo & margem"). Contadores inline
          (Total / Com custo / Sem custo) mantidos à direita do header. */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="b3-page-title flex items-center gap-2">
            <CalculatorIcon className="size-5 text-ink-3" aria-hidden />
            Preencher custos
          </h1>
          <p className="b3-page-sub">
            Preencha o custo e a comissão de vários produtos de uma vez.
            Use Tab pra pular pra próxima linha. Salva automaticamente.
            Alimenta o lucro líquido no Resultado.
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
        <div className="b3-card flex flex-col items-center gap-4 rounded-2xl p-12 text-center">
          <div className="space-y-1">
            <p className="text-ink-1 text-[15px] font-semibold">
              Nenhum produto cadastrado ainda.
            </p>
            <p className="text-ink-4 max-w-sm text-[12.5px] leading-snug">
              Esta tela é pra preencher custo e comissão em massa de produtos
              que você já tem. Comece cadastrando o primeiro produto.
            </p>
          </div>
          <ProductCreateButton size="lg">
            Cadastrar primeiro produto
          </ProductCreateButton>
        </div>
      ) : (
        <>
          {truncated ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              Mostrando os primeiros {PRODUCTS_LIMIT.toLocaleString("pt-BR")}{" "}
              de {totalRows.toLocaleString("pt-BR")} produtos. Filtre por
              marca ou categoria pra editar produtos fora dessa janela.
            </div>
          ) : null}
          <CostGridClient initialRows={rows} />
        </>
      )}
    </div>
  );
}
