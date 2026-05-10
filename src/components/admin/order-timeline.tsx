// Timeline vertical de pedido (canvas-v1 admin Lote 3).
//
// 6 etapas: Criado → Aberto WhatsApp → Confirmado → Em separação →
// Cumprido → Encerrado. Mapeadas a partir do orderStatusEnum + timestamps
// reais do `orderTable` quando disponíveis (createdAt, whatsappOpenedAt,
// confirmedAt). Etapas "Em separação" e "Encerrado" são derivadas do
// status terminal — não há campos dedicados (acceptable: timeline é
// visualização, não fonte da verdade).
//
// Estados visuais (canvas linhas 562-589):
// - `done`: bolinha sólida `bg-foreground` com checkmark branco
// - `current`: bolinha sólida `bg-primary` com ring `0 0 0 4px brand-tint`
// - `pending`: bolinha transparente com `border-foreground/30`
import { CheckIcon } from "lucide-react";

import type { ORDER_STATUS_VALUES } from "@/actions/order/schema";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];
type StepState = "done" | "current" | "pending";

interface Step {
  key: string;
  label: string;
  state: StepState;
  /** Timestamp opcional pra mostrar abaixo do label. */
  date?: Date | null;
}

export interface OrderTimelineProps {
  order: {
    status: OrderStatus;
    createdAt: Date;
    whatsappOpenedAt: Date | null;
    confirmedAt: Date | null;
    expiresAt: Date;
  };
}

export function OrderTimeline({ order }: OrderTimelineProps) {
  const steps = buildSteps(order);

  return (
    <ol className="relative flex flex-col gap-1" aria-label="Linha do tempo">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Connector line (vertical) — não no último. */}
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[11px] top-6 bottom-0 w-px",
                  step.state === "done"
                    ? "bg-foreground/30"
                    : "bg-foreground/15",
                )}
              />
            ) : null}

            {/* Bolinha + estado */}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full transition-all",
                step.state === "done" &&
                  "bg-foreground text-background",
                step.state === "current" &&
                  "bg-primary text-primary-foreground ring-brand-tint ring-4",
                step.state === "pending" &&
                  "border-foreground/30 bg-card border-2",
              )}
            >
              {step.state === "done" ? (
                <CheckIcon className="size-3" strokeWidth={3} />
              ) : null}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  "text-[12.5px] font-medium",
                  step.state === "pending"
                    ? "text-muted-foreground"
                    : "text-foreground",
                  step.state === "current" && "text-primary",
                )}
              >
                {step.label}
              </p>
              {step.date ? (
                <p className="text-muted-foreground font-mono text-[11px]">
                  {formatRelativeDate(step.date)}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function buildSteps(order: OrderTimelineProps["order"]): Step[] {
  const status = order.status;
  const isTerminal =
    status === "fulfilled" ||
    status === "canceled" ||
    status === "expired";

  // Default todos pending — abaixo override por timestamp e status.
  const steps: Step[] = [
    {
      key: "created",
      label: "Pedido criado",
      state: "done",
      date: order.createdAt,
    },
    {
      key: "whatsapp_opened",
      label: "Aberto no WhatsApp",
      state: order.whatsappOpenedAt ? "done" : "pending",
      date: order.whatsappOpenedAt,
    },
    {
      key: "confirmed",
      label: "Confirmado",
      state: order.confirmedAt ? "done" : "pending",
      date: order.confirmedAt,
    },
    {
      key: "preparing",
      label: "Em separação",
      state: "pending",
    },
    {
      key: "fulfilled",
      label: "Cumprido",
      state: "pending",
    },
    {
      key: "closed",
      label:
        status === "canceled"
          ? "Cancelado"
          : status === "expired"
            ? "Expirado"
            : "Encerrado",
      state: "pending",
      date: status === "expired" ? order.expiresAt : undefined,
    },
  ];

  // ---- Apply 'current' baseado em status ----
  if (status === "awaiting_whatsapp") {
    if (!order.whatsappOpenedAt) steps[1]!.state = "current";
    else steps[2]!.state = "current";
  } else if (status === "confirmed") {
    // Já confirmou; "Em separação" é a etapa ativa.
    steps[3]!.state = "current";
  } else if (status === "fulfilled") {
    steps[3]!.state = "done";
    steps[4]!.state = "done";
    steps[5]!.state = "done";
  } else if (status === "canceled" || status === "expired") {
    // Encerrado é o passo "current" terminal — preparing/fulfilled ficam pending.
    steps[5]!.state = "current";
  }

  // Garantia: se está terminal (canceled/expired), preparing/fulfilled
  // ficam pending; se fulfilled, todos os 3 últimos ficam done.
  if (isTerminal && status !== "fulfilled") {
    steps[3]!.state = "pending";
    steps[4]!.state = "pending";
  }

  return steps;
}
