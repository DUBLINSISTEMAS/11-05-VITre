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
 *   4. Cupom — ESCONDIDO (decisão Lote 2: sem couponTable).
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
  Loader2,
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
import { StoreHeader } from "@/components/storefront/store-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Store } from "@/db/schema";
import { useCart } from "@/hooks/use-cart";
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

  const isEmpty = isHydrated && count === 0;
  const counterLabel = count === 1 ? "1 ITEM" : `${count} ITENS`;
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
      const result = await createOrderFromCart({
        storeSlug: store.slug,
        idempotencyKey: idempotencyKeyRef.current!,
        items,
        ...data,
      });

      if (result.ok && result.publicToken) {
        router.push(`/${store.slug}/sucesso?token=${result.publicToken}`);
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
            Adicione produtos do catálogo da {store.name} e finalize seu pedido aqui.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href={`/${store.slug}`}>Ver catálogo</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <StoreHeader
        variant="sticky-title"
        store={store}
        title="Sua sacola"
        counter={counterLabel}
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

        {/* Form Seus dados — bloco mínimo entre lista e totals (não-canvas
            mas necessário pro WhatsApp prefill). */}
        <section className="mt-6 space-y-3">
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
                {...form.register("customerNotes")}
                aria-invalid={!!form.formState.errors.customerNotes}
              />
            </FieldGroup>
          </div>
        </section>

        {/* Totals card */}
        <div className="border-border bg-muted/40 mt-5 space-y-2 rounded-xl border p-3.5">
          <Row label="Subtotal" value={formatBRL(subtotalCents)} mono />
          <Row label="Frete" value="A combinar" />
          <Row label="Desconto" value="—" />
          <hr className="border-border my-2" />
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] font-semibold">Total</span>
            <span className="text-[18px] font-semibold tabular-nums tracking-tight">
              {formatBRL(subtotalCents)}
            </span>
          </div>
        </div>

        {/* Aviso dashed */}
        <p className="border-border text-muted-foreground mt-3.5 rounded-[10px] border border-dashed p-3 text-[11px] leading-[1.5]">
          O pedido é finalizado pelo WhatsApp da loja. Frete e formas de
          pagamento são combinados diretamente com {storeFirstName}.
        </p>
      </form>

      {/* Sticky CTA WA */}
      <div
        className="border-border bg-background fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3"
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
                Finalizar no WhatsApp
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
            <p className="text-muted-foreground font-mono text-[9.5px] uppercase tracking-[0.5px]">
              {item.productId.slice(0, 8)}
            </p>
            <p className="text-foreground mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-[1.25]">
              {item.productName}
            </p>
            {item.variantName && (
              <p className="text-muted-foreground mt-1 text-[10.5px] font-medium">
                {item.variantName}
              </p>
            )}
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
          {/* Stepper height 28px border canvas */}
          <div className="border-border flex h-7 items-center rounded-lg border">
            <button
              type="button"
              onClick={onDecrement}
              className={cn(
                "grid size-7 place-items-center rounded-l-lg transition-colors",
                "text-foreground hover:bg-muted",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label={`Diminuir quantidade de ${item.productName}`}
            >
              <Minus className="size-3" />
            </button>
            <span
              className="w-[22px] text-center text-[12px] font-semibold tabular-nums"
              aria-label={`Quantidade: ${item.quantity}`}
            >
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={onIncrement}
              disabled={!canIncrement}
              className={cn(
                "grid size-7 place-items-center rounded-r-lg transition-colors",
                "text-foreground hover:bg-muted",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
              aria-label={`Aumentar quantidade de ${item.productName}`}
            >
              <Plus className="size-3" />
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
