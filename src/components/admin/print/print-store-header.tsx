/**
 * Cabeçalho universal de documentos impressos — Onda 2.7 (2026-05-22),
 * redesign 2026-05-29 (visual lojista).
 *
 * Header com IDENTIDADE da loja (logo + nome em destaque + dados de
 * contato + cor primária da loja como acento visual). Antes era um
 * blob monocromático centralizado sem hierarquia; agora é layout de
 * carta-comercial com cor de marca como assinatura discreta.
 *
 * Recibo térmico, A4 de venda/orçamento e fichas compartilham este
 * cabeçalho. Atende ao CLAUDE.md "Impressão e exportação — padrão
 * universal".
 *
 * `variant`:
 *   - "a4":      layout completo (faixa cor primária + logo grande +
 *                nome destacado + linhas de contato)
 *   - "thermal": compacto preto-e-branco (cor de marca não imprime em
 *                impressora térmica monocromática)
 */
import Image from "next/image";

export interface PrintStoreHeaderProps {
  store: {
    name: string;
    document: string | null;
    whatsappDisplay: string | null;
    logoUrl: string | null;
    /** Hex (#RRGGBB). Default visual fica neutro se não informado. */
    primaryColor?: string | null;
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
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
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

/** Sanitiza cor hex pra evitar injection via style inline. */
function safeHex(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

export function PrintStoreHeader({
  store,
  variant = "a4",
}: PrintStoreHeaderProps) {
  const doc = formatDocument(store.document);
  const address = joinAddress(store);

  if (variant === "thermal") {
    // Térmica: monocromática (a impressora não imprime cor de marca).
    return (
      <header className="text-center text-[11px] text-black/70">
        <h1 className="text-[13px] font-bold tracking-tight text-black">
          {store.name}
        </h1>
        {doc ? (
          <p className="mt-0.5 font-mono text-[10.5px]">CNPJ/CPF: {doc}</p>
        ) : null}
        {address ? <p className="mt-0.5 text-[10.5px]">{address}</p> : null}
        {store.whatsappDisplay ? (
          <p className="mt-0.5 font-mono text-[10.5px]">
            WhatsApp {store.whatsappDisplay}
          </p>
        ) : null}
      </header>
    );
  }

  // A4 redesign — faixa de cor primária no topo, logo + nome destacado em
  // linha, dados de contato organizados embaixo. Cor é usada com parcimônia
  // (faixa + texto do nome) pra ficar bonito mesmo impresso em PB.
  const primary = safeHex(store.primaryColor, "#1E3FE6");

  return (
    <header>
      {/* Faixa de cor primária — fica como assinatura visual no topo.
          Em impressão PB vira cinza claro (color-adjust:exact em CSS de
          print força a cor a sair). */}
      <div
        aria-hidden
        className="h-1 w-full rounded-sm"
        style={{
          background: primary,
          // print-color-adjust força browsers a imprimir a cor de fundo
          // (Chrome respeita; alguns lojistas precisam habilitar "graphics"
          // no diálogo de impressão).
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      />

      <div className="flex items-center gap-4 pt-4">
        {store.logoUrl ? (
          <div className="size-16 shrink-0 overflow-hidden rounded-md border border-black/10 bg-white">
            <Image
              src={store.logoUrl}
              alt={store.name}
              width={64}
              height={64}
              className="size-full object-contain"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-[20px] font-bold leading-tight tracking-tight"
            style={{
              color: primary,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            {store.name}
          </h1>
          <div className="mt-1 space-y-0.5 text-[11.5px] leading-snug text-black/75">
            {doc ? <p>CNPJ/CPF: {doc}</p> : null}
            {address ? <p>{address}</p> : null}
            {store.whatsappDisplay ? (
              <p>WhatsApp {store.whatsappDisplay}</p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
