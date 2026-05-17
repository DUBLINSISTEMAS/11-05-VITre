"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  ImagePlusIcon,
  Loader2Icon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteBanner } from "@/actions/banner/delete";
import { reorderBanners } from "@/actions/banner/reorder";
import { toggleBannerActive } from "@/actions/banner/toggle-active";
import { uploadBanner } from "@/actions/banner/upload";
import {
  blobToWebpFile,
  ImageEditorDialog,
} from "@/components/shared/image-editor-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  compressImageClient,
  IMAGE_COMPRESSION_FAILED_MESSAGE,
  IMAGE_TOO_LARGE_MESSAGE,
  ImageTooLargeError,
} from "@/lib/image-client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import { BannerEditDialog } from "./banner-edit-dialog";

export interface BannerRow {
  id: string;
  imageUrl: string;
  link: string | null;
  position: number;
  isActive: boolean;
}

interface BannersAdminProps {
  banners: BannerRow[];
  /** Limite duro server-side, recebido pelo server pra UI esconder o "+" no topo. */
  maxBanners: number;
}

/**
 * Painel completo de banners: lista, upload, reorder, toggle, edit, delete.
 *
 * Escolhi manter tudo num só componente porque a interação é coesa —
 * quebrar em N sub-componentes complicaria a comunicação de `isPending`
 * sem ganho real (≤10 banners).
 */
