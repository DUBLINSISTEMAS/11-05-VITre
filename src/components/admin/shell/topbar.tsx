"use client";

// Topbar desktop do admin — redesign Fase 2 ref Abacate Pay (2026-05-21),
// handoff design 2026-05-25 (CTA "Nova venda" verde com kbd F2).
//
// Layout:
// - LEFT: breadcrumb da rota atual (ícone + Seção / ícone + Item)
// - RIGHT: search trigger (Cmd+K), CTA "Ver loja", sino, CTA verde "Nova venda" (F2)
//
// Background TRANSPARENTE — flutua sobre o cinza do .b3-main acima do
// card branco .b3-main-card. Mobile não usa este componente.
import { ExternalLinkIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NEW_SALE_EVENT } from "@/components/admin/pdv/new-sale-events";

import { Breadcrumb } from "./breadcrumb";
import { NotificationsPopover } from "./notifications-popover";

function openPalette() {
  window.dispatchEvent(new Event("admin:open-palette"));
}

function openNewSale() {
  window.dispatchEvent(new Event(NEW_SALE_EVENT));
}

/**
 * Prefetch silencioso do chunk do PdvShell ao primeiro hover/focus do CTA.
 * Cobre o caso "lojista em outra rota (relatórios, cadastros, etc) clica
 * Nova venda" — sem isso o chunk só baixaria no click, gerando 1-3s de
 * espera. Idempotente (Webpack/Turbopack cacheiam após primeira chamada).
 * Marcador `prefetched` evita disparo a cada hover. Audit 2026-05-26.
 */
let _pdvPrefetched = false;
function prefetchPdvOnce() {
  if (_pdvPrefetched) return;
  _pdvPrefetched = true;
  void import("@/components/admin/pdv/pdv-shell");
}

export interface TopBarProps {
  /** Slug da loja do usuário, usado pra montar o link da loja online. */
  storeSlug: string;
}

export function TopBar({ storeSlug }: TopBarProps) {
  const pathname = usePathname();

  // Renderiza atalho coerente com o SO (Mac=⌘K, Win/Linux=Ctrl K).
  // Default = "Ctrl K" pra não piscar errado em SSR.
  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    setShortcut(isMac ? "⌘ K" : "Ctrl K");
  }, []);

  return (
    <header className="b3-top hidden lg:flex" data-admin-chrome="topbar">
      <Breadcrumb pathname={pathname} />

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="b3-search-btn"
          onClick={openPalette}
          aria-label={`Abrir busca (${shortcut})`}
          title={`Buscar produto, cliente ou pedido (${shortcut})`}
        >
          <SearchIcon size={14} aria-hidden />
          <span>Buscar</span>
          <kbd>{shortcut}</kbd>
        </button>

        {/* CTA persistente pro lojista ver a loja online — o storefront é o
            diferencial defensável do Mangos Pay (princípio do norte). Manter
            o caminho pra ele a 1 clique.

            S1 (handoff pixel-perfect 2026-05-25): label normalizado pra
            "Ver loja" conforme app-oficial/topbar.jsx do bundle + README
            "ícone notificações, 'Ver loja', 'Nova venda' CTA verde". O
            "online" segue no aria-label e title pra clareza assistiva. */}
        <Link
          href={`/${storeSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          className="b3-top-storelink"
          aria-label="Abrir loja online em uma nova aba"
          title="Ver loja online (abre em nova aba)"
        >
          <ExternalLinkIcon size={14} aria-hidden />
          <span>Ver loja</span>
        </Link>

        {/* Popover do sino — clica abre painel com lista (ou empty state
            honesto). Dot só renderiza com unreadCount > 0. Handoff Passo 5. */}
        <NotificationsPopover />

        {/* CTA verde "Nova venda" + kbd F2 — entrada principal de fluxo
            operacional do lojista. Disponível em qualquer rota do admin
            (não só /admin/pedidos). Abre o modal global montado em
            admin-shell via evento NEW_SALE_EVENT. */}
        <button
          type="button"
          className="b3-top-newsale"
          onClick={openNewSale}
          onMouseEnter={prefetchPdvOnce}
          onFocus={prefetchPdvOnce}
          aria-label="Nova venda (F2)"
          title="Nova venda (F2)"
        >
          <PlusIcon size={14} aria-hidden />
          <span>Nova venda</span>
          <kbd>F2</kbd>
        </button>
      </div>
    </header>
  );
}
