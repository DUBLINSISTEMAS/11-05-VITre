"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteProduct } from "@/actions/product/delete";
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

interface DeleteProductDialogProps {
  productId: string;
  productName: string;
  /**
   * Quando true, mostra apenas o ícone (uso em menu compacto).
   * Default: false → mostra ícone + texto.
   */
  iconOnly?: boolean;
  /**
   * Trigger custom (ex: DropdownMenuItem). Quando passado, ignora `iconOnly`.
   */
  trigger?: React.ReactNode;
}

/**
 * Diálogo de exclusão de produto. Confirmação por 2 cliques (não digitar
 * nome — Sandra de 50 anos não acerta digitação exata 3x).
 *
 * Após sucesso: redireciona pra `/admin/produtos`.
 */
export function DeleteProductDialog({
  productId,
  productName,
  iconOnly,
  trigger,
}: DeleteProductDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteProduct({ productId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Produto excluído.");
      setOpen(false);
      router.push("/admin/produtos");
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="ghost"
            size={iconOnly ? "icon" : "sm"}
            className="text-destructive hocus:bg-destructive/10 hocus:text-destructive"
            aria-label="Excluir produto"
          >
            <Trash2Icon />
            {iconOnly ? null : "Excluir"}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="text-foreground font-medium">
              {productName || "Este produto"}
            </span>{" "}
            e todas as suas fotos e variantes serão removidos. Esta ação não
            pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isPending}
            className="bg-destructive text-white hocus:bg-destructive/90"
          >
            {isPending ? "Excluindo…" : "Sim, excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
