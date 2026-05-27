/**
 * Página `/sucesso?token=<publicToken>` — confirmação pós-checkout.
 *
 * Chave de URL = publicToken (32 chars opaco). NÃO use shortCode aqui:
 * shortCode tem 4 chars (~14M combos) e é adivinhável; atacante adivinha
 * código, abre /sucesso, e captura o publicToken renderizado.
 *
 * Redesign 2026-05-27 (Onda D ref Dribbble 1 tela 3): formato "order
 * summary" com status pill, card de atendimento, lista de itens com
 * thumbnail e tabela de totais. Substitui o layout antigo de
 * confirmação simples (check + 2 linhas) — agora o cliente vê o que
 * pediu, valor total e canal de atendimento numa view só.
 *
 * Server Component:
 *  - Resolve order pelo publicToken (service_role).
 *  - Verifica que pertence à loja do path (defesa contra link cruzado).
 *  - Reconstrói whatsappUrl a partir do snapshot + loja.
 *
 * Limpeza do carrinho acontece NO CLIENT (`SuccessClearCart`).
 */
import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { z } from "zod";

import { CopyCodeButton } from "@/components/storefront/copy-code-button";
import { StoreHeader } from "@/components/storefront/store-header";
import { SuccessClearCart } from "@/components/storefront/success-clear-cart";
import { SuccessCtas } from "@/components/storefront/success-ctas";
import { WhatsAppAutoHandoff } from "@/components/storefront/whatsapp-auto-handoff";
import { env } from "@/lib/env";
import { boolFlagSchema, searchTextSchema } from "@/lib/page-search-params";
import { formatBRL } from "@/lib/pricing";
import { buildPublicOrderWhatsAppMessage } from "@/lib/public-order";
import { getOrderByPublicToken } from "@/lib/storefront/order-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp-message";

export const metadata: Metadata = {
  title: "Resumo do pedido",
  robots: { index: false, follow: false },
};

interface PageParams {
  storeSlug: string;
}

const sucessoSearchSchema = z.object({
  token: searchTextSchema,
  auto: boolFlagSchema,
});

// Status badge: cada status do enum vira pill colorido. Verde =
// "tudo certo / em andamento". Âmbar = "ação pendente". Vermelho =
// "ruim". Cinza = "encerrado".
const STATUS_CONFIG: Record<
  string,
  { label: string; tone: "success" | "warning" | "muted" | "destructive" }
> = {
  awaiting_whatsapp: { label: "Aguardando contato", tone: "success" },
  confirmed: { label: "Confirmado", tone: "success" },
  fulfilled: { label: "Concluído", tone: "muted" },
  canceled: { label: "Cancelado", tone: "destructive" },
  expired: { label: "Expirado", tone: "muted" },
};

