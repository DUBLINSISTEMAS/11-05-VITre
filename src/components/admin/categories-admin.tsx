"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";

import { deleteCategory } from "@/actions/category/delete";
import { reorderCategories } from "@/actions/category/reorder";
import { toggleCategoryActive } from "@/actions/category/toggle-active";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { CategoryOption } from "./category-dialog";
import { CategoryEditDialog } from "./category-edit-dialog";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
  isActive: boolean;
  imageUrl: string | null;
}

interface CategoriesAdminProps {
  categories: CategoryRow[];
  /** Mapa categoryId → quantidade de produtos. Calculado server-side. */
  productCountByCategory: Record<string, number>;
}

/**
 * Painel interativo de categorias. Recebe lista flat do server e:
 *  - Agrupa em raízes + filhas no client
 *  - Reorder (↑/↓ por escopo: raízes ou filhas de um parent)
 *  - Toggle visibilidade
 *  - Editar (dialog)
 *  - Deletar (alert dialog confirma)
 *
 * Após cada mutação, `router.refresh()` reusa o RSC pra atualizar a lista
 * com dados frescos sem reload completo.
 */
export function CategoriesAdmin({
  categories,
  productCountByCategory,
}: CategoriesAdminProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Agrupa raízes + filhas (estável por position+name).
  const { roots, childrenByParent } = useMemo(() => {
    const sorted = [...categories].sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
    const rootList = sorted.filter((c) => c.parentId === null);
    const map = new Map<string, CategoryRow[]>();
    for (const c of sorted) {
      if (c.parentId) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    }
    return { roots: rootList, childrenByParent: map };
  }, [categories]);

  // Categorias-raiz disponíveis pra ser pai (todas as raízes).
  // Usado nos edit dialogs.
  const rootOptions: CategoryOption[] = useMemo(
    () =>
      roots.map((r) => ({ id: r.id, name: r.name, parentId: null })),
    [roots],
  );

  const handleReorder = (
    parentId: string | null,
    fromIdx: number,
    direction: -1 | 1,
  ) => {
    const scope = parentId === null
      ? roots
      : childrenByParent.get(parentId) ?? [];
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= scope.length) return;
    const newOrder = [...scope];
    const tmp = newOrder[fromIdx]!;
    newOrder[fromIdx] = newOrder[toIdx]!;
    newOrder[toIdx] = tmp;

    startTransition(async () => {
      const r = await reorderCategories({
        orderedIds: newOrder.map((c) => c.id),
        parentId,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  };

  const handleToggle = (cat: CategoryRow) => {
    startTransition(async () => {
      const r = await toggleCategoryActive({
        categoryId: cat.id,
        isActive: !cat.isActive,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.isActive ? "Categoria visível." : "Categoria pausada.");
      router.refresh();
    });
  };

  const handleDelete = (cat: CategoryRow) => {
    startTransition(async () => {
      const r = await deleteCategory({ categoryId: cat.id });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Categoria excluída.");
      router.refresh();
    });
  };

  if (roots.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-3">
      {roots.map((root, idx) => {
        const children = childrenByParent.get(root.id) ?? [];
        return (
          <li key={root.id}>
            <CategoryCard
              category={root}
              rootOptions={rootOptions.filter((r) => r.id !== root.id)}
              hasChildren={children.length > 0}
              productCount={productCountByCategory[root.id] ?? 0}
              isFirst={idx === 0}
              isLast={idx === roots.length - 1}
              isPending={isPending}
              onMove={(dir) => handleReorder(null, idx, dir)}
              onToggle={() => handleToggle(root)}
              onDelete={() => handleDelete(root)}
            />
            {children.length > 0 ? (
              <ul className="mt-2 space-y-1.5 pl-4 sm:pl-8">
                {children.map((child, cIdx) => (
                  <li key={child.id}>
                    <CategoryCard
                      category={child}
                      rootOptions={rootOptions.filter((r) => r.id !== child.id)}
                      hasChildren={false}
                      productCount={productCountByCategory[child.id] ?? 0}
                      isFirst={cIdx === 0}
                      isLast={cIdx === children.length - 1}
                      isPending={isPending}
                      isChild
                      onMove={(dir) => handleReorder(root.id, cIdx, dir)}
                      onToggle={() => handleToggle(child)}
                      onDelete={() => handleDelete(child)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface CategoryCardProps {
  category: CategoryRow;
  rootOptions: CategoryOption[];
  hasChildren: boolean;
  productCount: number;
  isFirst: boolean;
  isLast: boolean;
  isPending: boolean;
  isChild?: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  onDelete: () => void;
}

function CategoryCard({
  category,
  rootOptions,
  hasChildren,
  productCount,
  isFirst,
  isLast,
  isPending,
  isChild,
  onMove,
  onToggle,
  onDelete,
}: CategoryCardProps) {
  return (
    <div
      className={cn(
        "bg-card flex items-center gap-2 rounded-xl border p-2.5 shadow-sm transition-colors sm:gap-3 sm:p-3",
        !category.isActive && "opacity-60",
        isChild && "border-dashed shadow-none",
      )}
    >
      <div className="flex shrink-0 flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={isFirst || isPending}
          onClick={() => onMove(-1)}
          aria-label={`Mover ${category.name} para cima`}
        >
          <ArrowUpIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={isLast || isPending}
          onClick={() => onMove(1)}
          aria-label={`Mover ${category.name} para baixo`}
        >
          <ArrowDownIcon className="size-3.5" />
        </Button>
      </div>

      <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-full border sm:size-12">
        {category.imageUrl ? (
          <Image
            src={category.imageUrl}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="text-muted-foreground/60 flex size-full items-center justify-center">
            <ImageIcon className="size-4" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium sm:text-base">
          {category.name}
          {!category.isActive ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              · pausada
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground text-xs">
          {productCount} {productCount === 1 ? "produto" : "produtos"}
          {hasChildren ? " · com subcategorias" : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          disabled={isPending}
          aria-label={
            category.isActive ? "Pausar categoria" : "Tornar categoria visível"
          }
        >
          {category.isActive ? (
            <EyeIcon className="size-4" />
          ) : (
            <EyeOffIcon className="size-4" />
          )}
        </Button>

        <CategoryEditDialog
          category={category}
          rootCategories={rootOptions}
          hasChildren={hasChildren}
        />

        <DeleteCategoryButton
          categoryName={category.name}
          productCount={productCount}
          hasChildren={hasChildren}
          isPending={isPending}
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}

interface DeleteCategoryButtonProps {
  categoryName: string;
  productCount: number;
  hasChildren: boolean;
  isPending: boolean;
  onConfirm: () => void;
}

function DeleteCategoryButton({
  categoryName,
  productCount,
  hasChildren,
  isPending,
  onConfirm,
}: DeleteCategoryButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isPending || hasChildren}
          aria-label={`Excluir ${categoryName}`}
        >
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <Trash2Icon className="size-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{categoryName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {productCount > 0
              ? `${productCount} ${productCount === 1 ? "produto vai ficar" : "produtos vão ficar"} sem categoria. Essa ação não pode ser desfeita.`
              : "Essa ação não pode ser desfeita."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
