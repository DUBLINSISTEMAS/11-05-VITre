"use client";

// Header MOBILE-ONLY (`lg:hidden`). Em desktop a sidebar carrega todo
// o nav, então não há topbar. Em mobile:
// - Hamburger à esquerda abre Sheet drawer com sidebar completa
// - Logo Vitrê no centro
// - Sino de notificações à direita (placeholder por enquanto — vira badge real em fase futura)
import { BellIcon, MenuIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { SidebarContent, type SidebarContentProps } from "./sidebar-content";

export type MobileHeaderProps = SidebarContentProps;

export function MobileHeader(props: MobileHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-3">
        {/* Hamburger → abre drawer com SidebarContent */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="rounded-md p-2 text-navy-700 outline-none transition-colors hocus:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Abrir menu"
          >
            <MenuIcon className="size-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[280px] p-0 sm:max-w-[280px]"
            showCloseButton={false}
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
          className="hocus:bg-accent flex items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Vitrê — ir para o início"
        >
          <Image
            src="/brand/logo-principal.webp"
            alt=""
            width={28}
            height={28}
            priority
            className="size-7 rounded-md"
          />
          <span className="font-semibold tracking-tight text-foreground">
            Vitrê
          </span>
        </Link>

        {/* Sino placeholder */}
        <button
          type="button"
          className="rounded-md p-2 text-navy-700 outline-none transition-colors hocus:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Notificações"
        >
          <BellIcon className="size-5" />
        </button>
      </div>
    </header>
  );
}
