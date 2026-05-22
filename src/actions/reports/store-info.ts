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

/**
 * Sprint 4.1 — CPF (11) ou CNPJ (14) com pontuação canônica. Outros
 * formatos passam direto (UI já mostra a string sem mexer).
 */
function formatDocument(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.length === 11) {
    return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
  }
  if (raw.length === 14) {
    return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
  }
  return raw;
}

/**
 * Sprint 4.8 — nome do operador que está gerando o relatório (rodapé
 * universal "Gerado em ... por {operador}"). Retorna `null` se sessão
 * expirou.
 */
export async function loadReportOperatorName(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.name ?? null;
}

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
    document: formatDocument(store.document),
  };
}
