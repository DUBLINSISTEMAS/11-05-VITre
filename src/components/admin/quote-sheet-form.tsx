"use client";

/**
 * Form da ficha de orçamento de balcão (2026-05-28).
 *
 * Layout em colunas espelha a "ficha de papel" do joalheiro: cabeçalho fixo
 * da loja (banner com logo + CNPJ + tel) → cliente → datas → discriminação
 * → valores → aviso. Submit grava + redireciona pra impressão.
 *
 * Cents conversion: input texto/number aceita reais (R$ X,XX), state local
 * mantém em centavos pra restante derivar em tempo real. Action recebe cents.
 */

import { Loader2Icon, PrinterIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createQuoteSheet } from "@/actions/quote-sheet/create";
import { type CreateQuoteSheetInput } from "@/actions/quote-sheet/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export interface QuoteSheetFormStore {
  name: string;
  document: string | null;
  whatsappDisplay: string | null;
  logoUrl: string | null;
  addressCity: string | null;
  addressState: string | null;
}

export interface QuoteSheetFormProps {
  store: QuoteSheetFormStore;
  /** Aviso sugerido — texto que pré-preenche o campo "Observação". Pode
   *  vir de config futura; por ora, é fixo na rota /ficha/novo. */
  defaultNotice?: string;
}

// --------------- Helpers ---------------

function reaisToCents(input: string): number {
  if (!input) return 0;
  // Aceita "1.234,56", "1234,56", "1234.56", "1234".
  const cleaned = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove . de milhar
    .replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100);
}

