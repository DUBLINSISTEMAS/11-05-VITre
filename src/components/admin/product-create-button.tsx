/**
 * Botão "+ Novo produto" do header e do empty state.
 *
 * Migrado pra <Link prefetch> em 2026-05-12 — Next 15 baixa o JS de
 * /admin/produtos/novo antes do click, abertura percebida instantânea.
 * Substitui o antigo gate ?novo=1 + ProductDialog.
 */
import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface ProductCreateButtonProps {
  children?: React.ReactNode;
  className?: string;
  size?: React.ComponentProps<typeof Button>["size"];
}

export function ProductCreateButton({
  children,
  className,
  size,
}: ProductCreateButtonProps) {
  return (
    <Button asChild type="button" className={className} size={size}>
      <Link href="/admin/produtos/novo" prefetch>
        {children ?? (
          <>
            <PlusIcon /> <span className="hidden sm:inline">Novo produto</span>
          </>
        )}
      </Link>
    </Button>
  );
}
