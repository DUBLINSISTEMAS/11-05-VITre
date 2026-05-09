/**
 * Página `/sucesso?code=A7K2` — confirmação pós-checkout.
 *
 * Server Component:
 *  - Resolve order pelo shortCode (service_role).
 *  - Verifica que pertence à loja do path (defesa contra link cruzado).
 *  - Reconstrói whatsappUrl a partir do snapshot + loja.
 *  - Renderiza Lottie + copy honesto + CTAs (Abrir WhatsApp + Ver pedido).
 *
 * Limpeza do carrinho acontece NO CLIENT (`SuccessClearCart`) — a
 * server action já criou o pedido; client só precisa apagar o
 * localStorage. Idempotência cobre se o cliente clicou 2× e gerou 2x.
 */
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderLottie } from "@/components/storefront/order-lottie";
import { SuccessClearCart } from "@/components/storefront/success-clear-cart";
import { WhatsAppOpenButton } from "@/components/storefront/whatsapp-open-button";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { formatBRL } from "@/lib/pricing";
import { buildPublicOrderWhatsAppMessage } from "@/lib/public-order";
import { getOrderByShortCode } from "@/lib/storefront/order-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import { buildWhatsAppUrl } from "@/lib/whatsapp-message";

export const metadata: Metadata = {
  title: "Pedido enviado",
  robots: { index: false, follow: false },
};

interface PageParams {
  storeSlug: string;
}

interface SearchParams {
  code?: string;
}

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams]);

  const code = sp.code?.trim();
  if (!code) redirect(`/${storeSlug}/sacola`);

  const [store, order] = await Promise.all([
    getStoreBySlug(storeSlug),
    getOrderByShortCode(code),
  ]);
  if (!store) notFound();
  if (!order || order.store.slug !== storeSlug) notFound();

  // Reconstrói whatsappUrl pra que cliente possa reabrir mesmo se
  // tab foi fechada e ele voltou via histórico.
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const message = buildPublicOrderWhatsAppMessage({
    storeName: order.store.name,
    shortCode: order.shortCode,
    publicUrl: `${baseUrl}/p/${order.publicToken}`,
    items: order.items.map((it) => ({
      productName: it.productNameSnapshot,
      variantName: it.variantNameSnapshot,
      quantity: it.quantity,
      priceInCents: it.priceInCentsSnapshot,
    })),
    totalInCents: order.totalInCents,
  });
  const whatsappUrl = buildWhatsAppUrl(order.store.whatsappNumber, message);

  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <SuccessClearCart />

      <OrderLottie />

      <h1 className="text-foreground mt-4 text-2xl font-semibold tracking-tight">
        Pedido enviado!
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Toque no botão abaixo para abrir uma conversa no WhatsApp com{" "}
        {order.store.name}. Você recebe a confirmação por lá.
      </p>

      <div className="bg-muted/40 mt-6 rounded-xl p-4 text-left">
        <div className="text-muted-foreground flex items-baseline justify-between text-xs uppercase tracking-wide">
          <span>Código do pedido</span>
          <span>Total</span>
        </div>
        <div className="text-foreground mt-1 flex items-baseline justify-between text-lg font-semibold tabular-nums">
          <span>#{order.shortCode}</span>
          <span>{formatBRL(order.totalInCents)}</span>
        </div>
      </div>

      <WhatsAppOpenButton
        publicToken={order.publicToken}
        whatsappUrl={whatsappUrl}
        className="mt-6"
      />

      <Button asChild variant="ghost" className="mt-2 w-full">
        <Link href={`/p/${order.publicToken}`} prefetch={false}>
          Ver detalhes do pedido
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Button>

      <p className="text-muted-foreground/70 mt-6 text-xs">
        Guarde este código. Você pode reabrir o pedido em qualquer momento
        em <span className="text-foreground font-mono">vitre.app/p/{order.publicToken}</span>.
      </p>
    </div>
  );
}
