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
import Link from "next/link";

import { DeleteProductDialog } from "@/components/admin/delete-product-dialog";
import { StockMovementDialog } from "@/components/admin/stock-movement-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VariantOption {
  id: string;
  name: string;
  stockQuantity: number;
}

interface ProductActionsMenuProps {
  productId: string;
  productName: string;
  /** Variantes do produto pra preencher o select no dialog de movimentação. */
  variants: VariantOption[];
}

export function ProductActionsMenu({
  productId,
  productName,
  variants,
}: ProductActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Mais opções">
          <MoreVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <StockMovementDialog
          productId={productId}
          productName={productName}
          variants={variants}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Lançar movimentação
            </DropdownMenuItem>
          }
        />
        <DropdownMenuItem asChild>
          <Link href={`/admin/produtos/${productId}/etiqueta`} prefetch>
            Imprimir etiqueta (barcode)
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
