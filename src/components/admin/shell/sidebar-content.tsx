"use client";

// Conteúdo da sidebar admin — layout PLANO (refactor 2026-05-27 ref Finexy).
//
// Antes: 4 seções colapsáveis (accordion). Agora: cada seção renderiza
// como label pequeno cinza + lista plana de items, todos visíveis. Sem
// chevron de seção, sem accordion logic. Brief explícito do founder
// ("aparecer já planos / como itens de primeiro nível").
//
// Mantido:
// - Logo + store-switcher no topo
// - Item "Início" sempre visível
// - 4 grupos (Operação / Cadastros / Gestão / Loja+Config)
// - Hover + active state + dot + soon-badge
// - Modo collapsed (72px só ícones, controlado pelo aside via data-collapsed)
// - Suporte + StoreFooter no rodapé com dropdown

import type { LucideIcon } from "lucide-react";
import {
  LogOutIcon,
  MoreVerticalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  StoreIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
  ADMIN_NAV_HOME,
  ADMIN_NAV_SECTIONS,
  ADMIN_NAV_SUPPORT,
  type AdminNavItem,
  getAllNavItems,
  isItemActive,
} from "./nav-items";

// Audit 2026-05-28: scope congelado no escopo do módulo. Passado em todas as
// chamadas de `isItemActive` pra ativar longest-prefix matching e evitar o
// bug "tudo verde" (Relatórios + Resultado ativando juntos, Estoque + parado
// idem). Lista é determinística (config); computar 1 vez.
const NAV_SCOPE = getAllNavItems();

