"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { storeTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/**
 * Config mínima da loja relevante pro PDV (Sprint 3 — audit 2026-05-26).
 *
 * Hoje retorna: limites e taxa de juros do cartão. Read-only. Sem rate
 * limit (autenticado + RLS). PdvShell faz `useEffect` no mount.
 *
 * Mantém prefixo `load*` (CLAUDE.md #3 — leitura pura sem side-effect).
 */
export interface PdvStoreConfig {
  cardMaxInstallments: number;
  cardInterestRateBps: number;
  cardInterestFreeUpTo: number;
}

export async function loadPdvConfig(): Promise<PdvStoreConfig | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  return withTenant(store.id, session.user.id, async (tx) => {
    const [row] = await tx
      .select({
        cardMaxInstallments: storeTable.cardMaxInstallments,
        cardInterestRateBps: storeTable.cardInterestRateBps,
        cardInterestFreeUpTo: storeTable.cardInterestFreeUpTo,
      })
      .from(storeTable)
      .where(eq(storeTable.id, store.id))
      .limit(1);
    if (!row) return null;
    return {
      cardMaxInstallments: row.cardMaxInstallments,
      cardInterestRateBps: row.cardInterestRateBps,
      cardInterestFreeUpTo: row.cardInterestFreeUpTo,
    };
  });
}
