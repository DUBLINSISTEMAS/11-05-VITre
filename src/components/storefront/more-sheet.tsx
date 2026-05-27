"use client";

/**
 * MoreSheet — bottom-sheet acionado pelo tab "Mais" do bottom-nav.
 *
 * Conteúdo:
 *   - Saudação com nome da loja
 *   - Links: Sobre, Falar conosco (formulário), WhatsApp direto da loja
 *   - Footer: link discreto "Sistema Mangos Pay"
 *
 * Por que sheet (não dropdown)? Mobile-first: cliente clica num tab que
 * está no bottom da tela; sheet bottom-up é gesto natural pro polegar
 * (Fitts: alvo dispara no mesmo plano onde o dedo está). Dropdown vira
 * ergonômico ruim. Estilo padrão dos apps modernos (ref Dribbble 1).
 *
 * Sem React Query, sem fetch — recebe `store` como prop, renderiza
 * estático. Open/close controlados pelo BottomNav via callback.
 */
import {
  ExternalLinkIcon,
  InfoIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
} from "lucide-react";
import Link from "next/link";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Store } from "@/db/schema";
import { cn } from "@/lib/utils";

export interface MoreSheetProps {
  store: Store;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoreSheet({ store, open, onOpenChange }: MoreSheetProps) {
  const baseHref = `/${store.slug}`;
  const whatsappNumber = store.whatsappNumber?.replace(/^\+/, "") ?? "";
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Oi, ${store.name}! Vim pela loja online.`,
      )}`
    : null;

  // Endereço de exibição: rua + cidade quando preenchidos. Storefront
  // não tem geolocalização — é apenas informativo pro cliente saber
  // onde retirar caso ofereça pickup.
  const address = formatAddress(store);

  function close() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-background max-h-[85vh] rounded-t-3xl border-0 p-0 pt-2"
      >
        {/* Handle bar — pista visual de "puxe pra fechar". */}
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-gray-300" aria-hidden />

        <SheetHeader className="px-5 pt-1 pb-3 text-left">
          <SheetTitle className="text-[18px] font-semibold tracking-[-0.4px]">
            {store.name}
          </SheetTitle>
          {address ? (
            <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[12px]">
              <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{address}</span>
            </div>
          ) : null}
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {whatsappHref ? (
            <SheetLink
              href={whatsappHref}
              icon={MessageCircleIcon}
              label="Falar pelo WhatsApp"
              hint="Tire dúvidas direto com a loja"
              tone="whatsapp"
              external
              onClick={close}
            />
          ) : null}

          <SheetLink
            href={`${baseHref}/contato`}
            icon={MailIcon}
            label="Mandar uma mensagem"
            hint="Formulário de contato"
            onClick={close}
          />

          <SheetLink
            href={`${baseHref}/sobre`}
            icon={InfoIcon}
            label="Sobre a loja"
            hint="História, atendimento, formas de pagamento"
            onClick={close}
          />
        </nav>

        {/* Footer com marca discreta da plataforma — não compete com a
            loja, mas comunica que tem infra por trás (gera confiança). */}
        <div className="border-t border-border/60 px-5 py-3 text-center">
          <span className="text-muted-foreground text-[10.5px] font-medium tracking-[0.3px] uppercase">
            Loja online por{" "}
            <span className="text-foreground font-semibold">Mangos Pay</span>
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SheetLink({
  href,
  icon: Icon,
  label,
  hint,
  external = false,
  tone = "default",
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  hint: string;
  external?: boolean;
  tone?: "default" | "whatsapp";
  onClick?: () => void;
}) {
  const isWhatsapp = tone === "whatsapp";
  const common =
    "group flex items-center gap-3.5 rounded-2xl px-3.5 py-3 outline-none transition-colors focus-visible:bg-accent active:bg-accent/70";
  const iconWrapClass = cn(
    "grid size-10 shrink-0 place-items-center rounded-xl",
    isWhatsapp ? "bg-whatsapp/12 text-whatsapp" : "bg-muted text-foreground",
  );

  const body = (
    <>
      <div className={iconWrapClass}>
        <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground text-[13.5px] font-semibold tracking-[-0.2px]">
          {label}
        </div>
        <div className="text-muted-foreground mt-0.5 truncate text-[11.5px]">
          {hint}
        </div>
      </div>
      {external ? (
        <ExternalLinkIcon
          className="text-muted-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      ) : null}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={common}
        onClick={onClick}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={false} className={common} onClick={onClick}>
      {body}
    </Link>
  );
}

function formatAddress(store: Store): string | null {
  const street = store.addressStreet?.trim();
  const city = store.addressCity?.trim();
  const stateUF = store.addressState?.trim();

  const parts: string[] = [];
  if (street) parts.push(street);
  const cityState = [city, stateUF].filter(Boolean).join("/");
  if (cityState) parts.push(cityState);

  return parts.length > 0 ? parts.join(" · ") : null;
}
