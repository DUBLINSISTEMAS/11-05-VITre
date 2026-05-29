/**
 * /admin/orcamentos/ficha/[id]/imprimir — visualização imprimível A4 da
 * ficha de orçamento de balcão (2026-05-28).
 *
 * Layout estilo "talão de papel" do joalheiro:
 *   header da loja (logo + CNPJ + tel + endereço) → bloco cliente →
 *   bloco datas → discriminação (borda larga) → grid valores+assinaturas
 *   lado a lado → rodapé com aviso configurável.
 *
 * Auto-print no mount. CSS @media print esconde o chrome do admin
 * (`[data-admin-chrome]`) e força fundo branco.
 */
import { notFound } from "next/navigation";

import { loadQuoteSheetDetail } from "@/actions/quote-sheet/load-detail";
import { PrintStoreHeader } from "@/components/admin/print/print-store-header";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";

import { AutoPrintBar } from "./auto-print";

export const dynamic = "force-dynamic";

interface ImprimirFichaPageProps {
  params: Promise<{ id: string }>;
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

export default async function ImprimirFichaPage({
  params,
}: ImprimirFichaPageProps) {
  const { id } = await params;
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: imprimir ficha sem loja");
  }

  const result = await loadQuoteSheetDetail(id);
  if (!result.ok) notFound();
  const q = result.quoteSheet;

  const customerDoc = formatBRDocument(q.customerDocument);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 1.5cm; }
          html, body { background: white !important; color: black !important; }
          [data-admin-chrome] { display: none !important; }
        }
      `}</style>

      <AutoPrintBar backHref="/admin/orcamentos" />

      <article className="mx-auto max-w-[700px] bg-white px-6 py-8 text-black print:px-0 print:py-0">
        {/* Cabeçalho da loja (logo + CNPJ + endereço + tel) */}
        <div className="border-b border-black/20 pb-4">
          <PrintStoreHeader store={store} variant="a4" />
        </div>

        {/* Título do documento */}
        <header className="border-b border-black/20 pb-3 pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-bold tracking-tight">
              ORÇAMENTO #{q.shortCode}
            </h2>
            <span className="font-mono text-[12px] uppercase tracking-wider">
              Ficha de balcão
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-black/70">
            Emitido em{" "}
            {q.createdAt.toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </header>

        {/* Cliente — grid 2col */}
        <section className="mt-5 break-inside-avoid">
          <h3 className="font-mono text-[10.5px] uppercase tracking-[0.5px] text-black/60">
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
            <FieldRow label="Data de recebimento" value={formatDate(q.receivedAt)} mono />
            <FieldRow label="Data de entrega" value={formatDate(q.deliveryAt)} mono />
          </dl>
        </section>

        {/* Discriminação — borda larga, texto livre */}
        <section className="mt-6 break-inside-avoid">
          <h3 className="font-mono text-[10.5px] uppercase tracking-[0.5px] text-black/60">
            Discriminação
          </h3>
          <div className="mt-2 min-h-[120px] whitespace-pre-wrap rounded border border-black/40 p-3 text-[13px] leading-relaxed">
            {q.description}
          </div>
        </section>

        {/* Grid lado a lado: valores (esquerda) + assinaturas (direita) */}
        <section className="mt-6 grid grid-cols-2 gap-6 break-inside-avoid">
          {/* Valores */}
          <div>
            <h3 className="font-mono text-[10.5px] uppercase tracking-[0.5px] text-black/60">
              Valores
            </h3>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              <FieldRow label="Valor" value={formatBRL(q.totalInCents)} mono strong />
              <FieldRow
                label="Entrada"
                value={formatBRL(q.downPaymentInCents)}
                mono
              />
              {q.downPaymentNote ? (
                <FieldRow
                  label="Forma"
                  value={q.downPaymentNote}
                  small
                />
              ) : null}
              <FieldRow
                label="Restante"
                value={formatBRL(q.remainderInCents)}
                mono
                strong
              />
            </dl>
          </div>

          {/* Assinaturas */}
          <div className="space-y-6">
            <SignatureBlock label="Assinatura do cliente" />
            <SignatureBlock label="Assinatura do responsável" />
          </div>
        </section>

        {/* Aviso configurável (rodapé) */}
        {q.noticeText ? (
          <section className="mt-8 break-inside-avoid border-t border-black/20 pt-3">
            <p className="text-[11.5px] leading-snug text-black/70 whitespace-pre-wrap">
              {q.noticeText}
            </p>
          </section>
        ) : null}

        {/* Rodapé fixo — referência do código */}
        <footer className="mt-6 border-t border-black/10 pt-2 text-[10.5px] text-black/40">
          Ficha #{q.shortCode} · {store.name}
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
