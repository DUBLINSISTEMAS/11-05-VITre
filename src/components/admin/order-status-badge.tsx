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
  confirmed: "bg-primary/10 text-primary ring-primary/20",
  fulfilled: "bg-success-soft text-success ring-success/30",
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
