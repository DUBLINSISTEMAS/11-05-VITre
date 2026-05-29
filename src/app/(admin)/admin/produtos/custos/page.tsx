import { CalculatorIcon } from "lucide-react";

import {
  type CustoKind,
  type CustoStatus,
  loadCategoriesForCusto,
  loadCustoProducts,
  loadStoreFeesForCusto,
} from "@/actions/product/load-for-custo";
import { ProductCustoCards } from "@/components/admin/product-custo-cards";
import { requireSession } from "@/lib/auth-server";
import { DEFAULT_STORE_FEES } from "@/lib/pricing/net-profit";

/**
 * `/admin/produtos/custos` — Bloco F (2026-05-29).
 *
 * Opção 2 do diagnóstico (radical): tela vira CARD-VIEW por produto.
 *
 * Cada card mostra TUDO que o lojista precisa pra responder "quanto vou
 * ganhar?":
 *   - identidade
 *   - preço de venda + custo + comissão (editáveis inline)
 *   - materiais (cost components inline)
 *   - simulador de lucro líquido por método de pagamento (Dinheiro /
 *     Crédito 1×/6×/12×) usando taxa REAL da loja
 *
 * Antes era tabela bulk de 5 colunas — útil pra "preencher rápido", mas
 * inútil pra "entender quanto sobra" (queixa direta do founder).
 */

export const metadata = {
  title: "Preencher custos — Mangos Pay",
};

interface SearchParams {
  searchParams: Promise<{
    q?: string;
    categoria?: string;
    status?: string;
    tipo?: string;
  }>;
}

function parseStatus(v: string | undefined): CustoStatus {
  if (v === "with_cost" || v === "without_cost") return v;
  return "all";
}

function parseKind(v: string | undefined): CustoKind {
  if (
    v === "raw_material" ||
    v === "service" ||
    v === "all"
  ) {
    return v;
  }
  return "finished_good";
}

export default async function ProdutosCustosPage({ searchParams }: SearchParams) {
  await requireSession();
  const params = await searchParams;

  const filters = {
    search: params.q?.trim() ?? "",
    categoryId: params.categoria ?? "",
    status: parseStatus(params.status),
    kind: parseKind(params.tipo),
  };

  const [productsResult, categories, storeFees] = await Promise.all([
    loadCustoProducts({
      search: filters.search,
      categoryId: filters.categoryId || undefined,
      status: filters.status,
      kind: filters.kind,
    }),
    loadCategoriesForCusto(),
    loadStoreFeesForCusto(),
  ]);

  if (!productsResult) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-ink-3 text-sm">Loja não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1360px] space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="b3-page-title flex items-center gap-2">
          <CalculatorIcon className="size-5 text-ink-3" aria-hidden />
          Preencher custos
        </h1>
        <p className="b3-page-sub">
          Por produto: custo, comissão, materiais e lucro líquido REAL por
          método de pagamento. Cadastra rápido com &ldquo;Novo produto&rdquo;
          ou edita o cadastro completo no menu (⋮) de cada card.
        </p>
      </header>

      <ProductCustoCards
        products={productsResult.rows}
        storeFees={storeFees ?? DEFAULT_STORE_FEES}
        categories={categories}
        filters={filters}
        totals={{
          total: productsResult.total,
          totalAll: productsResult.totalAll,
          withCost: productsResult.withCost,
          withoutCost: productsResult.withoutCost,
          truncated: productsResult.truncated,
        }}
      />
    </div>
  );
}
