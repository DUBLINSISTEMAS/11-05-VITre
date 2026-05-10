"use client";

// Toolbar flutuante de bulk actions (canvas-v1 admin Lote 3). Aparece
// quando ≥1 produto selecionado na ProductsTable. Ativar / Pausar /
// Excluir, com AlertDialog destrutivo no Excluir.
//
// Layout: barra sticky no fundo do card de listagem (não fixed na viewport
// — fica contida no scroll do main pra não atrapalhar quem rola pra cima).
import { EyeIcon, EyeOffIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { bulkDeleteProducts } from "@/actions/product/bulk-delete";
import { bulkToggleProductsActive } from "@/actions/product/bulk-toggle-active";
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

export interface BulkActionsToolbarProps {
  selectedIds: ReadonlyArray<string>;
  onClear: () => void;
  /** Chamado depois de qualquer mutação bem-sucedida (limpa seleção). */
  onMutated: () => void;
}

export function BulkActionsToolbar({
  selectedIds,
  onClear,
  onMutated,
}: BulkActionsToolbarProps) {
  const [isPending, startTransition] = useTransition();
  const count = selectedIds.length;

  const handleToggle = (isActive: boolean) => {
    startTransition(async () => {
      const result = await bulkToggleProductsActive({
        productIds: [...selectedIds],
        isActive,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const verb = isActive ? "publicado" : "pausado";
      const noun = result.updated === 1 ? "produto" : "produtos";
      let message = `${result.updated} ${noun} ${verb}${result.updated === 1 ? "" : "s"}.`;
      if (isActive && result.skippedDrafts > 0) {
        message += ` ${result.skippedDrafts} rascunho${result.skippedDrafts === 1 ? "" : "s"} pulado${result.skippedDrafts === 1 ? "" : "s"} — termine de cadastrar antes de publicar.`;
      }
      toast.success(message);
      onMutated();
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await bulkDeleteProducts({
        productIds: [...selectedIds],
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const noun = result.deleted === 1 ? "produto" : "produtos";
      toast.success(`${result.deleted} ${noun} excluído${result.deleted === 1 ? "" : "s"}.`);
      onMutated();
    });
  };

  if (count === 0) return null;

  return (
    <div className="bg-foreground text-background sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-2 rounded-xl px-3 py-2 shadow-lg">
      <button
        type="button"
        onClick={onClear}
        aria-label="Limpar seleção"
        className="hocus:bg-background/15 flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-background/40"
      >
        <XIcon className="size-4" />
      </button>
      <span className="font-mono text-[12.5px] font-medium tabular-nums">
        {count} selecionado{count === 1 ? "" : "s"}
      </span>
      <span aria-hidden className="bg-background/20 mx-1 h-5 w-px" />

      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => handleToggle(true)}
        className="text-background hover:bg-background/15 hover:text-background h-8"
      >
        <EyeIcon className="size-3.5" /> Publicar
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => handleToggle(false)}
        className="text-background hover:bg-background/15 hover:text-background h-8"
      >
        <EyeOffIcon className="size-3.5" /> Pausar
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            className="text-destructive-soft hover:bg-destructive/15 hover:text-destructive-soft h-8"
          >
            <Trash2Icon className="size-3.5" /> Excluir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {count} produto{count === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As imagens dos produtos
              também serão removidas. Pedidos antigos com esses produtos
              continuam preservados (snapshots).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
