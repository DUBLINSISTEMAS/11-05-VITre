"use client";

/**
 * CheckoutPanel — fiel ao canvas-referencia (VTSacola).
 *
 * Estrutura canvas:
 *   1. Header sticky-title ("Sua sacola" + counter "{N} ITENS")
 *   2. Lista de itens (thumbnail 80×100 + variantes + stepper 28px + total)
 *   3. Form "Seus dados" (name + whatsapp + notes — Lote 2: NÃO existe no
 *      canvas mas é necessário pro createOrderFromCart preencher o WA;
 *      bloco mínimo, posicionado entre lista e totals).
 *   4. Cupom — Sprint 5.1 (2026-05-22): ativado. Campo "Tem código de
 *      desconto?" entre form de dados e totals. Valida via
 *      validateCouponForPublic (anon-callable, rate-limited por IP).
 *      Server revalida + aplica em createOrderFromCart no submit.
 *   5. Totals card (Subtotal/Frete/Total) bg-muted border rounded-12.
 *   6. Aviso dashed border ("Pedido finalizado pelo WhatsApp...").
 *   7. Sticky CTA WA height-48 rounded-12 shadow-colored.
 *
 * Lógica preservada (sem mudanças):
 *   - createOrderFromCart server action (idempotency via crypto.randomUUID)
 *   - RHF + Zod (customerInputSchema)
 *   - Routing pra /sucesso após sucesso
 *   - Tratamento de OUT_OF_STOCK e RATE_LIMIT
 *
 * Bottom-nav e header global escondidos em /sacola via shell-content.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronDown,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { validateCouponForPublic } from "@/actions/coupon/public";
import { createOrderFromCart } from "@/actions/order/create-from-cart";
import {
  type CustomerInput,
  customerInputSchema,
} from "@/actions/order/schema";
import { WhatsAppInput } from "@/components/onboarding/whatsapp-input";
import { StoreHeader } from "@/components/storefront/store-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Store } from "@/db/schema";
import { useCart } from "@/hooks/use-cart";
import { logger } from "@/lib/logger";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export interface CheckoutPanelProps {
  store: Store;
}

export function CheckoutPanel({ store }: CheckoutPanelProps) {
  const { state, count, subtotalCents, isHydrated, updateQty, removeItem } =
    useCart();
  const [isSubmitting, startTransition] = useTransition();
  const router = useRouter();

  // Idempotency key
  const idempotencyKeyRef = useRef<string | null>(null);
  if (idempotencyKeyRef.current === null && typeof crypto !== "undefined") {
    idempotencyKeyRef.current = crypto.randomUUID();
  }

  const form = useForm<CustomerInput>({
    resolver: zodResolver(customerInputSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerNotes: "",
    },
    mode: "onBlur",
  });

  const [storeLoaded, setStoreLoaded] = useState(false);
  useEffect(() => setStoreLoaded(true), []);

  // Sprint 5.1 — estado do cupom. couponInput é o texto digitado;
  // applied é o cupom validado (com discount). null = nada aplicado.
  // Onda 1 (2026-05-27): cupom virou collapsable dentro do totals card.
  // `couponExpanded` controla se o input + botão estão abertos. Default
  // false — 95% dos clientes não têm cupom, esconder reduz friction.
  const [couponInput, setCouponInput] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponExpanded, setCouponExpanded] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountInCents: number;
  } | null>(null);

  // Onda 3 (2026-05-27): observações virou collapsable. Cliente comum
  // não usa, e exibir um textarea grande sugeria que era obrigatório.
  // Default false; se cliente já digitou algo (raro mas possível em
  // edge cases — autofill do navegador, prefill futuro), mantém aberto.
  const [notesExpanded, setNotesExpanded] = useState(false);
  const customerNotesValue = form.watch("customerNotes");
  useEffect(() => {
    if (customerNotesValue && customerNotesValue.trim().length > 0) {
      setNotesExpanded(true);
    }
  }, [customerNotesValue]);

  // Quando o carrinho mudar, valida de novo o cupom aplicado (subtotal
  // mudou — desconto% precisa ser recalculado, valor mínimo pode
  // deixar de bater).
  useEffect(() => {
    if (!appliedCoupon || !isHydrated) return;
    let canceled = false;
    void (async () => {
      try {
        const res = await validateCouponForPublic({
          storeSlug: store.slug,
          code: appliedCoupon.code,
          subtotalInCents: subtotalCents,
        });
        if (canceled) return;
        if (!res.ok) {
          setAppliedCoupon(null);
          setCouponError(res.error);
          return;
        }
        if (res.discountInCents !== appliedCoupon.discountInCents) {
          setAppliedCoupon({
            code: res.code,
            discountInCents: res.discountInCents,
          });
        }
      } catch (err) {
        logger.error("storefront.checkout.coupon_revalidate_failed", {
          err,
          storeSlug: store.slug,
        });
        if (canceled) return;
        setCouponError("Não foi possível atualizar o cupom. Tente novamente.");
      }
    })();
    return () => {
      canceled = true;
    };
    // appliedCoupon.code é a chave; discountInCents pode mudar por
    // recálculo — não entra no array pra evitar loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCoupon?.code, subtotalCents, isHydrated, store.slug]);

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const res = await validateCouponForPublic({
        storeSlug: store.slug,
        code,
        subtotalInCents: subtotalCents,
      });
      if (!res.ok) {
        setCouponError(res.error);
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({
        code: res.code,
        discountInCents: res.discountInCents,
      });
      setCouponInput("");
      setCouponExpanded(false);
      toast.success(
        `Cupom ${res.code} aplicado · −${formatBRL(res.discountInCents)}`,
      );
    } catch (err) {
      logger.error("storefront.checkout.coupon_apply_failed", {
        err,
        storeSlug: store.slug,
      });
      setCouponError("Não foi possível validar o cupom. Tente novamente.");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponInput("");
  };

  // Total final descontando cupom — usado no rodapé e no envio.
  const discountInCents = appliedCoupon?.discountInCents ?? 0;
  const totalAfterCoupon = Math.max(0, subtotalCents - discountInCents);

  const isEmpty = isHydrated && count === 0;
  const storeFirstName = store.name.split(" ")[0] ?? store.name;

  const onSubmit = (data: CustomerInput) => {
    const items = state.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      quantity: it.quantity,
    }));
    if (items.length === 0) {
      toast.error("Sacola vazia.");
      return;
    }
    if (!idempotencyKeyRef.current) {
      toast.error("Falha ao iniciar checkout. Recarregue a pagina.");
      return;
    }

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createOrderFromCart>>;
      try {
        result = await createOrderFromCart({
          storeSlug: store.slug,
          idempotencyKey: idempotencyKeyRef.current!,
          items,
          // Sprint 5.1 — server revalida e aplica o desconto; o
          // appliedCoupon do client é só preview.
          couponCode: appliedCoupon?.code ?? null,
          ...data,
        });
      } catch (err) {
        logger.error("storefront.checkout.create_order_failed", {
          err,
          storeSlug: store.slug,
        });
        toast.error("Não foi possível enviar o pedido.", {
          description: "Verifique sua conexão e tente novamente.",
        });
        return;
      }

      if (result.ok && result.publicToken) {
        // `auto=1` aciona o handoff automático na /sucesso — usuário
        // é redirecionado pro WhatsApp do lojista após 2.5s sem precisar
        // clicar em nada. Onda 5 do pacote master 2026-05-13.
        router.push(
          `/${store.slug}/sucesso?token=${result.publicToken}&auto=1`,
        );
        return;
      }

      if (result.errorCode === "OUT_OF_STOCK") {
        toast.error("Algum item esgotou", {
          description: "Atualize a sacola e tente novamente.",
        });
        return;
      }
      if (result.errorCode === "RATE_LIMIT") {
        toast.error("Muitas tentativas", {
          description: "Aguarde alguns instantes e tente novamente.",
        });
        return;
      }
      if (result.errorCode === "COUPON_INVALID") {
        // Sprint 5.1 — cupom virou inválido entre preview e submit
        // (foi pausado pelo lojista, atingiu limite, expirou no meio
        // do checkout). Remove o preview e instrui cliente.
        setAppliedCoupon(null);
        setCouponError(
          result.errorMessage ?? "Cupom não disponível mais — sacola atualizada.",
        );
        toast.error("Cupom não disponível mais.", {
          description: "A sacola foi atualizada. Tente finalizar de novo.",
        });
        return;
      }
      toast.error(result.errorMessage ?? "Algo deu errado. Tente novamente.");
    });
  };

  // SSR / pré-hidratação
  if (!isHydrated || !storeLoaded) {
    return (
      <>
        <StoreHeader variant="sticky-title" store={store} title="Sua sacola" />
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-20">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando sacola...</p>
        </div>
      </>
    );
  }

  if (isEmpty) {
    return (
      <>
        <StoreHeader variant="sticky-title" store={store} title="Sua sacola" />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="bg-muted mx-auto mb-6 flex size-20 items-center justify-center rounded-full">
            <ShoppingBag
              className="text-muted-foreground size-10"
              aria-hidden
            />
          </div>
          <h1 className="text-foreground text-2xl font-bold">
            Sua sacola está vazia
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Adicione produtos da vitrine da {store.name} e finalize seu pedido aqui.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href={`/${store.slug}`}>Ver vitrine</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {/*
        Onda 1 (2026-05-27): subtitle com nome da loja preserva contexto
        de identidade. Cliente que veio do link da "Joias Dublin" agora
        vê "Sua sacola · Joias Dublin" em vez de só "Sua sacola" descontextualizado.
        Counter "{N} ITENS" foi removido em 2026-05-13 (founder ruidoso).
      */}
      <StoreHeader
        variant="sticky-title"
        store={store}
        title="Sua sacola"
        subtitle={store.name}
      />

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto w-full max-w-screen-md px-4 pb-32 pt-2"
        noValidate
      >
        {/* Lista de itens */}
        <ul className="divide-border divide-y" role="list">
          {state.items.map((item) => (
            <li
              key={`${item.productId}:${item.variantId ?? "_"}`}
              className="py-3 first:pt-0"
            >
              <CartItemRow
                item={item}
                onIncrement={() =>
                  updateQty(item.productId, item.variantId, item.quantity + 1)
                }
                onDecrement={() =>
                  updateQty(item.productId, item.variantId, item.quantity - 1)
                }
                onRemove={() => removeItem(item.productId, item.variantId)}
              />
            </li>
          ))}
        </ul>

        {/*
          Onda 1 (2026-05-27) — fluxo reordenado pro padrão e-commerce:
            1. Lista de itens
            2. Totals card (cupom collapsable embutido)
            3. Form "Seus dados"
            4. Aviso brand-tinted WhatsApp
            5. CTA

          Antes: itens → form → cupom → totals → aviso. Cliente preenchia
          dados antes de ver o total, friction máxima. Agora vê total ANTES
          de decidir preencher — heurística "ver o preço antes de dar dados".

          Cupom virou collapsable atrás de "Tem código promocional?". 95%
          dos clientes não tem cupom; esconder reduz ruído visual e
          alivia o cognitive load no momento de fechamento.
        */}
        <div className="border-border bg-muted/40 mt-5 space-y-2 rounded-xl border p-3.5">
          <Row label="Subtotal" value={formatBRL(subtotalCents)} mono />
          {appliedCoupon ? (
            <Row
              label={`Cupom ${appliedCoupon.code}`}
              value={`−${formatBRL(discountInCents)}`}
              mono
            />
          ) : null}
          <Row label="Frete" value="A combinar" />

          {/* Cupom collapsable embutido dentro do totals card */}
          <div className="pt-1">
            {appliedCoupon ? (
              <div className="border-state-ok/30 bg-state-ok/10 flex items-center justify-between rounded-md border px-2.5 py-1.5">
                <span className="text-state-ok text-[11px] font-medium">
                  ✓ Cupom {appliedCoupon.code} aplicado
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline"
                >
                  Remover
                </button>
              </div>
            ) : couponExpanded ? (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value);
                      if (couponError) setCouponError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyCoupon();
                      }
                    }}
                    placeholder="Ex: MAIO10"
                    maxLength={40}
                    className="h-9 flex-1 uppercase"
                    aria-label="Código de desconto"
                    disabled={applyingCoupon}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => void applyCoupon()}
                    disabled={
                      applyingCoupon || couponInput.trim().length === 0
                    }
                    className="h-9"
                  >
                    {applyingCoupon ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Aplicar"
                    )}
                  </Button>
                </div>
                {couponError ? (
                  <p
                    role="alert"
                    className="text-destructive text-[11px] font-medium"
                  >
                    {couponError}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setCouponExpanded(false);
                    setCouponInput("");
                    setCouponError(null);
                  }}
                  className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCouponExpanded(true)}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-[11.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <ChevronDown className="size-3.5" aria-hidden />
                Tem código promocional?
              </button>
            )}
          </div>

          <hr className="border-border my-2" />
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] font-semibold">Total</span>
            <span className="text-[18px] font-semibold tabular-nums tracking-tight">
              {formatBRL(totalAfterCoupon)}
            </span>
          </div>
        </div>

        {/* Form Seus dados — agora DEPOIS do totals (Onda 1). Bloco mínimo
            necessário pro createOrderFromCart preencher o WhatsApp. */}
        <section className="mt-5 space-y-3">
          <h2 className="text-muted-foreground font-mono text-[9.5px] uppercase tracking-[0.5px]">
            Seus dados
          </h2>
          <div className="space-y-3">
            <FieldGroup
              label="Nome completo"
              htmlFor="customerName"
              error={form.formState.errors.customerName?.message}
              required
            >
              <Input
                id="customerName"
                autoComplete="name"
                placeholder="Como devemos te chamar?"
                className="h-10"
                {...form.register("customerName")}
                aria-invalid={!!form.formState.errors.customerName}
              />
            </FieldGroup>

            <FieldGroup
              label="WhatsApp"
              htmlFor="customerPhone"
              error={form.formState.errors.customerPhone?.message}
              required
            >
              <Controller
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <WhatsAppInput
                    id="customerPhone"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    aria-invalid={!!form.formState.errors.customerPhone}
                  />
                )}
              />
            </FieldGroup>

            {/* Observações collapsable Onda 3: cliente comum não usa,
                exibir textarea grande sugeria obrigatoriedade. Default
                fechado; se houver valor (autofill, edge case), expande. */}
            {notesExpanded ? (
              <FieldGroup
                label="Observações"
                htmlFor="customerNotes"
                hint="Tamanho, cor, horário de entrega — opcional"
                error={form.formState.errors.customerNotes?.message}
              >
                <Textarea
                  id="customerNotes"
                  rows={3}
                  placeholder="Ex.: pode entregar na portaria a partir de 14h"
                  className="resize-none"
                  autoFocus
                  {...form.register("customerNotes")}
                  aria-invalid={!!form.formState.errors.customerNotes}
                />
              </FieldGroup>
            ) : (
              <button
                type="button"
                onClick={() => setNotesExpanded(true)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <ChevronDown className="size-3.5" aria-hidden />
                Adicionar instruções (opcional)
              </button>
            )}
          </div>
        </section>

        {/*
          Onda 1 (2026-05-27) — aviso WhatsApp PROMOVIDO de letra miúda
          (dashed border cinza) pra bloco brand-tinted positivo. Antes
          parecia "termo legal pequeno"; agora comunica o DIFERENCIAL da
          Mangos Pay (WhatsApp-checkout sem cadastro) como vantagem.
          Ícone MessageCircle reforça canal.
        */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-whatsapp/30 bg-whatsapp/10 p-3.5">
          <MessageCircle
            className="text-whatsapp size-5 shrink-0"
            strokeWidth={1.8}
            aria-hidden
          />
          <p className="text-foreground/85 text-[12.5px] leading-[1.5]">
            Sua compra é confirmada direto com{" "}
            <span className="text-foreground font-semibold">
              {storeFirstName}
            </span>{" "}
            pelo WhatsApp — frete e pagamento combinados na hora, sem
            cadastro.
          </p>
        </div>
      </form>

      {/* Sticky CTA WA — Onda 27 (2026-05-27):
          - rounded-t-2xl + border-t leve pra paridade Apple com o
            bottom-nav arredondado (Onda 14/19).
          - Total INLINE no CTA: cliente que rolou pra cima/baixo no
            form perde de vista o totals card; ver o valor a pagar
            colado no botão de ação é padrão Shopee/Shein/Aritzia. */}
      <div
        className="border-border/40 bg-background fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-screen-md">
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="bg-whatsapp hover:bg-whatsapp-hover text-whatsapp-foreground h-12 w-full rounded-xl text-[14px] font-semibold shadow-[0_6px_16px_rgba(37,211,102,0.3)]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Enviando pedido...
              </>
            ) : (
              <>
                <WhatsAppIcon className="size-5" />
                <span>Finalizar no WhatsApp</span>
                <span aria-hidden className="opacity-60">
                  ·
                </span>
                <span className="tabular-nums">{formatBRL(totalAfterCoupon)}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground text-[12px]">{label}</span>
      <span
        className={cn(
          "text-foreground text-[12px] tabular-nums",
          mono && "font-mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function FieldGroup({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[12px] font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-[11px] font-medium">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-[11px]">{hint}</p>
      ) : null}
    </div>
  );
}

