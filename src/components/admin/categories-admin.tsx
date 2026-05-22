"use client";

// Painel de categorias — port Dublin v3 (ADR-0019, Onda A.8).
//
// Layout canônico (B3CategoriasScreen, bagy-extra.jsx:266-322):
// - b3-card com b3-helpbar topo (border-radius 12px 12px 0 0)
// - Grid 300px 1fr: descrição esquerda + b3-tree direita
// - Cada categoria root → b3-tree-l1 (uppercase, ink-1)
// - Cada subcategoria → b3-tree-l2 (uppercase, ink-2)
// - Row tem: grip (up/down arrows substituem DnD nativo) + name +
//   ícone toggle visibility + actions ("Adicionar" só pra root + "Editar"
//   ícone + "Excluir" texto danger)
//
// Mantém capacidade Mangos Pay:
// - Reorder via ↑↓ (DnD nativo NÃO implementado; arrows são UX
//   acessível-friendly mas menos fluido)
// - Toggle visibilidade
// - Edit dialog (com image upload)
// - Delete confirm

import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
  /** Mapa categoryId → quantidade de produtos. */
  productCountByCategory: Record<string, number>;
  /** Categorias raiz pra dialog de criação inline. */
  rootOptions: CategoryOption[];
}

export function CategoriesAdmin({
  categories,
  productCountByCategory,
  rootOptions: rootOptionsProp,
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

  // Mesmo array de roots reformatado pra `CategoryOption` (para dialog Edit).
  const rootOptions: CategoryOption[] = useMemo(
    () =>
      rootOptionsProp.length > 0
        ? rootOptionsProp
        : roots.map((r) => ({ id: r.id, name: r.name, parentId: null })),
    [rootOptionsProp, roots],
  );

  const handleReorder = (
    parentId: string | null,
    fromIdx: number,
    direction: -1 | 1,
  ) => {
    const scope =
      parentId === null ? roots : (childrenByParent.get(parentId) ?? []);
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
    <div className="b3-card overflow-hidden">
      {/* Onda 2.11: helpbar com link de vídeo removido. Promessa quebrada
          de "vídeo em breve" frustra mais do que ajuda; volta quando
          houver conteúdo real. */}

      {/* Grid: descrição esquerda 300px + tree direita */}
      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[300px_1fr]">
        <div className="space-y-3.5">
          <p className="text-ink-3 text-[13.5px] leading-[1.6]">
            As categorias e subcategorias são fundamentais para organizar
            o seu catálogo de produtos. É possível criar até{" "}
            <strong>dois níveis</strong> de subcategorias.
          </p>
          <p className="text-ink-3 text-[13.5px] leading-[1.6]">
            Para modificar ou personalizar a hierarquia das categorias,
            use as setas ↑/↓ pra reordenar dentro do mesmo nível.
          </p>
        </div>

        <div>
          <div className="b3-tree">
            {roots.map((root, idx) => {
              const subs = childrenByParent.get(root.id) ?? [];
              return (
                <CategoryTreeGroup
                  key={root.id}
                  root={root}
                  subs={subs}
                  rootIdx={idx}
                  rootsCount={roots.length}
                  rootOptions={rootOptions.filter((r) => r.id !== root.id)}
                  productCountByCategory={productCountByCategory}
                  isPending={isPending}
                  onMove={(dir) => handleReorder(null, idx, dir)}
                  onMoveChild={(cIdx, dir) =>
                    handleReorder(root.id, cIdx, dir)
                  }
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TREE GROUP (root + filhas) ────────────────────────────────────────

interface CategoryTreeGroupProps {
  root: CategoryRow;
  subs: CategoryRow[];
  rootIdx: number;
  rootsCount: number;
  rootOptions: CategoryOption[];
  productCountByCategory: Record<string, number>;
  isPending: boolean;
  onMove: (direction: -1 | 1) => void;
  onMoveChild: (childIdx: number, direction: -1 | 1) => void;
  onToggle: (cat: CategoryRow) => void;
  onDelete: (cat: CategoryRow) => void;
}

function CategoryTreeGroup({
  root,
  subs,
  rootIdx,
  rootsCount,
  rootOptions,
  productCountByCategory,
  isPending,
  onMove,
  onMoveChild,
  onToggle,
  onDelete,
}: CategoryTreeGroupProps) {
  return (
    <>
      <CategoryTreeRow
        category={root}
        level={1}
        rootOptions={rootOptions}
        hasChildren={subs.length > 0}
        productCount={productCountByCategory[root.id] ?? 0}
        isFirst={rootIdx === 0}
        isLast={rootIdx === rootsCount - 1}
        isPending={isPending}
        onMove={onMove}
        onToggle={() => onToggle(root)}
        onDelete={() => onDelete(root)}
      />
      {subs.map((child, cIdx) => (
        <CategoryTreeRow
          key={child.id}
          category={child}
          level={2}
          rootOptions={rootOptions.filter((r) => r.id !== child.id)}
          hasChildren={false}
          productCount={productCountByCategory[child.id] ?? 0}
          isFirst={cIdx === 0}
          isLast={cIdx === subs.length - 1}
          isPending={isPending}
          onMove={(dir) => onMoveChild(cIdx, dir)}
          onToggle={() => onToggle(child)}
          onDelete={() => onDelete(child)}
        />
      ))}
    </>
  );
}

// ─── TREE ROW (uma categoria, l1 ou l2) ────────────────────────────────

interface CategoryTreeRowProps {
  category: CategoryRow;
  level: 1 | 2;
  rootOptions: CategoryOption[];
  hasChildren: boolean;
  productCount: number;
  isFirst: boolean;
  isLast: boolean;
  isPending: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  onDelete: () => void;
}

function CategoryTreeRow({
  category,
  level,
  rootOptions,
  hasChildren,
  productCount,
  isFirst,
  isLast,
  isPending,
  onMove,
  onToggle,
  onDelete,
}: CategoryTreeRowProps) {
  return (
    <div
      className={cn(
        `b3-tree-row b3-tree-l${level}`,
        !category.isActive && "opacity-60",
      )}
    >
      {/* Grip — substituído por setas ↑↓ stacked (DnD nativo não
          implementado; setas são UX acessível) */}
      <span className="b3-tree-grip flex-col gap-0">
        <button
          type="button"
          className="text-ink-4 hover:text-ink-1 leading-none disabled:opacity-30"
          disabled={isFirst || isPending}
          onClick={() => onMove(-1)}
          aria-label={`Mover ${category.name} para cima`}
        >
          <ArrowUpIcon className="size-3" />
        </button>
        <button
          type="button"
          className="text-ink-4 hover:text-ink-1 leading-none disabled:opacity-30"
          disabled={isLast || isPending}
          onClick={() => onMove(1)}
          aria-label={`Mover ${category.name} para baixo`}
        >
          <ArrowDownIcon className="size-3" />
        </button>
      </span>

      {/* Avatar opcional — fica pequeno se houver image */}
      {category.imageUrl ? (
        <span className="bg-bg-app relative size-7 shrink-0 overflow-hidden rounded-full border border-line">
          <Image
            src={category.imageUrl}
            alt=""
            fill
            sizes="28px"
            className="object-cover"
          />
        </span>
      ) : (
        <span className="bg-bg-app text-ink-5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line">
          <ImageIcon className="size-3" aria-hidden />
        </span>
      )}

      {/* Nome (uppercase via b3-tree-name CSS) */}
      <span
        className="b3-tree-name"
        style={{
          color:
            level === 1
              ? "var(--ink-1)"
              : "var(--ink-2)",
        }}
      >
        {category.name}
      </span>

      {/* Counter de produtos */}
      <span className="text-ink-4 font-mono text-[11px] tabular-nums">
        {productCount} {productCount === 1 ? "prod" : "prods"}
      </span>

      {/* Toggle visibility */}
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        className={cn(
          "text-ink-4 hover:text-ink-1 rounded p-1 transition-colors",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
        aria-label={
          category.isActive
            ? `Pausar ${category.name}`
            : `Tornar ${category.name} visível`
        }
      >
        {category.isActive ? (
          <EyeIcon className="size-3.5" />
        ) : (
          <EyeOffIcon className="size-3.5" />
        )}
      </button>

      {/* Actions: Editar (ícone) + Excluir (texto danger) */}
      <div className="b3-tree-actions">
        <CategoryEditDialog
          category={category}
          rootCategories={rootOptions}
          hasChildren={hasChildren}
          trigger={
            <button
              type="button"
              aria-label={`Editar ${category.name}`}
              className="inline-flex items-center gap-1"
            >
              <PencilIcon className="size-3" /> Editar
            </button>
          }
        />
        <DeleteCategoryConfirm
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

// ─── DELETE CONFIRM ────────────────────────────────────────────────────

interface DeleteCategoryConfirmProps {
  categoryName: string;
  productCount: number;
  hasChildren: boolean;
  isPending: boolean;
  onConfirm: () => void;
}

function DeleteCategoryConfirm({
  categoryName,
  productCount,
  hasChildren,
  isPending,
  onConfirm,
}: DeleteCategoryConfirmProps) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="danger inline-flex items-center gap-1"
          disabled={isPending || hasChildren}
          aria-label={`Excluir ${categoryName}`}
        >
          {isPending ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <Trash2Icon className="size-3" />
          )}{" "}
          Excluir
        </button>
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
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
