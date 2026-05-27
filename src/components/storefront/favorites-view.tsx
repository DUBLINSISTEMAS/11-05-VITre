"use client";

/**
 * FavoritesView — Onda 7 (2026-05-27).
 *
 * Painel client da página /favoritos. Antes era a página inteira ("use client"
 * standalone), agora encapsulado pra que o page.tsx possa ser Server Component
 * que carrega store via getStoreBySlug + renderiza header próprio.
 *
 * UX:
 *  - Header sticky-title "Favoritos · {storeName}" + counter (mesmo padrão
 *    de /sacola pra consistência cross-tela).
 *  - Empty state: ilustração + CTA "Explorar vitrine" pra home.
 *  - Grid de cards 2/3/4 com Heart filled (clique remove direto).
 *  - "Limpar todos" no canto direito do header quando count > 0.
 */
import { Heart, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { FavoriteButton } from "@/components/storefront/favorite-button";
import { ProductCardSkeleton } from "@/components/storefront/skeletons";
import { StoreHeader } from "@/components/storefront/store-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Store } from "@/db/schema";
import { useFavorites } from "@/hooks/use-favorites";
import { formatBRL } from "@/lib/pricing";
import { plural, t } from "@/lib/storefront/i18n";

export interface FavoritesViewProps {
  store: Store;
}

export function FavoritesView({ store }: FavoritesViewProps) {
  const { items, isHydrated, count, clearFavorites } = useFavorites();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const counterLabel = isHydrated
    ? `${count} ${plural(count, t.cart.item, t.cart.items)}`.toUpperCase()
    : undefined;

  return (
    <>
      <StoreHeader
        variant="sticky-title"
        store={store}
        title="Favoritos"
        subtitle={store.name}
        counter={counterLabel}
      />

      <div className="mx-auto w-full max-w-screen-xl px-4 pt-4 lg:pt-6 pb-24 lg:pb-12">
        {!isHydrated ? (
          <HydratingSkeleton />
        ) : items.length === 0 ? (
          <EmptyState storeSlug={store.slug} />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                className="text-muted-foreground hover:text-destructive"
              >
                Limpar todos
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <FavoriteCard
                  key={item.productId}
                  item={item}
                  storeSlug={store.slug}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os favoritos?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai remover os {count}{" "}
              {plural(count, "item", "itens")} da sua lista. Não dá
              pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearFavorites();
                setConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function HydratingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-muted">
        <Heart className="size-12 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        {t.favorites.empty}
      </h2>
      <p className="mb-8 max-w-xs text-sm text-muted-foreground">
        {t.favorites.emptyDescription}
      </p>
      <Button
        asChild
        size="lg"
        className="gap-2 rounded-full bg-foreground text-background shadow-lg hover:brightness-110"
      >
        <Link href={`/${storeSlug}`}>
          <ShoppingBag className="size-4" />
          {t.nav.explore}
        </Link>
      </Button>
    </div>
  );
}

interface FavoriteCardProps {
  item: {
    productId: string;
    productSlug: string;
    productName: string;
    imageUrl: string | null;
    priceCents: number;
  };
  storeSlug: string;
}

function FavoriteCard({ item, storeSlug }: FavoriteCardProps) {
  return (
    <div className="group relative">
      <Link
        href={`/${storeSlug}/produto/${item.productSlug}`}
        className="flex flex-col gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.productName}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
              {t.product.noPhoto}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 px-0.5">
          <p className="truncate text-sm font-medium text-foreground">
            {item.productName}
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatBRL(item.priceCents)}
          </p>
        </div>
      </Link>

      <FavoriteButton
        product={{
          productId: item.productId,
          productSlug: item.productSlug,
          productName: item.productName,
          imageUrl: item.imageUrl,
          priceCents: item.priceCents,
        }}
        className="absolute right-2 top-2"
        size="sm"
      />
    </div>
  );
}
