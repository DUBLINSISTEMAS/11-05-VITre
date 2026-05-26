"use client";

import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteCustomerGroup,
  upsertCustomerGroup,
} from "@/actions/customer-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CustomerGroup } from "@/db/schema";

type EditState = {
  id: string | null;
  name: string;
  discountPct: string; // string pra digitar livre "10,5"
  description: string;
  isActive: boolean;
  /**
   * Audit 2026-05-26 — tier do grupo. "regular" = preço normal de venda;
   * "wholesale" = PDV usa product.wholesalePriceInCents quando lojista
   * vincula cliente desse grupo. Antes era ignorado pelo form (default
   * DB "regular" pra sempre) — feature wholesale ficava zumbi.
   */
  defaultPricingTier: "regular" | "wholesale";
};

const EMPTY: EditState = {
  id: null,
  name: "",
  discountPct: "0",
  description: "",
  isActive: true,
  defaultPricingTier: "regular",
};

export function CustomerGroupsManager({
  initialGroups,
}: {
  initialGroups: CustomerGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEdit(EMPTY);
    setOpen(true);
  }
  function openEdit(g: CustomerGroup) {
    setEdit({
      id: g.id,
      name: g.name,
      discountPct: (g.discountBps / 100).toString().replace(".", ","),
      description: g.description ?? "",
      isActive: g.isActive,
      defaultPricingTier: g.defaultPricingTier,
    });
    setOpen(true);
  }

  function save() {
    const pct = parsePct(edit.discountPct);
    if (Number.isNaN(pct) || pct < 0 || pct > 99.99) {
      toast.error("Desconto inválido. Use 0–99,99%.");
      return;
    }
    const discountBps = Math.round(pct * 100);
    startTransition(async () => {
      const res = await upsertCustomerGroup({
        id: edit.id,
        name: edit.name.trim(),
        discountBps,
        description: edit.description.trim() || null,
        position: 0,
        isActive: edit.isActive,
        defaultPricingTier: edit.defaultPricingTier,
      });
      if (res.ok) {
        toast.success(edit.id ? "Grupo atualizado." : "Grupo criado.");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete(g: CustomerGroup) {
    if (
      !confirm(
        `Excluir grupo "${g.name}"? Clientes vinculados ficarão sem grupo (não serão removidos).`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteCustomerGroup({ id: g.id });
      if (res.ok) toast.success("Grupo excluído.");
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
          Novo grupo
        </button>
      </div>

      {initialGroups.length === 0 ? (
        <div className="b3-card b3-card-pad text-center">
          <p className="text-ink-3 text-[13px]">
            Nenhum grupo ainda. Crie {`"VIP"`}, {`"Atacado"`} ou os nomes
            que fizerem sentido para o seu negócio.
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-tbl w-full">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Desconto sugerido</th>
                <th>Descrição</th>
                <th>Status</th>
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {initialGroups.map((g) => (
                <tr key={g.id}>
                  <td className="text-ink-1 font-semibold">{g.name}</td>
                  <td>
                    <span className="mono">
                      {(g.discountBps / 100).toFixed(2).replace(".", ",")}%
                    </span>
                  </td>
                  <td className="text-ink-3 max-w-[260px] truncate">
                    {g.description ?? "—"}
                  </td>
                  <td>
                    {g.isActive ? (
                      <span className="b3-pill b3-pill--ok">Ativo</span>
                    ) : (
                      <span className="b3-pill">Inativo</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        className="b3-btn b3-btn--sm"
                        title="Editar"
                      >
                        <PencilIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(g)}
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
            <DialogTitle>{edit.id ? "Editar grupo" : "Novo grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Nome
              </label>
              <input
                type="text"
                className="b3-input w-full"
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder="Ex: VIP, Atacado, Funcionários"
                autoFocus
              />
            </div>
            <div>
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Desconto sugerido (%)
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="b3-input mono w-full"
                value={edit.discountPct}
                onChange={(e) =>
                  setEdit({ ...edit, discountPct: e.target.value })
                }
                placeholder="10"
              />
              <p className="text-ink-4 mt-1 text-[11px]">
                Aplicado no PDV via botão {`"Aplicar desconto do grupo"`} —
                não sozinho.
              </p>
            </div>
            <div>
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
                placeholder="Ex: Clientes recorrentes acima de R$ 500/mês"
                maxLength={280}
              />
            </div>
            {/* Audit 2026-05-26 — tier de pricing. Quando "Atacado", o PDV
                puxa product.wholesalePriceInCents ao vincular cliente desse
                grupo. Sem essa seleção, feature wholesale era zumbi. */}
            <div>
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Como o PDV aplica o preço
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEdit({ ...edit, defaultPricingTier: "regular" })
                  }
                  className={`rounded-md border px-3 py-2 text-left text-[12.5px] font-medium leading-tight ${
                    edit.defaultPricingTier === "regular"
                      ? "border-brand bg-brand-wash text-brand"
                      : "border-line bg-surface text-ink-1 hover:bg-bg-app"
                  }`}
                >
                  Preço normal
                  <span className="text-ink-4 mt-0.5 block text-[10.5px] font-normal">
                    Mesmo preço de venda da loja
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEdit({ ...edit, defaultPricingTier: "wholesale" })
                  }
                  className={`rounded-md border px-3 py-2 text-left text-[12.5px] font-medium leading-tight ${
                    edit.defaultPricingTier === "wholesale"
                      ? "border-brand bg-brand-wash text-brand"
                      : "border-line bg-surface text-ink-1 hover:bg-bg-app"
                  }`}
                >
                  Preço de atacado
                  <span className="text-ink-4 mt-0.5 block text-[10.5px] font-normal">
                    Usa preço atacado cadastrado no produto
                  </span>
                </button>
              </div>
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
              disabled={isPending || !edit.name.trim()}
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

function parsePct(s: string): number {
  const normalized = s.replace(",", ".").trim();
  if (normalized === "") return 0;
  return Number.parseFloat(normalized);
}
