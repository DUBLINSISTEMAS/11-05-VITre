import {
  and,
  asc,
  count,
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
import { InfoIcon, PackageIcon, PlusIcon, SearchXIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import type { CategoryOption } from "@/components/admin/category-dialog";
import { ProductCreateButton } from "@/components/admin/product-create-button";
import { ProductsErrorToast } from "@/components/admin/products-error-toast";
import { ProductsStatusTabs } from "@/components/admin/products-status-tabs";
import {
  ProductsTable,
  type ProductTableRow,
} from "@/components/admin/products-table";
import { ProductsToolbar } from "@/components/admin/products-toolbar";
import { Pagination } from "@/components/common/pagination";
import {
  categoryTable,
  productImageTable,
  productTable,
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

const STATUS_VALUES = ["active", "inactive", "draft", "no-stock"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

const produtosSearchSchema = z.object({
  q: searchTextSchema,
  categoryId: idOrNullSchema,
  status: enumOrNull(STATUS_VALUES),
  promo: boolFlagSchema,
  page: pageNumberSchema,
});

interface ProdutosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProdutosPage({ searchParams }: ProdutosPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: produtos page sem loja");
  }

  const {
    q,
    categoryId,
    status: statusFilter,
    promo: onlyPromo,
    page,
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
    return NOT_DRAFT;
  };

  // Lista respeita ou ?promo=1 ou ?status=X (mutex). Quando ?promo=1, ignora
  // statusFilter (UI já garante mas backend é defensivo).
  const listConditions: SQL[] = onlyPromo
    ? [...baseConditions, ...promoConditions(), ...NOT_DRAFT]
    : [...baseConditions, ...statusConditions(statusFilter)];
  const whereClause = and(...listConditions);

  // ---- Fetch paralelo: lista + total + categorias + capas + counts ----
  const offset = (page - 1) * PAGE_SIZE;
  const {
    products,
    total,
    categories,
    coversByProduct,
    tabCounts,
  } = await withTenant(store.id, session.user.id, async (tx) => {
    const countByStatus = (s: StatusFilter | null) =>
      tx
        .select({ value: count() })
        .from(productTable)
        .where(and(...baseConditions, ...statusConditions(s)));

    // SÉRIE dentro do tx — `pg` deprecou queries paralelas no mesmo client.
    const products = await tx.query.productTable.findMany({
      where: whereClause,
      orderBy: [desc(productTable.updatedAt)],
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
      },
    });
    const totalRows = await tx
      .select({ value: count() })
      .from(productTable)
      .where(whereClause);
    const categories = await tx.query.categoryTable.findMany({
      where: eq(categoryTable.storeId, store.id),
      orderBy: [asc(categoryTable.position), asc(categoryTable.name)],
      columns: { id: true, name: true, parentId: true },
    });
    const cAll = await countByStatus(null);
    const cActive = await countByStatus("active");
    const cInactive = await countByStatus("inactive");
    const cDraft = await countByStatus("draft");
    const cNoStock = await countByStatus("no-stock");
    const cPromo = await tx
      .select({ value: count() })
      .from(productTable)
      .where(and(...baseConditions, ...promoConditions(), ...NOT_DRAFT));

    const tabCounts = {
      all: cAll[0]?.value ?? 0,
      active: cActive[0]?.value ?? 0,
      inactive: cInactive[0]?.value ?? 0,
      draft: cDraft[0]?.value ?? 0,
      "no-stock": cNoStock[0]?.value ?? 0,
      promo: cPromo[0]?.value ?? 0,
    };

    let coversByProduct = new Map<string, string>();
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
    }

    return {
      products,
      total: totalRows[0]?.value ?? 0,
      categories,
      coversByProduct,
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
    q !== "" || !!categoryId || statusFilter !== null || onlyPromo;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (categoryId) usp.set("categoryId", categoryId);
    if (statusFilter && !onlyPromo) usp.set("status", statusFilter);
    if (onlyPromo) usp.set("promo", "1");
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
    categoryName: p.categoryId ? categoriesById.get(p.categoryId) ?? null : null,
  }));

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + products.length, total);
  const rangeLabel =
    total === 0
      ? "0 de 0"
      : `${rangeStart} – ${rangeEnd} de ${total}`;

  return (
    <div className="b3-page">
      <div className="b3-page-hd">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-1">
            Meus produtos
          </h1>
        </div>
        <ProductCreateButton />
      </div>

      <Suspense fallback={null}>
        <ProductsErrorToast />
      </Suspense>

      {/* Empty state fresh (sem pedidos + sem filtros) FORA do card */}
      {products.length === 0 && !hasFilters ? (
        <EmptyState />
      ) : (
        <div className="b3-card" style={{ overflow: "hidden" }}>
          <div className="b3-helpbar">
            <span className="b3-helpbar-ico">
              <InfoIcon size={14} />
            </span>
            <span className="b3-helpbar-text">
              Precisa de ajuda? Em breve teremos vídeos curtos sobre{" "}
              <strong>produtos</strong>.
            </span>
          </div>

          <Suspense fallback={<div className="b3-tabs h-12" />}>
            <ProductsStatusTabs counts={tabCounts} />
          </Suspense>

          <Suspense fallback={<div className="b3-toolbar h-14" />}>
            <ProductsToolbar
              categories={filterCategories}
              rangeLabel={rangeLabel}
            />
          </Suspense>

          {products.length === 0 ? (
            <NoResults onlyPromo={onlyPromo} />
          ) : (
            <ProductsTable products={tableRows} />
          )}

          {totalPages > 1 ? (
            <div className="border-t border-line p-3">
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
      <h2 className="text-lg font-semibold text-ink-1">Comece sua vitrine</h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Cadastre seu primeiro produto. Depois você pode publicar quando
        quiser que apareça pros seus clientes.
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
      <h2 className="text-lg font-semibold text-ink-1">
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
