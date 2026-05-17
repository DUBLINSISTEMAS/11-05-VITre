"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  type UpdatePaymentInput,
  updatePaymentSchema,
} from "@/actions/store/schema";
import { updatePayment } from "@/actions/store/update-payment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface PaymentConfigInitialData {
  acceptsCard: boolean;
  cardMaxInstallments: number;
  installmentBasePrice: "base" | "effective";
  showInstallmentsOnPDP: boolean;
  cashDiscountBps: number;
  paymentMethodsNote: string | null;
}

interface PaymentConfigFormProps {
  initialData: PaymentConfigInitialData;
}

/**
 * Form da rota dedicada `/admin/pagamento` (Fase 2 — ADR-0013).
 *
 * Extraído de StoreConfigForm em 2026-05-16 a pedido do founder: cada
 * domínio funcional do admin tem rota própria (Pagamento, Aparência,
 * Configurações), nada de FormCards empilhados numa página catch-all.
 * Memory team `admin-rota-dedicada-por-dominio-2026-05-16.md` documenta
 * o padrão.
 *
 * `acceptsCard` é gate mestre: quando desligado, os controles de parcela
 * ficam visualmente desabilitados (não removidos do form, pra não perder
 * valor digitado se o lojista religar acceptsCard).
 */
export function PaymentConfigForm({ initialData }: PaymentConfigFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const {
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
    setError,
  } = useForm<UpdatePaymentInput>({
    resolver: zodResolver(updatePaymentSchema),
    defaultValues: {
      acceptsCard: initialData.acceptsCard,
      cardMaxInstallments: initialData.cardMaxInstallments,
      installmentBasePrice: initialData.installmentBasePrice,
      showInstallmentsOnPDP: initialData.showInstallmentsOnPDP,
      cashDiscountBps: initialData.cashDiscountBps,
      paymentMethodsNote: initialData.paymentMethodsNote ?? "",
    },
  });

  const acceptsCardValue = watch("acceptsCard");

  const onSubmit = (values: UpdatePaymentInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    startTransition(async () => {
      try {
        const result = await updatePayment(values);
        if (!result.ok) {
          if (result.fieldErrors) {
            for (const [field, message] of Object.entries(result.fieldErrors)) {
              setError(field as keyof UpdatePaymentInput, { message });
            }
          }
          toast.error(result.error);
          return;
        }
        toast.success("Pagamento salvo.");
        router.refresh();
      } finally {
        submittingRef.current = false;
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 pb-36 lg:pb-4"
    >
      <FormCard
        title="Cartão de crédito"
        description="Controle se a vitrine mostra cálculo de parcelas e sobre qual preço a parcela é calculada."
      >
        <Controller
          name="acceptsCard"
          control={control}
          render={({ field }) => (
            <ToggleRow
              id="pay-accepts-card"
              label="Aceito cartão de crédito"
              description="Quando desligado, nenhuma label de parcela aparece — independente das outras opções abaixo."
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isPending}
            />
          )}
        />

        <Controller
          name="showInstallmentsOnPDP"
          control={control}
          render={({ field }) => (
            <ToggleRow
              id="pay-show-installments"
              label="Mostrar parcelas na página do produto"
              description="Se desligado, você ainda aceita cartão — mas a vitrine não mostra o cálculo de parcela (deixa pra combinar no WhatsApp)."
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isPending || !acceptsCardValue}
            />
          )}
        />

        <div className="space-y-1.5">
          <Label htmlFor="pay-max-installments">Máximo de parcelas</Label>
          <Controller
            name="cardMaxInstallments"
            control={control}
            render={({ field }) => (
              <Select
                value={String(field.value)}
                onValueChange={(v) => field.onChange(Number(v))}
                disabled={isPending || !acceptsCardValue}
              >
                <SelectTrigger
                  id="pay-max-installments"
                  className="w-full sm:max-w-[160px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}×
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-ink-4 text-xs">
            Você pode sobrescrever esse limite por produto, na tela de
            edição (em &ldquo;Preços e promoção&rdquo;).
          </p>
          {errors.cardMaxInstallments?.message ? (
            <p className="text-destructive text-xs">
              {errors.cardMaxInstallments.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pay-installment-base">Calcular parcela sobre</Label>
          <Controller
            name="installmentBasePrice"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isPending || !acceptsCardValue}
              >
                <SelectTrigger
                  id="pay-installment-base"
                  className="w-full sm:max-w-[260px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Preço cheio (recomendado)</SelectItem>
                  <SelectItem value="effective">
                    Preço atual (promo se ativa)
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-ink-4 text-xs">
            &ldquo;Preço cheio&rdquo; preserva o valor original mesmo em
            promoção (3× de R$ 100 em vez de 3× de R$ 80). &ldquo;Preço
            atual&rdquo; divide sempre pelo valor que o cliente paga hoje.
          </p>
        </div>
      </FormCard>

      <FormCard
        title="Desconto à vista"
        description="Aparece na página do produto e ajuda a fechar a venda no PIX/dinheiro. Você pode sobrescrever por produto na tela de edição."
      >
        <div className="space-y-1.5">
          <Label htmlFor="pay-cash-discount">Desconto à vista (%)</Label>
          <Controller
            name="cashDiscountBps"
            control={control}
            render={({ field }) => {
              // `cashDiscountBps` é z.coerce.number — tipo de INPUT (RHF)
              // é unknown; normalizamos pra number no render. Memory
              // `zod-action-input-type-with-defaults.md` documenta o porquê.
              const bpsValue =
                typeof field.value === "number" ? field.value : 0;
              return (
                <div className="flex items-center gap-2">
                  <Input
                    id="pay-cash-discount"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min={0}
                    max={99.99}
                    // Form guarda em basis points (10% = 1000 bps); UI
                    // mostra em percentual com decimal.
                    value={
                      bpsValue === 0
                        ? ""
                        : String(Math.round(bpsValue) / 100).replace(".", ",")
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(",", ".").trim();
                      if (raw === "") {
                        field.onChange(0);
                        return;
                      }
                      const pct = Number.parseFloat(raw);
                      if (!Number.isFinite(pct) || pct < 0) {
                        field.onChange(0);
                        return;
                      }
                      field.onChange(Math.min(9999, Math.round(pct * 100)));
                    }}
                    placeholder="0"
                    className="w-32"
                    disabled={isPending}
                    aria-invalid={!!errors.cashDiscountBps}
                  />
                  <span className="text-ink-4 text-sm">% off</span>
                </div>
              );
            }}
          />
          <p className="text-ink-4 text-xs">
            Vai aparecer no produto como &ldquo;à vista R$ X (Y% off)
            &rdquo;. O método (PIX, dinheiro) você descreve no campo abaixo.
          </p>
          {errors.cashDiscountBps?.message ? (
            <p className="text-destructive text-xs">
              {errors.cashDiscountBps.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pay-methods-note">
            Como aceito pagamento (opcional)
          </Label>
          <Controller
            name="paymentMethodsNote"
            control={control}
            render={({ field }) => {
              const text = field.value ?? "";
              return (
                <>
                  <Textarea
                    id="pay-methods-note"
                    placeholder="Ex: PIX, dinheiro ou cartão (até 10x). Combine pelo WhatsApp."
                    rows={2}
                    maxLength={280}
                    disabled={isPending}
                    aria-invalid={!!errors.paymentMethodsNote}
                    value={text}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? null : e.target.value,
                      )
                    }
                  />
                  <div className="text-ink-4 flex justify-between text-xs">
                    <span>
                      Aparece no produto e no template do WhatsApp via{" "}
                      <code className="font-mono">{"{formaPagamento}"}</code>.
                    </span>
                    <span className="tabular-nums">{text.length}/280</span>
                  </div>
                </>
              );
            }}
          />
          {errors.paymentMethodsNote?.message ? (
            <p className="text-destructive text-xs">
              {errors.paymentMethodsNote.message}
            </p>
          ) : null}
        </div>
      </FormCard>

      {/* Save desktop inline */}
      <div className="hidden justify-end pt-4 lg:flex">
        <Button
          type="submit"
          disabled={isPending || !isDirty}
          className="min-w-32"
        >
          {isPending ? (
            <>
              <Loader2Icon className="animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <SaveIcon /> Salvar
            </>
          )}
        </Button>
      </div>

      {/* Save mobile sticky (acima do bottom nav) */}
      <div
        className={cn(
          "surface-elevated fixed inset-x-0 z-50 px-4 py-3 lg:hidden",
        )}
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 3.5rem + 0.25rem)",
        }}
      >
        <Button
          type="submit"
          disabled={isPending || !isDirty}
          className="w-full"
          size="lg"
        >
          {isPending ? (
            <>
              <Loader2Icon className="animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <SaveIcon /> Salvar
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label htmlFor={id} className="text-[12.5px] font-medium">
          {label}
        </Label>
        {description ? (
          <p className="text-ink-4 text-[11px] leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

interface FormCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function FormCard({ title, description, children }: FormCardProps) {
  return (
    <section className="b3-card p-4 sm:p-5">
      <header className="mb-4 space-y-0.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
          {title}
        </h2>
        {description ? (
          <p className="text-ink-4 text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
