/**
 * Tipos compartilhados do PDV (S4.1 — extraídos de pdv-shell.tsx 3409).
 *
 * Mantidos isolados pra:
 *   1. Sections em ./sections/* poderem importar sem ciclo
 *   2. Facilitar criação de hooks customizados (./hooks/*) em futuras
 *      iterações de refactor
 */
import type { BanknoteIcon } from "lucide-react";

import type { PaymentMethod } from "@/actions/order/balcao/schema";

export interface CartItem {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  priceInCents: number;
  quantity: number;
  thumbUrl: string | null;
  trackStock: boolean;
  stockQuantity: number | null;
  /**
   * Desconto por linha em centavos (Fase 4 / 2026-05-21). NULL ou 0 = sem
   * desconto. Source of truth em cents — % é só UX. Validação server-side
   * garante `<= priceInCents × quantity`. Persiste em
   * `order_item.discount_in_cents`.
   */
  discountInCents: number | null;
  /**
   * Snapshot dos preços do produto pra recalcular quando lojista
   * vincula cliente atacado COM carrinho já montado (sprint flash
   * 2026-05-24). basePriceInCents = preço varejo (sem promo);
   * wholesalePriceInCents = preço atacado quando produto tem (null
   * quando produto não tem preço atacado cadastrado).
   */
  basePriceInCents: number;
  wholesalePriceInCents: number | null;
}

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  Icon: typeof BanknoteIcon;
}

export interface LastSale {
  publicToken: string | null;
  totalInCents: number;
}

/**
 * Sprint 1A — uma linha do pagamento dividido no form do PDV.
 * Strings em vez de cents pra acomodar UX de digitação (vírgula, vazio).
 * Conversão pra cents acontece no submit.
 */
export interface PaymentLineState {
  id: string;
  method: PaymentMethod;
  amountInput: string;
  cashReceivedInput: string;
  /**
   * Parcelas do cartão de crédito (1..12 no PDV — limite prático BR).
   * Só faz sentido > 1 quando method='credit'. Resetado pra 1 ao trocar
   * de método. Persistido em `order_payment.installments` (SQL 70).
   * Mangos Pay NÃO calcula juros — só registra a escolha. A maquininha
   * cobra a taxa do lojista fora do sistema.
   */
  installments: number;
  notes: string;
}
