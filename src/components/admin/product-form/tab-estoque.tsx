"use client";

// Aba "Estoque" do ProductForm — controle, limites de alerta, identificação.
//
// Onda 1.4 (2026-05-24) — Passo 2: eliminada a duplicação do "Estoque atual"
// (antes existia um input editável + um campo readonly num sub-card diferente,
// confundindo onde digitar). Agora:
//   - 1 único input "Estoque atual" no sub-card "Controle de estoque"
//   - Em modo EDIT, hint visual compara o digitado com o saldo no banco
//     ("vai gerar ajuste +5") + link "Ver movimentações deste produto"
//   - Sub-card "Quantidades" virou "Limites e alertas" com só mín/máx
//     (Atual readonly removido — era a fonte da confusão)
import Link from "next/link";
import type {
  Control,
  FieldErrors,
  UseFormRegister,
} from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

import type { ProductFormValues, ProductUnit } from "@/actions/product/schema";
import { StockInput } from "@/components/admin/stock-input";
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

import { SubCard } from "./shared";

// Onda 2.10 — bate com glossário CLAUDE.md (un, kg, g, m, m², L, ml, par, dúzia).
// `pc/cm/m3` permanecem no enum do DB pra produtos legados mas saíram do select.
const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: "un", label: "un" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "m", label: "m" },
  { value: "m2", label: "m²" },
  { value: "L", label: "L" },
  { value: "ml", label: "ml" },
  { value: "par", label: "par" },
  { value: "duzia", label: "dúzia" },
];

interface TabEstoqueProps {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  isPending: boolean;
  /** True em /admin/produtos/novo, false em /admin/produtos/[id]. */
  isCreating: boolean;
  /**
   * Saldo no banco quando o form carregou (somente edit). NULL em criação.
   * Usado pra mostrar o delta visual entre o digitado e o saldo real
   * — clareza pro lojista entender "quando salvar, vai gerar +5 / -3".
   */
  originalStockQuantity: number | null;
}

