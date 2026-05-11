/**
 * Layout do segmento /favoritos.
 *
 * Existe apenas pra carregar metadata `noindex`. A página é `"use client"`
 * (favoritos vivem em localStorage; sem dado server-side), então não pode
 * exportar `metadata` direto. Em Next 15 metadata vive em RSC, não client.
 *
 * `noindex`: lista é privada por dispositivo, sem valor SEO. Google
 * indexaria página vazia ou personalizada — ruim em ambos os casos.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Favoritos",
  robots: { index: false, follow: false },
};

export default function FavoritosLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
