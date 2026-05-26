"use client";

/**
 * Form Dialog pra criar/editar despesa.
 *
 * S2.2 do Plano de Endurecimento. Form com categoria, valor, datas,
 * supplier opcional, recorrência (só create), notes.
 *
 * Recurring: gera 12 entries no INSERT (app-layer em createExpense).
 * Edit: campo recurring escondido (deve apagar e recriar a série).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createExpense } from "@/actions/expense/create";
import type { ExpenseRow } from "@/actions/expense/load";
import {
  CATEGORY_LABEL_BR,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/actions/expense/schema";
import { updateExpense } from "@/actions/expense/update";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amountInReais: z
    .number({ message: "Informe o valor." })
    .positive("Valor deve ser maior que zero."),
  paidAt: z.string().optional(),
  dueDate: z.string().optional(),
  supplierId: z.string().nullable().optional(),
  recurring: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Array<{ id: string; name: string }>;
  mode: "create" | "edit";
  initialData?: ExpenseRow | null;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  suppliers,
  mode,
  initialData,
}: ExpenseFormDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: initialData?.category ?? "other",
      amountInReais: initialData ? initialData.amountInCents / 100 : undefined,
      paidAt: initialData?.paidAt ?? "",
      dueDate: initialData?.dueDate ?? "",
      supplierId: initialData?.supplierId ?? null,
      recurring: false,
      notes: initialData?.notes ?? "",
    },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const amountInCents = Math.round(values.amountInReais * 100);
      const payload = {
        category: values.category,
        amountInCents,
        paidAt: values.paidAt || null,
        dueDate: values.dueDate || null,
        supplierId: values.supplierId ?? null,
        recurring: values.recurring ?? false,
        notes: values.notes ?? null,
      };

      const result =
        mode === "create"
          ? await createExpense(payload)
          : await updateExpense({ ...payload, id: initialData!.id });

      if (result.ok) {
        toast.success(
          mode === "create"
            ? values.recurring
              ? "12 despesas mensais criadas."
              : "Despesa registrada."
            : "Despesa atualizada.",
        );
        reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova despesa" : "Editar despesa"}
          </DialogTitle>
          <DialogDescription>
            Aluguel, salário, conta de luz, comissão a vendedora — qualquer
            saída de dinheiro que vai pesar no DRE.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="expense-category">Categoria</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="expense-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABEL_BR[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Valor (R$)</Label>
            <Input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0.01"
              {...register("amountInReais", { valueAsNumber: true })}
              placeholder="Ex: 3500.00"
              disabled={isPending}
            />
            {errors.amountInReais?.message ? (
              <p className="text-destructive text-xs">
                {errors.amountInReais.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-paid-at">Pago em</Label>
              <Input
                id="expense-paid-at"
                type="date"
                {...register("paidAt")}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-due-date">Vencimento</Label>
              <Input
                id="expense-due-date"
                type="date"
                {...register("dueDate")}
                disabled={isPending}
              />
            </div>
          </div>
          <p className="text-ink-4 text-[11px]">
            Informe pelo menos uma das duas datas. Pago = vai pro DRE.
            Vencimento = aparece em pendentes até pagar.
          </p>

          {suppliers.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="expense-supplier">Fornecedor (opcional)</Label>
              <Controller
                name="supplierId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  >
                    <SelectTrigger id="expense-supplier" className="w-full">
                      <SelectValue placeholder="Sem fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem fornecedor</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ) : null}

          {mode === "create" ? (
            <div className="flex items-start gap-2">
              <Controller
                name="recurring"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="expense-recurring"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                )}
              />
              <div className="flex-1">
                <Label
                  htmlFor="expense-recurring"
                  className="cursor-pointer text-sm"
                >
                  Repetir mensalmente
                </Label>
                <p className="text-ink-4 text-[11px]">
                  Gera 12 entradas (uma por mês). Pra cancelar a série, apague
                  as entradas individualmente.
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="expense-notes">Observações</Label>
            <Textarea
              id="expense-notes"
              {...register("notes")}
              placeholder="Ex: Aluguel da loja matriz"
              disabled={isPending}
              rows={2}
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
