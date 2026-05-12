"use client";

// Conteúdo compartilhado da sidebar admin — usado em desktop (AdminSidebar
// fixa) e mobile (dentro do Sheet drawer). Estilo AbacatePay:
// - Store switcher no topo
// - Nav items planos com ícone + label (sem tile-de-ícone Fly.io)
// - Grupos recolhíveis (`AdminNavGroup`) com chevron animado
// - Item "Suporte" antes do rodapé
// - User card no rodapé com dropdown 3-pontos pra Sair/Configurações/Ver vitrine
import {
  ChevronDownIcon,
  LogOutIcon,
  MessageCircleIcon,
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
  ADMIN_NAV_ITEMS,
  type AdminNavGroup,
  type AdminNavLink,
  isGroupActive,
  isLinkActive,
} from "./nav-items";
import { StoreSwitcher } from "./store-switcher";

export interface SidebarContentProps {
  ownerName: string;
  ownerEmail: string;
  storeName: string;
  storeSlug: string;
  primaryColor: string;
  /** Logo da loja (URL Supabase). Renderiza no topo do switcher se presente. */
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
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Topo: store switcher */}
      <div className="px-3 pt-3 pb-2">
        <StoreSwitcher
          storeName={storeName}
          storeSlug={storeSlug}
          primaryColor={primaryColor}
          logoUrl={logoUrl}
        />
      </div>

      <hr className="mx-3 border-gray-200" />

      {/* Lista de items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegação principal">
        <ul className="space-y-0.5">
          {ADMIN_NAV_ITEMS.map((entry) => (
            <li key={entry.kind === "link" ? entry.href : entry.label}>
              {entry.kind === "link" ? (
                <NavLinkRow item={entry} pathname={pathname} onNavigate={onNavigate} />
              ) : (
                <NavGroupRow group={entry} pathname={pathname} onNavigate={onNavigate} />
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Suporte */}
      <div className="px-2 pb-2">
        <a
          href="mailto:contato@vitre.site"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-navy-700 outline-none transition-colors hocus:bg-accent hocus:text-navy-900 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <MessageCircleIcon className="size-4 shrink-0" aria-hidden />
          <span>Suporte</span>
        </a>
      </div>

      <hr className="mx-3 border-gray-200" />

      {/* Footer: user card */}
      <UserCardFooter
        ownerName={ownerName}
        ownerEmail={ownerEmail}
        storeSlug={storeSlug}
      />
    </div>
  );
}

// ----- NAV LINK ROW -----

interface NavLinkRowProps {
  item: AdminNavLink;
  pathname: string;
  onNavigate?: () => void;
}

function NavLinkRow({ item, pathname, onNavigate }: NavLinkRowProps) {
  const Icon = item.icon;
  const isActive = isLinkActive(item, pathname);

  return (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-navy-700 hocus:bg-accent hocus:text-navy-900",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

// ----- NAV GROUP ROW (recolhível) -----

interface NavGroupRowProps {
  group: AdminNavGroup;
  pathname: string;
  onNavigate?: () => void;
}

function NavGroupRow({ group, pathname, onNavigate }: NavGroupRowProps) {
  const Icon = group.icon;
  const hasActiveChild = isGroupActive(group, pathname);
  // Default expandido se algum child estiver ativo, senão recolhido
  const [isOpen, setIsOpen] = useState(hasActiveChild);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
          hasActiveChild
            ? "text-navy-900"
            : "text-navy-700 hocus:bg-accent hocus:text-navy-900",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-navy-400 transition-transform",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-gray-200 pl-2">
          {group.children.map((child) => {
            const ChildIcon = child.icon;
            const isActive = isLinkActive(child, pathname);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  prefetch
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-navy-600 hocus:bg-accent hocus:text-navy-900",
                  )}
                >
                  <ChildIcon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
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
    <div className="flex items-center gap-2 px-3 py-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
      >
        {getInitials(ownerName)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[12.5px] font-semibold text-foreground">
          {ownerName.split(/\s+/)[0] ?? "Você"}
        </p>
        <p className="truncate font-mono text-[10.5px] text-muted-foreground">
          {ownerEmail}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-md p-1 text-navy-500 outline-none transition-colors hocus:bg-accent hocus:text-navy-900 focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Opções da conta"
        >
          <MoreVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={6} className="min-w-52">
          <DropdownMenuLabel className="space-y-0.5 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {ownerName}
            </p>
            <p className="truncate text-xs font-normal text-muted-foreground">
              {ownerEmail}
            </p>
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
  );
}
