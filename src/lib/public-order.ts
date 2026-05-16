import { customAlphabet } from "nanoid";

import {
  buildOrderMessageFromTemplate,
  type WhatsAppItemInput,
} from "@/lib/whatsapp-message";

const TOKEN_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";

export const PUBLIC_ORDER_TOKEN_LENGTH = 24;

const generateToken = customAlphabet(TOKEN_ALPHABET, PUBLIC_ORDER_TOKEN_LENGTH);

export interface PublicOrderMessageInput {
  storeName: string;
  shortCode: string;
  publicUrl: string;
  items: WhatsAppItemInput[];
  totalInCents: number;
  customerName?: string | null;
  customerPhone?: string | null;
  customerNotes?: string | null;
  /**
   * Template custom da loja (campo `store.whatsappTemplate`). Quando
   * null, builder usa DEFAULT_WHATSAPP_TEMPLATE.
   */
  whatsappTemplate?: string | null;
  /**
   * Texto livre de formas de pagamento aceitas (storeTable.payment
   * MethodsNote). Alimenta placeholder {formaPagamento} no template.
   * Fase 2 — ADR-0013.
   */
  paymentMethodsNote?: string | null;
}

export function generatePublicOrderToken(): string {
  return generateToken();
}

export function buildPublicOrderPath(publicToken: string): string {
  return `/p/${publicToken}`;
}

export function buildPublicOrderWhatsAppMessage(
  input: PublicOrderMessageInput,
): string {
  return buildOrderMessageFromTemplate({
    template: input.whatsappTemplate ?? null,
    storeName: input.storeName,
    customerName: input.customerName?.trim() || "cliente",
    items: input.items,
    totalInCents: input.totalInCents,
    shortCode: input.shortCode,
    publicUrl: input.publicUrl,
    customerNotes: input.customerNotes ?? undefined,
    paymentMethodsNote: input.paymentMethodsNote ?? null,
  });
}
