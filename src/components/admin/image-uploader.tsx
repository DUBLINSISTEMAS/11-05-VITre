"use client";

import {
  ImagePlusIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteProductImage } from "@/actions/product/delete-image";
import { replaceProductImage } from "@/actions/product/replace-image";
import { uploadProductImage } from "@/actions/product/upload-image";
import {
  blobToWebpFile,
  ImageEditorDialog,
} from "@/components/shared/image-editor-dialog";
import { tempId } from "@/lib/id";
import {
  compressImageClient,
  IMAGE_COMPRESSION_FAILED_MESSAGE,
  IMAGE_TOO_LARGE_MESSAGE,
  ImageTooLargeError,
} from "@/lib/image-client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

export interface ProductImageData {
  id: string;
  url: string;
  position: number;
}

/**
 * Foto anexada no client mas ainda sem `productId` no DB. Usada no
 * fluxo de criação: lojista anexa fotos antes de salvar o produto, e
 * elas só viram registros reais após `createProductFromValues` retornar
 * o id. Padrão Shopify/Nuvem Shop.
 */
export interface StagedImageFile {
  id: string;
  file: File;
  previewUrl: string;
}

type ImageUploaderMode = "server" | "staged";

interface ImageUploaderProps {
  productId: string;
  images: ProductImageData[];
  onChange: (images: ProductImageData[]) => void;
  /**
   * - `server` (default): faz upload imediato pro Supabase Storage
   *   usando `productId`. Usado em modo edit (produto persistido).
   * - `staged`: guarda Files em memória do client. Caller submete via
   *   `flushStagedUploads` após criar o produto. Usado em modo create.
   */
  mode?: ImageUploaderMode;
  /** Items aguardando submit. Obrigatório em `mode="staged"`. */
  stagedFiles?: StagedImageFile[];
  onStagedChange?: (files: StagedImageFile[]) => void;
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
  mode = "server",
  stagedFiles = [],
  onStagedChange,
  maxImages = DEFAULT_MAX,
  disabled,
}: ImageUploaderProps) {
  const isStaged = mode === "staged";
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingPreviews, setPendingPreviews] = useState<
    { id: string; previewUrl: string; phase: "compressing" | "uploading" }[]
  >([]);
  const [isDeleting, startDelete] = useTransition();
  // Editor inline: lojista clica no lápis do thumbnail e abre crop/zoom/rotate
  // sobre a imagem JÁ uploaded. Confirma → re-upload substitui blob preservando
  // id+position+featuredImageId. Fetch da URL atual via blob no client.
  const [editTarget, setEditTarget] = useState<{
    imageId: string;
    file: File;
  } | null>(null);
  const [isReplacing, startReplace] = useTransition();

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

  // Auditoria I7 (2026-05-12): ref sempre apontando pra `images` mais
  // atual permite que uploads em sequência leiam o estado fresh, sem
  // sobrescrever delete que aconteceu durante upload. Sem isso, deletar
  // foto B enquanto F1 sobe fazia onChange final reescrever array
  // incluindo B (closure stale do `images` no início do handler).
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Em staged mode, items aguardam submit; em server mode, items são
  // pendingPreviews (uploading) + images (persistidos).
  const totalCount = isStaged
    ? stagedFiles.length
    : images.length + pendingPreviews.length;
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

    // ===== MODE: STAGED =====
    // Em criação, só comprime e segura File[] localmente. Upload acontece
    // após createProductFromValues retornar productId real, controlado
    // pelo ProductForm via flushStagedUploads.
    if (isStaged) {
      const accepted: StagedImageFile[] = [];
      for (const file of filesToUpload) {
        try {
          const { file: outFile, compressed } = await compressImageClient(file);
          if (!compressed) {
            toast.error(IMAGE_COMPRESSION_FAILED_MESSAGE);
            continue;
          }
          accepted.push({
            id: tempId(),
            file: outFile,
            previewUrl: URL.createObjectURL(outFile),
          });
        } catch (e) {
          if (e instanceof ImageTooLargeError) {
            toast.error(IMAGE_TOO_LARGE_MESSAGE);
          } else {
            logger.error("admin.product_image.stage_failed", { err: e });
            toast.error("Erro ao preparar foto. Tente outra.");
          }
        }
      }
      if (accepted.length > 0 && onStagedChange) {
        onStagedChange([...stagedFiles, ...accepted]);
      }
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // ===== MODE: SERVER (default — fluxo edit) =====
    // Cada iteração lê `imagesRef.current` (sempre fresh, sync com prop)
    // e adiciona a nova foto. Assim, delete ocorrido DURANTE o upload
    // não é sobrescrito. Antes era `let current = images` (closure stale).
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
          const next = [
            ...imagesRef.current,
            { id: result.id, url: result.url, position: result.position },
          ];
          onChange(next);
        }
      } catch (e) {
        // ImageTooLargeError: arquivo bruto > 25 MB, rejeitado no client.
        if (e instanceof ImageTooLargeError) {
          toast.error(IMAGE_TOO_LARGE_MESSAGE);
        } else {
          logger.error("admin.product_image.upload_failed", { err: e });
          toast.error("Erro ao enviar. Verifique sua conexão.");
        }
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

  const handleStagedRemove = (id: string) => {
    if (!onStagedChange) return;
    const found = stagedFiles.find((s) => s.id === id);
    if (found) URL.revokeObjectURL(found.previewUrl);
    onStagedChange(stagedFiles.filter((s) => s.id !== id));
  };

  // Abre o editor: baixa a imagem atual como blob pra entregar ao Cropper.
  // Imagens públicas no Supabase Storage permitem GET anônimo, sem CORS issue
  // (mesma origem via next/image também, mas aqui precisamos do File raw).
  const handleEdit = async (img: ProductImageData) => {
    try {
      const res = await fetch(img.url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], "edit.webp", {
        type: blob.type || "image/webp",
      });
      setEditTarget({ imageId: img.id, file });
    } catch (e) {
      logger.error("admin.product_image.load_for_edit_failed", { err: e });
      toast.error("Não foi possível abrir a imagem para edição.");
    }
  };

  const handleEditConfirm = (blob: Blob) => {
    if (!editTarget) return;
    const target = editTarget;
    setEditTarget(null);
    const file = blobToWebpFile(blob, "edited");

    startReplace(async () => {
      try {
        // Passa pelo pipeline de compressão client (consistência com upload).
        const { file: outFile, compressed } = await compressImageClient(file);
        if (!compressed) {
          toast.error(IMAGE_COMPRESSION_FAILED_MESSAGE);
          return;
        }
        const fd = new FormData();
        fd.append("file", outFile);
        fd.append("imageId", target.imageId);
        const result = await replaceProductImage(fd);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        // Atualiza URL no state preservando id + position.
        onChange(
          images.map((img) =>
            img.id === target.imageId ? { ...img, url: result.url } : img,
          ),
        );
        toast.success("Imagem ajustada.");
      } catch (e) {
        if (e instanceof ImageTooLargeError) {
          toast.error(IMAGE_TOO_LARGE_MESSAGE);
        } else {
          logger.error("admin.product_image.replace_failed", { err: e });
          toast.error("Erro ao salvar. Tente novamente.");
        }
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {/* Staged tiles — só aparecem em mode="staged" (criação). */}
        {isStaged
          ? stagedFiles.map((s, idx) => (
              <div
                key={s.id}
                className="group bg-muted relative aspect-[3/4] overflow-hidden rounded-xl border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.previewUrl}
                  alt={`Foto ${idx + 1}`}
                  className="size-full object-cover"
                />
                {idx === 0 ? (
                  <span className="bg-foreground text-background absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.04em]">
                    CAPA
                  </span>
                ) : null}
                <div className="absolute right-1 top-1 flex gap-1 sm:right-1.5 sm:top-1.5">
                  <button
                    type="button"
                    onClick={() => handleStagedRemove(s.id)}
                    disabled={disabled}
                    className="flex size-9 items-center justify-center rounded-full bg-black/70 text-white opacity-100 transition hover:bg-black/85 disabled:opacity-50 sm:size-7 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    aria-label={`Remover foto ${idx + 1}`}
                  >
                    <Trash2Icon className="size-4 sm:size-3.5" />
                  </button>
                </div>
              </div>
            ))
          : null}
        {!isStaged && images.map((img, idx) => (
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
            <div className="absolute right-1 top-1 flex gap-1 sm:right-1.5 sm:top-1.5">
              <button
                type="button"
                onClick={() => handleEdit(img)}
                disabled={isReplacing || isDeleting || disabled}
                className="flex size-9 items-center justify-center rounded-full bg-black/70 text-white opacity-100 transition hover:bg-black/85 disabled:opacity-50 sm:size-7 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                aria-label={`Ajustar imagem ${idx + 1}`}
              >
                <PencilIcon className="size-4 sm:size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                disabled={isDeleting || isReplacing || disabled}
                className="flex size-9 items-center justify-center rounded-full bg-black/70 text-white opacity-100 transition hover:bg-black/85 disabled:opacity-50 sm:size-7 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                aria-label={`Remover imagem ${idx + 1}`}
              >
                <Trash2Icon className="size-4 sm:size-3.5" />
              </button>
            </div>
            {isReplacing && editTarget?.imageId === img.id ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2Icon className="size-6 animate-spin text-white" />
              </div>
            ) : null}
          </div>
        ))}

        {!isStaged && pendingPreviews.map((p) => (
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
                {p.phase === "compressing" ? "Preparando" : "Enviando"}
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
        WebP — fotos grandes são otimizadas automaticamente. Toque no lápis
        para ajustar enquadramento.
      </p>

      <ImageEditorDialog
        open={editTarget !== null}
        imageFile={editTarget?.file ?? null}
        aspectRatio={1}
        onConfirm={handleEditConfirm}
        onCancel={() => setEditTarget(null)}
      />
    </div>
  );
}
