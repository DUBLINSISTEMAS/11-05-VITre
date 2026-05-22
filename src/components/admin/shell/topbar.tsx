"use client";

// Topbar desktop do admin — redesign Fase 2 ref Abacate Pay (2026-05-21).
//
// Layout:
// - LEFT: breadcrumb da rota atual (ícone + Seção / ícone + Item)
// - RIGHT: search trigger (Cmd+K), CTA "Ver loja online", sino
//
// Background TRANSPARENTE — flutua sobre o cinza do .b3-main acima do
// card branco .b3-main-card. Mobile não usa este componente.
import { BellIcon, ExternalLinkIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Breadcrumb } from "./breadcrumb";

function openPalette() {
  window.dispatchEvent(new Event("admin:open-palette"));
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
          <SearchIcon size={15} aria-hidden />
          <span>Buscar</span>
          <kbd>{shortcut}</kbd>
        </button>

        {/* CTA persistente pro lojista ver a loja online — o storefront é o
            diferencial defensável do Mangos Pay (princípio do norte). Manter
            o caminho pra ele a 1 clique. */}
        <Link
          href={`/${storeSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          className="b3-top-storelink"
          aria-label="Abrir loja online em uma nova aba"
          title="Ver loja online (abre em nova aba)"
        >
          <ExternalLinkIcon size={15} aria-hidden />
          <span>Ver loja online</span>
        </Link>

        <button
          type="button"
          className="b3-top-icbtn"
          aria-label="Notificações"
          title="Notificações (em breve)"
        >
          <BellIcon size={18} />
          <span className="ndot" aria-hidden />
        </button>
      </div>
    </header>
  );
}
