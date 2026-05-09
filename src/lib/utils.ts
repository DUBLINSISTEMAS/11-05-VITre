import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compõe classes Tailwind aceitando condicionais e resolvendo conflitos.
 * Padrão shadcn/ui — usado em toda UI.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
