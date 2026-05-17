"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleProductActive } from "@/actions/product/toggle-active";
import { Switch } from "@/components/ui/switch";

interface ProductPublishToggleProps {
  productId: string;
  isActive: boolean;
  /** True quando o produto é rascunho (sem nome/slug `draft-*`) — switch trava OFF. */
  disabled?: boolean;
}

/**
 * Switch "Visível na minha loja" no header da página de editar.
 *
 * Atualização otimista de verdade: estado local reflete a intenção
 * imediatamente, reverte se a action falhar. Importante porque a action
 * pode levar 2-3s no 4G ruim de cidade pequena — sem isso, lojista acha que o
 * switch travou.
 */
export function ProductPublishToggle({
  productId,
  isActive,
  disabled,
}: ProductPublishToggleProps) {
  const [optimistic, setOptimistic] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  // Sincroniza quando a prop muda (ex: depois do router.refresh).
  useEffect(() => {
    setOptimistic(isActive);
  }, [isActive]);

  const handleToggle = (next: boolean) => {
    setOptimistic(next);
    startTransition(async () => {
      const result = await toggleProductActive({
        productId,
        isActive: next,
      });
      if (!result.ok) {
        setOptimistic(!next); // reverte
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Produto publicado." : "Produto pausado.");
    });
  };

  return (
    <label
      className="flex cursor-pointer items-center gap-2 text-sm"
      title={
        disabled
          ? "Salve o produto antes de publicar."
          : optimistic
            ? "Visível pros seus clientes"
            : "Pausado — só você vê"
      }
    >
      <span className="text-ink-4 hidden sm:inline">
        {optimistic ? "Visível" : "Pausado"}
      </span>
      <Switch
        checked={optimistic}
        onCheckedChange={handleToggle}
        disabled={disabled || isPending}
        aria-label="Visível na minha vitrine"
      />
    </label>
  );
}
