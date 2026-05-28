import type { ReactNode } from "react";

import { CustomerFormDrawerListener } from "@/components/admin/customer-form-drawer-listener";
import { FeedbackWidget } from "@/components/admin/feedback-widget";
import { OrderDetailDrawerListener } from "@/components/admin/order-detail-drawer-listener";
import { NewSaleModalListener } from "@/components/admin/pdv/new-sale-modal";
import { ProductFormDrawerListener } from "@/components/admin/product-form-drawer-listener";

import { AdminSidebar, type AdminSidebarProps } from "./admin-sidebar";
import { CommandPalette } from "./command-palette";
import { MobileHeader } from "./header";
import { TopBar } from "./topbar";

export interface AdminShellProps extends AdminSidebarProps {
  children: ReactNode;
}

/**
 * Shell do painel admin — port Dublin v3 BAGY-style (Onda A.3, ADR-0019).
 *
 * Layout:
 * - Desktop (lg+): b3-shell flex → b3-side (sidebar 248px com 3 grupos
 *   CONTROLE INTERNO/MINHA LOJA/CONTA + items recolhíveis) + b3-main flex
 *   column → TopBar sticky (search global + bolt + bell) + main content.
 * - Mobile (<lg): MobileHeader sticky (hamburger + logo + sino) + main.
 *   Sidebar entra via Sheet drawer no hamburger.
 *
 * Banner de trial REMOVIDO em 2026-05-18 (decisão founder): vai voltar quando
 * o módulo de Assinatura (B.5) estiver fechado e tivermos `trialEndsAt` real.
 * Hardcoded "14 dias" não agrega valor pra clientes pagos que founder já vai
 * onboardar agora.
 *
 * O wrapper b3-shell + b3-main + b3-side cuida do sticky/overflow/min-w-0
 * (definidos no globals.css). `.b3-main` tem background `var(--bg-app)`
 * (cinza) — cards continuam `var(--surface)` (branco), dando o "ar de
 * sistema" pedido pelo founder em 2026-05-18.
 */
export function AdminShell({ children, ...userProps }: AdminShellProps) {
  return (
    <div className="b3-shell print:block">
      <AdminSidebar {...userProps} />

      <div className="b3-main">
        <TopBar
          storeSlug={userProps.storeSlug}
          storeName={userProps.storeName}
          ownerName={userProps.ownerName}
          ownerEmail={userProps.ownerEmail}
          logoUrl={userProps.logoUrl}
          primaryColor={userProps.primaryColor}
        />
        <MobileHeader {...userProps} />

        {/*
          Card branco flutuante (ref Abacate Pay 2026-05-21) — fundo branco
          com border-radius 20px e margem visível em volta mostrando o cinza
          do .b3-main. Scroll do conteúdo é interno a este card (não scroll
          de página) pra a curva inferior ficar sempre visível na viewport.
        */}
        <main className="b3-main-card flex-1 px-4 pt-4 pb-12 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-12 print:px-0 print:py-0 print:m-0 print:rounded-none print:shadow-none">
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

      <CommandPalette />
      {/* Host global do modal de Nova venda — abre via CTA do topbar (evento
          NEW_SALE_EVENT) e via tecla F2 (com guarda contra teclar F2 dentro
          de inputs ou dentro do próprio PdvShell). Handoff 2026-05-25. */}
      <NewSaleModalListener />
      {/* Host global do drawer de detalhe da venda — abre via evento
          OPEN_ORDER_DETAIL_EVENT (row da OrdersTable, "Vendas recentes" do
          dashboard, etc) ou via deep-link `?detail=<id>`. Handoff 2026-05-25. */}
      <OrderDetailDrawerListener />
      {/* Host global do drawer de produto — abre via evento
          OPEN_PRODUCT_FORM_EVENT (row da ProductsTable, CTA "Novo produto"
          do header, Cmd+K) ou deep-link `?edit=<id|new>`. PP1 Fase B
          (handoff pixel-perfect 2026-05-25). */}
      <ProductFormDrawerListener storeSlug={userProps.storeSlug} />
      {/* Host global do drawer de cliente — abre via evento
          OPEN_CUSTOMER_FORM_EVENT (row da CustomersTable, CTA "Adicionar
          cliente") ou deep-link `?customer=<id|new>`. PP2 (handoff). */}
      <CustomerFormDrawerListener />
      {/* Widget flutuante de feedback — botão amarelo bottom-right + Sheet
          com 4 tipos · mensagem · contexto auto-preenchido. Resend manda
          pra suporte@mangospay.app com reply-to do lojista. Handoff Passo 14. */}
      <FeedbackWidget
        ownerName={userProps.ownerName}
        ownerEmail={userProps.ownerEmail}
        storeName={userProps.storeName}
      />
    </div>
  );
}
