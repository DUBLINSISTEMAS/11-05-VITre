"use client";

// Conteúdo da sidebar admin — port Dublin v3 (ADR-0019, Onda A.3).
// Renderiza estritamente os primitivos `b3-side-*` definidos em globals.css.
// Usado em desktop (dentro de `<aside class="b3-side">`) e em mobile
// (dentro de um Sheet drawer com `flex flex-col`).
//
// Estrutura:
// - b3-side-top: store switcher (logo da loja + nome + handle)
// - 3 seções (CONTROLE INTERNO / MINHA LOJA / CONTA) com headers b3-side-group
// - Cada item pode ter `subs` (recolhível com chevron) ou ser link direto
// - Items `soon: true` são renderizados disabled com badge "em breve"
// - b3-side-foot: user card com dropdown (Sair / Configurações / Ver vitrine)
import {
  ChevronDownIcon,
  LogOutIcon,
  MoreVerticalIcon,
  SettingsIcon,
  StoreIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { cn } from "@/lib/utils";

import {
  ADMIN_NAV_SECTIONS,
  type AdminNavItem,
  type AdminNavSubItem,
  isItemActive,
  isSubItemActive,
} from "./nav-items";
import { StoreSwitcher } from "./store-switcher";

export interface SidebarContentProps {
  ownerName: string;
  ownerEmail: string;
  storeName: string;
  storeSlug: string;
  primaryColor: string;
  logoUrl: string | null;
  /** Callback opcional pra fechar drawer mobile ao navegar. */
  onNavigate?: () => void;
}

export function SidebarContent({
  ownerName,
  ownerEmail,
  storeName,
  storeSlug,
  primaryColor,
  logoUrl,
  onNavigate,
}: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <>
      {/* b3-side-top: store switcher no topo (substitui logo "D"/"dublin" do handoff) */}
      <div className="b3-side-top">
        <StoreSwitcher
          storeName={storeName}
          storeSlug={storeSlug}
          primaryColor={primaryColor}
          logoUrl={logoUrl}
        />
      </div>

      <nav className="flex-1 overflow-y-auto" aria-label="Navegação principal">
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="b3-side-group">{section.label}</div>
            {section.items.map((item) => (
              <NavItemRow
                key={item.k}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* b3-side-foot: user card no rodapé */}
      <UserCardFooter
        ownerName={ownerName}
        ownerEmail={ownerEmail}
        storeSlug={storeSlug}
      />
    </>
  );
}

// ----- NAV ITEM (header — link direto OU expansível com subs) -----

interface NavItemRowProps {
  item: AdminNavItem;
  pathname: string;
  onNavigate?: () => void;
}

function NavItemRow({ item, pathname, onNavigate }: NavItemRowProps) {
  const Icon = item.icon;
  const hasSubs = Boolean(item.subs && item.subs.length > 0);
  const isActive = isItemActive(item, pathname);
  // Default: aberto se algum sub estiver ativo
  const [isOpen, setIsOpen] = useState(isActive && hasSubs);

  // ----- Item COM subs: clica no header pra toggle, não navega -----
  if (hasSubs) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className="b3-side-item w-full text-left"
          data-active={isActive ? "true" : undefined}
          data-open={isOpen ? "true" : undefined}
        >
          <Icon size={17} aria-hidden />
          <span className="flex-1 truncate">{item.label}</span>
          {item.dot ? <span className="dot" aria-hidden /> : null}
          <ChevronDownIcon size={11} className="chev" aria-hidden />
        </button>

        {isOpen ? (
          <div className="b3-side-sub">
            {item.subs!.map((sub) => (
              <SubItemRow
                key={sub.href}
                sub={sub}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : null}
      </>
    );
  }

  // ----- Item SEM subs: link direto (ou soon → disabled) -----
  if (item.soon) {
    return (
      <div
        className="b3-side-item cursor-not-allowed opacity-50"
        aria-disabled="true"
        title="Em breve"
      >
        <Icon size={17} aria-hidden />
        <span className="flex-1 truncate">{item.label}</span>
        <SoonBadge />
      </div>
    );
  }

  // mailto: ou link interno
  const isExternal = item.href!.startsWith("mailto:") || item.href!.startsWith("http");
  if (isExternal) {
    return (
      <a
        href={item.href}
        onClick={onNavigate}
        className="b3-side-item"
        data-active={isActive ? "true" : undefined}
      >
        <Icon size={17} aria-hidden />
        <span className="flex-1 truncate">{item.label}</span>
      </a>
    );
  }

  return (
    <Link
      href={item.href!}
      prefetch
      onClick={onNavigate}
      className="b3-side-item"
      data-active={isActive ? "true" : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon size={17} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

// ----- SUB-ITEM (dentro de b3-side-sub) -----

interface SubItemRowProps {
  sub: AdminNavSubItem;
  pathname: string;
  onNavigate?: () => void;
}

function SubItemRow({ sub, pathname, onNavigate }: SubItemRowProps) {
  if (sub.soon) {
    return (
      <div
        className="b3-side-sub-item cursor-not-allowed opacity-50"
        aria-disabled="true"
        title="Em breve"
      >
        <span className="flex-1 truncate">{sub.label}</span>
        <SoonBadge />
      </div>
    );
  }

  const isActive = isSubItemActive(sub, pathname);
  return (
    <Link
      href={sub.href}
      prefetch
      onClick={onNavigate}
      className="b3-side-sub-item"
      data-active={isActive ? "true" : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="flex-1 truncate">{sub.label}</span>
    </Link>
  );
}

// ----- Badge "em breve" -----

function SoonBadge() {
  return (
    <span
      aria-hidden
      className="ml-auto rounded bg-bg-app px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-ink-4"
    >
      em breve
    </span>
  );
}

// ----- USER CARD FOOTER -----

interface UserCardFooterProps {
  ownerName: string;
  ownerEmail: string;
  storeSlug: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function UserCardFooter({
  ownerName,
  ownerEmail,
  storeSlug,
}: UserCardFooterProps) {
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

  return (
    <div className="b3-side-foot">
      <div className="b3-side-foot-user">
        <span className="b3-side-foot-avatar" aria-hidden>
          {getInitials(ownerName)}
        </span>
        <div className="b3-side-foot-user-meta">
          <b>{ownerName.split(/\s+/)[0] ?? "Você"}</b>
          <span>{ownerEmail}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "rounded-md p-1 text-ink-4 outline-none transition-colors",
              "hocus:bg-bg-app hocus:text-ink-1 focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
            aria-label="Opções da conta"
          >
            <MoreVerticalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={6}
            className="min-w-52"
          >
            <DropdownMenuLabel className="space-y-0.5 py-2">
              <p className="truncate text-sm font-medium text-ink-1">{ownerName}</p>
              <p className="truncate text-xs font-normal text-ink-4">{ownerEmail}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/${storeSlug}`} target="_blank" rel="noopener noreferrer">
                <StoreIcon className="size-4" /> Ver minha vitrine
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
      </div>
    </div>
  );
}
