"use client";

// Topbar desktop do admin — port Dublin v3 (ADR-0019, Onda A.3).
// Replica `b3-top` do handoff: search input à esquerda (abre ⌘K real em B.7),
// grupo de ícones à direita (bolt = ações rápidas, bell = notificações).
//
// Mobile não usa este componente — MobileHeader cuida disso com hamburger.
import { BellIcon, SearchIcon, ZapIcon } from "lucide-react";

function openPalette() {
  window.dispatchEvent(new Event("admin:open-palette"));
}

export function TopBar() {
  return (
    <header className="b3-top hidden lg:flex" data-admin-chrome="topbar">
      <button
        type="button"
        className="b3-search cursor-pointer text-left"
        onClick={openPalette}
        aria-label="Abrir busca (⌘K)"
      >
        <SearchIcon size={16} aria-hidden />
        <span className="text-ink-4 text-[13px]">
          Buscar produto, cliente ou pedido…
        </span>
        <kbd className="text-ink-4 ml-auto text-[10px]">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className="b3-top-icbtn"
          aria-label="Ações rápidas"
          title="Ações rápidas (⌘K)"
          onClick={openPalette}
        >
          <ZapIcon size={18} />
        </button>
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
