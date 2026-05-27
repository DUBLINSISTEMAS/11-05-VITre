/**
 * Página /[storeSlug]/favoritos.
 *
 * Onda 7 (2026-05-27): refatorada de "use client" standalone pra Server
 * Component fino que carrega store + delega pro <FavoritesView> client.
 * Motivação: agora a página renderiza StoreHeader sticky-title próprio
 * ("Favoritos · {storeName}" + counter), mesmo padrão de /sacola.
 *
 * Antes era "use client" puro porque favoritos vivem em localStorage e a
 * página inteira precisava do hook useFavorites. Solução melhor: o page
 * carrega store no servidor, o panel cliente lida com a parte stateful.
 *
 * Metadata e noindex permanecem no layout.tsx adjacente.
 */
import { notFound } from "next/navigation";

import { FavoritesView } from "@/components/storefront/favorites-view";
import { getStoreBySlug } from "@/lib/storefront/store-loader";

interface PageParams {
  storeSlug: string;
}

export default async function FavoritosPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  return <FavoritesView store={store} />;
}
