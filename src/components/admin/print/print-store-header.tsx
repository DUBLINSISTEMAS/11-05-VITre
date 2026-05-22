/**
 * Cabeçalho universal de documentos impressos — Onda 2.7 (2026-05-22).
 *
 * Recibo térmico, A4 de venda/orçamento e fechamento Z compartilham este
 * cabeçalho. Atende ao CLAUDE.md "Impressão e exportação — padrão
 * universal" (logo + nome + CNPJ + endereço + telefone).
 *
 * Sem styling de container — encaixa em A4 (700px) e térmica (420px)
 * porque usa `text-center` + tamanhos relativos. Pais decidem largura.
 *
 * `variant`:
 *   - "a4":      layout completo (logo + título + 3 linhas de contato)
 *   - "thermal": compacto (1-2 linhas, sem logo grande)
 */
import Image from "next/image";

export interface PrintStoreHeaderProps {
  store: {
    name: string;
    document: string | null;
    whatsappDisplay: string | null;
    logoUrl: string | null;
    addressStreet: string | null;
    addressNumber: string | null;
    addressNeighborhood: string | null;
    addressCity: string | null;
    addressState: string | null;
  };
  variant?: "a4" | "thermal";
}

function formatDocument(d: string | null): string | null {
  if (!d) return null;
  if (d.length === 11) {
    // CPF 123.456.789-09
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    // CNPJ 12.345.678/0001-99
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
      8,
      12,
    )}-${d.slice(12)}`;
  }
  return d;
}

function joinAddress(s: PrintStoreHeaderProps["store"]): string | null {
  const street = s.addressStreet
    ? `${s.addressStreet}${s.addressNumber ? `, ${s.addressNumber}` : ""}`
    : null;
  const cityState =
    s.addressCity && s.addressState
      ? `${s.addressCity}/${s.addressState}`
      : null;
  const parts = [street, s.addressNeighborhood, cityState].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : null;
}

export function PrintStoreHeader({
  store,
  variant = "a4",
}: PrintStoreHeaderProps) {
  const doc = formatDocument(store.document);
  const address = joinAddress(store);
  const isThermal = variant === "thermal";

  return (
    <header
      className={
        isThermal
          ? "text-center text-[11px] text-black/70"
          : "text-center"
      }
    >
      {!isThermal && store.logoUrl ? (
        <div className="mx-auto mb-2 size-12 overflow-hidden rounded-full bg-black/5">
          <Image
            src={store.logoUrl}
            alt={store.name}
            width={48}
            height={48}
            className="size-full object-cover"
          />
        </div>
      ) : null}
      <h1
        className={
          isThermal
            ? "text-[13px] font-bold tracking-tight text-black"
            : "text-[15px] font-bold tracking-tight"
        }
      >
        {store.name}
      </h1>
      {doc ? (
        <p
          className={
            isThermal ? "mt-0.5 font-mono text-[10.5px]" : "mt-0.5 text-[11.5px]"
          }
        >
          CNPJ/CPF: {doc}
        </p>
      ) : null}
      {address ? (
        <p
          className={
            isThermal ? "mt-0.5 text-[10.5px]" : "mt-0.5 text-[11.5px]"
          }
        >
          {address}
        </p>
      ) : null}
      {store.whatsappDisplay ? (
        <p
          className={
            isThermal ? "mt-0.5 font-mono text-[10.5px]" : "mt-0.5 text-[11.5px]"
          }
        >
          WhatsApp {store.whatsappDisplay}
        </p>
      ) : null}
    </header>
  );
}
