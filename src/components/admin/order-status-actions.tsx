"use client";

import { CheckIcon, Loader2Icon, PackageCheckIcon, XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  ORDER_STATUS_VALUES,
  VALID_TRANSITIONS,
} from "@/actions/order/schema";
import { updateOrderStatus } from "@/actions/order/update-status";
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

interface OrderStatusActionsProps {
  orderId: string;
  status: (typeof ORDER_STATUS_VALUES)[number];
}

/**
 * Botões de transição de status. Render condicional — só ações permitidas
 * por `VALID_TRANSITIONS` aparecem. Cancelamento exige confirmação.
 */
export function OrderStatusActions({
  orderId,
  status,
}: OrderStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const allowed = VALID_TRANSITIONS[status];

  const transition = (
    next: (typeof ORDER_STATUS_VALUES)[number],
    successMsg: string,
  ) => {
    startTransition(async () => {
      const r = await updateOrderStatus({ orderId, nextStatus: next });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(successMsg);
      router.refresh();
    });
  };

  if (allowed.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Pedido finalizado. Sem ações disponíveis.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allowed.includes("confirmed") ? (
        <Button
          type="button"
          onClick={() => transition("confirmed", "Pedido confirmado.")}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <CheckIcon />
          )}
          Confirmar pedido
        </Button>
      ) : null}

      {allowed.includes("fulfilled") ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => transition("fulfilled", "Pedido marcado como cumprido.")}
          disabled={isPending}
        >
          <PackageCheckIcon /> Marcar como cumprido
        </Button>
      ) : null}

      {allowed.includes("canceled") ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <XCircleIcon /> Cancelar pedido
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar este pedido?</AlertDialogTitle>
              <AlertDialogDescription>
                A cliente não recebe nenhum aviso automaticamente — combine o
                cancelamento por WhatsApp antes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => transition("canceled", "Pedido cancelado.")}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Cancelar pedido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
