/**
 * Botão "+ Adicionar produto" do header e do empty state.
 *
 * Port Dublin v3 (ADR-0019, Onda A.7): migrado pra classe `b3-btn b3-btn--cta`
 * direto. Mantém <Link prefetch> pra /admin/produtos/novo — Next 15 baixa o
 * JS antes do click. Substituído o gate `?novo=1` + ProductDialog em
 * 2026-05-12 (auditoria sênior).
 *
 * Renderiza como Link sempre — `asChild` do shadcn Button removido em favor
 * de class direta porque agora é primitivo `b3-btn` não shadcn Button.
 */
import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface ProductCreateButtonProps {
  children?: React.ReactNode;
  className?: string;
  /** Tamanho do botão. `lg` adiciona altura/padding extras pra empty state CTAs. */
  size?: "default" | "lg";
}

export function ProductCreateButton({
  children,
  className,
  size = "default",
}: ProductCreateButtonProps) {
  return (
    <Link
      href="/admin/produtos/novo"
      prefetch
      className={cn(
        "b3-btn b3-btn--cta",
        size === "lg" && "h-11 px-5 text-[14px]",
        className,
      )}
    >
      {children ?? (
        <>
          <PlusIcon size={14} />
          <span className="hidden sm:inline">Adicionar produto</span>
          <span className="sm:hidden">Adicionar</span>
        </>
      )}
    </Link>
  );
}
