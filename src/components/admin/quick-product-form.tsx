"use client";

/**
 * QuickProductForm — Sprint 2D.
 *
 * Modo "criação rápida" do produto: 3 campos essenciais (nome, preço, foto).
 * Pra lojista cadastrar 50 peças em 1 noite sem clicar em 30 inputs.
 * Defaults pros outros campos preenchem o produto como rascunho viável
 * (isActive=true, isPublishedToStorefront=true, sem variantes, sem estoque
 * controlado). Lojista refina depois em /admin/produtos/[id] usando o form
 * completo de 5 abas.
 */
import { Loader2Icon, PlusCircleIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createProductFromValues } from "@/actions/product/create-from-values";
import { uploadProductImage } from "@/actions/product/upload-image";
import {
  ImageUploader,
  type ProductImageData,
  type StagedImageFile,
} from "@/components/admin/image-uploader";
import { PriceInput } from "@/components/admin/price-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QuickProductFormProps {
  /** Callback ao salvar com sucesso. */
  onAfterSave: (opts: { productId: string; continueCreating?: boolean }) => void;
}

const SESSION_COUNTER_KEY = "vitre:product-quickcreate-session-count";
function bumpQuickCounter(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = sessionStorage.getItem(SESSION_COUNTER_KEY);
    const current = raw ? parseInt(raw, 10) : 0;
    const next = (Number.isNaN(current) ? 0 : current) + 1;
    sessionStorage.setItem(SESSION_COUNTER_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function QuickProductForm({ onAfterSave }: QuickProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const [name, setName] = useState("");
  const [priceInCents, setPriceInCents] = useState<number | null>(null);
  const [images, setImages] = useState<ProductImageData[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedImageFile[]>([]);

  const [submitMode, setSubmitMode] = useState<"save" | "saveAndContinue">(
    "save",
  );

  const reset = () => {
    setName("");
    setPriceInCents(null);
    setImages([]);
    stagedFiles.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStagedFiles([]);
  };

  const canSubmit =
    !isPending &&
    name.trim().length > 0 &&
    priceInCents !== null &&
    priceInCents > 0;

  const handleSubmit = () => {
    if (submittingRef.current) return;
    if (!canSubmit) {
      if (!name.trim()) {
        toast.error("Digite o nome do produto.");
        return;
      }
      if (priceInCents === null || priceInCents <= 0) {
        toast.error("Digite o preço de venda.");
        return;
      }
      return;
    }
    submittingRef.current = true;

    startTransition(async () => {
      try {
        const result = await createProductFromValues({
          name: name.trim(),
          description: "",
          basePriceInCents: priceInCents ?? 0,
          promoPriceInCents: null,
          categoryId: null,
          trackStock: false,
          stockQuantity: null,
          installmentsOverride: null,
          cashDiscountOverrideBps: null,
          isActive: true,
          isFeatured: false,
          isPublishedToStorefront: true,
          composition: "",
          modeling: "",
          lining: "",
          washing: "",
          wholesalePriceInCents: null,
          costPriceInCents: null,
          minStockQuantity: null,
          maxStockQuantity: null,
          gtin: "",
          brand: "",
          brandId: null,
          unit: "un",
          internalCode: "",
          defaultCommissionBps: null,
          ncm: "",
          variants: [],
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        // Sobe fotos staged (mesmo padrão do ProductForm completo).
        const filesToFlush = stagedFiles;
        let uploadOk = 0;
        let uploadFail = 0;
        if (filesToFlush.length > 0) {
          const uploads = await Promise.allSettled(
            filesToFlush.map(async (s) => {
              const fd = new FormData();
              fd.append("file", s.file);
              fd.append("productId", result.productId);
              const r = await uploadProductImage(fd);
              if (!r.ok) throw new Error(r.error);
            }),
          );
          for (const u of uploads) {
            if (u.status === "fulfilled") uploadOk += 1;
            else uploadFail += 1;
          }
          filesToFlush.forEach((s) => URL.revokeObjectURL(s.previewUrl));
          setStagedFiles([]);
        }

        if (filesToFlush.length === 0) {
          toast.success(
            "Produto criado. Adicione foto agora ou depois — sem foto vende menos.",
          );
        } else if (uploadFail === 0) {
          toast.success(
            `Produto criado com ${uploadOk} ${uploadOk === 1 ? "foto" : "fotos"}.`,
          );
        } else if (uploadOk > 0) {
          toast.warning(
            `Produto criado. ${uploadOk} de ${filesToFlush.length} fotos enviadas. Reenvie editando o produto.`,
          );
        } else {
          toast.warning(
            "Produto criado, mas nenhuma foto subiu. Tente reenviar editando.",
          );
        }

        if (submitMode === "save") {
          onAfterSave({ productId: result.productId });
          return;
        }

        const count = bumpQuickCounter();
        toast.success(
          `${count} ${count === 1 ? "produto rápido criado" : "produtos rápidos criados"} nesta série. Próximo!`,
        );
        reset();
        router.refresh();
        onAfterSave({ productId: result.productId, continueCreating: true });
      } finally {
        submittingRef.current = false;
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="mx-auto max-w-[600px] space-y-4"
    >
      <section className="b3-card flex flex-col gap-4 rounded-2xl p-4 sm:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="quick-name">Nome do produto</Label>
          <Input
            id="quick-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Vestido midi preto"
            disabled={isPending}
            autoFocus
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quick-price">Preço de venda</Label>
          <PriceInput
            id="quick-price"
            value={priceInCents}
            onChange={setPriceInCents}
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Foto (opcional)</Label>
          <ImageUploader
            productId="new"
            images={images}
            onChange={setImages}
            mode="staged"
            stagedFiles={stagedFiles}
            onStagedChange={setStagedFiles}
            disabled={isPending}
          />
        </div>
      </section>

      <p className="text-ink-4 text-[11.5px] leading-relaxed">
        Outros campos (categoria, marca, descrição, variantes, custo, etc)
        ficam em branco e podem ser preenchidos depois clicando no produto
        na lista. Produto nasce já publicado na loja online — desligue depois
        se quiser segurar.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          disabled={!canSubmit}
          onClick={() => setSubmitMode("save")}
          className="w-full sm:w-auto"
          size="lg"
        >
          {isPending && submitMode === "save" ? (
            <>
              <Loader2Icon className="animate-spin" /> Criando…
            </>
          ) : (
            <>
              <SaveIcon /> Criar e voltar pra lista
            </>
          )}
        </Button>
        <Button
          type="submit"
          variant="outline"
          disabled={!canSubmit}
          onClick={() => setSubmitMode("saveAndContinue")}
          className="w-full sm:w-auto"
          size="lg"
        >
          {isPending && submitMode === "saveAndContinue" ? (
            <>
              <Loader2Icon className="animate-spin" /> Criando…
            </>
          ) : (
            <>
              <PlusCircleIcon /> Criar e adicionar outro
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