export function BannersAdmin({ banners, maxBanners }: BannersAdminProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "preparing" | "uploading">(
    "idle",
  );
  const inputRef = useRef<HTMLInputElement>(null);
  // Editor obrigatório (banner usa aspect 16/9).
  const [editorFile, setEditorFile] = useState<File | null>(null);

  const sorted = [...banners].sort((a, b) => a.position - b.position);
  const canAddMore = sorted.length < maxBanners;

  const handleUpload = (file: File) => {
    setPhase("preparing");
    startTransition(async () => {
      try {
        // Banner usa proporção wide (1600x600 sugerida) — limites mais largos.
        // maxSizeMB: 1 (display-only, não precisa de detalhe de produto).
        const { file: outFile, compressed } = await compressImageClient(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 2000,
        });
        if (!compressed) {
          toast.error(IMAGE_COMPRESSION_FAILED_MESSAGE);
          return;
        }
        setPhase("uploading");
        const formData = new FormData();
        formData.append("file", outFile);
        const r = await uploadBanner(formData);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success("Banner enviado.");
        router.refresh();
      } catch (e) {
        if (e instanceof ImageTooLargeError) {
          toast.error(IMAGE_TOO_LARGE_MESSAGE);
        } else {
          // Captura throw inesperado (RateLimitError não-tratado, Next body
          // limit, Upstash offline). Sem catch, useTransition engole e toast
          // nunca aparece.
          logger.error("admin.banner.upload_failed", { err: e });
          toast.error("Erro ao enviar. Verifique sua conexão.");
        }
      } finally {
        setPhase("idle");
      }
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleReorder = (fromIdx: number, direction: -1 | 1) => {
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= sorted.length) return;
    const newOrder = [...sorted];
    const tmp = newOrder[fromIdx]!;
    newOrder[fromIdx] = newOrder[toIdx]!;
    newOrder[toIdx] = tmp;

    startTransition(async () => {
      try {
        const r = await reorderBanners({
          orderedIds: newOrder.map((b) => b.id),
        });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        router.refresh();
      } catch (e) {
        logger.error("admin.banner.reorder_failed", { err: e });
        toast.error("Falha ao reordenar. Tente novamente.");
      }
    });
  };

  const handleToggle = (b: BannerRow) => {
    startTransition(async () => {
      try {
        const r = await toggleBannerActive({
          bannerId: b.id,
          isActive: !b.isActive,
        });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        router.refresh();
      } catch (e) {
        logger.error("admin.banner.toggle_failed", { err: e, bannerId: b.id });
        toast.error("Falha ao pausar/ativar. Tente novamente.");
      }
    });
  };

  const handleDelete = (b: BannerRow) => {
    startTransition(async () => {
      try {
        const r = await deleteBanner({ bannerId: b.id });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success("Banner excluído.");
        router.refresh();
      } catch (e) {
        logger.error("admin.banner.delete_failed", { err: e, bannerId: b.id });
        toast.error("Falha ao excluir. Tente novamente.");
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Slot de upload (sempre visível enquanto cabe banner) */}
      {canAddMore ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className={cn(
            "border-line bg-bg-app/40 hover:bg-bg-app hover:border-ink-5 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors disabled:opacity-50 sm:p-8",
          )}
        >
          {isPending ? (
            <Loader2Icon className="text-ink-4 size-6 animate-spin" />
          ) : (
            <UploadIcon className="text-ink-4 size-6" />
          )}
          <span className="text-sm font-medium text-ink-1">
            {isPending
              ? phase === "preparing"
                ? "Preparando imagem…"
                : "Enviando…"
              : sorted.length === 0
                ? "Enviar primeiro banner"
                : "Enviar outro banner"}
          </span>
          <span className="text-ink-4 text-xs">
            JPG, PNG ou WebP. Recomendado 1600×600px.
          </span>
        </button>
      ) : (
        <p className="text-ink-4 rounded-xl border border-dashed border-line p-4 text-center text-sm">
          Limite de {maxBanners} banners atingido. Apague algum pra subir
          outro.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setEditorFile(file);
        }}
      />

      <ImageEditorDialog
        open={editorFile !== null}
        imageFile={editorFile}
        aspectRatio={16 / 9}
        onConfirm={(blob) => {
          const baseName = editorFile?.name ?? "banner";
          const out = blobToWebpFile(blob, baseName);
          setEditorFile(null);
          handleUpload(out);
        }}
        onCancel={() => {
          setEditorFile(null);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      {/* Lista */}
      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((b, idx) => (
            <li key={b.id}>
              <BannerCard
                banner={b}
                isFirst={idx === 0}
                isLast={idx === sorted.length - 1}
                isPending={isPending}
                onMove={(dir) => handleReorder(idx, dir)}
                onToggle={() => handleToggle(b)}
                onDelete={() => handleDelete(b)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-line flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center sm:p-10">
      <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
        <ImagePlusIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">Sem banners ainda</h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Banners aparecem no topo da sua vitrine, ótimos pra destacar promoções
        ou coleções novas.
      </p>
    </div>
  );
}

interface BannerCardProps {
  banner: BannerRow;
  isFirst: boolean;
  isLast: boolean;
  isPending: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  onDelete: () => void;
}

function BannerCard({
  banner,
  isFirst,
  isLast,
  isPending,
  onMove,
  onToggle,
  onDelete,
}: BannerCardProps) {
  return (
    <div
      className={cn(
        "b3-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center",
        !banner.isActive && "opacity-60",
      )}
    >
      <div className="bg-bg-app relative aspect-[8/3] w-full overflow-hidden rounded-lg sm:aspect-auto sm:h-20 sm:w-52 sm:shrink-0">
        <Image
          src={banner.imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 13rem"
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">
          {banner.link ? (
            <span className="text-ink-4 font-mono text-xs">
              {banner.link}
            </span>
          ) : (
            <span className="text-ink-4 italic">Sem link</span>
          )}
        </p>
        <p className="text-ink-4 text-xs">
          {banner.isActive ? "Visível" : "Pausado"}
        </p>
      </div>

      <div className="flex items-center gap-0.5 sm:shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isFirst || isPending}
          onClick={() => onMove(-1)}
          aria-label="Mover banner para cima"
        >
          <ArrowUpIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isLast || isPending}
          onClick={() => onMove(1)}
          aria-label="Mover banner para baixo"
        >
          <ArrowDownIcon className="size-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          disabled={isPending}
          aria-label={banner.isActive ? "Pausar banner" : "Tornar banner visível"}
        >
          {banner.isActive ? (
            <EyeIcon className="size-4" />
          ) : (
            <EyeOffIcon className="size-4" />
          )}
        </Button>

        <BannerEditDialog banner={{ id: banner.id, link: banner.link }} />

        <DeleteBannerButton
          isPending={isPending}
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}

function DeleteBannerButton({
  isPending,
  onConfirm,
}: {
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isPending}
          aria-label="Excluir banner"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esse banner?</AlertDialogTitle>
          <AlertDialogDescription>
            A imagem é apagada do storage. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
