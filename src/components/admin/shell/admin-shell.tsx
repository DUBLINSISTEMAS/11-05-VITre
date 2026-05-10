import type { ReactNode } from "react";

import { AdminSidebar, type AdminSidebarProps } from "./admin-sidebar";
import { BottomNav } from "./bottom-nav";
import { MobileHeader } from "./header";

export interface AdminShellProps extends AdminSidebarProps {
  children: ReactNode;
}

/**
 * Shell do painel admin (canvas-v1 admin Lote 3).
 *
 * Layout:
 * - Desktop (lg+): flex — sidebar fixa 232px (StoreSwitcher topo +
 *   StorefrontFooterCard rodapé) + main envolto em card branco com border.
 *   Sem topbar (cada página renderiza `<AdminPageHeader>` no topo do card).
 * - Mobile (<lg): coluna única — header slim (logo + UserMenu) + main
 *   edge-to-edge + bottom nav escuro fixo.
 *
 * Ornamento: gradiente radial sutil (CSS puro, sem WebP) — economiza banda
 * em mobile com 4G ruim de Pedreiras.
 */
export function AdminShell({ children, ...userProps }: AdminShellProps) {
  return (
    <div className="bg-background relative min-h-dvh">
      {/* Ornamento decorativo — pointer-events-none, fixed atrás de tudo */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(at 18% 0%, color-mix(in oklch, var(--primary) 8%, transparent) 0px, transparent 55%), radial-gradient(at 88% 12%, color-mix(in oklch, var(--navy-200) 50%, transparent) 0px, transparent 50%)",
        }}
      />

      <div className="lg:flex">
        <AdminSidebar {...userProps} />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader {...userProps} />

          {/* Main: edge-to-edge mobile, card centralizado desktop */}
          <main className="flex-1 px-4 pt-4 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-12">
            <div className="bg-card mx-auto w-full max-w-5xl rounded-xl border p-4 shadow-sm sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
