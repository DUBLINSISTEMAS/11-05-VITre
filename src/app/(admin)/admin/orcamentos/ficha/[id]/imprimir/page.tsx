/**
 * /admin/orcamentos/ficha/[id]/imprimir — ficha de balcão imprimível
 * (2026-05-28, redesign 2026-05-29).
 *
 * Layout estilo carta-comercial do joalheiro: faixa cor primária no topo →
 * logo + nome destacado + dados de contato → bloco cliente → datas →
 * discriminação → grid valores+assinaturas → aviso → rodapé com Mangos
 * Pay discreto.
 *
 * Suporta dois formatos via `?formato=`:
 *   - `?formato=termica` → cupom 80mm preto-e-branco
 *   - default (a4)       → A4 com cor primária da loja como acento
 *
 * Auto-print no mount; troca de formato força re-disparo.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadQuoteSheetDetail } from "@/actions/quote-sheet/load-detail";
import { PrintStoreHeader } from "@/components/admin/print/print-store-header";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";

import { AutoPrintBar } from "./auto-print";
import { type PrintFormat, PrintFormatToggle } from "./format-toggle";

export const dynamic = "force-dynamic";

// Override do title default ("Mangos Pay — Loja online com checkout
// WhatsApp") pra que o browser não imprima o subtítulo de marketing no
// cabeçalho do papel. Template do root layout vira "Imprimir ficha · Mangos Pay".
export const metadata: Metadata = { title: "Imprimir ficha" };

interface ImprimirFichaPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ formato?: string }>;
}

function parseFormat(raw: string | undefined): PrintFormat {
  return raw === "termica" ? "termica" : "a4";
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatBRDocument(d: string | null): string | null {
  if (!d) return null;
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return d;
}

function safeHex(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

export default async function ImprimirFichaPage({
  params,
  searchParams,
}: ImprimirFichaPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const format = parseFormat(sp.formato);

  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: imprimir ficha sem loja");
  }

  const result = await loadQuoteSheetDetail(id);
  if (!result.ok) notFound();
  const q = result.quoteSheet;

  const customerDoc = formatBRDocument(q.customerDocument);
  const primary = safeHex(store.primaryColor, "#1E3FE6");

  if (format === "termica") {
    return (
      <>
        <style>{`
          @media print {
            @page { size: 80mm auto; margin: 0; }
            html, body { background: white !important; color: black !important; margin: 0; padding: 0; }
            [data-admin-chrome] { display: none !important; }
          }
          @media screen { body { background: #efefef; } }
        `}</style>

        <AutoPrintBar backHref="/admin/orcamentos" formatKey={format}>
          <PrintFormatToggle current={format} />
        </AutoPrintBar>

        <article className="mx-auto my-4 max-w-[80mm] bg-white px-3 py-3 text-[11px] text-black shadow-md print:my-0 print:max-w-none print:shadow-none">
          <PrintStoreHeader store={store} variant="thermal" />

          <div className="my-2 border-t border-dashed border-black/40" />

          <h2 className="text-center text-[12px] font-bold uppercase tracking-wider">
            Orçamento #{q.shortCode}
          </h2>
          <p className="text-center text-[10px] text-black/60">
            {q.createdAt.toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>

          <div className="my-2 border-t border-dashed border-black/40" />

          <dl className="space-y-0.5 text-[10.5px]">
            <ThermalRow label="Cliente" value={q.customerName} bold />
            {q.customerPhone ? (
              <ThermalRow label="Telefone" value={q.customerPhone} />
            ) : null}
            {customerDoc ? (
              <ThermalRow label="CPF/CNPJ" value={customerDoc} />
            ) : null}
            {q.customerCity ? (
              <ThermalRow label="Cidade" value={q.customerCity} />
            ) : null}
            {q.receivedAt ? (
              <ThermalRow label="Recebido" value={formatDate(q.receivedAt)} />
            ) : null}
            {q.deliveryAt ? (
              <ThermalRow label="Entrega" value={formatDate(q.deliveryAt)} />
            ) : null}
          </dl>

          <div className="my-2 border-t border-dashed border-black/40" />

          <p className="text-[9.5px] uppercase tracking-wider text-black/60">
            Discriminação
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug">
            {q.description}
          </p>

          <div className="my-2 border-t border-dashed border-black/40" />

          <dl className="space-y-0.5 text-[11px]">
            <ThermalRow label="Valor" value={formatBRL(q.totalInCents)} bold />
            <ThermalRow
              label="Entrada"
              value={formatBRL(q.downPaymentInCents)}
            />
            {q.downPaymentNote ? (
              <p className="text-[10px] italic text-black/70">
                Forma: {q.downPaymentNote}
              </p>
            ) : null}
            <ThermalRow
              label="Restante"
              value={formatBRL(q.remainderInCents)}
              bold
            />
          </dl>

          <div className="my-2 border-t border-dashed border-black/40" />

          {/* Assinaturas — térmica é mais compacta, uma linha cada */}
          <div className="space-y-3 pt-1">
            <ThermalSignature label="Cliente" />
            <ThermalSignature label="Responsável" />
          </div>

          {q.noticeText ? (
            <>
              <div className="my-2 border-t border-dashed border-black/40" />
              <p className="whitespace-pre-wrap text-[10px] font-bold leading-snug text-black">
                {q.noticeText}
              </p>
            </>
          ) : null}

          <p className="mt-3 text-center text-[8.5px] text-black/40">
            Mangos Pay
          </p>
        </article>
      </>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 1.5cm; }
          html, body { background: white !important; color: black !important; }
          [data-admin-chrome] { display: none !important; }
        }
      `}</style>

      <AutoPrintBar backHref="/admin/orcamentos" formatKey={format}>
        <PrintFormatToggle current={format} />
      </AutoPrintBar>

      <article className="mx-auto max-w-[700px] bg-white px-6 py-8 text-black print:px-0 print:py-0">
        {/* Cabeçalho com cor primária da loja */}
        <PrintStoreHeader store={store} variant="a4" />

        {/* Título do documento — também com primary color sutil */}
        <header className="mt-5 flex items-baseline justify-between gap-4 border-b border-black/15 pb-3">
          <h2
            className="text-[18px] font-bold tracking-tight"
            style={{
              color: primary,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            ORÇAMENTO #{q.shortCode}
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-wider text-black/60">
            Ficha de balcão
          </span>
        </header>
        <p className="mt-1 text-[12px] text-black/60">
          Emitido em{" "}
          {q.createdAt.toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>

        {/* Cliente — grid 2col */}
        <section className="mt-5 break-inside-avoid">
          <h3
            className="font-mono text-[10.5px] uppercase tracking-[0.5px]"
            style={{
              color: primary,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            Cliente
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            <FieldRow label="Cliente" value={q.customerName} strong />
            <FieldRow label="Telefone" value={q.customerPhone ?? "—"} mono />
            <FieldRow label="CPF / CNPJ" value={customerDoc ?? "—"} mono />
            <FieldRow label="Cidade" value={q.customerCity ?? "—"} />
          </dl>
        </section>

        {/* Datas */}
        <section className="mt-5 break-inside-avoid">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            <FieldRow
              label="Data de recebimento"
              value={formatDate(q.receivedAt)}
              mono
            />
            <FieldRow
              label="Data de entrega"
              value={formatDate(q.deliveryAt)}
              mono
            />
          </dl>
        </section>

        {/* Discriminação — borda larga, texto livre */}
        <section className="mt-6 break-inside-avoid">
          <h3
            className="font-mono text-[10.5px] uppercase tracking-[0.5px]"
            style={{
              color: primary,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            Discriminação
          </h3>
          <div className="mt-2 min-h-[120px] whitespace-pre-wrap rounded border border-black/40 p-3 text-[13px] leading-relaxed">
            {q.description}
          </div>
        </section>

        {/* Valores (esquerda) + assinaturas (direita) */}
        <section className="mt-6 grid grid-cols-2 gap-6 break-inside-avoid">
          <div>
            <h3
              className="font-mono text-[10.5px] uppercase tracking-[0.5px]"
              style={{
                color: primary,
                WebkitPrintColorAdjust: "exact",
                printColorAdjust: "exact",
              }}
            >
              Valores
            </h3>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              <FieldRow
                label="Valor"
                value={formatBRL(q.totalInCents)}
                mono
                strong
              />
              <FieldRow
                label="Entrada"
                value={formatBRL(q.downPaymentInCents)}
                mono
              />
              {q.downPaymentNote ? (
                <FieldRow label="Forma" value={q.downPaymentNote} small />
              ) : null}
              <FieldRow
                label="Restante"
                value={formatBRL(q.remainderInCents)}
                mono
                strong
              />
            </dl>
          </div>

          <div className="space-y-6">
            <SignatureBlock label="Assinatura do cliente" />
            <SignatureBlock label="Assinatura do responsável" />
          </div>
        </section>

        {/* Aviso configurável — em negrito pra dar destaque (regra de
            joalheria: o cliente PRECISA ver o aviso de prazo/responsabilidade) */}
        {q.noticeText ? (
          <section className="mt-8 break-inside-avoid border-t border-black/15 pt-3">
            <p className="whitespace-pre-wrap text-[12px] font-bold leading-snug text-black/80">
              {q.noticeText}
            </p>
          </section>
        ) : null}

        {/* Rodapé — só ID + nome da loja. Sem vitre.site (founder pediu
            remoção). "Mangos Pay" minúsculo do lado direito como assinatura. */}
        <footer className="mt-8 border-t border-black/10 pt-2 text-[10px] text-black/40">
          <div className="flex items-baseline justify-between gap-2">
            <span>
              Ficha #{q.shortCode} · {store.name}
            </span>
            <span className="font-mono">Mangos Pay</span>
          </div>
        </footer>
      </article>
    </>
  );
}

// =============== Subcomponents ===============

function FieldRow({
  label,
  value,
  strong,
  mono,
  small,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-x-2">
      <dt className="text-[11.5px] text-black/60">{label}</dt>
      <dd
        className={[
          mono ? "font-mono tabular-nums" : "",
          strong ? "font-semibold" : "",
          small ? "text-[11.5px] text-black/70" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function SignatureBlock({ label }: { label: string }) {
  return (
    <div>
      <div className="h-10 border-b border-black/60" aria-hidden />
      <p className="mt-1 text-center text-[10.5px] uppercase tracking-wider text-black/60">
        {label}
      </p>
    </div>
  );
}

function ThermalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-black/60">{label}</span>
      <span className={bold ? "font-bold tabular-nums" : "tabular-nums"}>
        {value}
      </span>
    </div>
  );
}

function ThermalSignature({ label }: { label: string }) {
  return (
    <div>
      <div className="h-6 border-b border-black/60" aria-hidden />
      <p className="mt-0.5 text-center text-[8.5px] uppercase tracking-wider text-black/60">
        {label}
      </p>
    </div>
  );
}
