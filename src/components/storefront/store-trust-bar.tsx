/**
 * StoreTrustBar — sinal de confiança discreto na home da loja online.
 *
 * Onda 3 (2026-05-27 — análise sênior): cliente que chega de WhatsApp/Insta
 * vê catálogo mas não tem prova de que a loja é "séria". Trust bar resolve
 * exibindo dados verificáveis do cadastro: cidade física + WhatsApp
 * clicável. Pattern Etsy/Shopify ("about this shop" compact).
 *
 * Render rules (todos os campos são opcionais):
 *  - Sem city E sem whatsapp → não renderiza (silenciosamente null).
 *  - Sem city → mostra só WhatsApp.
 *  - Sem whatsapp → mostra só localização.
 *  - Com ambos → MapPin · MessageCircle separados por bullet.
 *
 * Mobile: linha compacta single-row, scroll horizontal se overflow.
 * Desktop: mesmo layout, max-w-md centralizado.
 *
 * Server Component — não tem hooks, dados vêm do store loader.
 */
import { MapPin, MessageCircle } from "lucide-react";

import type { Store } from "@/db/schema";

export interface StoreTrustBarProps {
  store: Pick<
    Store,
    | "addressCity"
    | "addressState"
    | "whatsappNumber"
    | "whatsappDisplay"
    | "name"
  >;
}

function formatLocation(city: string | null, state: string | null): string | null {
  const c = city?.trim();
  const s = state?.trim();
  if (!c && !s) return null;
  return [c, s].filter(Boolean).join(", ");
}

export function StoreTrustBar({ store }: StoreTrustBarProps) {
  const location = formatLocation(store.addressCity, store.addressState);
  const hasWhatsApp = Boolean(store.whatsappNumber && store.whatsappDisplay);

  if (!location && !hasWhatsApp) return null;

  const waNumber = store.whatsappNumber.replace(/^\+/, "");
  const waMessage = encodeURIComponent(
    `Olá ${store.name}! Vi sua loja online e gostaria de tirar uma dúvida.`,
  );
  const waHref = `https://wa.me/${waNumber}?text=${waMessage}`;

  return (
    <div
      role="complementary"
      aria-label="Informações da loja"
      className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11.5px] font-medium"
    >
      {location && (
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
          <span>{location}</span>
        </span>
      )}
      {location && hasWhatsApp && (
        <span aria-hidden className="text-muted-foreground/40">
          ·
        </span>
      )}
      {hasWhatsApp && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-whatsapp hover:text-whatsapp-hover inline-flex items-center gap-1.5 rounded-md font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Abrir conversa no WhatsApp com ${store.name}`}
        >
          <MessageCircle
            className="size-3.5 shrink-0"
            strokeWidth={1.8}
            aria-hidden
          />
          <span>{store.whatsappDisplay}</span>
        </a>
      )}
    </div>
  );
}
