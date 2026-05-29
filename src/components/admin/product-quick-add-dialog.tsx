"use client";

/**
 * Bloco F (2026-05-29) — `ProductQuickAddDialog`.
 *
 * Form curto pra cadastrar produto direto da tela `/admin/produtos/custos`
 * SEM abrir o modal cheio de 7 abas. 4 campos só: Nome, Preço, Custo
 * (opcional), Categoria (opcional).
 *
 * Decisão founder: o lojista que tá numa rajada de preencher custos
 * frequentemente lembra de UM produto que esqueceu — abrir o modal de
 * 7 abas pra isso é exagero. Quick Add cobre 90% dos casos novos.
 *
 * Pro caso 10% (variantes, foto, atacado, NCM, etc), continua tendo o
 * "Editar produto completo" no menu ⋮ do card que abre o modal cheio.
 */

import { Loader2Icon, PackagePlusIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createProductFromValues } from "@/actions/product/create-from-values";
import { PriceInput } from "@/components/admin/price-input";
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
import { cn } from "@/lib/utils";

interface ProductQuickAddDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  categories: Array<{ id: string; name: string }>;
}

const NO_CATEGORY = "__none__";

export function ProductQuickAddDialog({
  open,
  onOpenChange,
  categories,
}: ProductQuickAddDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [basePriceInCents, setBasePriceInCents] = useState<number | null>(null);
  const [costPriceInCents, setCostPriceInCents] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setBasePriceInCents(null);
    setCostPriceInCents(null);
    setCategoryId(NO_CATEGORY);
  };

  const handleOpenChange = (next: boolean) => {
    if (isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const canSubmit =
    name.trim().length >= 2 &&
    basePriceInCents !== null &&
    basePriceInCents > 0 &&
    !isPending;

  const submit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await createProductFromValues({
        name: name.trim(),
        description: "",
        kind: "finished_good",
        basePriceInCents: basePriceInCents!,
        costPriceInCents,
        categoryId: categoryId === NO_CATEGORY ? null : categoryId,
        promoPriceInCents: null,
        trackStock: true,
        stockQuantity: null,
        allowOversell: false,
        installmentsOverride: null,
        cashDiscountOverrideBps: null,
        isActive: true,
        isFeatured: false,
        isPublishedToStorefront: false,
        composition: "",
        modeling: "",
        lining: "",
        washing: "",
        wholesalePriceInCents: null,
        minStockQuantity: null,
        maxStockQuantity: null,
        gtin: "",
        brand: "",
        brandId: null,
        unit: "un",
        internalCode: "",
        defaultCommissionBps: null,
        ncm: "",
        weightGrams: null,
        variants: [],
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Produto "${name.trim()}" cadastrado.`);
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm",
            "duration-[150ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "bg-surface fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none",
            "w-[95vw] max-w-md rounded-[16px] p-5 sm:p-6",
            "border border-line shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)]",
            "duration-[150ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="text-ink-1 flex items-center gap-2 text-[16px] font-semibold tracking-tight">
            <PackagePlusIcon className="size-4" aria-hidden />
            Novo produto rápido
          </DialogPrimitive.Title>
          <p className="text-ink-4 mt-1 text-[12px] leading-snug">
            Cadastro mínimo pra entrar no workbench de custos. Pra adicionar
            foto, variantes, atacado, NCM e outros, use &ldquo;Editar
            completo&rdquo; no menu (⋮) do card.
          </p>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="qa-name" required>
                Nome do produto
              </Label>
              <Input
                id="qa-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Anel solitário ouro 18k"
                disabled={isPending}
                autoFocus
                maxLength={120}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qa-price" required>
                  Preço de venda
                </Label>
                <PriceInput
                  id="qa-price"
                  value={basePriceInCents}
                  onChange={setBasePriceInCents}
                  disabled={isPending}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qa-cost">
                  Custo{" "}
                  <span className="text-ink-4 font-normal text-[11px]">
                    (opc.)
                  </span>
                </Label>
                <PriceInput
                  id="qa-cost"
                  value={costPriceInCents}
                  onChange={setCostPriceInCents}
                  disabled={isPending}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {categories.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="qa-category">
                  Categoria{" "}
                  <span className="text-ink-4 font-normal text-[11px]">
                    (opc.)
                  </span>
                </Label>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  disabled={isPending}
                >
                  <SelectTrigger id="qa-category">
                    <SelectValue placeholder="Sem categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={!canSubmit}>
              {isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <PackagePlusIcon className="size-3.5" /> Cadastrar produto
                </>
              )}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
