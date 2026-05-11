import type { ReactNode } from "react";

import { AdminSidebar, type AdminSidebarProps } from "./admin-sidebar";
import { BottomNav } from "./bottom-nav";
import { MobileHeader } from "./header";

export interface AdminShellProps extends AdminSidebarProps {
  children: ReactNode;
}

/**
 * Shell do painel admin (refatorado pra estilo AbacatePay).
 *
 * Layout:
 * - Desktop (lg+): flex — sidebar fixa 232px + main com conteúdo fluido
 *   sobre o fundo cinza #F3F4F6. Cada bloco da página é seu próprio card
 *   branco (não há mais wrapper único).
 * - Mobile (<lg): coluna única — header slim (logo + UserMenu) + main
 *   edge-to-edge + bottom nav escuro fixo (será substituído por drawer
 *   na Onda 2).
 *
 * Sem ornamento de fundo: AbacatePay é flat sobre cinza. Mais limpo,
 * mais econômico em banda mobile.
 */
export function AdminShell({ children, ...userProps }: AdminShellProps) {
  return (
    <div className="relative min-h-dvh bg-[#F3F4F6]">
      <div className="lg:flex">
        <AdminSidebar {...userProps} />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader {...userProps} />

          {/* Main: conteúdo flui direto sobre cinza, sem wrapper card */}
          <main className="flex-1 px-4 pt-4 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-12">
            <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
              {children}
            </div>
          </main>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
