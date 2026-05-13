"use client";

/**
 * Botão "+ Novo produto" do header e do empty state.
 *
 * Não monta o <ProductDialog>. Em vez disso, faz `router.push("?novo=1")`.
 * O gate único (`ProductDialogGate` em product-create-gate.tsx) ouve esse
 * search param e abre o dialog. Garante UMA montagem do dialog na página,
 * evitando race de focus-trap (Crítico C1 da auditoria 2026-05-12).
 */
import { PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const openCreate = () => {
    const next = new URLSearchParams(searchParams);
    next.set("novo", "1");
    next.delete("editar");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <Button
      type="button"
      className={className}
      size={size}
      onClick={openCreate}
    >
      {children ?? (
        <>
          <PlusIcon /> <span className="hidden sm:inline">Novo produto</span>
        </>
      )}
    </Button>
  );
}