const TONE_CLASS: Record<string, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground",
  muted: "bg-muted text-muted-foreground",
  destructive: "bg-destructive-soft text-destructive",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ storeSlug }, sp] = await Promise.all([params, searchParams]);

  const { token, auto } = sucessoSearchSchema.parse(sp);
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
    customerName: order.customerName,
    customerNotes: order.customerNotes,
    whatsappTemplate: order.store.whatsappTemplate,
    paymentMethodsNote: order.store.paymentMethodsNote,
  });
  const whatsappUrl = buildWhatsAppUrl(order.store.whatsappNumber, message);

  const subtotalInCents = order.items.reduce(
    (sum, it) => sum + it.priceInCentsSnapshot * it.quantity,
    0,
  );
  const discountInCents = Math.max(0, subtotalInCents - order.totalInCents);

  const statusCfg =
    STATUS_CONFIG[order.status] ?? { label: order.status, tone: "muted" as const };

  const orderDate = DATE_FORMATTER.format(new Date(order.createdAt));
  // Onda 4 (2026-05-27): usa `store` atual (não `order.store` snapshot)
  // pro endereço — se a loja mudou de endereço entre o pedido e a tela
  // de confirmação, o cliente vê o atual. Address snapshot na order é
  // pra integridade fiscal/jurídica, não pra retirada.
  const storeAddress = formatStoreAddress(store);
  const mapsUrl = buildGoogleMapsUrl(store);

  // Auto-handoff só dispara quando:
  //  (a) Checkout passou `?auto=1`.
  //  (b) Pedido ainda não foi aberto no WhatsApp.
  const shouldAutoHandoff = auto && !order.whatsappOpenedAt;

  return (
    <>
      <StoreHeader
        variant="sticky-title"
        store={store}
        title="Resumo do pedido"
        subtitle={store.name}
      />

      <div className="mx-auto w-full max-w-screen-md px-4 pb-32 pt-3 lg:px-0">
        <SuccessClearCart />

        {shouldAutoHandoff ? (
          <WhatsAppAutoHandoff
            publicToken={order.publicToken}
            whatsappUrl={whatsappUrl}
          />
        ) : null}

        {/* Status card — ref Dribbble 1 tela 3 (status pill colorido +
            código de pedido + nome da loja). */}
        <section className="rounded-[18px] border border-border bg-background p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "inline-flex h-7 items-center rounded-full px-2.5 text-[11.5px] font-semibold uppercase tracking-[0.4px]",
                TONE_CLASS[statusCfg.tone],
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mr-1.5 inline-block size-1.5 rounded-full",
                  statusCfg.tone === "success" ? "bg-success" : "bg-current opacity-60",
                )}
              />
              {statusCfg.label}
            </span>
            <span className="text-muted-foreground font-mono text-[12px] font-semibold tracking-[0.4px]">
              #{order.shortCode}
            </span>
          </div>

          <h2 className="mt-3.5 text-[12px] font-medium uppercase tracking-[0.4px] text-muted-foreground">
            Atendido por
          </h2>
          <p className="mt-1 text-[15px] font-semibold tracking-[-0.2px] text-foreground">
            {order.store.name}
          </p>
          {storeAddress || mapsUrl ? (
            <div className="mt-1 space-y-1">
              {storeAddress ? (
                <p className="text-muted-foreground text-[12px] leading-snug whitespace-pre-line">
                  {storeAddress}
                </p>
              ) : null}
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/80 hover:text-foreground inline-flex items-center gap-1 text-[11.5px] font-semibold underline-offset-2 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-label="Abrir endereço da loja no Google Maps"
                >
                  <MapPin className="size-3.5" strokeWidth={1.8} aria-hidden />
                  Abrir no Google Maps
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Lista de itens — ref 1 mostra produto com foto, nome, size,
            preço alinhado direita. */}
        <section className="mt-4 rounded-[18px] border border-border bg-background">
          <h2 className="border-b border-border/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
            Seu pedido
          </h2>
          <ul role="list" className="divide-y divide-border/60">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3 p-3.5">
                <div className="bg-muted relative h-[68px] w-[60px] shrink-0 overflow-hidden rounded-xl">
                  {item.imageUrlSnapshot ? (
                    <Image
                      src={item.imageUrlSnapshot}
                      alt={item.productNameSnapshot}
                      fill
                      sizes="60px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-[9px] text-muted-foreground">
                      sem foto
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <p className="line-clamp-2 text-[13.5px] font-semibold leading-[1.25] tracking-[-0.2px] text-foreground">
                      {item.productNameSnapshot}
                    </p>
                    {item.variantNameSnapshot ? (
                      <p className="text-muted-foreground mt-1 text-[11.5px]">
                        {item.variantNameSnapshot}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground mt-0.5 text-[11.5px]">
                      Qtd: {item.quantity}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 self-start text-[14px] font-semibold tabular-nums text-foreground">
                  {formatBRL(item.priceInCentsSnapshot * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Tabela de totais — ref 1 tela 3 (Order date, Payment, Subtotal,
            Total). Removido Tax e Shipping (Mangos Pay não calcula —
            combinado no WhatsApp). */}
        <section className="mt-4 rounded-[18px] border border-border bg-background p-4">
          <TotalsRow label="Data do pedido" value={orderDate} />
          <TotalsRow label="Atendimento" value="WhatsApp" />
          <TotalsRow
            label="Subtotal"
            value={formatBRL(subtotalInCents)}
            mono
          />
          {discountInCents > 0 ? (
            <TotalsRow
              label="Desconto"
              value={`−${formatBRL(discountInCents)}`}
              tone="success"
              mono
            />
          ) : null}
          <div className="mt-2 border-t border-border pt-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-foreground">
                Total
              </span>
              <span className="font-mono text-[20px] font-bold tabular-nums tracking-[-0.3px] text-foreground">
                {formatBRL(order.totalInCents)}
              </span>
            </div>
          </div>
        </section>

        {/* Aviso brand-tint com ação concreta de copiar (Onda 3 → 28).
            Onda 28: copy mais curta — "Use o código #X pra acompanhar
            depois" é direto, sem patronizar com "mesmo sem cadastro". */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] bg-brand-tint px-3.5 py-3">
          <p className="text-foreground/85 text-[11.5px] leading-snug">
            Use o código{" "}
            <span className="text-foreground font-mono font-semibold">
              #{order.shortCode}
            </span>{" "}
            pra acompanhar este pedido depois.
          </p>
          <CopyCodeButton code={order.shortCode} />
        </div>
      </div>

      {/* CTAs fixed bottom — pill grande "Acompanhar pelo WhatsApp" +
          ghost "Voltar pra loja". Sem bottom-nav nessa página. */}
      <SuccessCtas
        publicToken={order.publicToken}
        whatsappUrl={whatsappUrl}
        storeSlug={storeSlug}
      />
    </>
  );
}

function TotalsRow({
  label,
  value,
  mono = false,
  tone = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "success";
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          mono && "font-mono",
          tone === "success" ? "font-semibold text-success" : "font-medium text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Formata o endereço da loja em até 2 linhas:
 *   Linha 1: Rua, Número
 *   Linha 2: Bairro · Cidade — UF
 * Onda 4 (2026-05-27): ampliado de city/state pra incluir street/number/
 * neighborhood. Cliente precisa do endereço completo pra retirada presencial.
 */
function formatStoreAddress(store: {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
}): string | null {
  const street = store.addressStreet?.trim();
  const number = store.addressNumber?.trim();
  const neighborhood = store.addressNeighborhood?.trim();
  const city = store.addressCity?.trim();
  const state = store.addressState?.trim();

  const line1Parts = [street, number].filter(Boolean);
  const line1 = line1Parts.join(", ");

  const cityState = [city, state].filter(Boolean).join(" — ");
  const line2 = [neighborhood, cityState].filter(Boolean).join(" · ");

  const lines = [line1, line2].filter(Boolean);
  if (lines.length === 0) return null;
  return lines.join("\n");
}

/**
 * Constrói URL do Google Maps. Prefere `googleMapsUrl` custom do lojista
 * (link de Place ID, mais preciso). Fallback: query string com endereço
 * completo. Retorna null se sem dado mínimo (sem city E sem street).
 */
function buildGoogleMapsUrl(store: {
  googleMapsUrl?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
}): string | null {
  const custom = store.googleMapsUrl?.trim();
  if (custom) return custom;

  const parts = [
    store.addressStreet,
    store.addressNumber,
    store.addressNeighborhood,
    store.addressCity,
    store.addressState,
  ]
    .map((p) => p?.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  // Só linka pro Maps se há cidade OU rua mínima (resto sozinho não acha).
  if (!store.addressCity?.trim() && !store.addressStreet?.trim()) return null;

  const query = encodeURIComponent(parts.join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