function formatBRDocument(d: string): string {
  const digits = d.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    // CPF — formata progressivamente
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  // CNPJ
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// --------------- Component ---------------

export function QuoteSheetForm({ store, defaultNotice }: QuoteSheetFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  // Estado controlado (form simples — sem RHF; menos boilerplate pra essa
  // ficha de campos planos).
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [deliveryAt, setDeliveryAt] = useState("");
  const [description, setDescription] = useState("");
  const [totalReais, setTotalReais] = useState("");
  const [downReais, setDownReais] = useState("");
  const [downPaymentNote, setDownPaymentNote] = useState("");
  const [noticeText, setNoticeText] = useState(defaultNotice ?? "");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const totalCents = useMemo(() => reaisToCents(totalReais), [totalReais]);
  const downCents = useMemo(() => reaisToCents(downReais), [downReais]);
  const remainderCents = Math.max(0, totalCents - downCents);

  const setError = (field: string, message: string) =>
    setFieldErrors((prev) => ({ ...prev, [field]: message }));

  const clearError = (field: string) =>
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    setFieldErrors({});
    const payload: CreateQuoteSheetInput = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || null,
      customerDocument:
        customerDocument.replace(/\D/g, "").slice(0, 14) || null,
      customerCity: customerCity.trim() || null,
      receivedAt: receivedAt || null,
      deliveryAt: deliveryAt || null,
      description: description.trim(),
      totalInCents: totalCents,
      downPaymentInCents: downCents,
      downPaymentNote: downPaymentNote.trim() || null,
      noticeText: noticeText.trim() || null,
    };

    // Validação superficial client-side antes de chamar action.
    if (!payload.customerName) {
      setError("customerName", "Nome do cliente é obrigatório.");
      return;
    }
    if (!payload.description) {
      setError("description", "Descreva a peça/serviço.");
      return;
    }
    if (totalCents <= 0) {
      setError("totalInCents", "Informe o valor.");
      return;
    }
    if (downCents > totalCents) {
      setError("downPaymentInCents", "Entrada maior que o valor total.");
      return;
    }

    submittingRef.current = true;
    startTransition(async () => {
      try {
        const result = await createQuoteSheet(payload);
        if (!result.ok) {
          if (result.fieldErrors) {
            for (const [field, message] of Object.entries(result.fieldErrors)) {
              setError(field, message);
            }
          }
          toast.error(result.error);
          return;
        }
        toast.success("Ficha criada. Abrindo impressão.");
        router.push(`/admin/orcamentos/ficha/${result.quoteSheet.id}/imprimir`);
      } finally {
        submittingRef.current = false;
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Banner da loja — readonly */}
      <StoreBanner store={store} />

      {/* Cliente */}
      <Section title="Cliente" description="Dados de quem está deixando a peça.">
        <Row cols={2}>
          <Field
            label="Cliente"
            htmlFor="qs-cust-name"
            required
            error={fieldErrors.customerName}
          >
            <Input
              id="qs-cust-name"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                clearError("customerName");
              }}
              placeholder="Maria da Silva"
              disabled={isPending}
              aria-invalid={!!fieldErrors.customerName}
              autoComplete="off"
            />
          </Field>
          <Field
            label="Telefone"
            htmlFor="qs-cust-phone"
            error={fieldErrors.customerPhone}
          >
            <Input
              id="qs-cust-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(99) 99999-9999"
              disabled={isPending}
              inputMode="tel"
              autoComplete="off"
            />
          </Field>
        </Row>
        <Row cols={2}>
          <Field
            label="CPF / CNPJ"
            htmlFor="qs-cust-doc"
            error={fieldErrors.customerDocument}
          >
            <Input
              id="qs-cust-doc"
              value={customerDocument}
              onChange={(e) =>
                setCustomerDocument(formatBRDocument(e.target.value))
              }
              placeholder="000.000.000-00"
              disabled={isPending}
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Cidade"
            htmlFor="qs-cust-city"
            error={fieldErrors.customerCity}
          >
            <Input
              id="qs-cust-city"
              value={customerCity}
              onChange={(e) => setCustomerCity(e.target.value)}
              placeholder="Açailândia"
              disabled={isPending}
              autoComplete="off"
            />
          </Field>
        </Row>
      </Section>

      {/* Datas */}
      <Section
        title="Recebimento e entrega"
        description="Datas opcionais — preencha as que fizerem sentido."
      >
        <Row cols={2}>
          <Field
            label="Data de recebimento"
            htmlFor="qs-received"
            error={fieldErrors.receivedAt}
          >
            <Input
              id="qs-received"
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              disabled={isPending}
            />
          </Field>
          <Field
            label="Data de entrega"
            htmlFor="qs-delivery"
            error={fieldErrors.deliveryAt}
          >
            <Input
              id="qs-delivery"
              type="date"
              value={deliveryAt}
              onChange={(e) => setDeliveryAt(e.target.value)}
              disabled={isPending}
            />
          </Field>
        </Row>
      </Section>

      {/* Discriminação */}
      <Section
        title="Discriminação"
        description="Descreva a peça: tipo, peso, material, observações. Aparece na borda principal da ficha impressa."
      >
        <Field
          label="O que está sendo orçado"
          htmlFor="qs-desc"
          required
          error={fieldErrors.description}
          hint="Ex.: Aliança em prata 950, 4g cada, gravação interna 'M&J 04/06'."
        >
          <Textarea
            id="qs-desc"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clearError("description");
            }}
            placeholder="Descreva a peça e detalhes técnicos"
            rows={5}
            disabled={isPending}
            aria-invalid={!!fieldErrors.description}
          />
        </Field>
      </Section>

      {/* Valores */}
      <Section
        title="Valores"
        description="Restante calculado automaticamente (Valor − Entrada)."
      >
        <Row cols={3}>
          <Field
            label="Valor"
            htmlFor="qs-total"
            required
            error={fieldErrors.totalInCents}
          >
            <Input
              id="qs-total"
              inputMode="decimal"
              value={totalReais}
              onChange={(e) => {
                setTotalReais(e.target.value);
                clearError("totalInCents");
              }}
              placeholder="0,00"
              disabled={isPending}
              aria-invalid={!!fieldErrors.totalInCents}
            />
          </Field>
          <Field
            label="Entrada"
            htmlFor="qs-down"
            error={fieldErrors.downPaymentInCents}
            hint="Quanto o cliente pagou agora (0 se nada)."
          >
            <Input
              id="qs-down"
              inputMode="decimal"
              value={downReais}
              onChange={(e) => {
                setDownReais(e.target.value);
                clearError("downPaymentInCents");
              }}
              placeholder="0,00"
              disabled={isPending}
              aria-invalid={!!fieldErrors.downPaymentInCents}
            />
          </Field>
          <Field label="Restante" htmlFor="qs-remainder" hint="Calculado.">
            <Input
              id="qs-remainder"
              value={formatBRL(remainderCents)}
              readOnly
              disabled={isPending}
              className="bg-bg-app/60 font-medium tabular-nums"
            />
          </Field>
        </Row>
        <Field
          label="Forma da entrada (opcional)"
          htmlFor="qs-down-note"
          error={fieldErrors.downPaymentNote}
          hint='Texto livre. Ex.: "Pix R$ 200 + 6× cartão", "à vista", "12× cartão".'
        >
          <Input
            id="qs-down-note"
            value={downPaymentNote}
            onChange={(e) => setDownPaymentNote(e.target.value)}
            placeholder="Pix R$ 200 + 6× cartão"
            disabled={isPending}
          />
        </Field>
      </Section>

      {/* Observação / aviso */}
      <Section
        title="Observação / aviso"
        description="Texto livre que sai no rodapé da ficha impressa. Use pra avisos como prazo de retirada, responsabilidade etc."
      >
        <Field
          label="Aviso ao cliente (opcional)"
          htmlFor="qs-notice"
          error={fieldErrors.noticeText}
        >
          <Textarea
            id="qs-notice"
            value={noticeText}
            onChange={(e) => setNoticeText(e.target.value)}
            placeholder="Ex.: Não nos responsabilizamos por peças deixadas por mais de 90 dias…"
            rows={3}
            disabled={isPending}
          />
        </Field>
      </Section>

      {/* CTAs */}
      <div className="border-line sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t bg-surface px-4 py-3 sm:-mx-6 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/orcamentos")}
          disabled={isPending}
        >
          <XIcon className="size-4" aria-hidden /> Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <PrinterIcon className="size-4" aria-hidden />
          )}
          Salvar e imprimir
        </Button>
      </div>
    </form>
  );
}

