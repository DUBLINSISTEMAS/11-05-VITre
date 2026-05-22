import { cn } from "@/lib/utils";

import { MangoIcon } from "./mango-icon";

export interface MangoLogoProps {
  /** `compact` mostra só o ícone; default mostra ícone + wordmark "Mangos Pay". */
  compact?: boolean;
  className?: string;
}

/**
 * Lockup oficial Mangos Pay — MangoIcon + wordmark.
 * Use em sidebars, topbars, splash screens. Para apenas o símbolo, use
 * `<MangoIcon />` diretamente.
 */
export function MangoLogo({ compact = false, className }: MangoLogoProps) {
  if (compact) {
    return <MangoIcon className={cn("h-7 w-7", className)} />;
  }
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <MangoIcon className="h-7 w-7" />
      <span className="text-[19px] font-extrabold tracking-tight text-mangos-green-950">
        Mangos Pay
      </span>
    </div>
  );
}
