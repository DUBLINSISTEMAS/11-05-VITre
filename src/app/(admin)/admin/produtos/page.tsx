import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { sql } from "drizzle-orm";
import { PackageIcon, PlusIcon, SearchXIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import type { CategoryOption } from "@/components/admin/category-dialog";
import { ProductCreateButton } from "@/components/admin/product-create-button";
import { ProductsErrorToast } from "@/components/admin/products-error-toast";
import { ProductsGrid } from "@/components/admin/products-grid";
import { ProductsStatusTabs } from "@/components/admin/products-status-tabs";
import {
  ProductsTable,
  type ProductTableRow,
} from "@/components/admin/products-table";
import { ProductsToolbar } from "@/components/admin/products-toolbar";
import { ProductsViewToggle } from "@/components/admin/products-view-toggle";
import { Pagination } from "@/components/common/pagination";
import {
  categoryTable,
  productImageTable,
  productTable,
  productVariantTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import {
  boolFlagSchema,
  enumOrNull,
  idOrNullSchema,
  pageNumberSchema,
  searchTextSchema,
} from "@/lib/page-search-params";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const PAGE_SIZE = 20;

// Onda 1.4 (2026-05-24): adicionado bucket "no-tracking" pra produtos
// cadastrados sem `trackStock`. Antes, esses produtos ficavam invisíveis
// nas duas pontas (não aparecem em "Sem estoque" porque o filtro exigia
// trackStock=true, e não tinham aba dedicada). Lojista que cadastrou 50
// SKUs sem ligar o switch perdia controle silenciosamente.
const STATUS_VALUES = [
  "active",
  "inactive",
  "draft",
  "no-stock",
  "no-tracking",
  // Onda L3 (2026-05-29) — filtro pra produtos sem custo cadastrado.
  // Substitui a tela /admin/produtos/custos deletada em L1. Lojista
  // entra aqui, filtra "Sem custo", abre o produto e cadastra.
  "no-cost",
] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

// R5 Semana 4 da ressignificação (2026-05-28) — filtro TIPO URL-driven.
// Eixo ortogonal ao STATUS: STATUS = operacional (rascunho/pausado/ativo),
// TIPO = universo (público / interno / item de gestão / serviço).
// Default sem ?tipo= mostra TUDO (visão geral de catálogo).
const TIPO_VALUES = ["publico", "interno", "gestao", "servico"] as const;
type TipoFilter = (typeof TIPO_VALUES)[number];

const VIEW_VALUES = ["table", "grid"] as const;

// Audit 2026-05-26 — sort URL-driven na tabela de produtos. Antes era
// `updatedAt desc` hardcoded — lojista com 250 SKUs não conseguia "menor
// estoque primeiro" ou "menor margem". Padrão idêntico ao stock-snapshot.
const SORT_VALUES = [
  "updated-desc",
  "name-asc",
  "name-desc",
  "price-asc",
  "price-desc",
  "stock-asc",
  "stock-desc",
] as const;
type ProductSort = (typeof SORT_VALUES)[number];

const produtosSearchSchema = z.object({
  q: searchTextSchema,
  categoryId: idOrNullSchema,
  status: enumOrNull(STATUS_VALUES),
  tipo: enumOrNull(TIPO_VALUES),
  promo: boolFlagSchema,
  semFoto: boolFlagSchema,
  page: pageNumberSchema,
  // Passo 9 — toggle table↔grid (default omite param).
  view: z.enum(VIEW_VALUES).catch("table"),
  sort: z.enum(SORT_VALUES).catch("updated-desc"),
});

interface ProdutosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProdutosPage({
  searchParams,
}: ProdutosPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: produtos page sem loja");
  }

  const {
    q,
    categoryId,
    status: statusFilter,
    tipo: tipoFilter,
    promo: onlyPromo,
    semFoto: onlyNoPhoto,
    page,
    view,
    sort,
  } = produtosSearchSchema.parse(await searchParams);

  // ---- WHERE base (storeId + busca + categoria) — SEM promo nem status ----
  // promo + status são EIXOS DE TAB (mutex). Aplicados separadamente abaixo
  // pra os counts não inflacionarem indevidamente.
  const baseConditions: SQL[] = [eq(productTable.storeId, store.id)];
  if (q) {
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    baseConditions.push(ilike(productTable.name, `%${safeQ}%`));
  }
  if (categoryId) {
    baseConditions.push(eq(productTable.categoryId, categoryId));
  }

  const promoConditions = (): SQL[] => {
    const now = sql`now()`;
    const startCond = or(
      isNull(productTable.promoStartsAt),
      lte(productTable.promoStartsAt, now),
    );
    const endCond = or(
      isNull(productTable.promoEndsAt),
      gte(productTable.promoEndsAt, now),
    );
    const conds: SQL[] = [isNotNull(productTable.promoPriceInCents)];
    if (startCond) conds.push(startCond);
    if (endCond) conds.push(endCond);
    return conds;
  };

  // ---- Status conditions (separadas pra permitir count por aba) ----
  const NOT_DRAFT: SQL[] = [
    sql`${productTable.slug} not like 'draft-%'`,
    sql`btrim(${productTable.name}) <> ''`,
  ];

  const statusConditions = (s: StatusFilter | null): SQL[] => {
    if (s === "active") {
      return [eq(productTable.isActive, true), ...NOT_DRAFT];
    }
    if (s === "inactive") {
      return [eq(productTable.isActive, false), ...NOT_DRAFT];
    }
    if (s === "draft") {
      return [
        sql`(${productTable.slug} like 'draft-%' or btrim(${productTable.name}) = '')`,
      ];
    }
    if (s === "no-stock") {
      return [
        eq(productTable.trackStock, true),
        eq(productTable.stockQuantity, 0),
        ...NOT_DRAFT,
      ];
    }
    if (s === "no-tracking") {
      // Onda 1.4 — produtos sem controle de estoque (trackStock=false).
      // Visibilidade explícita: lojista precisa saber quais produtos NÃO
      // entram em relatório de estoque pra decidir se foi consciente
      // (serviço/encomenda) ou esquecimento de cadastro.
      return [eq(productTable.trackStock, false), ...NOT_DRAFT];
    }
    if (s === "no-cost") {
      // Onda L3 — produtos sem custo cadastrado. Substitui a tela
      // /admin/produtos/custos (deletada em L1). DRE so fecha honesto
      // quando todos tem custo; lojista trabalha o filtro pra zerar.
      return [
        sql`${productTable.costPriceInCents} is null`,
        ...NOT_DRAFT,
      ];
    }
    return NOT_DRAFT;
  };

  // R5 Semana 4 da ressignificação — filtro TIPO ortogonal ao STATUS.
  // STATUS = operacional (rascunho/pausado/ativo + bucket no-stock/no-tracking).
  // TIPO   = universo conceitual (público/interno/gestão/serviço).
  // Os dois se combinam: ex: ?status=active&tipo=publico = produtos vendendo
  // na loja online.
  const tipoConditions = (t: TipoFilter | null): SQL[] => {
    if (t === "publico") {
      return [
        eq(productTable.kind, "finished_good"),
        eq(productTable.isPublishedToStorefront, true),
      ];
    }
    if (t === "interno") {
      return [
        eq(productTable.kind, "finished_good"),
        eq(productTable.isPublishedToStorefront, false),
      ];
    }
    if (t === "gestao") return [eq(productTable.kind, "raw_material")];
    if (t === "servico") return [eq(productTable.kind, "service")];
    return [];
  };

  const noPhotoConditions = (): SQL[] =>
    onlyNoPhoto
      ? [
          sql`not exists (
            select 1
            from product_image
            where product_image.product_id = ${productTable.id}
              and product_image.store_id = ${productTable.storeId}
          )`,
        ]
      : [];

  // Lista respeita ou ?promo=1 ou ?status=X (mutex). Quando ?promo=1, ignora
  // statusFilter (UI já garante mas backend é defensivo). ?tipo= combina com
  // ambos (eixo ortogonal — sempre AND).
  const listConditions: SQL[] = onlyPromo
    ? [
        ...baseConditions,
        ...promoConditions(),
        ...NOT_DRAFT,
        ...tipoConditions(tipoFilter),
        ...noPhotoConditions(),
      ]
    : [
        ...baseConditions,
        ...statusConditions(statusFilter),
        ...tipoConditions(tipoFilter),
        ...noPhotoConditions(),
      ];
  const whereClause = and(...listConditions);

  // ---- Fetch sequencial dentro do tx: 4 queries em vez de 9 ----
  // Counts por status agregados num único SELECT via `count(*) FILTER`
  // (mesmo pattern de /admin/pedidos:108). Antes eram 7 queries seriais
  // só de count (cAll/cActive/cInactive/cDraft/cNoStock/cPromo/total) —
  // agora 1 query cobre todos os buckets + total da listagem.
  const offset = (page - 1) * PAGE_SIZE;

  // Helpers SQL pra montar os filtros de count dentro do FILTER (...) sem
  // duplicar lógica. CADA bucket aplica os mesmos `baseConditions` (loja
  // + busca + categoria) — o WHERE externo já garante isso, então
  // FILTER só precisa do recorte específico da aba.
  const draftCond = sql`(${productTable.slug} like 'draft-%' or btrim(${productTable.name}) = '')`;
  const notDraftCond = sql`${productTable.slug} not like 'draft-%' and btrim(${productTable.name}) <> ''`;
  const promoActiveCond = sql`${productTable.promoPriceInCents} is not null
    and (${productTable.promoStartsAt} is null or ${productTable.promoStartsAt} <= now())
    and (${productTable.promoEndsAt} is null or ${productTable.promoEndsAt} >= now())`;

  const whereCounts = and(...baseConditions);

  const {
    products,
    total,
    categories,
    coversByProduct,
    variantCountByProduct,
    tabCounts,
  } = await withTenant(store.id, session.user.id, async (tx) => {
    // Audit 2026-05-26 — sort dinâmico URL-driven. Default `updated-desc`
    // preserva comportamento anterior; opções extras: name asc/desc,
    // price asc/desc, stock asc/desc.
    const orderByClause = (() => {
      switch (sort as ProductSort) {
        case "name-asc":
          return [asc(productTable.name)];
        case "name-desc":
          return [desc(productTable.name)];
        case "price-asc":
          return [asc(productTable.basePriceInCents)];
        case "price-desc":
          return [desc(productTable.basePriceInCents)];
        case "stock-asc":
          return [asc(productTable.stockQuantity)];
        case "stock-desc":
          return [desc(productTable.stockQuantity)];
        case "updated-desc":
        default:
          return [desc(productTable.updatedAt)];
      }
    })();

    // SÉRIE dentro do tx — `pg` deprecou queries paralelas no mesmo client.
    const products = await tx.query.productTable.findMany({
      where: whereClause,
      orderBy: orderByClause,
      limit: PAGE_SIZE,
      offset,
      columns: {
        id: true,
        name: true,
        slug: true,
        basePriceInCents: true,
        promoPriceInCents: true,
        promoStartsAt: true,
        promoEndsAt: true,
        isActive: true,
        isPublishedToStorefront: true,
        trackStock: true,
        stockQuantity: true,
        categoryId: true,
        // PP7 (handoff pixel-perfect 2026-05-25) — colunas SKU + Custo + Margem
        // na tabela. `internalCode` é o SKU display; `costPriceInCents` permite
        // calcular margem inline ((base − cost) / base * 100).
        internalCode: true,
        costPriceInCents: true,
        // R2 da Semana 4 (2026-05-28) — coluna TIPO. Derivação na UI:
        //   raw_material → "Item de gestão"
        //   finished_good && !isPublishedToStorefront → "Produto interno"
        //   finished_good && isPublishedToStorefront → "Produto público"
        //   service → "Serviço"
        kind: true,
      },
    });

    // 1 query × 7 buckets via FILTER. Respeita baseConditions (loja + q +
    // categoria) mas NÃO statusFilter/promoFilter — esses são EIXOS de
    // tab. Inclui também o `total` da listagem (mesmas condições que
    // whereClause aplica) recomputado em memória abaixo.
    const aggRow = await tx
      .select({
        all: sql<number>`count(*) filter (where ${notDraftCond})::int`,
        active: sql<number>`count(*) filter (where ${productTable.isActive} = true and ${notDraftCond})::int`,
        inactive: sql<number>`count(*) filter (where ${productTable.isActive} = false and ${notDraftCond})::int`,
        draft: sql<number>`count(*) filter (where ${draftCond})::int`,
        noStock: sql<number>`count(*) filter (where ${productTable.trackStock} = true and ${productTable.stockQuantity} = 0 and ${notDraftCond})::int`,
        // Onda 1.4 — bucket "Sem controle" (trackStock=false). Ortogonal
        // a "no-stock" (que exige trackStock=true). Ambos podem coexistir.
        noTracking: sql<number>`count(*) filter (where ${productTable.trackStock} = false and ${notDraftCond})::int`,
        // Onda L3 — bucket "Sem custo". Conta produtos com cost NULL
        // (descontando rascunhos). Substitui /admin/produtos/custos.
        noCost: sql<number>`count(*) filter (where ${productTable.costPriceInCents} is null and ${notDraftCond})::int`,
        promo: sql<number>`count(*) filter (where ${promoActiveCond} and ${notDraftCond})::int`,
      })
      .from(productTable)
      .where(whereCounts);

    const agg = aggRow[0] ?? {
      all: 0,
      active: 0,
      inactive: 0,
      draft: 0,
      noStock: 0,
      noTracking: 0,
      noCost: 0,
      promo: 0,
    };

    const [totalRow] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(productTable)
      .where(whereClause);
    const total = Number(totalRow?.value ?? 0);

    const categories = await tx.query.categoryTable.findMany({
      where: eq(categoryTable.storeId, store.id),
      orderBy: [asc(categoryTable.position), asc(categoryTable.name)],
      columns: { id: true, name: true, parentId: true },
    });

    const tabCounts = {
      all: agg.all,
      active: agg.active,
      inactive: agg.inactive,
      draft: agg.draft,
      "no-stock": agg.noStock,
      "no-tracking": agg.noTracking,
      "no-cost": agg.noCost,
      promo: agg.promo,
    };

    let coversByProduct = new Map<string, string>();
    // Onda 1.4 (2026-05-24) — count de variantes por produto pra o botão
    // "+" inline na coluna ESTOQUE. Botão é desabilitado quando o produto
    // tem variantes (lojista precisa abrir produto pra escolher qual
    // variante movimentar). Query separada (uma só, agrupada) em vez de
    // payload pesado com todas as variantes.
    let variantCountByProduct = new Map<string, number>();
    if (products.length > 0) {
      const productIds = products.map((p) => p.id);
      const covers = await tx
        .select({
          productId: productImageTable.productId,
          url: productImageTable.url,
        })
        .from(productImageTable)
        .where(
          and(
            eq(productImageTable.storeId, store.id),
            eq(productImageTable.position, 0),
            inArray(productImageTable.productId, productIds),
          ),
        );
      coversByProduct = new Map(covers.map((c) => [c.productId, c.url]));

      const variantCounts = await tx
        .select({
          productId: productVariantTable.productId,
          count: sql<number>`count(*)::int`,
        })
        .from(productVariantTable)
        .where(
          and(
            eq(productVariantTable.storeId, store.id),
            inArray(productVariantTable.productId, productIds),
          ),
        )
        .groupBy(productVariantTable.productId);
      variantCountByProduct = new Map(
        variantCounts.map((v) => [v.productId, v.count]),
      );
    }

    return {
      products,
      total,
      categories,
      coversByProduct,
      variantCountByProduct,
      tabCounts,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterCategories: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }));

  const categoriesById = new Map(categories.map((c) => [c.id, c.name]));

  const hasFilters =
    q !== "" ||
    !!categoryId ||
    statusFilter !== null ||
    tipoFilter !== null ||
    onlyPromo ||
    onlyNoPhoto;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (categoryId) usp.set("categoryId", categoryId);
    if (statusFilter && !onlyPromo) usp.set("status", statusFilter);
    if (tipoFilter) usp.set("tipo", tipoFilter);
    if (onlyPromo) usp.set("promo", "1");
    if (onlyNoPhoto) usp.set("semFoto", "1");
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  const tableRows: ProductTableRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    basePriceInCents: p.basePriceInCents,
    promoPriceInCents: p.promoPriceInCents,
    promoStartsAt: p.promoStartsAt,
    promoEndsAt: p.promoEndsAt,
    isActive: p.isActive,
    isPublishedToStorefront: p.isPublishedToStorefront,
    trackStock: p.trackStock,
    stockQuantity: p.stockQuantity,
    cover: coversByProduct.get(p.id) ?? null,
    categoryName: p.categoryId
      ? (categoriesById.get(p.categoryId) ?? null)
      : null,
    variantCount: variantCountByProduct.get(p.id) ?? 0,
    // PP7 (handoff 2026-05-25) — SKU + custo pra colunas novas.
    sku: p.internalCode,
    costPriceInCents: p.costPriceInCents,
    // R2 Semana 4 — universo do produto, pra coluna TIPO.
    kind: p.kind,
  }));

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + products.length, total);
  const rangeLabel =
    total === 0 ? "0 de 0" : `${rangeStart} – ${rangeEnd} de ${total}`;

  return (
    <div className="b3-page">
      {/* S4 (handoff pixel-perfect 2026-05-25): h1 vira `.b3-page-title`
          + p vira `.b3-page-sub` (handoff produtos.jsx:26-27). Wrapper
          b3-page-hd dá o flex layout pro h1+sub à esquerda + actions à
          direita. ProductsStatusTabs mantém "Todos" (masculine concorda
          com "produtos") em vez de "Todas" (que seria pra "vendas"). */}
      <div className="b3-page-hd">
        <div>
          <h1 className="b3-page-title">Produtos</h1>
          {/* Subtítulo dinâmico — conta total inclui rascunhos pra refletir
              o universo real do CRUD; "sem estoque" só conta produtos com
              controle ativo (não conta no-tracking). */}
          <p className="b3-page-sub">
            {tabCounts.all + tabCounts.draft}{" "}
            {tabCounts.all + tabCounts.draft === 1
              ? "produto cadastrado"
              : "produtos cadastrados"}
            {tabCounts["no-stock"] > 0
              ? ` · ${tabCounts["no-stock"]} sem estoque`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProductCreateButton />
        </div>
      </div>

      <Suspense fallback={null}>
        <ProductsErrorToast />
      </Suspense>

      {/* Empty state fresh (sem pedidos + sem filtros) FORA do card */}
      {products.length === 0 && !hasFilters ? (
        <EmptyState />
      ) : (
        <div className="b3-card" style={{ overflow: "hidden" }}>
          {/* Onda 2.11: helpbar "em breve teremos vídeos" removida.
              Volta quando houver conteúdo real de vídeo. */}

          <Suspense fallback={<div className="b3-tabs h-12" />}>
            <ProductsStatusTabs counts={tabCounts} />
          </Suspense>

          <Suspense fallback={<div className="b3-toolbar h-14" />}>
            <ProductsToolbar
              categories={filterCategories}
              rangeLabel={rangeLabel}
            />
          </Suspense>

          {/* Toggle table/grid — bate o handoff (lojista visual de
              joia/roupa/perfumaria prefere grid). Posicionado entre o
              toolbar e o conteúdo, alinhado à direita. */}
          <div className="border-line flex items-center justify-end border-t px-4 py-2">
            <Suspense fallback={<div className="h-8" />}>
              <ProductsViewToggle current={view} />
            </Suspense>
          </div>

          {products.length === 0 ? (
            <NoResults onlyPromo={onlyPromo} />
          ) : view === "grid" ? (
            <ProductsGrid products={tableRows} />
          ) : (
            <ProductsTable products={tableRows} />
          )}

          {totalPages > 1 ? (
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
        <PackageIcon className="size-6" />
      </div>
      <h2 className="text-ink-1 text-lg font-semibold">Comece seu cadastro</h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Cadastre seu primeiro produto com preço, custo e estoque. Se fizer
        sentido, marque para aparecer na loja online.
      </p>
      <ProductCreateButton size="lg" className="mt-2">
        <PlusIcon size={14} /> Cadastrar primeiro produto
      </ProductCreateButton>
    </div>
  );
}

function NoResults({ onlyPromo }: { onlyPromo: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
      <div className="bg-bg-app text-ink-4 flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-ink-1 text-lg font-semibold">
        {onlyPromo ? "Nenhum produto em promoção agora" : "Nada por aqui"}
      </h2>
      <p className="text-ink-4 max-w-sm text-sm">
        {onlyPromo
          ? "Quando você definir um preço promocional num produto, ele aparece aqui."
          : "Tente outros termos de busca ou limpe os filtros."}
      </p>
    </div>
  );
}
