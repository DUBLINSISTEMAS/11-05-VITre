"use client";

// Topbar desktop do admin — port Dublin v3 (ADR-0019, Onda A.3).
// Replica `b3-top` do handoff: search button à esquerda (abre command palette
// em B.7), grupo de ícones à direita (raio = ações rápidas, sino = notificações).
//
// Mobile não usa este componente — MobileHeader cuida disso com hamburger.
import { BellIcon, SearchIcon, ZapIcon } from "lucide-react";
import { useEffect, useState } from "react";

function openPalette() {
  window.dispatchEvent(new Event("admin:open-palette"));
}

export function TopBar() {
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
      <button
        type="button"
        className="b3-search cursor-pointer text-left"
        onClick={openPalette}
        aria-label={`Abrir busca (${shortcut})`}
      >
        <SearchIcon size={16} aria-hidden />
        <span className="text-ink-3 text-[13px]">
          Buscar produto, cliente ou pedido…
        </span>
        <kbd className="text-ink-4 ml-auto rounded border border-line bg-bg-app px-1.5 py-0.5 font-mono text-[10px]">
          {shortcut}
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className="b3-top-icbtn"
          aria-label="Ações rápidas"
          title={`Ações rápidas (${shortcut})`}
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
