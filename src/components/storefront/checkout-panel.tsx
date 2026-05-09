"use client";

/**
 * Premium checkout panel with modern styling.
 *
 * Features:
 * - Clean, organized layout
 * - Visual progress indicators
 * - Enhanced form UX
 * - WhatsApp integration CTA
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
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

import { createOrderFromCart } from "@/actions/order/create-from-cart";
import {
  type CustomerInput,
  customerInputSchema,
} from "@/actions/order/schema";
import { WhatsAppInput } from "@/components/onboarding/whatsapp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";
import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export interface CheckoutPanelProps {
  storeSlug: string;
  storeName: string;
  whatsappDisplay: string;
}

export function CheckoutPanel({
  storeSlug,
  storeName,
}: CheckoutPanelProps) {
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

  const isEmpty = isHydrated && count === 0;

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
      const result = await createOrderFromCart({
        storeSlug,
        idempotencyKey: idempotencyKeyRef.current!,
        items,
        ...data,
      });

      if (result.ok && result.shortCode) {
        router.push(`/${storeSlug}/sucesso?code=${result.shortCode}`);
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
      toast.error(result.errorMessage ?? "Algo deu errado. Tente novamente.");
    });
  };

  // SSR / pré-hidratação
  if (!isHydrated || !storeLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Carregando sacola...</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
          <ShoppingBag
            className="size-10 text-muted-foreground"
            aria-hidden
          />
        </div>
        <h1 className="text-foreground text-2xl font-bold">
          Sua sacola está vazia
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Adicione produtos do catalogo da {storeName} e finalize seu pedido aqui.
        </p>
        <Button asChild size="lg" className="mt-8 gap-2">
          <Link href={`/${storeSlug}`}>
            Ver catalogo
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-36 lg:pb-12">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          Finalizar pedido
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Após enviar, abrimos uma conversa no WhatsApp com {storeName}.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-12">
        {/* Form section */}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8"
          noValidate
        >
          {/* Cart items */}
          <section className="space-y-4">
            <SectionHeader
              number={1}
              title="Itens da sacola"
              subtitle={`${count} ${count === 1 ? "item" : "itens"}`}
            />
            <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
              <ul className="divide-y divide-border/60" role="list">
                {state.items.map((item) => (
                  <li key={`${item.productId}:${item.variantId ?? "_"}`}>
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
            </div>
          </section>

          {/* Customer data */}
          <section className="space-y-4">
            <SectionHeader
              number={2}
              title="Seus dados"
              subtitle="Para contato e entrega"
            />
            <div className="bg-card rounded-xl border border-border/60 shadow-sm p-5 space-y-5">
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
                  className="h-11 bg-background"
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

              <FieldGroup
                label="Observacoes"
                htmlFor="customerNotes"
                hint="Tamanho, cor, horario de entrega - opcional"
                error={form.formState.errors.customerNotes?.message}
              >
                <Textarea
                  id="customerNotes"
                  rows={3}
                  placeholder="Ex.: pode entregar na portaria a partir de 14h"
                  className="bg-background resize-none"
                  {...form.register("customerNotes")}
                  aria-invalid={!!form.formState.errors.customerNotes}
                />
              </FieldGroup>
            </div>
          </section>

          {/* Desktop CTA */}
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="hidden lg:flex w-full h-14 rounded-full text-base font-semibold gap-3 bg-whatsapp hover:bg-whatsapp-hover text-whatsapp-foreground"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Enviando pedido...
              </>
            ) : (
              <>
                <MessageCircle className="size-5" />
                Finalizar pelo WhatsApp
              </>
            )}
          </Button>
        </form>

        {/* Order summary sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6 space-y-5">
              <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
                Resumo do pedido
              </h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({count} {count === 1 ? "item" : "itens"})</span>
                  <span className="text-foreground font-medium tabular-nums">
                    {formatBRL(subtotalCents)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Frete</span>
                  <span className="text-foreground">A combinar</span>
                </div>
              </div>

              <div className="border-t border-border/60 pt-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-foreground font-semibold">Total</span>
                  <span className="text-foreground text-2xl font-bold tabular-nums">
                    {formatBRL(subtotalCents)}
                  </span>
                </div>
              </div>
            </div>

            {/* Security badges */}
            <div className="flex items-center justify-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="size-4 text-success" />
                <span>Pagamento seguro</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="size-4 text-success" />
                <span>Direto com a loja</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="bg-card/95 backdrop-blur-xl border-t border-border/40 px-4 py-3">
          <div className="mx-auto max-w-screen-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs">Total</p>
              <p className="text-foreground text-xl font-bold tabular-nums">
                {formatBRL(subtotalCents)}
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              onClick={form.handleSubmit(onSubmit)}
              className="h-12 px-6 rounded-full text-base font-semibold gap-2 bg-whatsapp hover:bg-whatsapp-hover text-whatsapp-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageCircle className="size-4" />
                  Finalizar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  number,
  title,
  subtitle,
}: {
  number: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
        {number}
      </div>
      <div>
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        )}
      </div>
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
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
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
    <div className="flex gap-4 p-4">
      <div className="relative aspect-square size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.productName}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground/50 grid h-full place-items-center text-[10px]">
            Sem foto
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-foreground line-clamp-2 text-sm font-medium leading-snug">
              {item.productName}
            </p>
            {item.variantName && (
              <p className="text-muted-foreground text-xs mt-0.5">
                {item.variantName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive -m-1 p-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={`Remover ${item.productName}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <button
              type="button"
              onClick={onDecrement}
              className={cn(
                "grid size-8 place-items-center rounded-md text-sm font-semibold transition-colors",
                "text-foreground hover:bg-background",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label={`Diminuir quantidade de ${item.productName}`}
            >
              <Minus className="size-3.5" />
            </button>
            <span
              className="w-8 text-center text-sm font-semibold tabular-nums"
              aria-label={`Quantidade: ${item.quantity}`}
            >
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={onIncrement}
              disabled={!canIncrement}
              className={cn(
                "grid size-8 place-items-center rounded-md text-sm font-semibold transition-colors",
                "text-foreground hover:bg-background",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
              aria-label={`Aumentar quantidade de ${item.productName}`}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <span className="text-foreground text-base font-bold tabular-nums">
            {formatBRL(lineTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
