"use client";

import {
  CheckIcon,
  Loader2Icon,
  PackageCheckIcon,
  Undo2Icon,
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { isReturnable } from "@/actions/order/constants";
import { recordOrderReturn } from "@/actions/order/record-return";
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
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const allowed = VALID_TRANSITIONS[status];
  const canReturn = isReturnable(status);

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

  const submitReturn = async () => {
    if (returnReason.trim().length < 3) {
      toast.error("Motivo precisa ter pelo menos 3 caracteres.");
      return;
    }
    setReturnSubmitting(true);
    try {
      const r = await recordOrderReturn({
        orderId,
        reason: returnReason.trim(),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.cashAdjustmentId
          ? `Devolução registrada. Saída de R$ ${(r.refundedInCents / 100)
              .toFixed(2)
              .replace(".", ",")} no caixa.`
          : "Devolução registrada.",
      );
      setReturnReason("");
      router.refresh();
    } finally {
      setReturnSubmitting(false);
    }
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

      {canReturn ? (
        <AlertDialog
          onOpenChange={(open) => {
            if (!open) setReturnReason("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={isPending || returnSubmitting}
              className="text-state-warning hover:bg-state-warning/10 hover:text-state-warning"
            >
              <Undo2Icon /> Registrar devolução
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Registrar devolução desta venda?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  Cliente trouxe os produtos de volta. O estoque será
                  restaurado, e — se houver caixa aberto — uma saída
                  será registrada pelo valor total.
                </span>
                <span className="text-warn block text-xs">
                  Devolução é PERMANENTE. Se houver fiado em aberto desta
                  venda, quite ou estorne antes.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1">
              <label
                htmlFor="return-reason"
                className="text-ink-2 text-xs font-medium"
              >
                Motivo (obrigatório, min 3 caracteres)
              </label>
              <input
                id="return-reason"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Ex: produto com defeito, cliente arrependido…"
                maxLength={500}
                className="border-line focus:border-brand h-9 w-full rounded-[8px] border bg-bg-card px-3 text-[13px] outline-none transition"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={returnSubmitting}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void submitReturn();
                }}
                disabled={
                  returnSubmitting || returnReason.trim().length < 3
                }
                className="bg-state-warning text-white hover:bg-state-warning/90"
              >
                {returnSubmitting ? (
                  <>
                    <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                    Registrando…
                  </>
                ) : (
                  <>Confirmar devolução</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
