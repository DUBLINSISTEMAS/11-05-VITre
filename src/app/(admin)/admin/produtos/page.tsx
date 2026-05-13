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
import { PackageIcon, PlusIcon, SearchXIcon } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";

import type { CategoryOption } from "@/components/admin/category-dialog";
import { ProductCreateButton } from "@/components/admin/product-create-button";
import { ProductsErrorToast } from "@/components/admin/products-error-toast";
import { ProductsFilters } from "@/components/admin/products-filters";
import { ProductsStatusTabs } from "@/components/admin/products-status-tabs";
import {
  ProductsTable,
  type ProductTableRow,
} from "@/components/admin/products-table";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
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

  // ---- WHERE base (storeId + busca + categoria + promo) ----
  const baseConditions: SQL[] = [eq(productTable.storeId, store.id)];
  if (q) {
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    baseConditions.push(ilike(productTable.name, `%${safeQ}%`));
  }
  if (categoryId) {
    baseConditions.push(eq(productTable.categoryId, categoryId));
  }
  if (onlyPromo) {
    const now = sql`now()`;
    baseConditions.push(isNotNull(productTable.promoPriceInCents));
    const startCond = or(
      isNull(productTable.promoStartsAt),
      lte(productTable.promoStartsAt, now),
    );
    const endCond = or(
      isNull(productTable.promoEndsAt),
      gte(productTable.promoEndsAt, now),
    );
    if (startCond) baseConditions.push(startCond);
    if (endCond) baseConditions.push(endCond);
  }

  // ---- Status conditions (separadas pra permitir count por aba) ----
  // Aba "Todos" (s === null) exclui rascunhos por padrão — drafts órfãos
  // (legado pré-fix d0c5804 + escapes) só aparecem quando lojista clica
  // na aba "Rascunho" explicitamente. Antes, drafts apareciam misturados
  // e o lojista via "produto fantasma" surgindo do nada na lista.
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

  const whereClause = and(...baseConditions, ...statusConditions(statusFilter));

  // ---- Fetch paralelo: lista + total + categorias da loja + capas ----
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

    // SÉRIE dentro do tx — `pg` deprecou queries paralelas no mesmo
    // client. Cada count com index é ~1ms; 8 queries totais ~8-12ms.
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
        trackStock: true,
        stockQuantity: true,
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

    const tabCounts = {
      all: cAll[0]?.value ?? 0,
      active: cActive[0]?.value ?? 0,
      inactive: cInactive[0]?.value ?? 0,
      draft: cDraft[0]?.value ?? 0,
      "no-stock": cNoStock[0]?.value ?? 0,
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

  const hasFilters =
    q !== "" || !!categoryId || statusFilter !== null || onlyPromo;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (categoryId) usp.set("categoryId", categoryId);
    if (statusFilter) usp.set("status", statusFilter);
    if (onlyPromo) usp.set("promo", "1");
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  // ---- Mapear pra ProductTableRow ----
  const tableRows: ProductTableRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    basePriceInCents: p.basePriceInCents,
    promoPriceInCents: p.promoPriceInCents,
    promoStartsAt: p.promoStartsAt,
    promoEndsAt: p.promoEndsAt,
    isActive: p.isActive,
    trackStock: p.trackStock,
    stockQuantity: p.stockQuantity,
    cover: coversByProduct.get(p.id) ?? null,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Produtos"
        subtitle={renderCountLabel(total, hasFilters)}
        actions={<ProductCreateButton />}
      />

      {/* Suspense boundary obrigatório: ambos componentes usam useSearchParams().
          Convenção CLAUDE.md #9. Fallback mantém altura pra evitar layout shift. */}
      <Suspense fallback={null}>
        <ProductsErrorToast />
      </Suspense>

      <Suspense fallback={<div className="bg-muted/30 h-10 animate-pulse rounded-md" />}>
        <ProductsStatusTabs counts={tabCounts} />
      </Suspense>

      <Suspense fallback={<div className="bg-muted/30 h-10 animate-pulse rounded-md" />}>
        <ProductsFilters categories={filterCategories} />
      </Suspense>

      {products.length === 0 ? (
        hasFilters ? (
          <NoResults onlyPromo={onlyPromo} />
        ) : (
          <EmptyState />
        )
      ) : (
        <>
          <ProductsTable products={tableRows} />

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            buildHref={buildHref}
          />
        </>
      )}
    </div>
  );
}

function renderCountLabel(total: number, filtered: boolean): string {
  if (total === 0) {
    return filtered ? "Nenhum produto bate com os filtros." : "Nenhum produto ainda.";
  }
  const word = total === 1 ? "produto" : "produtos";
  return filtered ? `${total} ${word} encontrado${total === 1 ? "" : "s"}` : `${total} ${word}`;
}

function EmptyState() {
  return (
    <div className="border-border/60 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
        <PackageIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">Comece sua vitrine</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Cadastre seu primeiro produto. Depois você pode publicar quando
        quiser que apareça pros seus clientes.
      </p>
      <ProductCreateButton className="mt-2">
        <PlusIcon /> Cadastrar primeiro produto
      </ProductCreateButton>
    </div>
  );
}

function NoResults({ onlyPromo }: { onlyPromo: boolean }) {
  return (
    <div className="border-border/60 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">
        {onlyPromo ? "Nenhum produto em promoção agora" : "Nada por aqui"}
      </h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        {onlyPromo
          ? "Quando você definir um preço promocional num produto, ele aparece aqui."
          : "Tente outros termos de busca ou limpe os filtros."}
      </p>
    </div>
  );
}
