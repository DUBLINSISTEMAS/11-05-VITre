import type { ReactNode } from "react";

import { AdminSidebar, type AdminSidebarProps } from "./admin-sidebar";
import { MobileHeader } from "./header";

export interface AdminShellProps extends AdminSidebarProps {
  children: ReactNode;
}

/**
 * Shell do painel admin — port Dublin v3 BAGY-style (Onda 4, ADR-0019).
 *
 * Layout:
 * - Desktop (lg+): sidebar fixa 248px (SidebarContent: store switcher,
 *   nav planos + grupos recolhíveis, suporte, user card no rodapé).
 *   Main com conteúdo fluindo direto sobre `--bg-app` (#F5F6F8). Cada
 *   bloco da página é seu próprio card branco — não há mais wrapper único.
 * - Mobile (<lg): MobileHeader com hamburger (abre Sheet drawer com a
 *   mesma SidebarContent) + logo + sino. BottomNav removido — toda a nav
 *   passou pro drawer.
 *
 * Sem ornamento decorativo: BAGY-inspired é flat sobre cinza, item ativo
 * com brand-wash + border-left navy 3px.
 */
export function AdminShell({ children, ...userProps }: AdminShellProps) {
  return (
    <div className="relative min-h-dvh bg-bg-app print:bg-white">
      <div className="lg:flex">
        {/*
          data-admin-chrome: usado pelo CSS print de /admin/pedidos/[id]/imprimir
          pra ocultar sidebar + mobile header. main fica e renderiza
          só o pedido imprimível.
        */}
        <div data-admin-chrome>
          <AdminSidebar {...userProps} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div data-admin-chrome>
            <MobileHeader {...userProps} />
          </div>

          <main className="flex-1 px-4 pt-4 pb-12 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-12 print:px-0 print:py-0">
            <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5 print:max-w-none print:space-y-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
