"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  type CreateStoreInput,
  createStoreSchema,
} from "@/actions/store/schema";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { SlugInput } from "@/components/onboarding/slug-input";
import {
  ONBOARDING_IDENTITY_KEY,
  SIGNUP_WHATSAPP_KEY,
} from "@/components/onboarding/storage-keys";
import { WhatsAppInput } from "@/components/onboarding/whatsapp-input";
import { clientEnv } from "@/lib/env-client";
import { generateSlug, isReservedSlug, isValidSlugFormat } from "@/lib/slug";
import { isValidWhatsAppBR } from "@/lib/whatsapp-format";

const APP_URL_HOST =
  clientEnv.APP_URL
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "") || "mangospay.app";

// 5 cores canvas (mantidas pra compat — usuária ajusta depois no admin).
const COLOR_SWATCHES = [
  { hex: "#1A3A8F", label: "Royal" },
  { hex: "#212126", label: "Carvão" },
  { hex: "#B58A3D", label: "Champagne" },
  { hex: "#C76E36", label: "Cobre" },
  { hex: "#3D7A6E", label: "Jade" },
] as const;

export default function CriarLojaIdentidadePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [, setSlugAvailable] = useState(false);
  const slugManuallyEdited = useRef(false);

  const form = useForm<CreateStoreInput>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: {
      name: "",
      slug: "",
      niche: "roupa_feminina",
      whatsappNumber: "",
      primaryColor: "#1A3A8F",
      addressCity: "",
      addressState: "",
      includeNicheCategories: true,
    },
    mode: "onTouched",
  });

  useEffect(() => {
    try {
      const storedWhatsapp = sessionStorage.getItem(SIGNUP_WHATSAPP_KEY);
      if (storedWhatsapp && isValidWhatsAppBR(storedWhatsapp)) {
        form.setValue("whatsappNumber", storedWhatsapp, { shouldValidate: true });
      }
      const storedIdentity = sessionStorage.getItem(ONBOARDING_IDENTITY_KEY);
      if (storedIdentity) {
        const parsed = JSON.parse(storedIdentity) as Partial<CreateStoreInput>;
        if (parsed.name) form.setValue("name", parsed.name);
        if (parsed.slug) {
          form.setValue("slug", parsed.slug);
          slugManuallyEdited.current = true;
        }
        if (parsed.whatsappNumber && isValidWhatsAppBR(parsed.whatsappNumber)) {
          form.setValue("whatsappNumber", parsed.whatsappNumber);
        }
        if (parsed.primaryColor) form.setValue("primaryColor", parsed.primaryColor);
        if (parsed.addressCity) form.setValue("addressCity", parsed.addressCity);
        if (parsed.addressState) form.setValue("addressState", parsed.addressState);
      }
    } catch {
      /* private mode / parse failed */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const watchedName = form.watch("name");
  useEffect(() => {
    if (slugManuallyEdited.current || !watchedName) return;
    const generated = generateSlug(watchedName);
    if (isValidSlugFormat(generated)) {
      form.setValue("slug", generated, { shouldValidate: true });
    }
  }, [watchedName, form]);

  const watchedWhatsapp = form.watch("whatsappNumber");
  const watchedSlug = form.watch("slug");
  const showWhatsappInline = !isValidWhatsAppBR(watchedWhatsapp);
  const slugCanAttemptSubmit =
    isValidSlugFormat(watchedSlug) && !isReservedSlug(watchedSlug);

  const onSubmit = (values: CreateStoreInput) => {
    if (!slugCanAttemptSubmit) {
      toast.error("Informe um endereço válido para continuar.");
      return;
    }
    startTransition(() => {
      try {
        sessionStorage.setItem(
          ONBOARDING_IDENTITY_KEY,
          JSON.stringify({
            name: values.name,
            slug: values.slug,
            whatsappNumber: values.whatsappNumber,
            primaryColor: values.primaryColor,
            addressCity: values.addressCity,
            addressState: values.addressState,
          }),
        );
      } catch {
        toast.error("Não consegui salvar esta etapa no navegador. Tente novamente.");
        return;
      }
      router.push("/criar-loja/tipo-negocio");
    });
  };

  const errors = form.formState.errors;

  return (
    <OnboardingShell
      step={2}
      footerLeft={
        <Link href="/criar-loja/conta" className="b3-btn">
          <ArrowLeftIcon className="size-3.5" /> Voltar
        </Link>
      }
      footerRight={
        <button
          type="button"
          onClick={form.handleSubmit(onSubmit)}
          className="b3-btn b3-btn--cta"
          disabled={isPending || !slugCanAttemptSubmit}
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Continuando…
            </>
          ) : (
            <>
              Continuar <ArrowRightIcon className="size-3.5" />
            </>
          )}
        </button>
      }
    >
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
        PASSO 2 DE 4
      </span>
      <h2 className="mt-2 mb-1.5 text-[26px] font-bold tracking-[-0.02em] text-ink-1">
        Como sua loja se chama?
      </h2>
      <p className="mb-6 text-[14px] text-ink-3">
        É o nome que aparece pro cliente. Pode mudar tudo depois.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="b3-field">
          <label htmlFor="store-name" className="b3-field-label">Nome da loja</label>
          <input
            id="store-name"
            autoComplete="organization"
            autoFocus
            placeholder="Ex: Sandra Brito Collection"
            disabled={isPending}
            aria-invalid={!!errors.name}
            className="b3-input"
            {...form.register("name")}
          />
          {errors.name?.message ? (
            <p className="mt-1 text-[11px] text-destructive">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="b3-field">
          <label className="b3-field-label">URL pública</label>
          <Controller
            name="slug"
            control={form.control}
            render={({ field }) => (
              <SlugInput
                value={field.value}
                onChange={(v) => {
                  slugManuallyEdited.current = true;
                  field.onChange(v);
                }}
                onAvailabilityChange={setSlugAvailable}
                disabled={isPending}
                appUrl={APP_URL_HOST}
              />
            )}
          />
          {errors.slug?.message ? (
            <p className="mt-1 text-[11px] text-destructive">{errors.slug.message}</p>
          ) : null}
        </div>

        {showWhatsappInline ? (
          <div className="b3-field">
            <label htmlFor="store-whatsapp" className="b3-field-label">WhatsApp para pedidos</label>
            <Controller
              name="whatsappNumber"
              control={form.control}
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
              <p className="mt-1 text-[11px] text-destructive">{errors.whatsappNumber.message}</p>
            ) : (
              <p className="mt-1 text-[10.5px] text-ink-4">Será o número que recebe os pedidos.</p>
            )}
          </div>
        ) : null}

        <div className="b3-field">
          <label className="b3-field-label">Cor primária</label>
          <Controller
            name="primaryColor"
            control={form.control}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((co) => {
                  const active = field.value.toLowerCase() === co.hex.toLowerCase();
                  return (
                    <button
                      key={co.hex}
                      type="button"
                      onClick={() => field.onChange(co.hex)}
                      disabled={isPending}
                      title={co.label}
                      aria-label={co.label}
                      aria-pressed={active}
                      className="cursor-pointer transition-transform hocus:scale-105"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: co.hex,
                        border: active
                          ? "2px solid var(--ink-1)"
                          : "1px solid var(--line-2)",
                      }}
                    />
                  );
                })}
              </div>
            )}
          />
          <p className="mt-2 text-[10.5px] text-ink-4">
            Aparece no botão de sacola e em destaques da vitrine.
          </p>
        </div>

        <button type="submit" hidden tabIndex={-1} />
      </form>
    </OnboardingShell>
  );
}
