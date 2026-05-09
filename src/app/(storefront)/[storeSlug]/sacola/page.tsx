/**
 * Página /sacola — checkout simplificado.
 *
 * Server Component RSC que resolve store e delega o conteúdo pro
 * `CheckoutPanel` client. O form (nome, WhatsApp, email opcional,
 * notas) e a leitura do carrinho vivem no client.
 *
 * Fluxo: usuário revisa itens → preenche dados → "Finalizar pelo
 * WhatsApp" → server action `createOrderFromCart` (Bloco C) → redirect
 * /sucesso → wa.me da Sandra.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CheckoutPanel } from "@/components/storefront/checkout-panel";
import { getStoreBySlug } from "@/lib/storefront/store-loader";

export const metadata: Metadata = {
  title: "Finalizar pedido",
  robots: { index: false, follow: false },
};

export default async function SacolaPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  return (
    <CheckoutPanel
      storeSlug={store.slug}
      storeName={store.name}
      whatsappDisplay={store.whatsappDisplay}
    />
  );
}
