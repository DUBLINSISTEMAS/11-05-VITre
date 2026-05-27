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

/**
 * Retorna true se persistiu, false se falhou (quota cheia, privacy mode,
 * Safari ITP). Onda 31 (2026-05-27): antes era void com fail silent;
 * cliente perdia o carrinho ao recarregar sem aviso nenhum. Agora o
 * caller (useCart) pode reagir disparando toast de warning.
 */
export function writeCart(storeSlug: string, state: CartState): boolean {
  if (!isBrowser()) return false;

  try {
    const toWrite: CartState = {
      version: CART_SCHEMA_VERSION,
      items: state.items,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(buildKey(storeSlug), JSON.stringify(toWrite));
    return true;
  } catch {
    // Quota cheia / privacy mode / safari ITP — carrinho continua em
    // memória; recarregar perde. Caller responsável por avisar usuário.
    return false;
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
