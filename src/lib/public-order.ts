import { customAlphabet } from "nanoid";

import {
  buildOrderMessage,
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
  const message = buildOrderMessage({
    storeName: input.storeName,
    customerName: "cliente",
    items: input.items,
    totalInCents: input.totalInCents,
    shortCode: input.shortCode,
    publicUrl: input.publicUrl,
  });

  return `${message}\n\nCódigo do pedido: ${input.shortCode}`;
}
