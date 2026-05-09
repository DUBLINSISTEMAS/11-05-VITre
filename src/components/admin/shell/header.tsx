"use client";

// Header MOBILE-ONLY (`lg:hidden`). Em desktop a sidebar carrega logo +
// UserMenu, então não há topbar. Em mobile mantemos um header slim com
// logo (orientação) + UserMenu (acesso rápido a Sair/Configurações).
import Image from "next/image";
import Link from "next/link";

import { UserMenu, type UserMenuProps } from "./user-menu";

export type MobileHeaderProps = UserMenuProps;

export function MobileHeader(props: MobileHeaderProps) {
  return (
    <header className="surface-elevated sticky top-0 z-40 w-full border-b lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
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

        <UserMenu {...props} />
      </div>
    </header>
  );
}
