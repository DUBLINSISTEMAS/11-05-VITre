"use client";

// Conteúdo da sidebar admin — accordion estilo fintech (Fase 2 redesign 2026-05-21).
// Renderiza estritamente os primitivos `b3-side-*` definidos em globals.css.
// Usado em desktop (dentro de `<aside class="b3-side">`) e em mobile
// (dentro de um Sheet drawer com `flex flex-col`).
//
// Estrutura:
// - b3-side-top: brand Mangos Pay (logo + wordmark) — link pra /admin
// - Início standalone (sempre visível, fora do accordion)
// - 4 seções colapsáveis (Operação / Cadastros / Gestão / Loja online + Config)
//   com comportamento accordion: abrir uma fecha a anterior
// - Default aberto: a seção que contém a rota atual
// - SupportFooterLink discreto acima do rodapé
// - b3-side-foot: store identity + dropdown
import {
  ChevronDownIcon,
  LogOutIcon,
  MoreVerticalIcon,
  SettingsIcon,
  StoreIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { MangoLogo } from "@/components/brand/mango-logo";
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
  type AdminNavSection,
  type AdminNavSubItem,
  findActiveSectionKey,
  isItemActive,
  isSubItemActive,
} from "./nav-items";

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

  // Accordion state — uma única seção aberta por vez.
  // Inicializa abrindo a seção da rota atual; null = todas fechadas.
  const [openKey, setOpenKey] = useState<string | null>(() =>
    findActiveSectionKey(pathname),
  );

  // Ao navegar entre seções (ex: via command palette), sincroniza o accordion
  // pra abrir a seção da nova rota. Se a rota não bate em nenhuma seção
  // (caso de /admin), preserva o estado atual do usuário.
  useEffect(() => {
    const active = findActiveSectionKey(pathname);
    if (active && active !== openKey) {
      setOpenKey(active);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleToggleSection = (sectionKey: string) => {
    setOpenKey((prev) => (prev === sectionKey ? null : sectionKey));
  };

  return (
    <>
      {/* b3-side-top: brand Mangos Pay (logo + wordmark) — link pra /admin */}
      <Link
        href="/admin"
        prefetch
        className="b3-side-top outline-none focus-visible:ring-2 focus-visible:ring-mangos-yellow/40"
        aria-label="Mangos Pay — ir para o início"
        onClick={onNavigate}
      >
        <MangoLogo />
      </Link>

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegação principal">
        {/* Início standalone — sempre visível, fora do accordion */}
        <div className="px-0 pb-1">
          <NavItemRow
            item={ADMIN_NAV_HOME}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </div>

        {/* 4 seções colapsáveis (accordion: uma aberta por vez) */}
        {ADMIN_NAV_SECTIONS.map((section) => (
          <NavSection
            key={section.k}
            section={section}
            pathname={pathname}
            isOpen={openKey === section.k}
            onToggle={() => handleToggleSection(section.k)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <SupportFooterLink pathname={pathname} onNavigate={onNavigate} />

      {/* b3-side-foot: identidade da loja do lojista + dropdown da conta */}
      <StoreFooter
        ownerName={ownerName}
        ownerEmail={ownerEmail}
        storeName={storeName}
        storeSlug={storeSlug}
        primaryColor={primaryColor}
        logoUrl={logoUrl}
      />
    </>
  );
}

// ----- NAV SECTION (header colapsável + items) -----

interface NavSectionProps {
  section: AdminNavSection;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

function NavSection({
  section,
  pathname,
  isOpen,
  onToggle,
  onNavigate,
}: NavSectionProps) {
  const Icon = section.icon;
  const hasActive = section.items.some((item) => isItemActive(item, pathname));

  return (
    <div className="b3-side-section-wrap">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`b3-side-panel-${section.k}`}
        className="b3-side-section"
        data-active={hasActive ? "true" : undefined}
        data-open={isOpen ? "true" : undefined}
      >
        <Icon size={17} aria-hidden />
        <span className="flex-1 truncate">{section.label}</span>
        <ChevronDownIcon size={14} className="chev" aria-hidden />
      </button>

      <div
        id={`b3-side-panel-${section.k}`}
        className="b3-side-collapsible"
        data-open={isOpen ? "true" : undefined}
        aria-hidden={!isOpen}
      >
        <div className="b3-side-collapsible-inner">
          {section.items.map((item) => (
            <NavItemRow
              key={item.k}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- NAV ITEM (link direto OU expansível com subs) -----

interface NavItemRowProps {
  item: AdminNavItem;
  pathname: string;
  onNavigate?: () => void;
  /** True quando o item está dentro de uma seção do accordion (indent). */
  nested?: boolean;
}

function NavItemRow({ item, pathname, onNavigate, nested }: NavItemRowProps) {
  const Icon = item.icon;
  const hasSubs = Boolean(item.subs && item.subs.length > 0);
  const isActive = isItemActive(item, pathname);
  // Default: aberto se algum sub estiver ativo
  const [isOpen, setIsOpen] = useState(isActive && hasSubs);

  const itemClass = cn("b3-side-item", nested && "b3-side-item--nested");

  // ----- Item COM subs: clica no header pra toggle, não navega -----
  if (hasSubs) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className={cn(itemClass, "w-full text-left")}
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
        className={cn(itemClass, "cursor-not-allowed opacity-50")}
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
        className={itemClass}
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
      className={itemClass}
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

// ----- SUPORTE — link discreto entre nav e rodapé -----

function SupportFooterLink({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = ADMIN_NAV_SUPPORT.icon;
  const isActive = isItemActive(ADMIN_NAV_SUPPORT, pathname);
  return (
    <div className="border-t border-border px-2 py-1">
      <Link
        href={ADMIN_NAV_SUPPORT.href!}
        prefetch
        onClick={onNavigate}
        className="b3-side-item opacity-55 transition-opacity hover:opacity-100"
        data-active={isActive ? "true" : undefined}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon size={17} aria-hidden />
        <span className="flex-1 truncate">{ADMIN_NAV_SUPPORT.label}</span>
      </Link>
    </div>
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

// ----- STORE FOOTER (identidade do lojista + dropdown da conta) -----

interface StoreFooterProps {
  ownerName: string;
  ownerEmail: string;
  storeName: string;
  storeSlug: string;
  primaryColor: string;
  logoUrl: string | null;
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

  return (
    <div className="b3-side-foot">
      <div className="b3-side-foot-user">
        {logoUrl ? (
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
        )}
        <div className="b3-side-foot-user-meta">
          <b className="uppercase tracking-tight">{storeName}</b>
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
