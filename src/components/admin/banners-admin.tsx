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
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { deleteBanner } from "@/actions/banner/delete";
import { reorderBanners } from "@/actions/banner/reorder";
import { toggleBannerActive } from "@/actions/banner/toggle-active";
import { uploadBanner } from "@/actions/banner/upload";
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
  const inputRef = useRef<HTMLInputElement>(null);

  const sorted = [...banners].sort((a, b) => a.position - b.position);
  const canAddMore = sorted.length < maxBanners;

  const handleUpload = (file: File) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const r = await uploadBanner(formData);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Banner enviado.");
      router.refresh();
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
      const r = await reorderBanners({ orderedIds: newOrder.map((b) => b.id) });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  };

  const handleToggle = (b: BannerRow) => {
    startTransition(async () => {
      const r = await toggleBannerActive({
        bannerId: b.id,
        isActive: !b.isActive,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = (b: BannerRow) => {
    startTransition(async () => {
      const r = await deleteBanner({ bannerId: b.id });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Banner excluído.");
      router.refresh();
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
            "border-border bg-muted/30 hover:bg-muted/60 hover:border-foreground/30 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors disabled:opacity-50 sm:p-8",
          )}
        >
          {isPending ? (
            <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
          ) : (
            <UploadIcon className="text-muted-foreground size-6" />
          )}
          <span className="text-sm font-medium">
            {sorted.length === 0
              ? "Enviar primeiro banner"
              : "Enviar outro banner"}
          </span>
          <span className="text-muted-foreground text-xs">
            JPG, PNG ou WebP. Recomendado 1600×600px.
          </span>
        </button>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">
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
          if (file) handleUpload(file);
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
    <div className="border-border/60 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center sm:p-10">
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
        <ImagePlusIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">Sem banners ainda</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Banners aparecem no topo da sua loja, ótimos pra destacar promoções
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
        "bg-background/50 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center",
        !banner.isActive && "opacity-60",
      )}
    >
      <div className="bg-muted relative aspect-[8/3] w-full overflow-hidden rounded-lg sm:aspect-auto sm:h-20 sm:w-52 sm:shrink-0">
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
            <span className="text-muted-foreground font-mono text-xs">
              {banner.link}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Sem link</span>
          )}
        </p>
        <p className="text-muted-foreground text-xs">
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
