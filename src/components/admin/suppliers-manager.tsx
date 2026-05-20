"use client";

import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteSupplier,
  loadSupplierDetail,
  upsertSupplier,
} from "@/actions/supplier";
import type { SupplierListRow } from "@/actions/supplier/types";
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
  document: string;
  phone: string;
  email: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  notes: string;
  isActive: boolean;
}

const EMPTY: EditState = {
  id: null,
  name: "",
  document: "",
  phone: "",
  email: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressNeighborhood: "",
  addressCity: "",
  addressState: "",
  addressZip: "",
  notes: "",
  isActive: true,
};

function formatDocument(doc: string | null): string {
  if (!doc) return "—";
  // Apenas dígitos; formata pra display
  if (doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if (doc.length === 14) {
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
}

interface SuppliersManagerProps {
  initialSuppliers: SupplierListRow[];
}

export function SuppliersManager({ initialSuppliers }: SuppliersManagerProps) {
  const [suppliers, setSuppliers] = useState<SupplierListRow[]>(initialSuppliers);
  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [open, setOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEdit(EMPTY);
    setFieldErrors({});
    setOpen(true);
  }

  function openEdit(s: SupplierListRow) {
    startTransition(async () => {
      const detail = await loadSupplierDetail(s.id);
      if (!detail) {
        toast.error("Fornecedor não encontrado.");
        return;
      }
      setEdit({
        id: detail.id,
        name: detail.name,
        document: detail.document ?? "",
        phone: detail.phone ?? "",
        email: detail.email ?? "",
        addressStreet: detail.addressStreet ?? "",
        addressNumber: detail.addressNumber ?? "",
        addressComplement: detail.addressComplement ?? "",
        addressNeighborhood: detail.addressNeighborhood ?? "",
        addressCity: detail.addressCity ?? "",
        addressState: detail.addressState ?? "",
        addressZip: detail.addressZip ?? "",
        notes: detail.notes ?? "",
        isActive: detail.isActive,
      });
      setFieldErrors({});
      setOpen(true);
    });
  }

  function save() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await upsertSupplier({
        id: edit.id,
        name: edit.name,
        document: edit.document || null,
        phone: edit.phone || null,
        email: edit.email || null,
        addressStreet: edit.addressStreet || null,
        addressNumber: edit.addressNumber || null,
        addressComplement: edit.addressComplement || null,
        addressNeighborhood: edit.addressNeighborhood || null,
        addressCity: edit.addressCity || null,
        addressState: edit.addressState || null,
        addressZip: edit.addressZip || null,
        notes: edit.notes || null,
        isActive: edit.isActive,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(edit.id ? "Fornecedor atualizado." : "Fornecedor criado.");
      setSuppliers((prev) => {
        if (edit.id) {
          return prev.map((x) =>
            x.id === result.id
              ? {
                  ...x,
                  name: result.name,
                  document: edit.document || null,
                  phone: edit.phone || null,
                  email: edit.email || null,
                  city: edit.addressCity || null,
                  state: edit.addressState || null,
                  isActive: edit.isActive,
                  updatedAt: new Date(),
                }
              : x,
          );
        }
        return [
          ...prev,
          {
            id: result.id,
            name: result.name,
            document: edit.document || null,
            phone: edit.phone || null,
            email: edit.email || null,
            city: edit.addressCity || null,
            state: edit.addressState || null,
            isActive: edit.isActive,
            purchaseCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ].sort((a, b) => a.name.localeCompare(b.name));
      });
      setOpen(false);
    });
  }

  function handleDelete(s: SupplierListRow) {
    if (s.purchaseCount > 0) {
      toast.error(
        `${s.name} tem ${s.purchaseCount} compra(s). Desative em vez de excluir.`,
      );
      return;
    }
    if (!confirm(`Excluir fornecedor "${s.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteSupplier({ id: s.id });
      if (!res.ok) {
        toast.error(res.error ?? "Falha ao deletar.");
        return;
      }
      toast.success("Fornecedor excluído.");
      setSuppliers((prev) => prev.filter((x) => x.id !== s.id));
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
          Novo fornecedor
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="b3-card b3-card-pad text-center">
          <p className="text-ink-3 text-[13px]">
            Nenhum fornecedor cadastrado.
          </p>
          <p className="text-ink-4 mt-1 text-[12px]">
            Cadastre fornecedores pra usar em compras (entrada de mercadoria).
          </p>
        </div>
      ) : (
        <div className="b3-card overflow-x-auto">
          <table className="b3-tbl w-full">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Documento</th>
                <th>Telefone</th>
                <th>Cidade/UF</th>
                <th className="text-right">Compras</th>
                <th>Status</th>
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="text-ink-1 font-medium">{s.name}</span>
                    {s.email ? (
                      <div className="text-ink-4 text-[11px]">{s.email}</div>
                    ) : null}
                  </td>
                  <td className="text-ink-3 mono text-[12px]">
                    {formatDocument(s.document)}
                  </td>
                  <td className="text-ink-3 text-[12.5px]">
                    {s.phone ?? "—"}
                  </td>
                  <td className="text-ink-3 text-[12.5px]">
                    {s.city && s.state
                      ? `${s.city}/${s.state}`
                      : s.city ?? s.state ?? "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {s.purchaseCount}
                  </td>
                  <td>
                    {s.isActive ? (
                      <span className="b3-pill b3-pill--ok">Ativo</span>
                    ) : (
                      <span className="b3-pill">Inativo</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="b3-btn b3-btn--sm"
                        title="Editar fornecedor"
                        disabled={isPending}
                      >
                        <PencilIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        className="b3-btn b3-btn--sm"
                        style={{ color: "var(--danger)" }}
                        disabled={isPending}
                        title="Excluir fornecedor"
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {edit.id ? "Editar fornecedor" : "Novo fornecedor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Nome"
                value={edit.name}
                onChange={(v) => setEdit({ ...edit, name: v })}
                placeholder="Ex: Distribuidora Acme Ltda"
                maxLength={120}
                error={fieldErrors.name}
                autoFocus
              />
              <Field
                label="CPF/CNPJ (sem máscara)"
                value={edit.document}
                onChange={(v) =>
                  setEdit({ ...edit, document: v.replace(/\D/g, "") })
                }
                placeholder="11 ou 14 dígitos"
                maxLength={14}
                mono
                error={fieldErrors.document}
              />
              <Field
                label="Telefone"
                value={edit.phone}
                onChange={(v) => setEdit({ ...edit, phone: v })}
                placeholder="+5511999999999"
                maxLength={40}
                error={fieldErrors.phone}
              />
              <Field
                label="Email"
                value={edit.email}
                onChange={(v) => setEdit({ ...edit, email: v })}
                placeholder="contato@fornecedor.com"
                maxLength={120}
                error={fieldErrors.email}
              />
            </div>

            <div className="border-line border-t pt-3">
              <p className="text-ink-4 text-[10px] font-bold uppercase tracking-wider mb-2">
                Endereço (opcional)
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <Field
                  label="Rua"
                  value={edit.addressStreet}
                  onChange={(v) => setEdit({ ...edit, addressStreet: v })}
                  maxLength={200}
                />
                <Field
                  label="Número"
                  value={edit.addressNumber}
                  onChange={(v) => setEdit({ ...edit, addressNumber: v })}
                  maxLength={20}
                />
                <Field
                  label="Complemento"
                  value={edit.addressComplement}
                  onChange={(v) => setEdit({ ...edit, addressComplement: v })}
                  maxLength={80}
                />
                <Field
                  label="Bairro"
                  value={edit.addressNeighborhood}
                  onChange={(v) =>
                    setEdit({ ...edit, addressNeighborhood: v })
                  }
                  maxLength={80}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_80px_120px] mt-3">
                <Field
                  label="Cidade"
                  value={edit.addressCity}
                  onChange={(v) => setEdit({ ...edit, addressCity: v })}
                  maxLength={80}
                />
                <Field
                  label="UF"
                  value={edit.addressState}
                  onChange={(v) =>
                    setEdit({ ...edit, addressState: v.toUpperCase() })
                  }
                  maxLength={2}
                  error={fieldErrors.addressState}
                />
                <Field
                  label="CEP"
                  value={edit.addressZip}
                  onChange={(v) =>
                    setEdit({ ...edit, addressZip: v.replace(/\D/g, "") })
                  }
                  maxLength={8}
                  mono
                  error={fieldErrors.addressZip}
                />
              </div>
            </div>

            <div className="border-line border-t pt-3">
              <label className="text-ink-2 mb-1 block text-[12.5px] font-medium">
                Observação (opcional)
              </label>
              <textarea
                className="b3-input w-full"
                rows={2}
                maxLength={500}
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                placeholder="Ex: contato preferencial, condição de pagamento, prazo de entrega"
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
              <span className="text-ink-3">
                Ativo (desativar oculta do select de compras sem deletar)
              </span>
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

interface FieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  mono?: boolean;
  error?: string;
  autoFocus?: boolean;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  mono,
  error,
  autoFocus,
}: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-ink-2 block text-[12px] font-medium">
        {label}
      </label>
      <input
        type="text"
        className={`b3-input w-full ${mono ? "mono" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
      />
      {error ? (
        <p className="text-destructive text-[11px]">{error}</p>
      ) : null}
    </div>
  );
}
