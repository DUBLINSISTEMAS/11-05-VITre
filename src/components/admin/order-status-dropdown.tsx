"use client";

// Dropdown de status do pedido — audit 2026-05-26 (founder rule).
//
// Antes: `OrderStatusBadge` era `<span>` read-only; mudança de status
// vivia em `OrderStatusActions` (botões) dentro do drawer de detalhe.
// Lojista que queria só "marcar como cumprido" precisava: row click →
// drawer abre → carrega detalhe → clica botão. 3-4 cliques + espera.
//
// Agora: o badge VIRA o trigger de um DropdownMenu Radix. Click no badge
// mostra opções de transição válidas (lê VALID_TRANSITIONS), aplica via
// updateOrderStatus optimistically.
//
// Regras de UX:
//  - stopPropagation no trigger e no content: badge fica dentro de row
//    clicável (orders-table). Click no badge NÃO deve abrir drawer.
//  - Sem ações disponíveis → renderiza apenas o badge (sem chevron).
//  - "Cancelar venda" mantém confirmação inline (window.confirm) porque
//    é destructive. Resto vai direto (otimista).
//  - terminal states (fulfilled, canceled, expired, returned) renderizam
//    o badge read-only — usuário vê o estado, não tem ação.

import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { OrderStatusBadge } from "./order-status-badge";

type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

const TRANSITION_LABELS: Record<OrderStatus, string> = {
  quote: "Marcar como orçamento",
  awaiting_whatsapp: "Voltar pra aguardando",
  confirmed: "Confirmar venda",
  fulfilled: "Marcar como cumprida",
  canceled: "Cancelar venda",
  expired: "Marcar como expirada",
  returned: "Marcar como devolvida",
};

interface OrderStatusDropdownProps {
  orderId: string;
  status: OrderStatus;
  quoteValidUntil?: Date | null;
}

export function OrderStatusDropdown({
  orderId,
  status,
  quoteValidUntil,
}: OrderStatusDropdownProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Audit 2026-05-26 — window.confirm trocado por AlertDialog (identidade
  // visual consistente com o resto do admin). Cancel é destrutivo (repõe
  // estoque, irreversível) — merece dialog rico com botão destructive.
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const allowed = VALID_TRANSITIONS[status] ?? [];

  // Sem transições disponíveis → fallback no badge estático original.
  if (allowed.length === 0) {
    return (
      <OrderStatusBadge status={status} quoteValidUntil={quoteValidUntil} />
    );
  }

  const performTransition = (next: OrderStatus) => {
    startTransition(async () => {
      const r = await updateOrderStatus({ orderId, nextStatus: next });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Status atualizado.");
      router.refresh();
    });
  };

  const transition = (next: OrderStatus) => {
    if (next === "canceled") {
      setCancelConfirmOpen(true);
      return;
    }
    performTransition(next);
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Evita Enter/Space na dropdown abrirem o drawer da row.
          if (e.key === "Enter" || e.key === " ") e.stopPropagation();
        }}
        aria-label="Mudar status"
        title="Mudar status"
        disabled={isPending}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded outline-none",
          "transition-opacity hocus:opacity-80",
          "focus-visible:ring-2 focus-visible:ring-ring/40",
          isPending && "opacity-50",
        )}
      >
        <OrderStatusBadge status={status} quoteValidUntil={quoteValidUntil} />
        {isPending ? (
          <Loader2Icon
            size={10}
            className="text-ink-4 animate-spin"
            aria-hidden
          />
        ) : (
          <ChevronDownIcon
            size={10}
            strokeWidth={2.2}
            className="text-ink-4"
            aria-hidden
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        className="min-w-[180px]"
      >
        {allowed.map((next) => (
          <DropdownMenuItem
            key={next}
            onSelect={() => transition(next)}
            disabled={isPending}
            variant={next === "canceled" ? "destructive" : "default"}
          >
            {TRANSITION_LABELS[next]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar esta venda?</AlertDialogTitle>
          <AlertDialogDescription>
            O estoque dos itens volta automaticamente e a operação não pode
            ser desfeita. Se cliente já recebeu, use &ldquo;Devolução&rdquo;
            no detalhe da venda em vez de cancelar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setCancelConfirmOpen(false);
              performTransition("canceled");
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Cancelar venda
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
