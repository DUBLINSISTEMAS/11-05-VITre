"use client";

/**
 * BrandField — Sprint 2A.
 *
 * Permite escolher uma marca cadastrada (select) OU digitar texto livre,
 * com botão "+ Nova marca" inline que cria a marca server-side sem perder
 * o estado do produto.
 *
 * Semântica:
 *   - Select escolhido → brandId = X, brandText = (nome snapshot)
 *   - Texto livre → brandId = null, brandText = texto
 *   - "Nenhuma" → brandId = null, brandText = ""
 *
 * Estados:
 *   - `mode = "select"` (default quando há marcas cadastradas): combobox
 *   - `mode = "freetext"`: input texto livre (sem snap pra select)
 *   - Toggle entre os 2 modos via link "Digitar livre"/"Escolher cadastrada"
 */
import { PlusIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { upsertBrand } from "@/actions/brand";
import type { BrandOption } from "@/actions/brand/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NONE_VALUE = "__none__";
const FREETEXT_VALUE = "__freetext__";

interface BrandFieldProps {
  brandId: string | null;
  brandText: string;
  brands: BrandOption[];
  disabled?: boolean;
  onChange: (next: { brandId: string | null; brandText: string }) => void;
  onBrandCreated: (b: BrandOption) => void;
}

export function BrandField({
  brandId,
  brandText,
  brands,
  disabled,
  onChange,
  onBrandCreated,
}: BrandFieldProps) {
  // Default mode: "select" se há brands cadastradas E (brandId setado OU brandText vazio).
  // "freetext" se brandText preenchido mas brandId não bate com nenhuma brand cadastrada.
  const hasCustomText =
    brandText && !brands.some((b) => b.id === brandId);
  const [mode, setMode] = useState<"select" | "freetext">(
    hasCustomText || brands.length === 0 ? "freetext" : "select",
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [creating, startCreate] = useTransition();
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialogOpen) {
      // Focus input quando dialog abre
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [dialogOpen]);

  function handleSelectChange(value: string) {
    if (value === NONE_VALUE) {
      onChange({ brandId: null, brandText: "" });
      return;
    }
    if (value === FREETEXT_VALUE) {
      setMode("freetext");
      // Não muda valor — lojista vai digitar
      return;
    }
    const picked = brands.find((b) => b.id === value);
    if (picked) {
      onChange({ brandId: picked.id, brandText: picked.name });
    }
  }

  function handleCreateBrand() {
    const name = newBrandName.trim();
    if (!name) {
      toast.error("Digite o nome da marca.");
      return;
    }
    startCreate(async () => {
      const result = await upsertBrand({ id: null, name, slug: null });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Marca criada.");
      onBrandCreated({ id: result.id, name: result.name });
      setDialogOpen(false);
      setNewBrandName("");
    });
  }

  // No mode "select" sem marcas cadastradas, força freetext.
  const effectiveMode = brands.length === 0 ? "freetext" : mode;

  if (effectiveMode === "freetext") {
    return (
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input
            id="product-brand"
            type="text"
            placeholder="Ex: Vivara, Nike"
            disabled={disabled}
            maxLength={80}
            value={brandText}
            onChange={(e) =>
              onChange({ brandId: null, brandText: e.target.value })
            }
            className="b3-input flex-1"
          />
        </div>
        {brands.length > 0 ? (
          <button
            type="button"
            className="text-ink-4 hover:text-brand text-[11px] underline"
            disabled={disabled}
            onClick={() => setMode("select")}
          >
            Escolher marca cadastrada
          </button>
        ) : (
          <button
            type="button"
            className="text-ink-4 hover:text-brand text-[11px] underline"
            disabled={disabled}
            onClick={() => setDialogOpen(true)}
          >
            + Cadastrar como marca reutilizável
          </button>
        )}
        <BrandCreateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          name={newBrandName}
          onNameChange={setNewBrandName}
          onCreate={handleCreateBrand}
          creating={creating}
          inputRef={nameInputRef}
          suggestedName={brandText.trim() || undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Select
          value={brandId ?? NONE_VALUE}
          onValueChange={handleSelectChange}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Sem marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>Sem marca</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
            <SelectItem value={FREETEXT_VALUE}>Digitar texto livre…</SelectItem>
          </SelectContent>
        </Select>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setDialogOpen(true)}
          aria-label="Cadastrar nova marca"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-line text-ink-3 transition",
            !disabled && "hover:border-brand hover:text-brand",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <PlusIcon size={14} />
        </button>
      </div>
      <BrandCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        name={newBrandName}
        onNameChange={setNewBrandName}
        onCreate={handleCreateBrand}
        creating={creating}
        inputRef={nameInputRef}
      />
    </div>
  );
}

interface BrandCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (next: string) => void;
  onCreate: () => void;
  creating: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestedName?: string;
}

function BrandCreateDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  onCreate,
  creating,
  inputRef,
  suggestedName,
}: BrandCreateDialogProps) {
  useEffect(() => {
    if (open && suggestedName && !name) {
      onNameChange(suggestedName);
    }
  }, [open, suggestedName, name, onNameChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova marca</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-ink-2 block text-[12.5px] font-medium">
            Nome
          </label>
          <input
            ref={inputRef}
            type="text"
            className="b3-input w-full"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ex: Vivara, Nike"
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creating && name.trim()) {
                e.preventDefault();
                onCreate();
              }
            }}
          />
          <p className="text-ink-4 text-[11px]">
            O endereço (slug) é gerado automaticamente. Pode editar depois em
            /admin/marcas.
          </p>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="b3-btn"
            disabled={creating}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={creating || !name.trim()}
            className="b3-btn b3-btn--cta"
          >
            {creating ? "Criando…" : "Criar marca"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
