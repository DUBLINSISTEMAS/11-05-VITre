import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  awaiting_whatsapp: "Aguardando WhatsApp",
  confirmed: "Confirmado",
  fulfilled: "Cumprido",
  canceled: "Cancelado",
  expired: "Expirado",
};

// Port Dublin v3 (Onda 5d): migra pra `b3-pill b3-pill--{warn,ok,danger}`.
// Dublin é flat, sem ring. Decisão preservada: founder pediu verde fixo
// pra "Confirmado" (Onda 4 / 2026-05-12) — ok-wash atende.
const STATUS_CLASSES: Record<string, string> = {
  awaiting_whatsapp: "b3-pill b3-pill--warn",
  confirmed: "b3-pill b3-pill--ok",
  fulfilled: "b3-pill b3-pill--ok",
  canceled: "b3-pill b3-pill--danger",
  expired: "b3-pill",
};

interface OrderStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

/**
 * Badge de status do pedido. Cores semânticas via b3-pill variants
 * (port Dublin v3). Size só ajusta padding/font-size.
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
        classes,
        size === "md" && "px-2.5 py-1 text-xs",
      )}
    >
      {label}
    </span>
  );
}
