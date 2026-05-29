"use client";

// Chrome interno do card branco — refactor 2026-05-29.
//
// Antes: topbar transparente flutuava ACIMA do card (search central + sino +
// ? + pill da conta). Pill da conta duplicava o avatar/dropdown que ja vive
// no rodape da sidebar; Suporte tambem aparecia 2x (link discreto na sidebar
// + ? no topbar).
//
// Agora: topo do card branco tem busca minimalista (ghost) ancorada a
// esquerda + sino e ? compactos no canto direito. Pill da conta REMOVIDA
// (sidebar footer ja entrega: avatar/loja/dropdown Ver loja/Configuracoes/
// Sair). Resultado: chrome enxuto, card mais alto na parte superior, zero
// duplicidade com a sidebar.
//
// Mobile (<lg) renderiza MobileHeader e este componente fica display:none.

import { HelpCircleIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { NotificationsPopover } from "./notifications-popover";

function openPalette() {
  window.dispatchEvent(new Event("admin:open-palette"));
}

export function TopBar() {
  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    setShortcut(isMac ? "⌘ K" : "Ctrl K");
  }, []);

  return (
    <header className="b3-card-chrome hidden lg:flex" data-admin-chrome="topbar">
      <button
        type="button"
        className="b3-card-chrome-search"
        onClick={openPalette}
        aria-label={`Abrir busca (${shortcut})`}
        title={`Buscar produto, cliente ou venda (${shortcut})`}
      >
        <SearchIcon size={15} aria-hidden />
        <span className="b3-card-chrome-search-placeholder">
          Buscar produto, cliente ou venda
        </span>
        <kbd className="b3-card-chrome-kbd">{shortcut}</kbd>
      </button>

      <div className="b3-card-chrome-right">
        <NotificationsPopover />
        <Link
          href="/admin/suporte"
          prefetch
          className="b3-card-chrome-iconbtn"
          aria-label="Ajuda e suporte"
          title="Ajuda e suporte"
        >
          <HelpCircleIcon size={16} aria-hidden />
        </Link>
      </div>
    </header>
  );
}
