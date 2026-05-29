"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveCostComponents } from "@/actions/product/cost-components";
import { PriceInput } from "@/components/admin/price-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/pricing";

type Row = { label: string; amountInCents: number | null };

interface Props {
  productId: string;
  initial?: { label: string; amountInCents: number }[];
  onTotalChange?: (totalInCents: number) => void;
}

export function CostComponentsEditor({
  productId,
  initial = [],
  onTotalChange,
}: Props) {
  const [rows, setRows] = useState<Row[]>(
    initial.length > 0
      ? initial.map((c) => ({ label: c.label, amountInCents: c.amountInCents }))
      : [{ label: "", amountInCents: null }],
  );
  const [pending, startTransition] = useTransition();
  const total = rows.reduce((acc, r) => acc + (r.amountInCents ?? 0), 0);

  useEffect(() => {
    onTotalChange?.(total);
  }, [onTotalChange, total]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => [...rs, { label: "", amountInCents: null }]);
  const removeRow = (i: number) =>
    setRows((rs) => rs.filter((_, idx) => idx !== i));

  const save = () => {
    const components = rows
      .filter((r) => r.label.trim() !== "")
      .map((r) => ({
        label: r.label.trim(),
        amountInCents: r.amountInCents ?? 0,
      }));
    startTransition(async () => {
      const res = await saveCostComponents({ productId, components });
      if (res.ok) {
        onTotalChange?.(res.totalInCents);
        toast.success(`Custo atualizado: ${formatBRL(res.totalInCents)}`);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="Material (ex: ouro 18k)"
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="flex-1"
            />
            <div className="w-40">
              <PriceInput
                value={row.amountInCents}
                onChange={(v) => update(i, { amountInCents: v })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(i)}
              aria-label="Remover material"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="size-4" /> Adicionar material
      </Button>
      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-ink-3 text-sm">
          Custo total (soma dos materiais)
        </span>
        <span className="text-lg font-semibold tabular-nums">
          {formatBRL(total)}
        </span>
      </div>
      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Salvando…" : "Salvar custo"}
      </Button>
    </div>
  );
}
