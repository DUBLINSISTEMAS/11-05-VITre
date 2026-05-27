/**
 * Página de coleção customizável (ADR-0031 / Frente C).
 *
 * Server Component:
 *  - Resolve store + collection. 404 se loja inexistente, coleção inativa
 *    ou se pertence a outra loja.
 *  - Lista produtos da coleção via `loadCollectionBySlug` (ordem `position`
 *    salva pelo admin). Sem filtros/paginação — coleção é curada.
 *  - Header `<StoreHeader variant="category">` reutiliza visual da rota
 *    de categoria (mesma identidade de listagem).
 *  - Sem `generateStaticParams` — coleções variam por loja e mudam com
 *    frequência; ISR via `revalidateTag('store-${slug}')` em mutações
 *    do admin é suficiente.
 *
 * Robots / SEO:
 *  - Sempre indexável (não há paginação que possa gerar duplicate).
 *  - Canonical absoluto em `NEXT_PUBLIC_APP_URL`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductGrid } from "@/components/storefront/product-grid";
import { StoreHeader } from "@/components/storefront/store-header";
import { env } from "@/lib/env";
import { loadCollectionBySlug } from "@/lib/storefront/collection-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import type { ProductCardVariant } from "@/lib/storefront/themes";

interface PageParams {
  storeSlug: string;
  collectionSlug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { storeSlug, collectionSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) return { title: "Não encontrado" };
  const collection = await loadCollectionBySlug(
    store.slug,
    store.id,
    collectionSlug,
  );
  if (!collection) return { title: "Coleção não encontrada" };

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const canonical = `${baseUrl}/${storeSlug}/colecao/${collectionSlug}`;

  return {
    title: collection.name,
    description:
      collection.description ?? `Coleção ${collection.name} — ${store.name}.`,
    alternates: { canonical },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { storeSlug, collectionSlug } = await params;

  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const collection = await loadCollectionBySlug(
    store.slug,
    store.id,
    collectionSlug,
  );
  if (!collection) notFound();

  return (
    <>
      {/* Onda 19 (2026-05-27): counter "X PEÇAS" removido — header limpo,
          coleção respira sem competição visual. */}
      <StoreHeader
        variant="category"
        store={store}
        kicker="COLEÇÃO"
        title={collection.name}
      />

      {/* pb-44 mobile reserva safe-zone pro MiniCartBar (h-14) +
          BottomNav (~76px) empilhados. Desktop pb-12 (sem mini-cart). */}
      <div className="px-4 pb-44 pt-1 lg:pb-12">
        {collection.items.length === 0 ? (
          <div className="text-muted-foreground bg-muted/30 rounded-2xl px-6 py-12 text-center text-sm">
            <p className="text-base font-medium">Coleção vazia</p>
            <p className="text-muted-foreground/80 mt-1">
              Sem produtos publicados no momento.
            </p>
          </div>
        ) : (
          <ProductGrid
            storeSlug={store.slug}
            products={collection.items}
            priorityFirst
            priorityCount={1}
            variant={store.productCardStyle as ProductCardVariant}
          />
        )}
      </div>
    </>
  );
}
