"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createCategory } from "@/actions/category/create";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CategoryOption {
  id: string;
  name: string;
  /** parentId === null = categoria raiz (pode ser pai). */
  parentId: string | null;
}

interface CategoryDialogProps {
  /** Categorias raiz da loja, pra opção "categoria pai". */
  rootCategories: CategoryOption[];
  /** Trigger custom; se omitido, usa botão "Adicionar categoria" `b3-btn--cta`. */
  trigger?: React.ReactNode;
  /** Quando true, trigger fica desabilitado (ex: form pai está salvando). */
  disabled?: boolean;
  /** Callback ao criar — útil pra recarregar lista ou pré-selecionar
   * a categoria recém-criada num dropdown pai. */
  onCreated?: (category: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
  }) => void;
}

const NO_PARENT = "__none__";

/**
 * Modal de criar categoria — port Dublin v3 (ADR-0019, Onda A.8).
 *
 * Lojista preenche nome (obrigatório) + opcionalmente escolhe categoria
 * pai. Salva, fecha, volta pro contexto onde abriu.
 *
 * Reusável: pode ser disparado de `/admin/categorias` ou inline no
 * ProductForm como "+ Nova categoria".
 */
export function CategoryDialog({
  rootCategories,
  trigger,
  disabled,
  onCreated,
}: CategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>(NO_PARENT);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);

    startTransition(async () => {
      const result = await createCategory({
        name,
        parentId: parentId === NO_PARENT ? null : parentId,
      });
      if (!result.ok) {
        if (result.fieldErrors?.name) setNameError(result.fieldErrors.name);
        toast.error(result.error);
        return;
      }
      toast.success(`Categoria “${result.category.name}” criada.`);
      // Reset + close ANTES do callback evita flash do dialog enquanto
      // o parent re-renderiza com a categoria nova.
      setName("");
      setParentId(NO_PARENT);
      setOpen(false);
      onCreated?.(result.category);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="b3-btn b3-btn--cta"
            disabled={disabled}
          >
            <PlusIcon className="size-3.5" /> Adicionar categoria
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <DialogDescription>
            Categorias agrupam produtos na sua vitrine — ex: “Vestidos”,
            “Anéis”, “Perfumes”.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="b3-field">
            <label htmlFor="category-name" className="b3-field-label">
              Nome
            </label>
            <input
              id="category-name"
              type="text"
              className="b3-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vestidos"
              maxLength={60}
              autoComplete="off"
              autoFocus
              disabled={isPending}
              aria-invalid={!!nameError}
              required
            />
            {nameError ? (
              <p className="text-destructive mt-1.5 text-[11px]">{nameError}</p>
            ) : null}
          </div>

          {rootCategories.length > 0 ? (
            <div className="b3-field">
              <label htmlFor="category-parent" className="b3-field-label">
                Categoria pai (opcional)
              </label>
              <Select
                value={parentId}
                onValueChange={setParentId}
                disabled={isPending}
              >
                <SelectTrigger id="category-parent" className="w-full">
                  <SelectValue placeholder="Sem categoria pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>
                    Sem categoria pai
                  </SelectItem>
                  {rootCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-ink-4 mt-1.5 text-[11px]">
                Use pra criar subcategorias (ex: “Vestidos” → “Festa”). Máx
                2 níveis.
              </p>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              className="b3-btn"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="b3-btn b3-btn--cta"
              disabled={isPending || !name.trim()}
            >
              {isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" /> Criando…
                </>
              ) : (
                "Criar categoria"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
