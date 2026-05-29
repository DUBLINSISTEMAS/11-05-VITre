"use client";

// Header MOBILE-ONLY do admin — port Dublin v3 (ADR-0019, Onda A.3).
// Em desktop a sidebar (b3-side) + chrome interno do card (b3-card-chrome,
// refactor 2026-05-29) cuidam de tudo, então este componente fica `lg:hidden`.
//
// Estrutura:
// - Hamburger à esquerda abre Sheet drawer com SidebarContent completa
//   (envolvida em flex column pro b3-side-foot ancorar no rodapé)
// - Logo Mangos Pay central
// - Sino à direita (placeholder; vira badge real em B.6+)
import { BellIcon, ExternalLinkIcon, MenuIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { SidebarContent, type SidebarContentProps } from "./sidebar-content";

export type MobileHeaderProps = SidebarContentProps;

export function MobileHeader(props: MobileHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-line bg-surface lg:hidden"
      data-admin-chrome="mobile-header"
    >
      <div className="flex h-14 items-center justify-between gap-3 px-3">
        {/* Hamburger → drawer com SidebarContent */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="rounded-md p-2 text-ink-2 outline-none transition-colors hocus:bg-bg-app focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Abrir menu"
          >
            <MenuIcon className="size-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-[280px] flex-col bg-white p-0 sm:max-w-[280px]"
            showCloseButton={false}
            data-admin-sidebar="true"
          >
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <SidebarContent
              {...props}
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Logo central */}
        <Link
          href="/admin"
          prefetch
          className="hocus:bg-bg-app flex items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Mangos Pay — ir para o início"
        >
          <Image
            src="/logos/logo.png"
            alt=""
            width={28}
            height={28}
            priority
            className="size-7 rounded-md"
          />
          <span className="font-semibold tracking-tight text-ink-1">
            Mangos Pay
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {/* Acesso direto à loja online — storefront é o diferencial
              defensável do produto, então fica a 1 toque tanto no desktop
              (topbar) quanto no mobile (aqui). */}
          <Link
            href={`/${props.storeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            className="rounded-md p-2 text-mangos-green-800 outline-none transition-colors hocus:bg-mangos-yellow-soft focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Abrir loja online em uma nova aba"
            title="Ver loja online"
          >
            <ExternalLinkIcon className="size-5" />
          </Link>
          <button
            type="button"
            className="rounded-md p-2 text-ink-2 outline-none transition-colors hocus:bg-bg-app focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Notificações"
          >
            <BellIcon className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
