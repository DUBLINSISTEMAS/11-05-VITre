"use client";

import {
  ImagePlusIcon,
  Loader2Icon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { removeCategoryImage } from "@/actions/category/remove-image";
import { uploadCategoryImage } from "@/actions/category/upload-image";
import { Button } from "@/components/ui/button";
import {
  compressImageClient,
  IMAGE_COMPRESSION_FAILED_MESSAGE,
  IMAGE_TOO_LARGE_MESSAGE,
  ImageTooLargeError,
} from "@/lib/image-client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface CategoryImageUploaderProps {
  categoryId: string;
  /** URL atual no banco. null = sem imagem ainda. */
  currentUrl: string | null;
  /** Hint adicional (ex: "Aparece como círculo na vitrine"). */
  hint?: string;
}

/**
 * Uploader single-slot pra imagem da categoria. Espelha o
 * `StoreImageUploader` mas com preview redondo (a imagem é renderizada
 * num círculo no storefront, então o admin já mostra o resultado final).
 *
 * Após sucesso/remoção chama `router.refresh()` pra atualizar a lista
 * com URL nova vinda do server (evita estado stale no client).
 */
export function CategoryImageUploader({
  categoryId,
  currentUrl,
  hint,
}: CategoryImageUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "uploading">(
    "idle",
  );

  const displayUrl = previewUrl ?? currentUrl;

  const handleFile = (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    setPreviewUrl(blobUrl);
    setPhase("preparing");

    startTransition(async () => {
      try {
        const { file: outFile, compressed } = await compressImageClient(file);
        if (!compressed) {
          toast.error(IMAGE_COMPRESSION_FAILED_MESSAGE);
          return;
        }
        setPhase("uploading");
        const formData = new FormData();
        formData.append("file", outFile);
        formData.append("categoryId", categoryId);
        const result = await uploadCategoryImage(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Imagem da categoria atualizada.");
        router.refresh();
      } catch (e) {
        if (e instanceof ImageTooLargeError) {
          toast.error(IMAGE_TOO_LARGE_MESSAGE);
        } else {
          // Captura throw inesperado (RateLimitError não-tratado, Next body
          // limit, Upstash offline). Sem catch, useTransition engole e toast
          // nunca aparece.
          logger.error("admin.category_image.upload_failed", {
            err: e,
            categoryId,
          });
          toast.error("Erro ao enviar. Verifique sua conexão.");
        }
      } finally {
        URL.revokeObjectURL(blobUrl);
        setPreviewUrl(null);
        setPhase("idle");
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      try {
        const result = await removeCategoryImage({ categoryId });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Imagem removida.");
        router.refresh();
      } catch (e) {
        logger.error("admin.category_image.remove_failed", { err: e, categoryId });
        toast.error("Não foi possível remover. Tente de novo em alguns segundos.");
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "bg-bg-app relative size-20 shrink-0 overflow-hidden rounded-full border border-line sm:size-24",
          )}
        >
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt="Imagem da categoria"
              fill
              sizes="(max-width: 640px) 80px, 96px"
              className={cn("object-cover", isPending && "opacity-50")}
              unoptimized={previewUrl !== null}
            />
          ) : (
            <div className="text-ink-4 flex size-full items-center justify-center">
              <ImagePlusIcon className="size-6" />
            </div>
          )}
          {isPending ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40">
              <Loader2Icon className="size-5 animate-spin text-white" />
              <span className="text-[9.5px] font-medium uppercase tracking-wider text-white/90">
                {phase === "preparing" ? "Preparando" : "Enviando"}
              </span>
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

      {hint ? <p className="text-ink-4 text-xs">{hint}</p> : null}

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
