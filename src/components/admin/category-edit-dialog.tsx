"use client";

import { Loader2Icon, PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateCategory } from "@/actions/category/update";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

import type { CategoryOption } from "./category-dialog";
import { CategoryImageUploader } from "./category-image-uploader";

const NO_PARENT = "__none__";

interface CategoryEditDialogProps {
  category: {
    id: string;
    name: string;
    parentId: string | null;
    imageUrl: string | null;
  };
  /** Categorias raiz da loja (excluindo a própria, pra não virar pai dela mesma). */
  rootCategories: CategoryOption[];
  /** True se a categoria atual já é raiz com filhas — bloqueia mudança pra subcategoria. */
  hasChildren: boolean;
}

/**
 * Dialog de editar categoria. Trigger é o ícone de lápis. Servidor revalida
 * `/admin/categorias` ao salvar; chamamos `router.refresh()` pra atualizar
 * a lista atual sem reload.
 */
export function CategoryEditDialog({
  category,
  rootCategories,
  hasChildren,
}: CategoryEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [parentId, setParentId] = useState<string>(
    category.parentId ?? NO_PARENT,
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [parentError, setParentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset campos quando a categoria muda OU quando reabre o dialog.
  useEffect(() => {
    if (!open) return;
    setName(category.name);
    setParentId(category.parentId ?? NO_PARENT);
    setNameError(null);
    setParentError(null);
  }, [open, category.id, category.name, category.parentId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setParentError(null);

    startTransition(async () => {
      const result = await updateCategory({
        categoryId: category.id,
        name,
        parentId: parentId === NO_PARENT ? null : parentId,
      });
      if (!result.ok) {
        if (result.fieldErrors?.name) setNameError(result.fieldErrors.name);
        if (result.fieldErrors?.parentId) setParentError(result.fieldErrors.parentId);
        toast.error(result.error);
        return;
      }
      toast.success("Categoria atualizada.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Editar ${category.name}`}
        >
          <PencilIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar categoria</DialogTitle>
          <DialogDescription>
            Renomear, mover ou trocar a imagem que aparece na vitrine.
          </DialogDescription>
        </DialogHeader>

        <div className="border-border/60 mb-4 rounded-lg border p-3">
          <CategoryImageUploader
            categoryId={category.id}
            currentUrl={category.imageUrl}
            hint="Imagem redonda exibida no topo da vitrine. JPG, PNG ou WebP — máx 8 MB."
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-cat-name">Nome</Label>
            <Input
              id="edit-cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="off"
              autoFocus
              disabled={isPending}
              aria-invalid={!!nameError}
              required
            />
            {nameError ? (
              <p className="text-destructive text-xs">{nameError}</p>
            ) : null}
          </div>

          {rootCategories.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="edit-cat-parent">Categoria pai</Label>
              <Select
                value={parentId}
                onValueChange={setParentId}
                disabled={isPending || hasChildren}
              >
                <SelectTrigger id="edit-cat-parent" className="w-full">
                  <SelectValue placeholder="Sem categoria pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>
                    Sem categoria pai (raiz)
                  </SelectItem>
                  {rootCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasChildren ? (
                <p className="text-muted-foreground text-xs">
                  Esta categoria tem subcategorias — não pode virar
                  subcategoria. Mova ou apague as filhas primeiro.
                </p>
              ) : null}
              {parentError ? (
                <p className="text-destructive text-xs">{parentError}</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? (
                <>
                  <Loader2Icon className="animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
