/**
 * Página `/sucesso?token=<publicToken>` — confirmação pós-checkout.
 *
 * Chave de URL = publicToken (32 chars opaco). NÃO use shortCode aqui:
 * shortCode tem 4 chars (~14M combos) e é adivinhável; atacante adivinha
 * código, abre /sucesso, e captura o publicToken renderizado.
 *
 * Redesign canvas-v1 fiel a `_vitre-storefront.jsx:457-515`:
 *  - Check 88×88 success-soft com SVG strokeWidth 2.4
 *  - Heading 24px display + sub 13px gray-600
 *  - Card resumo: kicker mono "PEDIDO" + #shortCode mono à direita
 *    (display apenas — shortCode continua exibido pra cliente)
 *  - Banner brand-tint inline com #shortCode mono
 *  - 2 CTAs: WhatsApp (verde) + "Continuar comprando" (outline)
 *  - Sem bottom-nav, sem header (controlados em shell-content.tsx)
 *
 * Server Component:
 *  - Resolve order pelo publicToken (service_role).
 *  - Verifica que pertence à loja do path (defesa contra link cruzado).
 *  - Reconstrói whatsappUrl a partir do snapshot + loja (cliente pode
 *    voltar via histórico mesmo se a tab original foi fechada).
 *
 * Limpeza do carrinho acontece NO CLIENT (`SuccessClearCart`) — a
 * server action já criou o pedido; client só apaga o localStorage.
 * Idempotência cobre se o cliente clicou 2× e gerou 2x.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { SuccessClearCart } from "@/components/storefront/success-clear-cart";
import { SuccessCtas } from "@/components/storefront/success-ctas";
import { env } from "@/lib/env";
import { searchTextSchema } from "@/lib/page-search-params";
import { formatBRL } from "@/lib/pricing";
import { buildPublicOrderWhatsAppMessage } from "@/lib/public-order";
import { getOrderByPublicToken } from "@/lib/storefront/order-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import { buildWhatsAppUrl } from "@/lib/whatsapp-message";

export const metadata: Metadata = {
  title: "Pedido enviado",
  robots: { index: false, follow: false },
};

interface PageParams {
  storeSlug: string;
}

const sucessoSearchSchema = z.object({
  token: searchTextSchema,
});

// Mapeamento status → label PT-BR (canvas usa "Aguardando contato"
// pra awaiting_whatsapp; demais derivamos do enum).
const STATUS_LABELS: Record<string, string> = {
  awaiting_whatsapp: "Aguardando contato",
  confirmed: "Confirmado",
  fulfilled: "Concluído",
  canceled: "Cancelado",
  expired: "Expirado",
};

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams]);

  const { token } = sucessoSearchSchema.parse(sp);
  if (!token) redirect(`/${storeSlug}/sacola`);

  const [store, order] = await Promise.all([
    getStoreBySlug(storeSlug),
    getOrderByPublicToken(token),
  ]);
  if (!store) notFound();
  if (!order || order.store.slug !== storeSlug) notFound();

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

  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);
  const itemsLabel = `${itemCount} ${itemCount === 1 ? "item" : "itens"}`;
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col px-6 pb-6 pt-[90px]">
      <SuccessClearCart />

      {/* Check icon — 88×88 success-soft */}
      <span
        aria-hidden
        className="mx-auto inline-flex size-[88px] items-center justify-center rounded-full bg-success-soft text-success"
      >
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>

      <h1 className="mt-[22px] text-center text-[24px] font-semibold leading-[1.15] tracking-[-0.5px] text-foreground">
        Pedido enviado para o WhatsApp
      </h1>
      <p className="mt-2 text-center text-[13px] text-gray-600 [text-wrap:pretty]">
        {order.store.name} já recebeu seu pedido. Continue a conversa pra combinar pagamento e entrega.
      </p>

      {/* Card resumo */}
      <div className="mt-7 rounded-[14px] border border-border bg-background p-4">
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.5px] text-gray-500">
            PEDIDO
          </span>
          <span className="font-mono text-[12px] font-semibold tracking-[0.5px] text-foreground">
            #{order.shortCode}
          </span>
        </div>
        <SummaryRow label={itemsLabel} value={formatBRL(order.totalInCents)} />
        <SummaryRow label="Atendido por" value={order.store.name} />
        <SummaryRow label="Status" value={statusLabel} />
      </div>

      {/* Banner brand-tint */}
      <div className="mt-[22px] rounded-[12px] bg-brand-tint px-3.5 py-3.5 text-[11.5px] leading-[1.55] text-gray-700">
        Salve o pedido{" "}
        <span className="font-mono font-semibold">#{order.shortCode}</span> — você pode usá-lo pra
        acompanhar status mesmo sem cadastro.
      </div>

      <SuccessCtas
        publicToken={order.publicToken}
        whatsappUrl={whatsappUrl}
        storeSlug={storeSlug}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-[5px] text-[12px]">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
