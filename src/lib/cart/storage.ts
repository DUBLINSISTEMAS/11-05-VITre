/**
 * Persistência do carrinho em localStorage.
 *
 * Chave: `Mangos Pay:cart:${storeSlug}` — humano-amigável pra debug. Rename
 * de slug (Fase 2+) orfana o cart antigo, aceitável.
 *
 * TTL de 7 dias via `savedAt`. Carrinho vencido = empty cart (não tenta
 * recuperar dados podres).
 *
 * Schema versionado: ao detectar versão diferente da atual, descarta
 * (futuro-proof contra mudanças quebradas).
 *
 * Tudo blindado contra `localStorage` indisponível (SSR, modo
 * privado iOS, quota cheio) — falha graciosamente devolvendo cart vazio.
 */
import {
  CART_SCHEMA_VERSION,
  CART_TTL_DAYS,
  type CartState,
  EMPTY_CART,
} from "./types";

const TTL_MS = CART_TTL_DAYS * 24 * 60 * 60 * 1000;

function buildKey(storeSlug: string): string {
  return `Mangos Pay:cart:${storeSlug}`;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readCart(storeSlug: string): CartState {
  if (!isBrowser()) return EMPTY_CART;

  try {
    const raw = window.localStorage.getItem(buildKey(storeSlug));
    if (!raw) return EMPTY_CART;

    const parsed = JSON.parse(raw) as Partial<CartState>;
    if (parsed.version !== CART_SCHEMA_VERSION) return EMPTY_CART;
    if (!parsed.savedAt || !Array.isArray(parsed.items)) return EMPTY_CART;

    const savedAt = Date.parse(parsed.savedAt);
    if (!Number.isFinite(savedAt)) return EMPTY_CART;
    if (Date.now() - savedAt > TTL_MS) {
      // Vencido. Limpa proativamente pra não acumular lixo.
      clearCart(storeSlug);
      return EMPTY_CART;
    }

    return {
      version: CART_SCHEMA_VERSION,
      items: parsed.items,
      savedAt: parsed.savedAt,
    };
  } catch {
    return EMPTY_CART;
  }
}

export function writeCart(storeSlug: string, state: CartState): void {
  if (!isBrowser()) return;

  try {
    const toWrite: CartState = {
      version: CART_SCHEMA_VERSION,
      items: state.items,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(buildKey(storeSlug), JSON.stringify(toWrite));
  } catch {
    // Quota cheia / privacy mode / safari ITP — falha silenciosa.
    // O carrinho continua em memória; recarregar perde, mas não quebra.
  }
}

export function clearCart(storeSlug: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(buildKey(storeSlug));
  } catch {
    // ignore
  }
}
