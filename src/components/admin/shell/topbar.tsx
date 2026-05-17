"use client";

// Topbar desktop do admin — port Dublin v3 (ADR-0019, Onda A.3).
// Replica `b3-top` do handoff: search input à esquerda (placeholder visual,
// ⌘K real virá em B.7), grupo de ícones à direita (bolt = ações rápidas,
// bell = notificações). Tudo placeholder visual nesta onda.
//
// Mobile não usa este componente — MobileHeader cuida disso com hamburger.
import { BellIcon, SearchIcon, ZapIcon } from "lucide-react";

export function TopBar() {
  return (
    <header className="b3-top hidden lg:flex" data-admin-chrome="topbar">
      <div className="b3-search">
        <SearchIcon size={16} aria-hidden />
        <input
          type="search"
          placeholder="Buscar produto, cliente ou pedido… (⌘K)"
          aria-label="Buscar"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className="b3-top-icbtn"
          aria-label="Ações rápidas"
          title="Ações rápidas (em breve)"
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
