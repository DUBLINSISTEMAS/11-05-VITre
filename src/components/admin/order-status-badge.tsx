import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  awaiting_whatsapp: "Aguardando WhatsApp",
  confirmed: "Confirmado",
  fulfilled: "Cumprido",
  canceled: "Cancelado",
  expired: "Expirado",
};

const STATUS_CLASSES: Record<string, string> = {
  awaiting_whatsapp: "bg-warning-soft text-warning-foreground ring-warning/30",
  // Onda 4 (2026-05-12): founder pediu verde fixo pra "Confirmado".
  // Confirmado vira success-soft (verde claro com texto verde escuro).
  // Fulfilled segue verde também mas com leve variação visual via opacity.
  confirmed: "bg-success-soft text-success ring-success/40",
  fulfilled: "bg-success/15 text-success ring-success/30",
  canceled: "bg-destructive-soft text-destructive ring-destructive/30",
  expired: "bg-muted text-muted-foreground ring-border",
};

interface OrderStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

/**
 * Badge de status do pedido com cores semânticas. Inclui ring tintado
 * pra contraste em fundos claros e escuros.
 */
export function OrderStatusBadge({
  status,
  size = "sm",
}: OrderStatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  const classes = STATUS_CLASSES[status] ?? STATUS_CLASSES.awaiting_whatsapp!;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium ring-1 ring-inset",
        size === "sm"
          ? "px-2 py-0.5 text-[11px]"
          : "px-2.5 py-1 text-xs",
        classes,
      )}
    >
      {label}
    </span>
  );
}
