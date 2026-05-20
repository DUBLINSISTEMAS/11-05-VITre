"use client";

import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCoupon, upsertCoupon } from "@/actions/coupon";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Coupon } from "@/db/schema";
import { formatBRL } from "@/lib/pricing";

type EditState = {
  id: string | null;
  code: string;
  discountType: "percentage" | "fixed";
  discountInput: string; // "10" pra 10% ou "10,00" pra R$10
  startsAt: string; // yyyy-mm-dd
  endsAt: string;
  maxUses: string; // "" = ilimitado
  description: string;
  isActive: boolean;
};

const EMPTY: EditState = {
  id: null,
  code: "",
  discountType: "percentage",
  discountInput: "10",
  startsAt: "",
  endsAt: "",
  maxUses: "",
  description: "",
  isActive: true,
};

export function CouponsManager({
  initialCoupons,
}: {
  initialCoupons: Coupon[];
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEdit(EMPTY);
    setOpen(true);
  }
  function openEdit(c: Coupon) {
    setEdit({
      id: c.id,
      code: c.code,
      discountType: c.discountType,
      discountInput:
        c.discountType === "percentage"
          ? (c.discountValue / 100).toString().replace(".", ",")
          : (c.discountValue / 100).toFixed(2).replace(".", ","),
      startsAt: c.startsAt ? c.startsAt.toISOString().slice(0, 10) : "",
      endsAt: c.endsAt ? c.endsAt.toISOString().slice(0, 10) : "",
      maxUses: c.maxUses?.toString() ?? "",
      description: c.description ?? "",
      isActive: c.isActive,
    });
    setOpen(true);
  }

  function save() {
    const raw = edit.discountInput.replace(",", ".").trim();
    const num = Number.parseFloat(raw);
    if (Number.isNaN(num) || num <= 0) {
      toast.error("Valor de desconto inválido.");
      return;
    }
    const discountValue =
      edit.discountType === "percentage"
        ? Math.round(num * 100) // 10 → 1000 bps
        : Math.round(num * 100); // 10,00 → 1000 cents

    startTransition(async () => {
      const res = await upsertCoupon({
        id: edit.id,
        code: edit.code,
        discountType: edit.discountType,
        discountValue,
        startsAt: edit.startsAt || null,
        endsAt: edit.endsAt || null,
        maxUses: edit.maxUses === "" ? null : Number.parseInt(edit.maxUses, 10),
        description: edit.description.trim() || null,
        isActive: edit.isActive,
      });
      if (res.ok) {
        toast.success(edit.id ? "Código de desconto atualizado." : "Código de desconto criado.");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete(c: Coupon) {
    if (!confirm(`Excluir código de desconto "${c.code}"?`)) return;
    startTransition(async () => {
      const res = await deleteCoupon({ id: c.id });
      if (res.ok) toast.success("Código de desconto excluído.");
      else toast.error(res.error);
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="b3-btn b3-btn--cta"
          style={{ height: 36 }}
        >
          <PlusIcon size={13} />
          Novo código de desconto
        </button>
      </div>

      {initialCoupons.length === 0 ? (
        <div className="b3-card b3-card-pad text-center">
          <p className="text-ink-3 text-[13px]">
            Nenhum código de desconto ainda. Crie códigos pra rodar campanhas pontuais.
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-tbl w-full">
            <thead>
              <tr>
                <th>Código</th>
                <th>Desconto</th>
                <th>Validade</th>
                <th>Usos</th>
                <th>Status</th>
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {initialCoupons.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="text-ink-1 mono font-bold">{c.code}</span>
                  </td>
                  <td>
                    <span className="mono">
                      {c.discountType === "percentage"
                        ? `${(c.discountValue / 100).toFixed(2).replace(".", ",")}%`
                        : formatBRL(c.discountValue)}
                    </span>
                  </td>
                  <td className="text-ink-3 text-[12.5px]">
                    {formatValidity(c.startsAt, c.endsAt)}
                  </td>
                  <td className="mono text-ink-3 text-[12.5px]">
                    {c.usesCount}
                    {c.maxUses !== null ? ` / ${c.maxUses}` : " / ∞"}
                  </td>
                  <td>{renderStatus(c)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="b3-btn b3-btn--sm"
                      >
                        <PencilIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        className="b3-btn b3-btn--sm"
                        style={{ color: "var(--danger)" }}
                        disabled={isPending}
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit.id ? "Editar código de desconto" : "Novo código de desconto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Código
              </label>
              <input
                type="text"
                className="b3-input mono w-full uppercase"
                value={edit.code}
                onChange={(e) =>
                  setEdit({ ...edit, code: e.target.value.toUpperCase() })
                }
                placeholder="BLACKFRIDAY"
                autoFocus
              />
            </div>
            <div>
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Tipo
              </label>
              <select
                className="b3-input w-full"
                value={edit.discountType}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    discountType: e.target.value as "percentage" | "fixed",
                  })
                }
              >
                <option value="percentage">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                {edit.discountType === "percentage"
                  ? "Desconto (%)"
                  : "Desconto (R$)"}
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="b3-input mono w-full"
                value={edit.discountInput}
                onChange={(e) =>
                  setEdit({ ...edit, discountInput: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Início (opcional)
              </label>
              <input
                type="date"
                className="b3-input w-full"
                value={edit.startsAt}
                onChange={(e) => setEdit({ ...edit, startsAt: e.target.value })}
              />
            </div>
            <div>
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Validade (opcional)
              </label>
              <input
                type="date"
                className="b3-input w-full"
                value={edit.endsAt}
                onChange={(e) => setEdit({ ...edit, endsAt: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Limite de usos (deixe vazio = ilimitado)
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="b3-input mono w-full"
                value={edit.maxUses}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    maxUses: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Descrição (opcional)
              </label>
              <textarea
                className="b3-input w-full"
                rows={2}
                value={edit.description}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
                maxLength={280}
              />
            </div>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={edit.isActive}
                onChange={(e) =>
                  setEdit({ ...edit, isActive: e.target.checked })
                }
                className="b3-checkbox-box"
              />
              <span className="text-ink-3">Ativo</span>
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="b3-btn"
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending || !edit.code.trim()}
              className="b3-btn b3-btn--cta"
            >
              {isPending ? "Salvando…" : "Salvar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatValidity(startsAt: Date | null, endsAt: Date | null): string {
  if (!startsAt && !endsAt) return "Sempre";
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (startsAt && endsAt) return `${fmt(startsAt)} → ${fmt(endsAt)}`;
  if (endsAt) return `Até ${fmt(endsAt)}`;
  return `A partir de ${fmt(startsAt!)}`;
}

function renderStatus(c: Coupon) {
  const now = new Date();
  if (!c.isActive) return <span className="b3-pill">Inativo</span>;
  if (c.endsAt && c.endsAt < now)
    return <span className="b3-pill b3-pill--danger">Expirado</span>;
  if (c.maxUses !== null && c.usesCount >= c.maxUses)
    return <span className="b3-pill b3-pill--danger">Esgotado</span>;
  if (c.startsAt && c.startsAt > now)
    return <span className="b3-pill b3-pill--warn">Agendado</span>;
  return <span className="b3-pill b3-pill--ok">Ativo</span>;
}