export function TabEstoque({
  control,
  register,
  errors,
  isPending,
  isCreating,
  originalStockQuantity,
}: TabEstoqueProps) {
  const trackStock = useWatch({ control, name: "trackStock" });
  const stockQuantity = useWatch({ control, name: "stockQuantity" });
  const productName = useWatch({ control, name: "name" });
  const variants = useWatch({ control, name: "variants" });

  // Onda 1.4 Passo 2 (2026-05-24): se HÁ pelo menos uma variante rastreada,
  // o saldo do produto-base não vale — quem controla são as variantes (mesma
  // regra do server: update.ts e loadStockSnapshot). Esconde input de saldo
  // pra evitar o bug "digitei 100 e nada mudou" (Aliança de Ouro, 2026-05-24).
  const hasTrackedVariants = (variants ?? []).some(
    (v) => v.stockQuantity !== null,
  );

  const showDeltaHint =
    !isCreating &&
    trackStock &&
    !hasTrackedVariants &&
    originalStockQuantity !== null;
  const typedNow = stockQuantity ?? 0;
  const inDb = originalStockQuantity ?? 0;
  const delta = typedNow - inDb;

  // Link pro histórico filtrado pelo nome do produto. Nome pode ter
  // mudado e não estar salvo ainda — usamos o que está no form (queryString
  // suporta caracteres especiais via encodeURIComponent dentro do Link).
  const histHref = productName?.trim()
    ? `/admin/estoque?view=historico&q=${encodeURIComponent(productName.trim())}`
    : "/admin/estoque?view=historico";

  return (
    <div className="flex flex-col gap-4">
      <SubCard
        title="Controle de estoque"
        description={
          hasTrackedVariants
            ? "Este produto tem variantes com estoque próprio. O saldo é a soma das variantes."
            : "Deixe ligado se você conta as peças. Desligue para serviços ou produtos sob encomenda."
        }
      >
        {hasTrackedVariants ? (
          <VariantsControlSaldoNotice
            isCreating={isCreating}
            variants={variants ?? []}
            histHref={histHref}
          />
        ) : (
          <>
            <Controller
              name="trackStock"
              control={control}
              render={({ field: trackField }) => (
                <Controller
                  name="stockQuantity"
                  control={control}
                  render={({ field: qtyField }) => (
                    <StockInput
                      value={{
                        trackStock: trackField.value,
                        stockQuantity: qtyField.value,
                      }}
                      onChange={(next) => {
                        trackField.onChange(next.trackStock);
                        qtyField.onChange(next.stockQuantity);
                      }}
                      disabled={isPending}
                    />
                  )}
                />
              )}
            />
            {errors.stockQuantity?.message ? (
              <p className="text-destructive text-xs">
                {errors.stockQuantity.message}
              </p>
            ) : null}

            {showDeltaHint ? (
              <DeltaHint inDb={inDb} typedNow={typedNow} delta={delta} />
            ) : null}

            {!isCreating && trackStock ? (
              <Link
                href={histHref}
                className="text-brand mt-1 inline-flex text-xs hover:underline"
                prefetch={false}
              >
                Ver movimentações deste produto →
              </Link>
            ) : null}
          </>
        )}
      </SubCard>

      {/* Onda 2.15 — permite vender mesmo zerado. Só relevante quando
          trackStock=true (sem controle, já é ilimitado). Default OFF
          preserva o bloqueio histórico de OUT_OF_STOCK no PDV. */}
      {trackStock ? (
        <SubCard
          title="Encomenda / pré-venda"
          description="Quando ligado, o PDV aceita vender mesmo se o estoque chegou a zero — útil pra peça personalizada ou pré-venda. Lojista vê aviso, mas a venda passa."
        >
          <Controller
            name="allowOversell"
            control={control}
            render={({ field }) => (
              <div className="bg-bg-app flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="product-allow-oversell"
                    className="cursor-pointer text-sm"
                  >
                    Permitir vender mesmo zerado
                  </Label>
                  <p className="text-ink-4 text-xs">
                    {field.value
                      ? "PDV mostra aviso e deixa fechar a venda."
                      : "PDV bloqueia a venda quando o saldo chega a zero (padrão)."}
                  </p>
                </div>
                <Switch
                  id="product-allow-oversell"
                  checked={field.value}
                  disabled={isPending}
                  onCheckedChange={field.onChange}
                />
              </div>
            )}
          />
        </SubCard>
      ) : null}

      {trackStock ? (
        <SubCard
          title="Limites e alertas"
          description="Mínimo dispara alerta de reposição. Máximo ajuda a identificar capital parado."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="product-min-stock">Estoque mínimo</Label>
              <Controller
                control={control}
                name="minStockQuantity"
                render={({ field }) => (
                  <Input
                    id="product-min-stock"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    placeholder="0"
                    disabled={isPending}
                    value={
                      field.value === null || field.value === undefined
                        ? ""
                        : field.value.toString()
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        field.onChange(null);
                        return;
                      }
                      const num = Number.parseInt(raw, 10);
                      if (!Number.isFinite(num) || num < 0) return;
                      field.onChange(num);
                    }}
                    aria-invalid={!!errors.minStockQuantity}
                  />
                )}
              />
              {errors.minStockQuantity?.message ? (
                <p className="text-destructive text-xs">
                  {errors.minStockQuantity.message}
                </p>
              ) : null}
              <p className="text-ink-4 text-[11px]">
                Aparece em &ldquo;Estoque baixo&rdquo; quando o saldo cair até esse valor.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-max-stock">Estoque máximo</Label>
              <Controller
                control={control}
                name="maxStockQuantity"
                render={({ field }) => (
                  <Input
                    id="product-max-stock"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    placeholder="0"
                    disabled={isPending}
                    value={
                      field.value === null || field.value === undefined
                        ? ""
                        : field.value.toString()
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        field.onChange(null);
                        return;
                      }
                      const num = Number.parseInt(raw, 10);
                      if (!Number.isFinite(num) || num < 0) return;
                      field.onChange(num);
                    }}
                    aria-invalid={!!errors.maxStockQuantity}
                  />
                )}
              />
              {errors.maxStockQuantity?.message ? (
                <p className="text-destructive text-xs">
                  {errors.maxStockQuantity.message}
                </p>
              ) : null}
              <p className="text-ink-4 text-[11px]">
                Acima desse valor conta como estoque parado.
              </p>
            </div>
          </div>
        </SubCard>
      ) : null}

      {/* Onda 2.2 — progressive disclosure: identificação é dobrável.
          Lojista comum não usa GTIN/código interno no dia-a-dia; só quem
          tem scanner ou comissão por código precisa. Default fechado. */}
      <details
        className="b3-card group rounded-xl"
        open={false}
      >
        <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 text-[13.5px] font-semibold text-ink-1 list-none">
          <span>
            Mais detalhes de estoque
            <span className="text-ink-4 ml-2 font-normal text-[12px]">
              Código de barras, código interno, unidade
            </span>
          </span>
          <span className="text-ink-4 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="border-t border-line p-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="product-gtin">Código de barras</Label>
            <Input
              id="product-gtin"
              {...register("gtin")}
              placeholder="Ex: 7891234567890"
              disabled={isPending}
              maxLength={14}
              aria-invalid={!!errors.gtin}
              inputMode="numeric"
            />
            {errors.gtin?.message ? (
              <p className="text-destructive text-xs">{errors.gtin.message}</p>
            ) : (
              <p className="text-ink-4 text-[11px]">EAN-8, 12, 13 ou 14 dígitos.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-internal-code">Código interno</Label>
            <Input
              id="product-internal-code"
              {...register("internalCode")}
              placeholder="Ex: ANE-12"
              disabled={isPending}
              maxLength={60}
              aria-invalid={!!errors.internalCode}
            />
            {errors.internalCode?.message ? (
              <p className="text-destructive text-xs">
                {errors.internalCode.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-unit">Unidade</Label>
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                  disabled={isPending}
                >
                  <SelectTrigger id="product-unit" aria-invalid={!!errors.unit}>
                    <SelectValue placeholder="un" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-ink-4 text-[11px]">
              Como você conta esse produto na venda.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

/**
 * Compara saldo digitado vs saldo no banco (modo edit). Verde quando
 * iguais ("sem alteração"), âmbar quando diferentes ("vai gerar ajuste +N").
 * Pinta a operação esperada — lojista vê antes de salvar o que vai acontecer.
 */
function DeltaHint({
  inDb,
  typedNow,
  delta,
}: {
  inDb: number;
  typedNow: number;
  delta: number;
}) {
  if (delta === 0) {
    return (
      <p className="text-xs text-emerald-700 dark:text-emerald-400">
        Saldo no banco: <strong>{inDb}</strong>. Sem alteração ao salvar.
      </p>
    );
  }
  const sign = delta > 0 ? "+" : "";
  return (
    <p className="text-xs text-amber-700 dark:text-amber-400">
      Saldo no banco: <strong>{inDb}</strong>. Você digitou{" "}
      <strong>{typedNow}</strong>. Ao salvar, vai gerar ajuste de{" "}
      <strong>
        {sign}
        {delta}
      </strong>{" "}
      no histórico.
    </p>
  );
}

/**
 * Onda 1.4 Passo 2 (2026-05-24) — quando o produto tem variantes
 * rastreadas, o saldo do produto-base é IGNORADO pelo server (mesma regra
 * de update.ts e loadStockSnapshot). Em vez de mostrar um input que vai
 * ser jogado fora, mostramos a foto consolidada: soma das variantes +
 * breakdown + link pro histórico. Lojista entende imediatamente onde
 * editar e por que.
 */
function VariantsControlSaldoNotice({
  isCreating,
  variants,
  histHref,
}: {
  isCreating: boolean;
  variants: Array<{ name: string; stockQuantity: number | null }>;
  histHref: string;
}) {
  const tracked = variants.filter((v) => v.stockQuantity !== null);
  const total = tracked.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0);

  return (
    <div className="bg-bg-app space-y-3 rounded-xl border border-line p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-ink-1 text-sm font-semibold">
            Saldo total: <span className="tabular-nums">{total}</span>{" "}
            <span className="text-ink-4 text-xs font-normal">
              (soma das {tracked.length}{" "}
              {tracked.length === 1 ? "variante" : "variantes"})
            </span>
          </p>
          <p className="text-ink-4 mt-0.5 text-xs">
            Para ajustar saldo, abra a aba <strong>Identidade</strong> e
            edite cada variante em &ldquo;Tem tamanho ou cor diferente?&rdquo;.
          </p>
        </div>
      </div>

      {tracked.length > 0 ? (
        <ul className="border-line divide-line divide-y border-t text-xs">
          {tracked.map((v, i) => (
            <li
              key={`${v.name}-${i}`}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-ink-1">{v.name}</span>
              <span className="text-ink-1 tabular-nums">{v.stockQuantity}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {!isCreating ? (
        <Link
          href={histHref}
          className="text-brand inline-flex text-xs hover:underline"
          prefetch={false}
        >
          Ver movimentações deste produto →
        </Link>
      ) : null}
    </div>
  );
}
