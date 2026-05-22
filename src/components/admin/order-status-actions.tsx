"use client";

import {
  CheckIcon,
  Loader2Icon,
  PackageCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { isReturnable } from "@/actions/order/constants";
import type { OrderDetailItem } from "@/actions/order/load-detail";
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
import { OrderReturnDialog } from "@/components/admin/order-return-dialog";

interface OrderStatusActionsProps {
  orderId: string;
  status: (typeof ORDER_STATUS_VALUES)[number];
  /**
   * Sprint 2.1: passados pelo OrderDetailDialog. Quando presentes,
   * o botão de devolução abre o OrderReturnDialog rico (full/partial
   * + fluxo guiado de fiado). Quando ausentes (callers legados), a
   * devolução não é oferecida — o caller precisa migrar.
   */
  items?: OrderDetailItem[];
  totalInCents?: number;
}

/**
 * Botões de transição de status. Render condicional — só ações permitidas
 * por `VALID_TRANSITIONS` aparecem. Cancelamento exige confirmação.
 */
export function OrderStatusActions({
  orderId,
  status,
  items,
  totalInCents,
}: OrderStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const allowed = VALID_TRANSITIONS[status];
  // Sprint 2.1 — devolução só aparece quando o caller passou os items
  // (necessário pro modo partial). Callers legados não veem o botão.
  const canReturn =
    isReturnable(status) && Array.isArray(items) && typeof totalInCents === "number";

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

  // Status 'returned' — venda já devolvida, nada a fazer.
  if (status === "returned") {
    return (
      <p className="text-ink-4 text-xs">
        Venda devolvida. Sem ações disponíveis.
      </p>
    );
  }

  if (allowed.length === 0 && !canReturn) {
    return (
      <p className="text-ink-4 text-xs">
        Venda finalizada. Sem ações disponíveis.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allowed.includes("confirmed") ? (
        <Button
          type="button"
          onClick={() => transition("confirmed", "Venda confirmada.")}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <CheckIcon />
          )}
          Confirmar venda
        </Button>
      ) : null}

      {allowed.includes("fulfilled") ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => transition("fulfilled", "Venda marcada como cumprida.")}
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
              <XCircleIcon /> Cancelar venda
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar esta venda?</AlertDialogTitle>
              <AlertDialogDescription>
                A cliente não recebe nenhum aviso automaticamente — combine o
                cancelamento por WhatsApp antes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => transition("canceled", "Venda cancelada.")}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Cancelar venda
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {canReturn && items && typeof totalInCents === "number" ? (
        <OrderReturnDialog
          orderId={orderId}
          orderTotalInCents={totalInCents}
          items={items}
          disabled={isPending}
        />
      ) : null}
    </div>
  );
}
