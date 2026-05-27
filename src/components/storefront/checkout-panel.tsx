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

  // Idempotency key — Onda 31 (2026-05-27): persistido em sessionStorage
  // keyed por storeSlug. Antes era useRef puro: se cliente: submit →
  // erro de rede → reload → submit, gerava NOVA key e podia criar 2
  // pedidos (server idempotency falha porque a key mudou). Agora a key
  // sobrevive ao reload da aba; só zera quando a aba fecha (sessionStorage)
  // ou quando pedido é confirmado (route push pra /sucesso).
  const idempotencyKeyRef = useRef<string | null>(null);
  if (idempotencyKeyRef.current === null && typeof window !== "undefined") {
    try {
      const storageKey = `Mangos Pay:idempotency:${store.slug}`;
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) {
        idempotencyKeyRef.current = stored;
      } else if (typeof crypto !== "undefined") {
        const fresh = crypto.randomUUID();
        idempotencyKeyRef.current = fresh;
        window.sessionStorage.setItem(storageKey, fresh);
      }
    } catch {
      // sessionStorage indisponível — degrada pra useRef puro (cenário
      // raro, mas funciona pelo menos durante a vida do componente).
      if (typeof crypto !== "undefined") {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
    }
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
  //
  // Onda 31 (2026-05-27): debounce 500ms. Antes cada add/remove disparava
  // uma chamada — cliente adicionando 5 itens em sequência fazia 5
  // requests. Rate limit publicApi permite (60/min) mas era desperdício.
  // Agora só revalida quando o cliente para de mexer por 500ms.
  useEffect(() => {
    if (!appliedCoupon || !isHydrated) return;
    let canceled = false;
    const timeoutId = setTimeout(() => {
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
    }, 500);
    return () => {
      canceled = true;
      clearTimeout(timeoutId);
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
      // Onda 31 (2026-05-27): timeout 20s no submit pra evitar spinner
      // eterno em internet ruim. Cliente sênior do interior não diagnostica
      // "rede caiu" — fica olhando o loading sem entender. 20s é confortável
      // pra rede 3G; após isso, mostra erro com retry CTA explícito.
      const SUBMIT_TIMEOUT_MS = 20_000;
      let result: Awaited<ReturnType<typeof createOrderFromCart>>;
      try {
        result = await Promise.race([
          createOrderFromCart({
            storeSlug: store.slug,
            idempotencyKey: idempotencyKeyRef.current!,
            items,
            // Sprint 5.1 — server revalida e aplica o desconto; o
            // appliedCoupon do client é só preview.
            couponCode: appliedCoupon?.code ?? null,
            ...data,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("CHECKOUT_TIMEOUT")),
              SUBMIT_TIMEOUT_MS,
            ),
          ),
        ]);
      } catch (err) {
        const isTimeout =
          err instanceof Error && err.message === "CHECKOUT_TIMEOUT";
        logger.error("storefront.checkout.create_order_failed", {
          err,
          storeSlug: store.slug,
          isTimeout,
        });
        toast.error(
          isTimeout
            ? "Demorou demais. Verifique sua internet."
            : "Não foi possível enviar o pedido.",
          {
            description: "Toque em Finalizar de novo pra tentar.",
            // Idempotency key preservada em sessionStorage — retry é seguro,
            // server reconhece e devolve o mesmo pedido se já criado.
          },
        );
        return;
      }

      if (result.ok && result.publicToken) {
        // Onda 31: limpa idempotencyKey da sessionStorage — próximo
        // pedido (raro mas possível: cliente volta pra loja, monta nova
        // sacola, finaliza de novo) precisa de chave NOVA pra não bater
        // no idempotency hit do pedido recém-criado.
        try {
          window.sessionStorage.removeItem(
            `Mangos Pay:idempotency:${store.slug}`,
          );
        } catch {
          // ignore
        }
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

      {/* Sticky CTA WA — Onda 27/30 (2026-05-27):
          - rounded-t-2xl + border-t leve pra paridade Apple-style
          - Onda 30: total inline REMOVIDO (founder review). Valor
            permanece em destaque no totals card acima — duplicação no
            CTA virava ruído. CTA verbal puro, foco na ação. */}
      <div
        className="border-border/40 bg-background fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-screen-md">
          {/* Onda 35 (2026-05-27): ícone WhatsApp esquerdo trocado pela seta
              circular animada (estilo Uiverse). Cor verde-WhatsApp + tamanho
              h-12 + copy preservados. Hover translada a seta 5px à direita;
              active dá scale 0.97. */}
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="group bg-whatsapp hover:bg-whatsapp-hover text-whatsapp-foreground h-12 w-full rounded-xl text-[14px] font-semibold shadow-[0_6px_16px_rgba(37,211,102,0.3)] transition-all duration-200 active:scale-[0.97]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Enviando pedido...
              </>
            ) : (
              <>
                <span>Finalizar no WhatsApp</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 74 74"
                  className="ml-2 size-7 transition-transform duration-300 ease-in-out group-hover:translate-x-1"
                  aria-hidden
                >
                  <circle
                    strokeWidth="3"
                    stroke="currentColor"
                    r="35.5"
                    cy="37"
                    cx="37"
                  />
                  <path
                    fill="currentColor"
                    d="M25 35.5C24.1716 35.5 23.5 36.1716 23.5 37C23.5 37.8284 24.1716 38.5 25 38.5V35.5ZM49.0607 38.0607C49.6464 37.4749 49.6464 36.5251 49.0607 35.9393L39.5147 26.3934C38.9289 25.8076 37.9792 25.8076 37.3934 26.3934C36.8076 26.9792 36.8076 27.9289 37.3934 28.5147L45.8787 37L37.3934 45.4853C36.8076 46.0711 36.8076 47.0208 37.3934 47.6066C37.9792 48.1924 38.9289 48.1924 39.5147 47.6066L49.0607 38.0607ZM25 38.5L48 38.5V35.5L25 35.5V38.5Z"
                  />
                </svg>
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

