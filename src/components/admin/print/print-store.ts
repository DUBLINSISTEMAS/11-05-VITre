/**
 * Helper para extrair `PrintStore` (interface do componente PrintLayout)
 * a partir da entidade `store` do DB. Centraliza fallbacks e
 * formatação. Importado server-side em qualquer rota imprimível.
 *
 * Campos CNPJ/telefone NÃO existem hoje no `storeTable` — quando o
 * lojista preencher no `/admin/configuracoes` (planejado pra Fase 2),
 * basta passar via parâmetro opcional.
 */
import type { Store } from "@/db/schema/store";

import type { PrintStore } from "./print-layout";

/**
 * Converte uma entity do storeTable em PrintStore. Lida com nullables
 * (lojista pode não ter preenchido endereço).
 *
 * Endereço: monta uma única linha "rua, número · bairro · cidade-UF".
 * Pula partes vazias. Retorna null se nenhuma parte preenchida.
 */
export function toPrintStore(
  store: Store,
  extras: { cnpj?: string | null; phone?: string | null } = {},
): PrintStore {
  return {
    name: store.name,
    slug: store.slug,
    cnpj: extras.cnpj ?? null,
    phone: extras.phone ?? null,
    address: buildAddressLine(store),
  };
}

function buildAddressLine(store: Store): string | null {
  const parts: string[] = [];
  if (store.addressStreet) {
    const main = [store.addressStreet, store.addressNumber]
      .filter(Boolean)
      .join(", ");
    if (main) parts.push(main);
  }
  if (store.addressNeighborhood) parts.push(store.addressNeighborhood);
  if (store.addressCity) {
    const cityState = [store.addressCity, store.addressState]
      .filter(Boolean)
      .join(" - ");
    if (cityState) parts.push(cityState);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
