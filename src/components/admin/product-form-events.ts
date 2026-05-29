/**
 * Eventos globais do ProductFormDrawer — handoff PP1 Fase B (2026-05-25).
 *
 * Arquivo neutro (sem `"use client"`) pra que tanto Server Components
 * quanto Client Components possam importar a constante sem cruzar boundary
 * (mesmo padrão de order-detail-events.ts + new-sale-events.ts).
 *
 * Quem dispara:
 *   - Row da ProductsTable em /admin/produtos
 *   - ProductCreateButton ("+ Novo produto" do header)
 *   - Quick action "Novo produto" do Cmd+K palette
 *   - Qualquer outro ponto que precise abrir/editar produto sem navegar
 *
 * Quem escuta: `<ProductFormDrawerListener />` montado em admin-shell.
 *
 * Payload: productId via CustomEvent.detail. `null` = modo novo.
 */
export const OPEN_PRODUCT_FORM_EVENT = "admin:open-product-form";

export interface OpenProductFormEventDetail {
  /** UUID do produto pra editar. `null` = abrir form vazio (novo). */
  productId: string | null;
  /**
   * Bloco F.1 (2026-05-29) — aba inicial. Quando setada, o ProductForm
   * abre direto naquela aba (em vez do default "basico"). Util pra
   * qualquer ponto da UI que queira mandar o lojista direto pra uma
   * aba especifica (ex: dashboard avisando produto sem foto -> "imagens",
   * relatorio de margem -> "preco").
   */
  initialTab?: "basico" | "imagens" | "preco" | "precificacao" | "estoque" | "variantes" | "loja";
}
