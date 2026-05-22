"use client";

/**
 * Dialog de ajuste de imagem (recorte + zoom + rotação).
 *
 * Usado em uploaders do admin para que o lojista possa enquadrar a foto
 * antes de salvar. Lib: `react-easy-crop` (~30KB, sem deps pesadas).
 *
 * Modo OBRIGATÓRIO:
 *  - banner (aspect 16/9)
 *  - logo / ícone da loja (aspect 1)
 *
 * Modo OPCIONAL (botão "Ajustar imagem" no thumbnail após upload):
 *  - produto (aspect 1)
 *  - categoria (aspect 4/3)
 *
 * Output: Blob WebP comprimido pelo canvas. Caller passa pelo
 * `browser-image-compression` antes do FormData (já é o pipeline padrão).
 */
import { Loader2Icon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ImageEditorDialogProps {
  open: boolean;
  /** Arquivo a editar. Quando null, dialog é renderizado mas sem conteúdo. */
  imageFile: File | null;
  /** Proporção do crop: 16/9, 1, 4/3, etc. */
  aspectRatio: number;
  /** Output quality (0..1). Default 0.9 — qualidade visual sem inflar. */
  outputQuality?: number;
  /** Chamado ao confirmar. Recebe Blob WebP do crop. */
  onConfirm: (croppedBlob: Blob) => void;
  /** Chamado ao cancelar (X, esc, fora). */
  onCancel: () => void;
}

export function ImageEditorDialog({
  open,
  imageFile,
  aspectRatio,
  outputQuality = 0.9,
  onConfirm,
  onCancel,
}: ImageEditorDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Cria/revoga blob URL conforme o arquivo muda.
  useEffect(() => {
    if (!imageFile) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    // Reset estados ao abrir nova imagem.
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  async function handleConfirm() {
    if (!imageFile || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await cropAndRotateImage(
        imageFile,
        croppedAreaPixels,
        rotation,
        outputQuality,
      );
      onConfirm(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar imagem</DialogTitle>
        </DialogHeader>

        <div className="relative h-[360px] w-full overflow-hidden rounded-md bg-black/5">
          {imageUrl ? (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_area, areaPixels) =>
                setCroppedAreaPixels(areaPixels)
              }
            />
          ) : null}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <label className="text-muted-foreground w-12 text-xs" htmlFor="zoom-slider">
              Zoom
            </label>
            <input
              id="zoom-slider"
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="accent-foreground flex-1"
              aria-label="Zoom"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            <RotateCwIcon className="size-4" /> Girar 90°
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy || !croppedAreaPixels}>
            {busy ? (
              <>
                <Loader2Icon className="size-4 animate-spin" /> Processando…
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Canvas-based crop + rotate. Output WebP.
 *
 * Notas:
 *  - rotation aplicada antes do crop (canvas rotaciona origin).
 *  - WebP é o formato final do pipeline Mangos Pay (server re-comprime via
 *    sharp 800x800 WebP 75% — esse output já está pré-otimizado).
 */
async function cropAndRotateImage(
  file: File,
  area: Area,
  rotation: number,
  quality: number,
): Promise<Blob> {
  const image = await fileToImage(file);
  const radians = (rotation * Math.PI) / 180;

  // 1. Renderiza imagem rotacionada em canvas auxiliar (mantém tamanho da
  //    bounding box após rotação).
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotatedWidth = image.width * cos + image.height * sin;
  const rotatedHeight = image.width * sin + image.height * cos;

  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = rotatedWidth;
  rotatedCanvas.height = rotatedHeight;
  const rctx = rotatedCanvas.getContext("2d");
  if (!rctx) throw new Error("Canvas 2d context indisponível.");
  rctx.translate(rotatedWidth / 2, rotatedHeight / 2);
  rctx.rotate(radians);
  rctx.drawImage(image, -image.width / 2, -image.height / 2);

  // 2. Extrai a área cropada do canvas rotacionado.
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = area.width;
  cropCanvas.height = area.height;
  const cctx = cropCanvas.getContext("2d");
  if (!cctx) throw new Error("Canvas 2d context indisponível.");
  cctx.drawImage(
    rotatedCanvas,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height,
  );

  // 3. Exporta como WebP.
  return new Promise<Blob>((resolve, reject) => {
    cropCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Falha ao gerar imagem ajustada."));
      },
      "image/webp",
      quality,
    );
  });
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem."));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Helper: converte Blob retornado pelo dialog num File com nome .webp
 * (mantém coerência com o pipeline de uploaders).
 */
export function blobToWebpFile(blob: Blob, baseName: string): File {
  const cleanBase = baseName.replace(/\.[^.]+$/, "");
  return new File([blob], `${cleanBase}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}