// =============== Subcomponents ===============

function StoreBanner({ store }: { store: QuoteSheetFormStore }) {
  const city =
    store.addressCity && store.addressState
      ? `${store.addressCity}/${store.addressState}`
      : store.addressCity ?? null;

  return (
    <div className="border-line bg-bg-app/40 flex items-center gap-3 rounded-lg border px-4 py-3">
      {store.logoUrl ? (
        <span className="relative size-12 shrink-0 overflow-hidden rounded-full border border-line bg-white">
          <Image
            src={store.logoUrl}
            alt=""
            fill
            sizes="48px"
            className="object-contain p-1"
          />
        </span>
      ) : (
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full bg-mangos-green-800 text-[15px] font-bold text-white"
        >
          {store.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-ink-1 truncate text-[13.5px] font-semibold">
          {store.name}
        </p>
        <p className="text-ink-4 mt-0.5 truncate text-[11.5px]">
          {[
            store.document ? `CNPJ/CPF: ${formatBRDocument(store.document)}` : null,
            store.whatsappDisplay ? `WhatsApp ${store.whatsappDisplay}` : null,
            city,
          ]
            .filter(Boolean)
            .join(" · ") || "Preencha os dados da loja em Configurações."}
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line space-y-3 rounded-lg border bg-surface p-4 sm:p-5">
      <header>
        <h2 className="text-ink-1 text-[13.5px] font-semibold">{title}</h2>
        {description ? (
          <p className="text-ink-4 mt-0.5 text-[12px]">{description}</p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({
  cols,
  children,
}: {
  cols: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[12.5px]">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive text-[11.5px]">{error}</p>
      ) : hint ? (
        <p className="text-ink-4 text-[11.5px]">{hint}</p>
      ) : null}
    </div>
  );
}
