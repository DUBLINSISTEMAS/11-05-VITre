import type { ReactNode } from "react";

import { AdminSidebar, type AdminSidebarProps } from "./admin-sidebar";
import { BannerTrial } from "./banner-trial";
import { MobileHeader } from "./header";
import { TopBar } from "./topbar";

export interface AdminShellProps extends AdminSidebarProps {
  children: ReactNode;
}

/**
 * Shell do painel admin — port Dublin v3 BAGY-style (Onda A.3, ADR-0019).
 *
 * Layout:
 * - Topo: BannerTrial 44px (faixa gradient navy com "14 dias restantes" +
 *   CTA Ver planos + X dismiss). Visível em qualquer breakpoint.
 * - Desktop (lg+): b3-shell flex → b3-side (sidebar 248px com 3 grupos
 *   CONTROLE INTERNO/MINHA LOJA/CONTA + items recolhíveis) + b3-main flex
 *   column → TopBar sticky (search global + bolt + bell) + main content.
 * - Mobile (<lg): MobileHeader sticky (hamburger + logo + sino) + main.
 *   Sidebar entra via Sheet drawer no hamburger.
 *
 * O wrapper b3-shell + b3-main + b3-side já cuida do sticky/overflow/min-w-0
 * (definidos no globals.css). Não há mais `max-w-7xl mx-auto` aqui — o
 * b3-page dentro de cada página é quem centraliza com max-width 1280px.
 */
export function AdminShell({ children, ...userProps }: AdminShellProps) {
  return (
    <>
      <div data-admin-chrome>
        <BannerTrial />
      </div>

      <div className="b3-shell print:block">
        <div data-admin-chrome>
          <AdminSidebar {...userProps} />
        </div>

        <div className="b3-main">
          <div data-admin-chrome>
            <TopBar />
            <MobileHeader {...userProps} />
          </div>

          <main className="flex-1 px-4 pt-4 pb-12 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-12 print:px-0 print:py-0">
            {/*
              Wrapper de compat: páginas ainda não migradas pra `b3-page` (Ondas
              A.4→A.17) continuam centralizadas e com gaps verticais. Páginas
              que JÁ usam `b3-page` ignoram este wrapper porque b3-page tem
              max-width 1280px próprio + padding interno — fica dentro deste
              max-w-7xl (também 1280px) sem conflito visual.
            */}
            <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5 print:max-w-none print:space-y-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
