"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  type UpdateStoreInput,
  updateStoreSchema,
} from "@/actions/store/schema";
import { updateStore } from "@/actions/store/update";
import { ColorPicker } from "@/components/onboarding/color-picker";
import { WhatsAppInput } from "@/components/onboarding/whatsapp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NICHE_OPTIONS } from "@/lib/niche-categories";
import { cn } from "@/lib/utils";

import { StoreImageUploader } from "./store-image-uploader";

export interface StoreConfigInitialData {
  name: string;
  description: string | null;
  niche: UpdateStoreInput["niche"];
  whatsappNumber: string;
  primaryColor: string;
  addressStreet: string | null;
  addressNumber: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  googleMapsUrl: string | null;
  instagramHandle: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
}

interface StoreConfigFormProps {
  initialData: StoreConfigInitialData;
  /** URL pública da loja (storefront). */
  storefrontUrl: string;
}

/**
 * Form único de configurações da loja. Mesmo padrão estrutural do
 * ProductForm (FormCard cards radius 12, sticky save mobile, inline desktop).
 *
 * Logos têm upload separado (componente `StoreImageUploader`) — o form
 * RHF não os controla, eles persistem direto via server actions.
 */
export function StoreConfigForm({
  initialData,
  storefrontUrl,
}: StoreConfigFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
    setError,
  } = useForm<UpdateStoreInput>({
    resolver: zodResolver(updateStoreSchema),
    defaultValues: {
      name: initialData.name,
      description: initialData.description ?? "",
      niche: initialData.niche,
      whatsappNumber: initialData.whatsappNumber,
      primaryColor: initialData.primaryColor,
      addressStreet: initialData.addressStreet ?? "",
      addressNumber: initialData.addressNumber ?? "",
      addressNeighborhood: initialData.addressNeighborhood ?? "",
      addressCity: initialData.addressCity ?? "",
      addressState: initialData.addressState ?? "",
      googleMapsUrl: initialData.googleMapsUrl ?? "",
      instagramHandle: initialData.instagramHandle ?? "",
    },
  });

  const onSubmit = (values: UpdateStoreInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    startTransition(async () => {
      try {
        const result = await updateStore(values);
        if (!result.ok) {
          if (result.fieldErrors) {
            for (const [field, message] of Object.entries(result.fieldErrors)) {
              setError(field as keyof UpdateStoreInput, { message });
            }
          }
          toast.error(result.error);
          return;
        }
        toast.success("Configurações salvas.");
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
        title="Identidade"
        description="O que aparece pra quem visita sua loja."
      >
        <div className="space-y-1.5">
          <Label htmlFor="store-name">Nome da loja</Label>
          <Input
            id="store-name"
            disabled={isPending}
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name?.message ? (
            <p className="text-destructive text-xs">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="store-description">Descrição</Label>
          <Textarea
            id="store-description"
            placeholder="Conte o que sua loja vende, em 1 ou 2 linhas…"
            rows={3}
            disabled={isPending}
            aria-invalid={!!errors.description}
            {...register("description")}
          />
          {errors.description?.message ? (
            <p className="text-destructive text-xs">
              {errors.description.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label>Endereço da loja</Label>
          <p className="bg-muted text-muted-foreground rounded-md px-2.5 py-1.5 font-mono text-xs">
            {storefrontUrl}
          </p>
          <p className="text-muted-foreground text-xs">
            Esse link é fixo. Não dá pra mudar pra não quebrar o que você
            já mandou pros clientes.
          </p>
        </div>
      </FormCard>

      <FormCard
        title="Logo e ícone"
        description="Logo aparece no topo da loja. Ícone é a aba do navegador (favicon)."
      >
        <StoreImageUploader
          kind="logo"
          currentUrl={initialData.logoUrl}
          label="Logo da loja"
          hint="Recomendado: PNG/WebP transparente, formato horizontal."
        />
        <StoreImageUploader
          kind="icon"
          currentUrl={initialData.iconUrl}
          label="Ícone da loja"
          hint="Recomendado: imagem quadrada, idealmente 256×256px."
        />
      </FormCard>

      <FormCard
        title="Nicho"
        description="Ajuda quando criamos sugestões automáticas e indicações."
      >
        <Controller
          name="niche"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isPending}
            >
              <SelectTrigger className="w-full sm:max-w-xs">
                <SelectValue placeholder="Escolha um nicho" />
              </SelectTrigger>
              <SelectContent>
                {NICHE_OPTIONS.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormCard>

      <FormCard
        title="Cor primária"
        description="A cor que destaca botões, links e elementos da sua loja."
      >
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
      </FormCard>

      <FormCard
        title="Contato"
        description="WhatsApp recebe os pedidos. Instagram aparece como link na loja."
      >
        <div className="space-y-1.5">
          <Label htmlFor="store-whatsapp">WhatsApp</Label>
          <Controller
            name="whatsappNumber"
            control={control}
            render={({ field }) => (
              <WhatsAppInput
                id="store-whatsapp"
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
                aria-invalid={!!errors.whatsappNumber}
              />
            )}
          />
          {errors.whatsappNumber?.message ? (
            <p className="text-destructive text-xs">
              {errors.whatsappNumber.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="store-instagram">Instagram (opcional)</Label>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
              @
            </span>
            <Input
              id="store-instagram"
              placeholder="sualoja"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="pl-7"
              disabled={isPending}
              aria-invalid={!!errors.instagramHandle}
              {...register("instagramHandle")}
            />
          </div>
          {errors.instagramHandle?.message ? (
            <p className="text-destructive text-xs">
              {errors.instagramHandle.message}
            </p>
          ) : null}
        </div>
      </FormCard>

      <FormCard
        title="Endereço (opcional)"
        description="Mostrado na página da loja. Útil pra retirada presencial."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="addr-street">Rua</Label>
            <Input
              id="addr-street"
              placeholder="Ex: Av. Brasil"
              disabled={isPending}
              {...register("addressStreet")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-number">Número</Label>
            <Input
              id="addr-number"
              placeholder="123"
              className="sm:w-28"
              disabled={isPending}
              {...register("addressNumber")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addr-neighborhood">Bairro</Label>
          <Input
            id="addr-neighborhood"
            disabled={isPending}
            {...register("addressNeighborhood")}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="addr-city">Cidade</Label>
            <Input
              id="addr-city"
              disabled={isPending}
              {...register("addressCity")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-state">UF</Label>
            <Input
              id="addr-state"
              placeholder="MA"
              maxLength={2}
              autoCapitalize="characters"
              className="uppercase sm:w-20"
              disabled={isPending}
              aria-invalid={!!errors.addressState}
              {...register("addressState")}
            />
            {errors.addressState?.message ? (
              <p className="text-destructive text-xs">
                {errors.addressState.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addr-maps">Link do Google Maps (opcional)</Label>
          <Input
            id="addr-maps"
            type="url"
            inputMode="url"
            placeholder="https://maps.google.com/..."
            disabled={isPending}
            aria-invalid={!!errors.googleMapsUrl}
            {...register("googleMapsUrl")}
          />
          {errors.googleMapsUrl?.message ? (
            <p className="text-destructive text-xs">
              {errors.googleMapsUrl.message}
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

/**
 * Card padrão de form do admin Lote 3 — bg-card radius 12 shadow-sm,
 * com header (title + description opcional) e content body.
 * Mesmo pattern aplicado em product-form.tsx (Onda 4).
 */
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
