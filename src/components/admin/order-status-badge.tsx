import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  quote: "Orçamento",
  awaiting_whatsapp: "Aguardando WhatsApp",
  confirmed: "Confirmado",
  fulfilled: "Cumprido",
  canceled: "Cancelado",
  expired: "Expirado",
  returned: "Devolvido",
};

// Port Dublin v3 (Onda 5d): migra pra `b3-pill b3-pill--{warn,ok,danger}`.
// Sprint 1A Fase 4: quote válido (não expirado) é neutro/cinza; quote
// expirado recebe variante --warn (caller passa expired flag).
// Pre-Sprint-6 C: 'returned' usa --danger pra sinalizar que a venda
// foi desfeita (estoque restaurado, dinheiro devolvido).
const STATUS_CLASSES: Record<string, string> = {
  quote: "b3-pill",
  awaiting_whatsapp: "b3-pill b3-pill--warn",
  confirmed: "b3-pill b3-pill--ok",
  fulfilled: "b3-pill b3-pill--ok",
  canceled: "b3-pill b3-pill--danger",
  expired: "b3-pill",
  returned: "b3-pill b3-pill--danger",
};

interface OrderStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  /**
   * Sprint 1A Fase 4 — pra status='quote': quoteValidUntil < now
   * troca o label/cor pra "Orçamento vencido" em âmbar (--warn).
   */
  quoteValidUntil?: Date | null;
}

/**
 * Badge de status do pedido. Cores semânticas via b3-pill variants
 * (port Dublin v3). Size só ajusta padding/font-size.
 */
export function OrderStatusBadge({
  status,
  size = "sm",
  quoteValidUntil,
}: OrderStatusBadgeProps) {
  let label = STATUS_LABELS[status] ?? status;
  let classes = STATUS_CLASSES[status] ?? STATUS_CLASSES.awaiting_whatsapp!;

  if (status === "quote" && quoteValidUntil && quoteValidUntil < new Date()) {
    label = "Orçamento vencido";
    classes = "b3-pill b3-pill--warn";
  }

  return (
    <span
      className={cn(
        classes,
        size === "md" && "px-2.5 py-1 text-xs",
      )}
    >
      {label}
    </span>
  );
}
