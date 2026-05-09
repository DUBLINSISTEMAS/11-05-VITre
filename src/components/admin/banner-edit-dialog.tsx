"use client";

import { Loader2Icon, PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateBanner } from "@/actions/banner/update";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BannerEditDialogProps {
  banner: {
    id: string;
    link: string | null;
  };
}

/**
 * Dialog pra editar o link do banner. Imagem em si NÃO é editável aqui —
 * remova e suba outra (mais simples que orquestrar substituição).
 */
export function BannerEditDialog({ banner }: BannerEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(banner.link ?? "");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLink(banner.link ?? "");
    setLinkError(null);
  }, [open, banner.id, banner.link]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);

    startTransition(async () => {
      const result = await updateBanner({
        bannerId: banner.id,
        link: link.trim() === "" ? null : link.trim(),
      });
      if (!result.ok) {
        if (result.fieldErrors?.link) setLinkError(result.fieldErrors.link);
        toast.error(result.error);
        return;
      }
      toast.success("Banner atualizado.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Editar banner"
        >
          <PencilIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar banner</DialogTitle>
          <DialogDescription>
            Para qual link o cliente vai quando tocar nesse banner.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="banner-link">Link (opcional)</Label>
            <Input
              id="banner-link"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/produtos/promocao  ou  https://instagram.com/sualoja"
              autoComplete="off"
              aria-invalid={!!linkError}
            />
            <p className="text-muted-foreground text-xs">
              Use um caminho da loja (começando com /) ou um link completo
              (http/https). Deixe em branco se for só decorativo.
            </p>
            {linkError ? (
              <p className="text-destructive text-xs">{linkError}</p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2Icon className="animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
