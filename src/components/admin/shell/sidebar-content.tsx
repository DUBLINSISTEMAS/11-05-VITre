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
import type { LucideIcon } from "lucide-react";
import {
  ChevronDownIcon,
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
  /**
   * Modo collapsed (desktop only, controlado pelo AdminSidebar). Quando
   * true, o sidebar tem 72px e renderiza só ícones. Mobile (drawer Sheet)
   * passa false / undefined.
   */
  collapsed?: boolean;
  /**
   * Handler do botão de toggle no `b3-side-top`. Se ausente, o botão
   * não é renderizado (caso do mobile, que usa hamburger do header).
   */
  onToggleCollapsed?: () => void;
}

export function SidebarContent({
  ownerName,
  ownerEmail,
  storeName,
  storeSlug,
  primaryColor,
  logoUrl,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
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

  // Quando collapsed, o accordion fica achatado (todas as seções abertas
  // simultaneamente) — o CSS força `grid-template-rows: 1fr` via
  // `.b3-side[data-collapsed="true"] .b3-side-collapsible`. O React passa
  // `isOpen=true` em todas pra alinhar o estado lógico com o visual
  // (caso o usuário expanda o sidebar de volta, queremos lembrar o estado
  // anterior — mas isso é refinamento futuro, hoje preservamos `openKey`).
  return (
    <>
      {/* b3-side-top: brand Mangos Pay (logo + wordmark) — link pra /admin.
          Imagem única do logo.svg (o arquivo já contém o ícone da manga +
          o nome "Mangos Pay" juntos). Usar <img> em vez de next/image
          porque next/image exige `dangerouslyAllowSVG: true` no config.

          Onda 2026-05-24: layout flex justify-between — logo à esquerda,
          botão collapse à direita. No modo collapsed, a logo full some
          (CSS), restando só o botão centralizado. Mobile não recebe
          `onToggleCollapsed` (passa undefined) → botão não renderiza. */}
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

      {/* PP14 (handoff pixel-perfect 2026-05-25) — StoreSwitcher compact
          entre logo e nav. Bate sidebar.jsx do bundle linhas 15-27.
          Esconde no modo collapsed (espaço apertado, info redundante
          com avatar do footer). */}
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
              mangospay.app/{storeSlug}
            </span>
          </span>
        </Link>
      ) : null}

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegação principal">
        {/* Início standalone — sempre visível, fora do accordion */}
        <div className="px-0 pb-1">
          <NavItemRow
            item={ADMIN_NAV_HOME}
            pathname={pathname}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        </div>

        {/* 4 seções colapsáveis (accordion: uma aberta por vez).
            No modo collapsed, o CSS força collapsible aberto + esconde
            o header de seção — então isOpen aqui não importa visualmente. */}
        {ADMIN_NAV_SECTIONS.map((section) => (
          <NavSection
            key={section.k}
            section={section}
            pathname={pathname}
            isOpen={openKey === section.k}
            onToggle={() => handleToggleSection(section.k)}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <SupportFooterLink
        pathname={pathname}
        onNavigate={onNavigate}
        collapsed={collapsed}
      />

      {/* b3-side-foot: identidade da loja do lojista + dropdown da conta */}
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

// ----- NAV SECTION (header colapsável + items) -----

interface NavSectionProps {
  section: AdminNavSection;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}

function NavSection({
  section,
  pathname,
  isOpen,
  onToggle,
  onNavigate,
  collapsed = false,
}: NavSectionProps) {
  const Icon = section.icon;
  const hasActive = section.items.some((item) => isItemActive(item, pathname));
  // No modo collapsed o CSS abre todos os collapsibles + esconde o header
  // — passamos `data-open=true` pra alinhar o estado lógico (aria-hidden
  // do panel também precisa refletir isso pra leitor de tela).
  const effectivelyOpen = collapsed ? true : isOpen;

  return (
    <div className="b3-side-section-wrap">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={effectivelyOpen}
        aria-controls={`b3-side-panel-${section.k}`}
        aria-hidden={collapsed || undefined}
        tabIndex={collapsed ? -1 : undefined}
        className="b3-side-section"
        data-active={hasActive ? "true" : undefined}
        data-open={effectivelyOpen ? "true" : undefined}
      >
        <Icon aria-hidden />
        <span className="b3-side-label flex-1 truncate">{section.label}</span>
        {/* Chevron maior + traço 2.2 — mais presente visualmente. Rotação
            animada de 180° controlada pelo CSS (.b3-side-section .chev). */}
        <ChevronDownIcon
          size={16}
          strokeWidth={2.2}
          className="chev b3-side-label"
          aria-hidden
        />
      </button>

      <div
        id={`b3-side-panel-${section.k}`}
        className="b3-side-collapsible"
        data-open={effectivelyOpen ? "true" : undefined}
        aria-hidden={!effectivelyOpen}
      >
        <div className="b3-side-collapsible-inner">
          {section.items.map((item) => (
            <NavItemRow
              key={item.k}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              nested
              collapsed={collapsed}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- ICON com pop animation ao virar ativo (mudança de rota) -----
//
// Detecta a transição inativo → ativo via ref + effect e aplica a classe
// `b3-icon-pop` por 380ms (sincronizado com a duração da animação CSS).
// Próxima ativação: classe removida → re-aplicada, animation re-roda.
//
// Acessibilidade: a animação respeita prefers-reduced-motion via media
// query no globals.css (a classe vira no-op naquele contexto).
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

// ----- NAV ITEM (link direto OU expansível com subs) -----

interface NavItemRowProps {
  item: AdminNavItem;
  pathname: string;
  onNavigate?: () => void;
  /** True quando o item está dentro de uma seção do accordion (indent). */
  nested?: boolean;
  collapsed?: boolean;
}

function NavItemRow({
  item,
  pathname,
  onNavigate,
  nested,
  collapsed = false,
}: NavItemRowProps) {
  const Icon = item.icon;
  const hasSubs = Boolean(item.subs && item.subs.length > 0);
  const isActive = isItemActive(item, pathname);
  // Default: aberto se algum sub estiver ativo
  const [isOpen, setIsOpen] = useState(isActive && hasSubs);

  const itemClass = cn("b3-side-item", nested && "b3-side-item--nested");
  // Tooltip nativa via `title` quando collapsed — sem dep extra (radix
  // tooltip não está instalado). Limitação: delay ~700ms padrão do SO.
  const tooltip = collapsed ? item.label : undefined;

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
          title={tooltip}
        >
          <AnimatedNavIcon Icon={Icon} isActive={isActive} />
          <span className="b3-side-label flex-1 truncate">{item.label}</span>
          {item.dot ? <span className="dot" aria-hidden /> : null}
          {/* Mesmo padrão do header de seção — chevron maior + stroke 2.2. */}
          <ChevronDownIcon
            size={15}
            strokeWidth={2.2}
            className="chev"
            aria-hidden
          />
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
        title={tooltip ?? "Em breve"}
      >
        {/* Soon nunca é ativo — passa false (no-op). */}
        <AnimatedNavIcon Icon={Icon} isActive={false} />
        <span className="b3-side-label flex-1 truncate">{item.label}</span>
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
        title={tooltip}
      >
        <AnimatedNavIcon Icon={Icon} isActive={isActive} />
        <span className="b3-side-label flex-1 truncate">{item.label}</span>
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
      title={tooltip}
    >
      <AnimatedNavIcon Icon={Icon} isActive={isActive} />
      <span className="b3-side-label flex-1 truncate">{item.label}</span>
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
        <span className="b3-side-label flex-1 truncate">{sub.label}</span>
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
      <span className="b3-side-label flex-1 truncate">{sub.label}</span>
    </Link>
  );
}

// ----- SUPORTE — link discreto entre nav e rodapé -----

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
  const isActive = isItemActive(ADMIN_NAV_SUPPORT, pathname);
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

// ----- Badge "em breve" -----

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

  // Avatar/logo da loja — extraído pra reusar nos dois modos (expandido
  // mostra como ornamento à esquerda da meta + trigger separado; collapsed
  // vira ele mesmo o trigger do dropdown).
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

  // Conteúdo do dropdown — idêntico nos dois modos.
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

  // Modo collapsed: o avatar inteiro vira o trigger. Sem meta visível.
  // Sem isso, o usuário perde acesso a "Sair" no modo recolhido.
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

  // Modo expandido: avatar + meta + trigger separado (MoreVerticalIcon).
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
