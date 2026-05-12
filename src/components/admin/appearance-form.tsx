"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  type UpdateAppearanceInput,
  updateAppearanceSchema,
} from "@/actions/store/schema";
import { updateAppearance } from "@/actions/store/update-appearance";
import { ColorPicker } from "@/components/onboarding/color-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { StoreImageUploader } from "./store-image-uploader";

export interface AppearanceInitialData {
  primaryColor: string;
  bannerRotationSec: number;
  logoUrl: string | null;
  iconUrl: string | null;
}

interface AppearanceFormProps {
  initialData: AppearanceInitialData;
}

/**
 * Form de Aparência — extraído de StoreConfigForm na Onda 3 (2026-05-12).
 * Logo/ícone usam StoreImageUploader (upload próprio, não passa pelo RHF).
 * Cor primária + rotação banner vão pela action updateAppearance.
 */
export function AppearanceForm({ initialData }: AppearanceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const {
    handleSubmit,
    control,
    formState: { errors, isDirty },
    setError,
  } = useForm<UpdateAppearanceInput>({
    resolver: zodResolver(updateAppearanceSchema),
    defaultValues: {
      primaryColor: initialData.primaryColor,
      bannerRotationSec: initialData.bannerRotationSec,
    },
  });

  const onSubmit = (values: UpdateAppearanceInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    startTransition(async () => {
      try {
        const result = await updateAppearance(values);
        if (!result.ok) {
          if (result.fieldErrors) {
            for (const [field, message] of Object.entries(result.fieldErrors)) {
              setError(field as keyof UpdateAppearanceInput, { message });
            }
          }
          toast.error(result.error);
          return;
        }
        toast.success("Aparência salva.");
        router.refresh();
      } finally {
        submittingRef.current = false;
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 pb-36 lg:pb-4"
    >
      <FormCard
        title="Visual"
        description="Logo, ícone e a cor que destaca a sua vitrine."
      >
        <StoreImageUploader
          kind="logo"
          currentUrl={initialData.logoUrl}
          label="Logo da loja"
          hint="Aparece no topo da sua loja e no painel admin. Use a versão completa do seu logo (com nome). Recomendado: 400×200 px, fundo transparente, PNG ou WebP."
        />
        <StoreImageUploader
          kind="icon"
          currentUrl={initialData.iconUrl}
          label="Ícone da loja"
          hint="Aparece na aba do navegador (favicon) e quando alguém compartilha sua loja em redes sociais. Use a versão compacta (só símbolo, sem texto). Recomendado: 512×512 px quadrado, PNG ou WebP."
        />

        <div className="space-y-1.5 pt-2">
          <Label>Cor primária</Label>
          <p className="text-muted-foreground text-xs">
            A cor que destaca botões, links e elementos da sua vitrine.
          </p>
          <Controller
            name="primaryColor"
            control={control}
            render={({ field }) => (
              <ColorPicker
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
          {errors.primaryColor?.message ? (
            <p className="text-destructive text-xs">
              {errors.primaryColor.message}
            </p>
          ) : null}
        </div>
      </FormCard>

      <FormCard
        title="Banners"
        description="Como o carrossel de banners aparece na sua vitrine."
      >
        <div className="space-y-1.5">
          <Label htmlFor="banner-rotation">Tempo do carrossel</Label>
          <Controller
            name="bannerRotationSec"
            control={control}
            render={({ field }) => (
              <Select
                value={String(field.value)}
                onValueChange={(v) => field.onChange(Number(v))}
                disabled={isPending}
              >
                <SelectTrigger
                  id="banner-rotation"
                  className="w-full sm:max-w-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">
                    Desligado (mostrar só o primeiro)
                  </SelectItem>
                  <SelectItem value="3">3 segundos</SelectItem>
                  <SelectItem value="5">5 segundos (recomendado)</SelectItem>
                  <SelectItem value="8">8 segundos</SelectItem>
                  <SelectItem value="12">12 segundos</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-muted-foreground text-xs">
            Quanto tempo cada banner aparece antes de trocar pro próximo. Só
            faz diferença se você tem 2 ou mais banners ativos.
          </p>
          {errors.bannerRotationSec?.message ? (
            <p className="text-destructive text-xs">
              {errors.bannerRotationSec.message}
            </p>
          ) : null}
        </div>
      </FormCard>

      {/* Save desktop inline */}
      <div className="hidden justify-end pt-4 lg:flex">
        <Button
          type="submit"
          disabled={isPending || !isDirty}
          className="min-w-32"
        >
          {isPending ? (
            <>
              <Loader2Icon className="animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <SaveIcon /> Salvar
            </>
          )}
        </Button>
      </div>

      {/* Save mobile sticky (acima do bottom nav) */}
      <div
        className={cn(
          "surface-elevated fixed inset-x-0 z-50 px-4 py-3 lg:hidden",
        )}
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 3.5rem + 0.25rem)",
        }}
      >
        <Button
          type="submit"
          disabled={isPending || !isDirty}
          className="w-full"
          size="lg"
        >
          {isPending ? (
            <>
              <Loader2Icon className="animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <SaveIcon /> Salvar
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface FormCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function FormCard({ title, description, children }: FormCardProps) {
  return (
    <section className="bg-card rounded-xl border p-4 shadow-sm sm:p-5">
      <header className="mb-4 space-y-0.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
