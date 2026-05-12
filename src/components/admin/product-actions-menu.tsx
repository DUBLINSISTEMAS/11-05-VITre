"use client";

/**
 * Dropdown de ações de produto na página de edição. Componente client
 * porque junta DropdownMenu (radix client) com onSelect handler — quando
 * isso vivia inline em `page.tsx` (RSC), Next 15 reclamava em dev/turbo:
 *
 *   "Event handlers cannot be passed to Client Component props"
 *
 * (visto em Sentry — issue 3fb4409a). RSC tenta serializar o ReactNode
 * `trigger` e topa com `onSelect`, que é função e não serializa.
 *
 * Fix: encapsula tudo em "use client" e expõe só `productId`/`productName`
 * como props serializáveis.
 */
import { MoreVerticalIcon } from "lucide-react";

import { DeleteProductDialog } from "@/components/admin/delete-product-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProductActionsMenuProps {
  productId: string;
  productName: string;
}

export function ProductActionsMenu({
  productId,
  productName,
}: ProductActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Mais opções">
          <MoreVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DeleteProductDialog
          productId={productId}
          productName={productName}
          trigger={
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => e.preventDefault()}
            >
              Excluir produto
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
