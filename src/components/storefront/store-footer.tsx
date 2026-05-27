/**
 * Footer do storefront. Server Component — sem JS no client.
 *
 * Mostra info da loja: nome, descrição opcional, links pra contato
 * (WhatsApp, Instagram, Maps), e link "Sobre" pra página dedicada (Bloco D).
 *
 * "Powered by Mangos Pay" sutil — marketing involuntário sem competir com a
 * marca da lojista. Quando virar plano pago (Fase 3), pode ficar opcional.
 */
import { Heart, Instagram, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";

import type { Store } from "@/db/schema";

export interface StoreFooterProps {
  store: Store;
}

export function StoreFooter({ store }: StoreFooterProps) {
  const baseHref = `/${store.slug}`;
  const addressLine = [
    store.addressStreet,
    store.addressNumber,
    store.addressNeighborhood,
  ]
    .filter(Boolean)
    .join(", ");
  const cityLine = [store.addressCity, store.addressState]
    .filter(Boolean)
    .join(" / ");
  const fullAddress = [addressLine, cityLine].filter(Boolean).join(" — ");

  const waNumber = store.whatsappNumber.replace(/\D/g, "");
  const igHandle = store.instagramHandle?.replace(/^@/, "");

  return (
    <footer className="border-border/60 bg-muted/30 mt-12 border-t">
      <div className="mx-auto w-full max-w-screen-xl space-y-6 px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-foreground text-base font-semibold">
              {store.name}
            </h2>
            {store.description && (
              <p className="text-muted-foreground line-clamp-3 text-sm">
                {store.description}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Link
                href={`${baseHref}/sobre`}
                prefetch={false}
                className="text-primary hocus:underline inline-block text-sm font-medium underline-offset-2"
              >
                Sobre a loja
              </Link>
              {/* Sprint 5.2 — link pro formulário público de contato. */}
              <Link
                href={`${baseHref}/contato`}
                prefetch={false}
                className="text-primary hocus:underline inline-block text-sm font-medium underline-offset-2"
              >
                Fale conosco
              </Link>
              {/* Onda 7 (2026-05-27): descoberta secundária pra favoritos.
                  Header da home tem ícone Heart (acesso direto); footer
                  fica como rede de segurança pro cliente que já desceu. */}
              <Link
                href={`${baseHref}/favoritos`}
                prefetch={false}
                className="text-primary hocus:underline inline-flex items-center gap-1.5 text-sm font-medium underline-offset-2"
              >
                <Heart className="size-3.5" aria-hidden />
                Meus favoritos
              </Link>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {waNumber && (
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hocus:text-primary flex items-center gap-2 transition-colors"
              >
                <MessageCircle className="size-4 shrink-0" aria-hidden />
                <span>{store.whatsappDisplay}</span>
              </a>
            )}
            {igHandle && (
              <a
                href={`https://instagram.com/${igHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hocus:text-primary flex items-center gap-2 transition-colors"
              >
                <Instagram className="size-4 shrink-0" aria-hidden />
                <span>@{igHandle}</span>
              </a>
            )}
            {fullAddress && (
              <div className="text-muted-foreground flex items-start gap-2">
                <MapPin
                  className="size-4 shrink-0 translate-y-0.5"
                  aria-hidden
                />
                {store.googleMapsUrl ? (
                  <a
                    href={store.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hocus:text-primary transition-colors"
                  >
                    {fullAddress}
                  </a>
                ) : (
                  <span>{fullAddress}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-border/60 text-muted-foreground flex flex-col items-start justify-between gap-2 border-t pt-4 text-xs sm:flex-row sm:items-center">
          <span>
            © {new Date().getFullYear()} {store.name}. Todos os direitos
            reservados.
          </span>
          <a
            href="https://vitre.site"
            target="_blank"
            rel="noopener noreferrer"
            className="hocus:text-foreground transition-colors"
          >
            Powered by Mangos Pay
          </a>
        </div>
      </div>
    </footer>
  );
}
