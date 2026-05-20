"use server";

/**
 * loadStoreInfoForReport — Sprint 5.
 *
 * Helper compartilhado entre os relatórios A4. Retorna o objeto que
 * `<ReportLayout/>` espera em `storeInfo`. Centraliza a composição do
 * endereço pra não duplicar lógica nos 5 relatórios.
 *
 * Retorna `null` se sessão expirou ou loja não encontrada — caller
 * deve render mensagem amigável.
 */
import { headers } from "next/headers";

import type { ReportStoreInfo } from "@/components/admin/report/report-layout";
import { auth } from "@/lib/auth";
import { getCurrentStore } from "@/lib/store-context";

export async function loadStoreInfoForReport(): Promise<ReportStoreInfo | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const store = await getCurrentStore(session.user.id);
  if (!store) return null;

  const address = [
    store.addressStreet
      ? `${store.addressStreet}${store.addressNumber ? ", " + store.addressNumber : ""}`
      : null,
    store.addressNeighborhood,
    store.addressCity && store.addressState
      ? `${store.addressCity}/${store.addressState}`
      : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    name: store.name,
    logoUrl: store.logoUrl,
    address: address || null,
    whatsapp: store.whatsappDisplay,
  };
}
