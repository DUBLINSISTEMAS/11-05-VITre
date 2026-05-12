"use client";

import {
  ExternalLinkIcon,
  PackagePlusIcon,
  Share2Icon,
  StoreIcon,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { ProductCreateButton } from "./product-create-button";

export interface WelcomeCardProps {
  storeName: string;
  storeUrl: string;
}

export function WelcomeCard({ storeName, storeUrl }: WelcomeCardProps) {
  const [isSharing, startSharing] = useTransition();

  const handleShare = () => {
    startSharing(async () => {
      const message = `Confira a vitrine da ${storeName}: ${storeUrl}`;
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await navigator.share({
            title: storeName,
            text: message,
            url: storeUrl,
          });
          return;
        } catch (error) {
          if ((error as Error).name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(message);
        toast.success("Link copiado! Cole no WhatsApp ou Instagram.");
      } catch {
        toast.error("Não conseguimos copiar. Copie manualmente.");
      }
    });
  };

  return (
    <section aria-labelledby="welcome-heading" className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-xl"
        >
          <StoreIcon className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Sua loja
          </p>
          <h2
            id="welcome-heading"
            className="text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl"
          >
            {storeName}
          </h2>
        </div>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
        Tudo pronto. Cadastre seus primeiros produtos para a vitrine aparecer
        para os clientes — eles compram direto pelo WhatsApp.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        <ProductCreateButton size="lg">
          <PackagePlusIcon /> Cadastrar produto
        </ProductCreateButton>
        <Button asChild size="lg" variant="outline">
          <a href={storeUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon /> Ver minha vitrine
          </a>
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={handleShare}
          disabled={isSharing}
        >
          <Share2Icon /> Compartilhar
        </Button>
      </div>
    </section>
  );
}