export interface SidebarContentProps {
  ownerName: string;
  ownerEmail: string;
  storeName: string;
  storeSlug: string;
  primaryColor: string;
  logoUrl: string | null;
  /**
   * Onda L5 (2026-05-29) — opt-in da Loja online. Quando false (sem
   * produto publicado), o grupo "Loja online" colapsa por default
   * (chevron + label visiveis, items escondidos). Lojista que so vende
   * balcao+WhatsApp nao ve esse grupo poluindo o dia-a-dia.
   */
  hasStorefront?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function SidebarContent({
  ownerName,
  ownerEmail,
  storeName,
  storeSlug,
  primaryColor,
  logoUrl,
  hasStorefront = false,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <>
      <div className="b3-side-top">
        <Link
          href="/admin"
          prefetch
          className="b3-side-label flex items-center outline-none focus-visible:ring-2 focus-visible:ring-mangos-yellow/40 rounded-md"
          aria-label="Mangos Pay — ir para o início"
          onClick={onNavigate}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/logo.svg"
            alt="Mangos Pay"
            className="h-8 w-auto"
            draggable={false}
          />
        </Link>
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="b3-side-collapse-toggle"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <PanelLeftOpenIcon size={16} aria-hidden />
            ) : (
              <PanelLeftCloseIcon size={16} aria-hidden />
            )}
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <Link
          href={`/${storeSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="b3-side-label mx-3 mb-2 flex items-center gap-2.5 rounded-[10px] border border-line bg-bg-app px-2.5 py-2 text-left transition-colors hover:bg-mangos-cream-soft outline-none focus-visible:ring-2 focus-visible:ring-mangos-yellow/40"
          title="Abrir loja online em nova aba"
        >
          {logoUrl ? (
            <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white">
              <Image
                src={logoUrl}
                alt=""
                fill
                sizes="28px"
                className="object-contain p-0.5"
              />
            </span>
          ) : (
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
              style={{ background: primaryColor }}
            >
              {getInitials(storeName)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <b className="text-ink-1 block truncate text-[12.5px] leading-tight">
              {storeName}
            </b>
            <span className="text-ink-4 block truncate font-mono text-[10.5px] leading-tight">
              vitre.site/{storeSlug}
            </span>
          </span>
        </Link>
      ) : null}

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegação principal">
        {/* Início standalone — sempre visível, sem label de seção */}
        <div className="px-0 pb-1">
          <NavItemRow
            item={ADMIN_NAV_HOME}
            pathname={pathname}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        </div>

        {/* Seções planas: label pequeno cinza + items todos visíveis.
            Onda L5 (2026-05-29): grupo "loja-config" vira opt-in. Quando
            !hasStorefront (loja sem produto publicado), renderiza como
            <details> fechado por default — lojista clica pra expandir
            quando quiser ativar a loja online. Outros grupos seguem
            sempre planos. Modo collapsed do sidebar inteiro continua
            mostrando so icones em todos os grupos (incluindo opt-in). */}
        {ADMIN_NAV_SECTIONS.map((section) => {
          const isOptIn =
            section.k === "loja-config" && !hasStorefront && !collapsed;
          if (isOptIn) {
            return (
              <details key={section.k} className="b3-side-flat-group">
                <summary className="b3-side-section-label b3-side-optin-summary">
                  <span>{section.label}</span>
                  <span className="b3-side-optin-hint">
                    Configurar
                  </span>
                </summary>
                {section.items.map((item) => (
                  <NavItemRow
                    key={item.k}
                    item={item}
                    pathname={pathname}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                  />
                ))}
              </details>
            );
          }
          return (
            <div key={section.k} className="b3-side-flat-group">
              <div
                className="b3-side-section-label"
                aria-hidden={collapsed || undefined}
              >
                {section.label}
              </div>
              {section.items.map((item) => (
                <NavItemRow
                  key={item.k}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                />
              ))}
            </div>
          );
        })}
      </nav>

      <SupportFooterLink
        pathname={pathname}
        onNavigate={onNavigate}
        collapsed={collapsed}
      />

      <StoreFooter
        ownerName={ownerName}
        ownerEmail={ownerEmail}
        storeName={storeName}
        storeSlug={storeSlug}
        primaryColor={primaryColor}
        logoUrl={logoUrl}
        collapsed={collapsed}
      />
    </>
  );
}

// ----- ICON com pop animation ao virar ativo -----

function AnimatedNavIcon({
  Icon,
  isActive,
}: {
  Icon: LucideIcon;
  isActive: boolean;
}) {
  const prevActiveRef = useRef(isActive);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 380);
      prevActiveRef.current = isActive;
      return () => clearTimeout(timer);
    }
    prevActiveRef.current = isActive;
  }, [isActive]);

  return (
    <Icon
      size={17}
      aria-hidden
      className={animating ? "b3-icon-pop" : undefined}
    />
  );
}

// ----- NAV ITEM (link direto OU disabled "em breve") -----
//
// No layout plano nunca renderizamos sub-items expansíveis: items que tinham
// `subs` no nav-items.ts foram normalizados pra link direto (ver nav-items.ts).
// Mantemos a guarda defensiva caso alguém adicione subs no futuro: renderiza
// só o header sem expandir.

interface NavItemRowProps {
  item: AdminNavItem;
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}

function NavItemRow({
  item,
  pathname,
  onNavigate,
  collapsed = false,
}: NavItemRowProps) {
  const Icon = item.icon;
  const isActive = isItemActive(item, pathname, NAV_SCOPE);
  const tooltip = collapsed ? item.label : undefined;

  if (item.soon) {
    return (
      <div
        className="b3-side-item cursor-not-allowed opacity-50"
        aria-disabled="true"
        title={tooltip ?? "Em breve"}
      >
        <AnimatedNavIcon Icon={Icon} isActive={false} />
        <span className="b3-side-label flex-1 truncate">{item.label}</span>
        <SoonBadge />
      </div>
    );
  }

  if (!item.href) {
    // Defensivo: item com subs sem href direto vira label estática.
    return (
      <div
        className="b3-side-item opacity-60"
        title={tooltip}
      >
        <AnimatedNavIcon Icon={Icon} isActive={false} />
        <span className="b3-side-label flex-1 truncate">{item.label}</span>
      </div>
    );
  }

  const isExternal = item.href.startsWith("mailto:") || item.href.startsWith("http");
  if (isExternal) {
    return (
      <a
        href={item.href}
        onClick={onNavigate}
        className="b3-side-item"
        data-active={isActive ? "true" : undefined}
        title={tooltip}
      >
        <AnimatedNavIcon Icon={Icon} isActive={isActive} />
        <span className="b3-side-label flex-1 truncate">{item.label}</span>
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      className="b3-side-item"
      data-active={isActive ? "true" : undefined}
      aria-current={isActive ? "page" : undefined}
      title={tooltip}
    >
      <AnimatedNavIcon Icon={Icon} isActive={isActive} />
      <span className="b3-side-label flex-1 truncate">{item.label}</span>
      {item.dot ? <span className="dot" aria-hidden /> : null}
    </Link>
  );
}

// ----- SUPORTE — link discreto acima do rodapé -----

function SupportFooterLink({
  pathname,
  onNavigate,
  collapsed = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const Icon = ADMIN_NAV_SUPPORT.icon;
  const isActive = isItemActive(ADMIN_NAV_SUPPORT, pathname, NAV_SCOPE);
  return (
    <div className="px-2 py-1">
      <Link
        href={ADMIN_NAV_SUPPORT.href!}
        prefetch
        onClick={onNavigate}
        className="b3-side-item opacity-55 transition-opacity hover:opacity-100"
        data-active={isActive ? "true" : undefined}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? ADMIN_NAV_SUPPORT.label : undefined}
      >
        <AnimatedNavIcon Icon={Icon} isActive={isActive} />
        <span className="b3-side-label flex-1 truncate">
          {ADMIN_NAV_SUPPORT.label}
        </span>
      </Link>
    </div>
  );
}

function SoonBadge() {
  return (
    <span
      aria-hidden
      className="b3-side-label ml-auto rounded bg-bg-app px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-ink-4"
    >
      em breve
    </span>
  );
}

// ----- STORE FOOTER (identidade do lojista + dropdown da conta) -----

interface StoreFooterProps {
  ownerName: string;
  ownerEmail: string;
  storeName: string;
  storeSlug: string;
  primaryColor: string;
  logoUrl: string | null;
  collapsed?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function StoreFooter({
  ownerName,
  ownerEmail,
  storeName,
  storeSlug,
  primaryColor,
  logoUrl,
  collapsed = false,
}: StoreFooterProps) {
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
      className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white"
    >
      <Image
        src={logoUrl}
        alt=""
        fill
        sizes="36px"
        className="object-contain p-0.5"
      />
    </span>
  ) : (
    <span
      aria-hidden
      className="b3-side-foot-avatar"
      style={
        primaryColor && primaryColor !== "#F6B73C"
          ? { background: primaryColor, color: "white" }
          : undefined
      }
    >
      {getInitials(storeName)}
    </span>
  );

  const dropdownContent = (
    <DropdownMenuContent
      align={collapsed ? "start" : "end"}
      side={collapsed ? "right" : "top"}
      sideOffset={collapsed ? 12 : 6}
      className="min-w-52"
    >
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
  );

  if (collapsed) {
    return (
      <div className="b3-side-foot">
        <div className="b3-side-foot-user">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Opções da conta"
              title="Conta"
            >
              {avatar}
            </DropdownMenuTrigger>
            {dropdownContent}
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div className="b3-side-foot">
      <div className="b3-side-foot-user">
        {avatar}
        <div className="b3-side-foot-user-meta">
          <b className="uppercase tracking-tight">{storeName}</b>
          <span>{ownerEmail}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            data-foot-menu
            className={cn(
              "rounded-md p-1 text-ink-4 outline-none transition-colors",
              "hocus:bg-bg-app hocus:text-ink-1 focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
            aria-label="Opções da conta"
          >
            <MoreVerticalIcon className="size-4" />
          </DropdownMenuTrigger>
          {dropdownContent}
        </DropdownMenu>
      </div>
    </div>
  );
}
