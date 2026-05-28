"use client";

// Topbar desktop do admin — redesign Finexy-style 2026-05-27.
//
// Layout:
// - LEFT:  logo round (favicon Mangos) + wordmark compacto
// - CENTER: search trigger largo (Cmd+K) com kbd à direita
// - RIGHT: sino (notifications) + help (?) + avatar pill
//
// Decisões de migração:
// - Breadcrumb removido daqui — o título da página (h1.b3-page-title) e a
//   sidebar plana já indicam onde o usuário está. Reduz ruído visual.
// - CTAs "Ver loja" e "Nova venda" descem pro header da dashboard (próximo
//   ao DateRangePill) ou ficam disponíveis via avatar pill + F2 global.
// - Background TRANSPARENTE preservado — flutua sobre o cinza do .b3-main
//   acima do card branco .b3-main-card.

import {
  ChevronDownIcon,
  HelpCircleIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  StoreIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

import { NotificationsPopover } from "./notifications-popover";

function openPalette() {
  window.dispatchEvent(new Event("admin:open-palette"));
}

export interface TopBarProps {
  storeSlug: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  logoUrl: string | null;
  primaryColor: string;
}

export function TopBar({
  storeSlug,
  storeName,
  ownerName,
  ownerEmail,
  logoUrl,
  primaryColor,
}: TopBarProps) {
  // Atalho coerente com o SO (Mac=⌘K, Win/Linux=Ctrl K).
  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    setShortcut(isMac ? "⌘ K" : "Ctrl K");
  }, []);

  return (
    <header className="b3-top hidden lg:flex" data-admin-chrome="topbar">
      {/* LEFT — logo round + wordmark */}
      <Link
        href="/admin"
        prefetch
        className="b3-topbar-brand"
        aria-label="Mangos Pay — Início"
      >
        <span className="b3-topbar-brand-icon" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/favicon.svg" alt="" className="h-5 w-5" />
        </span>
        <span className="b3-topbar-brand-word">Mangos Pay</span>
      </Link>

      {/* CENTER — search bar largo, click abre command palette */}
      <button
        type="button"
        className="b3-topbar-search"
        onClick={openPalette}
        aria-label={`Abrir busca (${shortcut})`}
        title={`Buscar produto, cliente ou pedido (${shortcut})`}
      >
        <SearchIcon size={15} aria-hidden />
        <span className="b3-topbar-search-placeholder">
          Buscar produto, cliente ou venda
        </span>
        <kbd className="b3-topbar-kbd">{shortcut}</kbd>
      </button>

      {/* RIGHT — sino + help + avatar pill */}
      <div className="b3-topbar-right">
        <NotificationsPopover />
        <Link
          href="/admin/suporte"
          prefetch
          className="b3-topbar-iconbtn"
          aria-label="Ajuda e suporte"
          title="Ajuda e suporte"
        >
          <HelpCircleIcon size={16} aria-hidden />
        </Link>
        <TopBarAvatarPill
          ownerName={ownerName}
          ownerEmail={ownerEmail}
          storeName={storeName}
          storeSlug={storeSlug}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
        />
      </div>
    </header>
  );
}

// ----- AVATAR PILL (right) -----

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface TopBarAvatarPillProps {
  ownerName: string;
  ownerEmail: string;
  storeName: string;
  storeSlug: string;
  logoUrl: string | null;
  primaryColor: string;
}

function TopBarAvatarPill({
  ownerName,
  ownerEmail,
  storeName,
  storeSlug,
  logoUrl,
  primaryColor,
}: TopBarAvatarPillProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Sessão encerrada.");
            router.push("/entrar");
            router.refresh();
          },
        },
      });
    });
  };

  const avatar = logoUrl ? (
    <span
      aria-hidden
      className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt="" className="size-full object-contain p-0.5" />
    </span>
  ) : (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full text-[10.5px] font-bold text-white"
      style={{ background: primaryColor || "var(--brand)" }}
    >
      {getInitials(storeName)}
    </span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="b3-topbar-avatar"
        aria-label="Opções da conta"
      >
        {avatar}
        <span className="b3-topbar-avatar-meta">
          <b className="b3-topbar-avatar-name">{storeName}</b>
          <span className="b3-topbar-avatar-role">Admin</span>
        </span>
        <ChevronDownIcon size={14} className="b3-topbar-avatar-chev" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-56">
        <DropdownMenuLabel className="space-y-0.5 py-2">
          <p className="truncate text-sm font-medium text-ink-1">{ownerName}</p>
          <p className="truncate text-xs font-normal text-ink-4">{ownerEmail}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${storeSlug}`} target="_blank" rel="noopener noreferrer">
            <StoreIcon className="size-4" /> Ver loja online
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/configuracoes">
            <SettingsIcon className="size-4" /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleSignOut();
          }}
          disabled={isPending}
          variant="destructive"
        >
          <LogOutIcon className="size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
