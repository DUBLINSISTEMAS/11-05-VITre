"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ProductDialog, type ProductDialogState } from "./product-dialog";

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
  const [dialog, setDialog] = useState<ProductDialogState>({ mode: "closed" });

  return (
    <>
      <Button
        type="button"
        className={className}
        size={size}
        onClick={() => setDialog({ mode: "create" })}
      >
        {children ?? (
          <>
            <PlusIcon /> <span className="hidden sm:inline">Novo produto</span>
          </>
        )}
      </Button>
      <ProductDialog
        state={dialog}
        onClose={() => setDialog({ mode: "closed" })}
      />
    </>
  );
}
