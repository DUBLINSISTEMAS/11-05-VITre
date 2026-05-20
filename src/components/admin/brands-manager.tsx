"use client";

import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteBrand, upsertBrand } from "@/actions/brand";
import type { BrandListRow } from "@/actions/brand/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditState {
  id: string | null;
  name: string;
  slug: string;
}

const EMPTY: EditState = { id: null, name: "", slug: "" };

interface BrandsManagerProps {
  initialBrands: BrandListRow[];
}

export function BrandsManager({ initialBrands }: BrandsManagerProps) {
  const [brands, setBrands] = useState<BrandListRow[]>(initialBrands);
  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [open, setOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEdit(EMPTY);
    setFieldErrors({});
    setOpen(true);
  }

  function openEdit(b: BrandListRow) {
    setEdit({ id: b.id, name: b.name, slug: b.slug });
    setFieldErrors({});
    setOpen(true);
  }

  function save() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await upsertBrand({
        id: edit.id,
        name: edit.name,
        slug: edit.slug || null,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(edit.id ? "Marca atualizada." : "Marca criada.");
      // Refresh local state otimisticamente (server revalidatePath também invalida cache)
      setBrands((prev) => {
        const next = { ...prev };
        if (edit.id) {
          return prev.map((b) =>
            b.id === result.id
              ? { ...b, name: result.name, slug: result.slug, updatedAt: new Date() }
              : b,
          );
        }
        return [
          ...prev,
          {
            id: result.id,
            name: result.name,
            slug: result.slug,
            productCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ].sort((a, b) => a.name.localeCompare(b.name));
      });
      setOpen(false);
    });
  }

  function handleDelete(b: BrandListRow) {
    const msg =
      b.productCount > 0
        ? `Excluir marca "${b.name}"? ${b.productCount} produto${b.productCount > 1 ? "s" : ""} perderá${b.productCount > 1 ? "ão" : ""} a referência (o nome em texto livre fica preservado nos produtos antigos).`
        : `Excluir marca "${b.name}"?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await deleteBrand({ id: b.id });
      if (!res.ok) {
        toast.error(res.error ?? "Falha ao deletar.");
        return;
      }
      toast.success("Marca excluída.");
      setBrands((prev) => prev.filter((x) => x.id !== b.id));
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
          Nova marca
        </button>
      </div>

      {brands.length === 0 ? (
        <div className="b3-card b3-card-pad text-center">
          <p className="text-ink-3 text-[13px]">
            Nenhuma marca cadastrada. Crie a primeira pra reutilizar em vários
            produtos.
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-tbl w-full">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Endereço (slug)</th>
                <th className="text-right">Produtos</th>
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="text-ink-1 font-medium">{b.name}</span>
                  </td>
                  <td className="text-ink-3 mono text-[12.5px]">{b.slug}</td>
                  <td className="text-right tabular-nums">
                    {b.productCount}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="b3-btn b3-btn--sm"
                        title="Editar marca"
                      >
                        <PencilIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        className="b3-btn b3-btn--sm"
                        style={{ color: "var(--danger)" }}
                        disabled={isPending}
                        title="Excluir marca"
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
            <DialogTitle>
              {edit.id ? "Editar marca" : "Nova marca"}
            </DialogTitle>
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
                onChange={(e) =>
                  setEdit({ ...edit, name: e.target.value })
                }
                placeholder="Ex: Vivara, Nike, Lacoste"
                autoFocus
                maxLength={80}
              />
              {fieldErrors.name ? (
                <p className="text-destructive text-xs mt-1">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Endereço (slug — opcional, gerado do nome se vazio)
              </label>
              <input
                type="text"
                className="b3-input mono w-full"
                value={edit.slug}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    slug: e.target.value.toLowerCase(),
                  })
                }
                placeholder="ex: vivara"
                maxLength={60}
              />
              {fieldErrors.slug ? (
                <p className="text-destructive text-xs mt-1">
                  {fieldErrors.slug}
                </p>
              ) : null}
              <p className="text-ink-4 mt-1 text-[11px]">
                Letras minúsculas, números e hífens. Usado em filtros e URLs.
              </p>
            </div>
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
