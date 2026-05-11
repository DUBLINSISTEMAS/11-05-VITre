"use client";

import {
  ImagePlusIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteProductImage } from "@/actions/product/delete-image";
import { uploadProductImage } from "@/actions/product/upload-image";
import { tempId } from "@/lib/id";
import {
  compressImageClient,
  IMAGE_COMPRESSION_FAILED_MESSAGE,
} from "@/lib/image-client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

export interface ProductImageData {
  id: string;
  url: string;
  position: number;
}

interface ImageUploaderProps {
  productId: string;
  images: ProductImageData[];
  onChange: (images: ProductImageData[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

const DEFAULT_MAX = 5;

/**
 * Galeria de imagens do produto com upload via input file.
 *
 * Mobile: o navegador oferece "Tirar foto" ou "Galeria" automaticamente
 * quando o usuário toca em um input file (sem `capture`, mais flexível).
 *
 * Pré-visualização otimista: enquanto sobe pro servidor, mostra o blob URL
 * local com loader em cima. Ao concluir (sucesso ou falha), o blob é revogado.
 *
 * Defesa em camadas:
 * - Limite máx local (UI esconde o "+" ao atingir).
 * - Server action também valida (race entre uploads simultâneos).
 */
export function ImageUploader({
  productId,
  images,
  onChange,
  maxImages = DEFAULT_MAX,
  disabled,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingPreviews, setPendingPreviews] = useState<
    { id: string; previewUrl: string; phase: "compressing" | "uploading" }[]
  >([]);
  const [isDeleting, startDelete] = useTransition();

  // Ref espelhando o estado para o cleanup ler sempre o valor atual,
  // não a closure do mount (deps `[]` causaria leak em uploads em andamento).
  const pendingRef = useRef<
    { id: string; previewUrl: string; phase: "compressing" | "uploading" }[]
  >([]);
  useEffect(() => {
    pendingRef.current = pendingPreviews;
  }, [pendingPreviews]);

  useEffect(() => {
    return () => {
      pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const totalCount = images.length + pendingPreviews.length;
  const canAdd = totalCount < maxImages && !disabled;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const slots = Math.max(0, maxImages - totalCount);
    const filesToUpload = Array.from(files).slice(0, slots);

    if (files.length > slots) {
      toast.warning(
        `Só foi possível adicionar ${slots} (limite: ${maxImages}).`,
      );
    }

    // Acumula resultados localmente: se chamássemos `onChange([...images, ...])`
    // dentro do loop, `images` (closure do início do handler) sobrescreveria
    // os uploads anteriores quando 2+ fotos são enviadas de uma vez.
    let current = images;
    for (const file of filesToUpload) {
      const previewId = tempId();
      const previewUrl = URL.createObjectURL(file);
      setPendingPreviews((prev) => [
        ...prev,
        { id: previewId, previewUrl, phase: "compressing" },
      ]);

      try {
        // Comprime no client ANTES do FormData (resolve 413 do Next + UX 4G).
        const { file: outFile, compressed } = await compressImageClient(file);
        if (!compressed) {
          toast.error(IMAGE_COMPRESSION_FAILED_MESSAGE);
          continue;
        }

        setPendingPreviews((prev) =>
          prev.map((p) =>
            p.id === previewId ? { ...p, phase: "uploading" } : p,
          ),
        );

        const formData = new FormData();
        formData.append("file", outFile);
        formData.append("productId", productId);

        const result = await uploadProductImage(formData);
        if (!result.ok) {
          toast.error(result.error);
        } else {
          current = [
            ...current,
            { id: result.id, url: result.url, position: result.position },
          ];
          onChange(current);
        }
      } catch (e) {
        logger.error("admin.product_image.upload_failed", { err: e });
        toast.error(
          "Falha no upload. Verifique sua conexão e tente novamente.",
        );
      } finally {
        setPendingPreviews((prev) => {
          const found = prev.find((p) => p.id === previewId);
          if (found) URL.revokeObjectURL(found.previewUrl);
          return prev.filter((p) => p.id !== previewId);
        });
      }
    }

    // limpa input para permitir re-upload do mesmo arquivo
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDelete = (imageId: string) => {
    startDelete(async () => {
      const result = await deleteProductImage({ imageId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onChange(images.filter((img) => img.id !== imageId));
      toast.success("Imagem removida.");
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {images.map((img, idx) => (
          <div
            key={img.id}
            className="group bg-muted relative aspect-[3/4] overflow-hidden rounded-xl border"
          >
            <Image
              src={img.url}
              alt={`Imagem ${idx + 1}`}
              fill
              sizes="(max-width: 640px) 33vw, 200px"
              className="object-cover"
            />
            {idx === 0 ? (
              <span className="bg-foreground text-background absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.04em]">
                CAPA
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => handleDelete(img.id)}
              disabled={isDeleting || disabled}
              className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-black/70 text-white opacity-100 transition hover:bg-black/85 sm:right-1.5 sm:top-1.5 sm:size-7 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              aria-label={`Remover imagem ${idx + 1}`}
            >
              <Trash2Icon className="size-4 sm:size-3.5" />
            </button>
          </div>
        ))}

        {pendingPreviews.map((p) => (
          <div
            key={p.id}
            className="bg-muted relative aspect-[3/4] overflow-hidden rounded-xl border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.previewUrl}
              alt=""
              className="size-full object-cover opacity-60"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40">
              <Loader2Icon className="size-6 animate-spin text-white" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/90">
                {p.phase === "compressing" ? "Otimizando" : "Enviando"}
              </span>
            </div>
          </div>
        ))}

        {canAdd ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-border bg-muted/30 hover:bg-muted/60 hover:border-foreground/30 flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition-colors",
            )}
            aria-label="Adicionar imagem"
          >
            <ImagePlusIcon className="text-muted-foreground size-6" />
            <span className="text-muted-foreground text-xs font-medium">
              Adicionar
            </span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <p className="text-muted-foreground text-xs">
        Até {maxImages} imagens. A primeira é a capa do produto. JPG, PNG ou
        WebP — fotos grandes são otimizadas automaticamente.
      </p>
    </div>
  );
}
