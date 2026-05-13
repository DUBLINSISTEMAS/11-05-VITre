/**
 * Página pública de pedido por publicToken (`/p/{24-char token}`).
 *
 * Função real (ADR-0010): fallback de continuidade — cliente perdeu
 * conversa no WhatsApp, precisa reabrir; ou lojista mandou link pra
 * referência. NÃO é tracking de status (cliente não atualiza pedido).
 *
 * Privacidade: NÃO mostra nome/whatsapp/notas do cliente. Risco de
 * leak por compartilhamento (cliente envia pra mãe pra mostrar look).
 * Mostra: logo + nome da loja + itens + total + status + código curto +
 * botão wa.me da loja.
 *
 * `noindex`: Google não indexa. Robots.txt complementa com Disallow: /p/.
 */
import { CheckCircle2, X } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { WhatsAppOpenButton } from "@/components/storefront/whatsapp-open-button";
import { env } from "@/lib/env";
import { formatBRL } from "@/lib/pricing";
import { buildPublicOrderWhatsAppMessage } from "@/lib/public-order";
import { getOrderByPublicToken } from "@/lib/storefront/order-loader";
import { buildWhatsAppUrl } from "@/lib/whatsapp-message";

interface PageParams {
  token: string;
}

export const metadata: Metadata = {
  title: "Pedido",
  robots: { index: false, follow: false },
};

export default async function PublicOrderPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { token } = await params;
  const order = await getOrderByPublicToken(token);
  if (!order) notFound();

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  // PII GATE: /p/[token] é link compartilhável. NÃO pode embedar
  // customerName/customerNotes na mensagem — quem clicar gera um
  // wa.me com PII de outro cliente. Mensagem genérica ("Sou cliente.").
  // Template do lojista é aplicado mesmo aqui — só os placeholders
  // PII ficam genéricos. Test guard: tests/public-order.test.ts L22.
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
    whatsappTemplate: order.store.whatsappTemplate,
  });
  const whatsappUrl = buildWhatsAppUrl(order.store.whatsappNumber, message);

  // Status human-readable.
  const statusInfo = getStatusInfo(order.status);

  // Brand color via inline style — esta página NÃO está dentro do
  // StoreShell, então re-injetamos manualmente. Hoje a página não tem
  // bottom-nav nem badge de sacola, então o escopo de --brand-store é
  // inerte aqui — mantemos por consistência caso futuro reuse algum
  // componente do storefront que dependa do token.
  const brandStyle = {
    "--brand-store": order.store.primaryColor,
  } as React.CSSProperties;

  return (
    <div
      className="bg-background text-foreground min-h-dvh"
      style={brandStyle}
    >
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <header className="border-border/60 flex items-center gap-3 border-b pb-4">
          <Link
            href={`/${order.store.slug}`}
            prefetch={false}
            className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            aria-label={`Voltar para ${order.store.name}`}
          >
            {order.store.logoUrl ? (
              <Image
                src={order.store.logoUrl}
                alt={order.store.name}
                width={100}
                height={28}
                className="h-7 w-auto object-contain"
              />
            ) : (
              <span className="text-foreground font-semibold tracking-tight">
                {order.store.name}
              </span>
            )}
          </Link>
        </header>

        <section className="mt-6 space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Pedido
          </p>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight tabular-nums">
            #{order.shortCode}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="text-muted-foreground text-sm">
              {statusInfo.label}
            </span>
          </div>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
            Itens
          </h2>
          <ul className="border-border/60 divide-border/60 divide-y rounded-xl border" role="list">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3 p-4">
                <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg">
                  {item.imageUrlSnapshot ? (
                    <Image
                      src={item.imageUrlSnapshot}
                      alt={item.productNameSnapshot}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground/50 grid h-full place-items-center text-[10px]">
                      Sem foto
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground line-clamp-2 text-sm font-medium leading-snug">
                    {item.productNameSnapshot}
                  </p>
                  {item.variantNameSnapshot && (
                    <p className="text-muted-foreground text-xs">
                      {item.variantNameSnapshot}
                    </p>
                  )}
                  <div className="text-muted-foreground mt-1 flex items-baseline justify-between text-sm">
                    <span>
                      {item.quantity}× {formatBRL(item.priceInCentsSnapshot)}
                    </span>
                    <span className="text-foreground font-semibold tabular-nums">
                      {formatBRL(item.priceInCentsSnapshot * item.quantity)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border/60 mt-6 flex items-baseline justify-between border-t pt-4">
          <span className="text-foreground text-sm font-medium">Total</span>
          <span className="text-foreground text-2xl font-semibold tabular-nums">
            {formatBRL(order.totalInCents)}
          </span>
        </section>

        {order.status === "awaiting_whatsapp" && (
          <div className="mt-6">
            <WhatsAppOpenButton
              publicToken={order.publicToken}
              whatsappUrl={whatsappUrl}
            >
              Abrir conversa no WhatsApp
            </WhatsAppOpenButton>
          </div>
        )}

        {(order.status === "confirmed" || order.status === "fulfilled") && (
          <div className="bg-success/10 text-foreground mt-6 flex items-start gap-3 rounded-lg p-4 text-sm">
            <CheckCircle2 className="text-success size-5 shrink-0" aria-hidden />
            <p>{statusInfo.description}</p>
          </div>
        )}

        {(order.status === "canceled" || order.status === "expired") && (
          <div className="bg-muted/50 text-muted-foreground mt-6 flex items-start gap-3 rounded-lg p-4 text-sm">
            <X className="size-5 shrink-0" aria-hidden />
            <p>{statusInfo.description}</p>
          </div>
        )}

        <p className="text-muted-foreground/70 mt-8 text-center text-xs">
          Compartilhe esta página apenas com {order.store.name}.<br />
          Detalhes pessoais ficam só no seu WhatsApp.
        </p>
      </div>
    </div>
  );
}

function getStatusInfo(
  status: import("@/db/schema").Order["status"],
): { label: string; description: string } {
  switch (status) {
    case "awaiting_whatsapp":
      return {
        label: "Aguardando confirmação no WhatsApp",
        description: "",
      };
    case "confirmed":
      return {
        label: "Confirmado",
        description:
          "Pedido confirmado. Combine entrega e pagamento pelo WhatsApp.",
      };
    case "fulfilled":
      return {
        label: "Concluído",
        description: "Pedido entregue. Obrigado!",
      };
    case "canceled":
      return {
        label: "Cancelado",
        description: "Este pedido foi cancelado.",
      };
    case "expired":
      return {
        label: "Expirado",
        description: "Este pedido expirou. Faça um novo se quiser repetir.",
      };
    default:
      return { label: status, description: "" };
  }
}
