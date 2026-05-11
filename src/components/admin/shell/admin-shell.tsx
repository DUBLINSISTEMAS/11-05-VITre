import type { ReactNode } from "react";

import { AdminSidebar, type AdminSidebarProps } from "./admin-sidebar";
import { MobileHeader } from "./header";

export interface AdminShellProps extends AdminSidebarProps {
  children: ReactNode;
}

/**
 * Shell do painel admin (refatorado pra estilo AbacatePay — Ondas 1 + 2).
 *
 * Layout:
 * - Desktop (lg+): sidebar fixa 240px (SidebarContent: store switcher,
 *   nav planos + grupos recolhíveis, suporte, user card no rodapé).
 *   Main com conteúdo fluindo direto sobre o fundo cinza #F3F4F6. Cada
 *   bloco da página é seu próprio card branco — não há mais wrapper único.
 * - Mobile (<lg): MobileHeader com hamburger (abre Sheet drawer com a
 *   mesma SidebarContent) + logo + sino. BottomNav removido — toda a nav
 *   passou pro drawer.
 *
 * Sem ornamento decorativo: AbacatePay é flat sobre cinza.
 */
export function AdminShell({ children, ...userProps }: AdminShellProps) {
  return (
    <div className="relative min-h-dvh bg-[#F3F4F6]">
      <div className="lg:flex">
        <AdminSidebar {...userProps} />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader {...userProps} />

          <main className="flex-1 px-4 pt-4 pb-12 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-12">
            <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
