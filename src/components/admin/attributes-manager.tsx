"use client";

import { FilterIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteAttribute, deleteAttributeValue } from "@/actions/attribute/delete";
import type { AttributeWithValues } from "@/actions/attribute/types";
import { upsertAttribute } from "@/actions/attribute/upsert";
import { upsertAttributeValue } from "@/actions/attribute/upsert-value";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Mode =
  | { kind: "closed" }
  | {
      kind: "attribute";
      data: { id: string | null; name: string; type: "color" | "size" | "text" };
    }
  | {
      kind: "value";
      attributeId: string;
      attributeType: "color" | "size" | "text";
      data: { id: string | null; label: string; colorHex: string };
    };

export function AttributesManager({
  initialAttributes,
}: {
  initialAttributes: AttributeWithValues[];
}) {
  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [isPending, startTransition] = useTransition();

  function openCreateAttribute() {
    setMode({ kind: "attribute", data: { id: null, name: "", type: "text" } });
  }
  function openEditAttribute(attr: AttributeWithValues) {
    setMode({
      kind: "attribute",
      data: { id: attr.id, name: attr.name, type: attr.type },
    });
  }
  function openCreateValue(attr: AttributeWithValues) {
    setMode({
      kind: "value",
      attributeId: attr.id,
      attributeType: attr.type,
      data: { id: null, label: "", colorHex: "" },
    });
  }
  function openEditValue(
    attr: AttributeWithValues,
    value: AttributeWithValues["values"][number],
  ) {
    setMode({
      kind: "value",
      attributeId: attr.id,
      attributeType: attr.type,
      data: { id: value.id, label: value.label, colorHex: value.colorHex ?? "" },
    });
  }

  function saveAttribute() {
    if (mode.kind !== "attribute") return;
    const data = mode.data;
    startTransition(async () => {
      const res = await upsertAttribute({
        id: data.id,
        name: data.name,
        type: data.type,
        position: 0,
        isActive: true,
      });
      if (res.ok) {
        toast.success(data.id ? "Filtro da loja atualizado." : "Filtro da loja criado.");
        setMode({ kind: "closed" });
      } else {
        toast.error(res.error);
      }
    });
  }

  function saveValue() {
    if (mode.kind !== "value") return;
    const data = mode.data;
    startTransition(async () => {
      const res = await upsertAttributeValue({
        id: data.id,
        attributeId: mode.attributeId,
        label: data.label,
        colorHex: data.colorHex || null,
        position: 0,
      });
      if (res.ok) {
        toast.success(data.id ? "Valor atualizado." : "Valor adicionado.");
        setMode({ kind: "closed" });
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDeleteAttribute(id: string, name: string) {
    if (!confirm(`Excluir filtro da loja "${name}" e todos seus valores?`)) return;
    startTransition(async () => {
      const res = await deleteAttribute({ id });
      if (res.ok) toast.success("Filtro da loja excluído.");
      else toast.error(res.error);
    });
  }

  function handleDeleteValue(id: string, label: string) {
    if (!confirm(`Excluir valor "${label}"?`)) return;
    startTransition(async () => {
      const res = await deleteAttributeValue({ id });
      if (res.ok) toast.success("Valor excluído.");
      else toast.error(res.error);
    });
  }

  if (initialAttributes.length === 0) {
    return (
      <>
        <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
          <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
            <FilterIcon className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-ink-1">
            Crie o primeiro filtro da loja
          </h2>
          <p className="text-ink-4 max-w-sm text-sm">
            Filtros aparecem na loja online pra o cliente refinar busca por
            cor, tamanho, material, etc. Crie uma vez e reaproveite em vários
            produtos.
          </p>
          <button
            type="button"
            onClick={openCreateAttribute}
            className="b3-btn b3-btn--cta mt-2"
            style={{ height: 36 }}
          >
            <PlusIcon size={13} />
            Criar primeiro filtro
          </button>
        </div>
        <EditDialogs
          mode={mode}
          setMode={setMode}
          isPending={isPending}
          onSaveAttribute={saveAttribute}
          onSaveValue={saveValue}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreateAttribute}
          className="b3-btn b3-btn--cta"
          style={{ height: 36 }}
        >
          <PlusIcon size={13} />
          Novo filtro da loja
        </button>
      </div>

      <div className="space-y-4">
        {initialAttributes.map((attr) => (
          <div key={attr.id} className="b3-card b3-card-pad">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-ink-1 text-[16px] font-bold">
                    {attr.name}
                  </h3>
                  <span className="b3-pill">{labelForType(attr.type)}</span>
                </div>
                <p className="text-ink-4 mt-0.5 text-[12px]">
                  {attr.values.length === 0
                    ? "Sem valores ainda"
                    : `${attr.values.length} valor${attr.values.length > 1 ? "es" : ""}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => openEditAttribute(attr)}
                  className="b3-btn b3-btn--sm"
                  title="Editar filtro da loja"
                >
                  <PencilIcon size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAttribute(attr.id, attr.name)}
                  className="b3-btn b3-btn--sm"
                  style={{ color: "var(--danger)" }}
                  title="Excluir filtro da loja"
                  disabled={isPending}
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {attr.values.map((v) => (
                <div
                  key={v.id}
                  className="border-line group inline-flex items-center gap-2 rounded-[8px] border bg-white px-2.5 py-1.5"
                >
                  {attr.type === "color" && v.colorHex && (
                    <span
                      className="border-line h-3.5 w-3.5 rounded-full border"
                      style={{ background: v.colorHex }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => openEditValue(attr, v)}
                    className="text-ink-1 text-[12.5px]"
                  >
                    {v.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteValue(v.id, v.label)}
                    className="text-ink-4 hover:text-danger ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                    title="Excluir valor"
                    disabled={isPending}
                  >
                    <TrashIcon size={11} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => openCreateValue(attr)}
                className="text-ink-3 hover:text-brand border-line inline-flex items-center gap-1 rounded-[8px] border border-dashed bg-transparent px-2.5 py-1.5 text-[12px]"
              >
                <PlusIcon size={11} />
                Adicionar valor
              </button>
            </div>
          </div>
        ))}
      </div>

      <EditDialogs
        mode={mode}
        setMode={setMode}
        isPending={isPending}
        onSaveAttribute={saveAttribute}
        onSaveValue={saveValue}
      />
    </>
  );
}

function EditDialogs({
  mode,
  setMode,
  isPending,
  onSaveAttribute,
  onSaveValue,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  isPending: boolean;
  onSaveAttribute: () => void;
  onSaveValue: () => void;
}) {
  return (
    <>
      <Dialog
        open={mode.kind === "attribute"}
        onOpenChange={(open) => !open && setMode({ kind: "closed" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode.kind === "attribute" && mode.data.id
                ? "Editar filtro da loja"
                : "Novo filtro da loja"}
            </DialogTitle>
          </DialogHeader>
          {mode.kind === "attribute" && (
            <div className="space-y-3">
              <div>
                <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                  Nome
                </label>
                <input
                  type="text"
                  className="b3-input w-full"
                  value={mode.data.name}
                  onChange={(e) =>
                    setMode({
                      ...mode,
                      data: { ...mode.data, name: e.target.value },
                    })
                  }
                  placeholder="Ex: Cor, Tamanho, Material"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                  Tipo
                </label>
                <select
                  className="b3-input w-full"
                  value={mode.data.type}
                  onChange={(e) =>
                    setMode({
                      ...mode,
                      data: {
                        ...mode.data,
                        type: e.target.value as "color" | "size" | "text",
                      },
                    })
                  }
                >
                  <option value="color">Cor (swatch com hex)</option>
                  <option value="size">Tamanho (label simples)</option>
                  <option value="text">Texto (genérico)</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setMode({ kind: "closed" })}
              className="b3-btn"
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSaveAttribute}
              disabled={isPending || (mode.kind === "attribute" && !mode.data.name.trim())}
              className="b3-btn b3-btn--cta"
            >
              {isPending ? "Salvando…" : "Salvar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode.kind === "value"}
        onOpenChange={(open) => !open && setMode({ kind: "closed" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode.kind === "value" && mode.data.id
                ? "Editar valor"
                : "Novo valor"}
            </DialogTitle>
          </DialogHeader>
          {mode.kind === "value" && (
            <div className="space-y-3">
              <div>
                <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                  Label
                </label>
                <input
                  type="text"
                  className="b3-input w-full"
                  value={mode.data.label}
                  onChange={(e) =>
                    setMode({
                      ...mode,
                      data: { ...mode.data, label: e.target.value },
                    })
                  }
                  placeholder={
                    mode.attributeType === "color"
                      ? "Ex: Vermelho cereja"
                      : mode.attributeType === "size"
                        ? "Ex: P, M, G, 38, 100ml"
                        : "Ex: 100% algodão"
                  }
                  autoFocus
                />
              </div>
              {mode.attributeType === "color" && (
                <div>
                  <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                    Cor (hex/CSS)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="border-line h-9 w-12 cursor-pointer rounded-[8px] border bg-white"
                      value={normalizeHex(mode.data.colorHex)}
                      onChange={(e) =>
                        setMode({
                          ...mode,
                          data: { ...mode.data, colorHex: e.target.value },
                        })
                      }
                    />
                    <input
                      type="text"
                      className="b3-input mono flex-1"
                      value={mode.data.colorHex}
                      onChange={(e) =>
                        setMode({
                          ...mode,
                          data: { ...mode.data, colorHex: e.target.value },
                        })
                      }
                      placeholder="#C71F1F"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setMode({ kind: "closed" })}
              className="b3-btn"
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSaveValue}
              disabled={isPending || (mode.kind === "value" && !mode.data.label.trim())}
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

function labelForType(t: "color" | "size" | "text"): string {
  return t === "color" ? "Cor" : t === "size" ? "Tamanho" : "Texto";
}

function normalizeHex(value: string): string {
  // <input type="color"> aceita só #RRGGBB. Se for hex válido, usa; senão fallback.
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
}
