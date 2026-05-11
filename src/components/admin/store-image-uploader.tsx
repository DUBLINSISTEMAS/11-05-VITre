"use client";

import {
  ImagePlusIcon,
  Loader2Icon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { removeStoreImage } from "@/actions/store/remove-image";
import { uploadStoreImage } from "@/actions/store/upload-image";
import { Button } from "@/components/ui/button";
import {
  compressImageClient,
  IMAGE_COMPRESSION_FAILED_MESSAGE,
} from "@/lib/image-client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface StoreImageUploaderProps {
  /** Logo OU ícone — define qual coluna é atualizada server-side. */
  kind: "logo" | "icon";
  /** URL atual no banco. null = sem imagem. */
  currentUrl: string | null;
  /** Texto descritivo curto pra label do botão. */
  label: string;
  /** Hint adicional (ex: dimensões recomendadas). */
  hint?: string;
}

/**
 * Uploader single-slot pra logo / ícone da loja. Contraste com
 * `ImageUploader` (galeria N-up de produto): aqui é 1 imagem só, com
 * "remover" + "trocar" no mesmo slot.
 *
 * `router.refresh()` não é necessário — a server action já chama
 * `revalidatePath('/admin/configuracoes')` que recarrega a página com
 * URL nova vinda do server.
 */
export function StoreImageUploader({
  kind,
  currentUrl,
  label,
  hint,
}: StoreImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const displayUrl = previewUrl ?? currentUrl;

  const handleFile = (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    setPreviewUrl(blobUrl);

    startTransition(async () => {
      try {
        const { file: outFile, compressed } = await compressImageClient(file);
        if (!compressed) {
          toast.error(IMAGE_COMPRESSION_FAILED_MESSAGE);
          return;
        }
        const formData = new FormData();
        formData.append("file", outFile);
        formData.append("kind", kind);
        const result = await uploadStoreImage(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          kind === "logo" ? "Logo atualizado." : "Ícone atualizado.",
        );
      } catch (e) {
        // Captura throw inesperado (RateLimitError não-tratado, Next body limit,
        // Upstash offline). Sem catch, useTransition engole e toast nunca aparece.
        logger.error("admin.store_image.upload_failed", { err: e, kind });
        toast.error(
          "Falha no upload. Verifique sua conexão e tente novamente.",
        );
      } finally {
        URL.revokeObjectURL(blobUrl);
        setPreviewUrl(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      try {
        const result = await removeStoreImage({ kind });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(kind === "logo" ? "Logo removido." : "Ícone removido.");
      } catch (e) {
        logger.error("admin.store_image.remove_failed", { err: e, kind });
        toast.error("Falha ao remover. Tente novamente.");
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "bg-muted relative shrink-0 overflow-hidden rounded-xl border",
            kind === "logo"
              ? "h-20 w-32 sm:h-24 sm:w-40"
              : "size-20 sm:size-24",
          )}
        >
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt={label}
              fill
              sizes="(max-width: 640px) 160px, 200px"
              className={cn(
                "object-contain p-2",
                isPending && "opacity-50",
              )}
              unoptimized={previewUrl !== null}
            />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              <ImagePlusIcon className="size-6" />
            </div>
          )}
          {isPending ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2Icon className="text-foreground size-5 animate-spin" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isPending}
          >
            <UploadIcon className="size-4" />
            {currentUrl ? "Trocar" : "Enviar"}
          </Button>
          {currentUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={isPending}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2Icon className="size-4" /> Remover
            </Button>
          ) : null}
        </div>
      </div>

      {hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