interface CartItemRowProps {
  item: import("@/lib/cart/types").CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

function CartItemRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemRowProps) {
  const lineTotal = item.cachedPriceCents * item.quantity;
  const stockCap = item.cachedStockQty;
  const canIncrement = stockCap === null || item.quantity < stockCap;

  return (
    <div className="flex gap-3">
      {/* thumbnail 80×100 conforme canvas */}
      <div className="bg-muted relative h-[100px] w-20 shrink-0 overflow-hidden rounded-lg">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.productName}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground/50 grid size-full place-items-center text-[10px]">
            Sem foto
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Sprint flash 2026-05-24 — removido kicker UUID truncado
                (`productId.slice(0,8)`) que aparecia como "5fa3b8c1"
                acima do nome do produto. Cliente final via aquilo
                como código aleatório de golpe. Quando houver variante,
                mostramos cor/tamanho como kicker. */}
            {item.variantName ? (
              <p className="text-muted-foreground text-[10.5px] uppercase tracking-[0.5px]">
                {item.variantName}
              </p>
            ) : null}
            <p className="text-foreground mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-[1.25]">
              {item.productName}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hocus:text-destructive -m-1 p-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={`Remover ${item.productName}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between pt-2">
          {/* Stepper Onda 3 (2026-05-27): h-7 (28px) → h-9 (36px). Antes
              estava sub-touch-target Apple HIG (44px) e Android (48dp);
              cliente sênior do ICP errava +/-. 36px é o compromisso entre
              touch-friendly e densidade do card de item. Ícones Minus/Plus
              também sobem (size-3 → size-3.5) pra contraste com o botão maior. */}
          <div className="border-border flex h-9 items-center rounded-lg border">
            <button
              type="button"
              onClick={onDecrement}
              className={cn(
                "grid size-9 place-items-center rounded-l-lg transition-colors",
                "text-foreground hover:bg-muted",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label={`Diminuir quantidade de ${item.productName}`}
            >
              <Minus className="size-3.5" />
            </button>
            <span
              className="w-7 text-center text-[13px] font-semibold tabular-nums"
              aria-label={`Quantidade: ${item.quantity}`}
            >
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={onIncrement}
              disabled={!canIncrement}
              className={cn(
                "grid size-9 place-items-center rounded-r-lg transition-colors",
                "text-foreground hover:bg-muted",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
              aria-label={`Aumentar quantidade de ${item.productName}`}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <span className="text-foreground text-[13px] font-semibold tabular-nums">
            {formatBRL(lineTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * WhatsApp logo path — usado direto pra evitar dependency em outro
 * componente. Fonte: brand guidelines WhatsApp + Lucide-style stroke.
 */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.768.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}
