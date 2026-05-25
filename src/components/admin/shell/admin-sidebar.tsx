"use client";

// Sidebar lateral fixa do admin — desktop only.
// Onda A.3 port Dublin v3 (ADR-0019): substitui wrappers tailwind pela
// classe canônica `b3-side` (280px, sticky, bg-surface, border-right --line,
// flex column pra rodapé com margin-top:auto). Mobile usa o mesmo
// SidebarContent dentro de um Sheet drawer (ver MobileHeader).
//
// Onda 2026-05-24: gerencia estado `collapsed` (280px ↔ 72px) persistido
// em localStorage. A largura é trocada via CSS quando `data-collapsed=true`
// no aside — transição de 240ms cuida da animação. O React só liga/desliga
// o atributo e passa o callback de toggle pro SidebarContent renderizar
// o botão no `b3-side-top`.
//
// HIDRATAÇÃO: SSR renderiza o aside VAZIO; SidebarContent só monta no
// client após `mounted=true`. Causa um flash de ~1 frame de sidebar cinza
// em F5, mas elimina deterministicamente hydration mismatch causado por
// IDs do Radix `useId` desincronizando (DropdownMenuTrigger do StoreFooter
// gera IDs diferentes em SSR vs client primeiro paint mesmo passando
// `collapsed=false` igual nos dois — provavelmente bug Turbopack +
// React 19). Admin está atrás de login → sem custo de SEO.
import { useEffect, useState } from "react";

import { SidebarContent, type SidebarContentProps } from "./sidebar-content";

export type AdminSidebarProps = SidebarContentProps;

const STORAGE_KEY = "mangos-sidebar-collapsed";

export function AdminSidebar(props: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Lê localStorage no mount. Antes disso o conteúdo nem renderiza
  // (defer total) — garante zero divergência entre SSR e primeiro
  // client paint.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      // localStorage indisponível (modo privado, etc) — ignora.
    }
    setMounted(true);
  }, []);

  const handleToggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
      } catch {
        // ignora — estado em memória mesmo assim.
      }
      return next;
    });
  };

  return (
    <aside
      aria-label="Navegação principal"
      className="b3-side hidden lg:flex"
      data-admin-chrome="sidebar"
      data-collapsed={mounted && collapsed ? "true" : undefined}
    >
      {mounted ? (
        <SidebarContent
          {...props}
          collapsed={collapsed}
          onToggleCollapsed={handleToggleCollapsed}
        />
      ) : null}
    </aside>
  );
}
