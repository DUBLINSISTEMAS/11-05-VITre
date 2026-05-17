"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Loader2Icon,
  UploadCloudIcon,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientEnv } from "@/lib/env-client";
import { generateSlug, isValidSlugFormat } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { isValidWhatsAppBR } from "@/lib/whatsapp-format";

const APP_URL_HOST =
  clientEnv.APP_URL
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "") || "vitre.app";

// 5 cores canvas (linha 215-219). Hex equivalentes do oklch — convertidos
// pra ficarem editáveis depois via ColorPicker (que aceita hex).
const COLOR_SWATCHES = [
  { hex: "#1E3FE6", label: "Royal" },
  { hex: "#212126", label: "Carvão" },
  { hex: "#B58A3D", label: "Champagne" },
  { hex: "#C76E36", label: "Cobre" },
  { hex: "#3D7A6E", label: "Jade" },
] as const;

export default function CriarLojaIdentidadePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slugAvailable, setSlugAvailable] = useState(false);
  const slugManuallyEdited = useRef(false);

  // Onda 3 port Dublin (ADR-0019): identidade NÃO chama createStore.
  // Persiste em sessionStorage e roteia pra /tipo-negocio. createStore
  // só é chamado no passo 3 com identity + niche + opt-in mesclados.
  const form = useForm<CreateStoreInput>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: {
      name: "",
      slug: "",
      niche: "roupa_feminina", // hidden default; usuária escolhe no passo 3
      whatsappNumber: "",
      primaryColor: "#1E3FE6",
      addressCity: "",
      addressState: "",
      includeNicheCategories: true, // hidden default; usuária pode desmarcar no passo 3
    },
    mode: "onTouched",
  });

  // Hidrata WhatsApp do sessionStorage (vindo da tela 1 Conta).
  // Também hidrata o snapshot completo de identidade caso usuária esteja
  // voltando do passo 3 (tipo-negocio) — todos os campos preenchidos no
  // passo 2 ficam preservados.
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
      // private mode / JSON.parse falhou — nada a fazer.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-slug a partir do nome (até usuária editar manualmente).
  const watchedName = form.watch("name");
  useEffect(() => {
    if (slugManuallyEdited.current || !watchedName) return;
    const generated = generateSlug(watchedName);
    if (isValidSlugFormat(generated)) {
      form.setValue("slug", generated, { shouldValidate: true });
    }
  }, [watchedName, form]);

  const watchedSlug = form.watch("slug");
  const watchedColor = form.watch("primaryColor");
  const initial = (watchedName.trim()[0] ?? "S").toUpperCase();
  const watchedWhatsapp = form.watch("whatsappNumber");
  const showWhatsappInline = !isValidWhatsAppBR(watchedWhatsapp);

  const onSubmit = (values: CreateStoreInput) => {
    if (!slugAvailable) {
      toast.error("Confirme um endereço disponível.");
      return;
    }
    // Onda 3 port Dublin: persiste snapshot da identidade e roteia
    // pro passo 3 (tipo-negocio). createStore é chamado lá com tudo
    // mesclado (identity + niche + opt-in).
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
        // private mode — segue sem persistir. Usuária perde estado
        // se voltar do passo 3, mas o fluxo principal completa.
      }
      router.push("/criar-loja/tipo-negocio");
    });
  };

  return (
    <OnboardingShell step={2}>
      <div className="overflow-y-auto px-4 pb-16 pt-8 sm:px-8 sm:pt-10 sm:pb-[60px]">
        <div className="mx-auto max-w-[980px]">
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.6px] sm:text-[32px] sm:tracking-[-0.8px]">
            Vamos dar identidade pra sua loja
          </h1>
          <p className="text-ink-4 mt-2 text-[13.5px]">
            Você pode mudar tudo isso depois. Começamos com o essencial.
          </p>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]"
          >
            {/* === Form column === */}
            <div className="flex flex-col gap-6">
              {/* Logo (placeholder visual — upload real no admin) */}
              <Section
                label="Logo da loja"
                hint="Você pode subir a sua logo depois em Configurações. Por enquanto usamos a inicial."
              >
                <div className="flex items-start gap-4">
                  <div
                    aria-hidden
                    className="flex size-24 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{
                      background: watchedColor,
                      fontSize: 38,
                      fontWeight: 600,
                      letterSpacing: -1,
                    }}
                  >
                    {initial}
                  </div>
                  <div
                    aria-hidden
                    className="border-line bg-bg-app text-ink-4 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed p-6"
                  >
                    <UploadCloudIcon className="size-5" />
                    <span className="text-ink-1 text-[12px] font-medium">
                      Solte sua logo aqui
                    </span>
                    <span className="text-[10.5px]">
                      ou{" "}
                      <span className="text-brand font-medium">
                        depois nas configurações
                      </span>
                    </span>
                  </div>
                </div>
              </Section>

              {/* Nome */}
              <Section
                label="Nome da loja"
                hint="É o nome que seus clientes vão ver no topo da página."
              >
                <Input
                  autoComplete="organization"
                  autoFocus
                  placeholder="Ex: Atelier Maria"
                  disabled={isPending}
                  aria-invalid={!!form.formState.errors.name}
                  className="h-11"
                  {...form.register("name")}
                />
                {form.formState.errors.name?.message ? (
                  <p className="text-destructive mt-1.5 text-[11px]">
                    {form.formState.errors.name.message}
                  </p>
                ) : null}
              </Section>

              {/* Endereço da loja (slug) */}
              <Section
                label="Endereço da loja"
                hint="Esse é o link que você vai compartilhar."
              >
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
                {form.formState.errors.slug?.message ? (
                  <p className="text-destructive mt-1.5 text-[11px]">
                    {form.formState.errors.slug.message}
                  </p>
                ) : null}
              </Section>

              {/* WhatsApp inline (só se sessionStorage não trouxe válido) */}
              {showWhatsappInline ? (
                <Section
                  label="WhatsApp para pedidos"
                  hint="Será o número que recebe os pedidos."
                >
                  <Controller
                    name="whatsappNumber"
                    control={form.control}
                    render={({ field }) => (
                      <WhatsAppInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isPending}
                        aria-invalid={!!form.formState.errors.whatsappNumber}
                      />
                    )}
                  />
                  {form.formState.errors.whatsappNumber?.message ? (
                    <p className="text-destructive mt-1.5 text-[11px]">
                      {form.formState.errors.whatsappNumber.message}
                    </p>
                  ) : null}
                </Section>
              ) : null}

              {/* Cor da loja */}
              <Section
                label="Cor da loja"
                hint="Aparece no botão de sacola e em destaques. Você pode trocar depois."
              >
                <Controller
                  name="primaryColor"
                  control={form.control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-2.5">
                      {COLOR_SWATCHES.map((co) => {
                        const active =
                          field.value.toLowerCase() === co.hex.toLowerCase();
                        return (
                          <button
                            key={co.hex}
                            type="button"
                            onClick={() => field.onChange(co.hex)}
                            disabled={isPending}
                            className={cn(
                              "bg-surface hocus:border-line-2 flex cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] border-line px-2.5 py-3 transition-colors",
                              active && "shadow-sm",
                            )}
                            style={
                              active
                                ? { borderColor: co.hex }
                                : undefined
                            }
                          >
                            <span
                              aria-hidden
                              className="size-6 shrink-0 rounded-full"
                              style={{ background: co.hex }}
                            />
                            <span className="text-[11.5px] font-medium">
                              {co.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              </Section>

              {/* Botões */}
              <div className="mt-2 flex items-center gap-2">
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-11 px-4 text-[13px]"
                >
                  <Link href="/criar-loja/conta">
                    <ArrowLeftIcon className="size-4" /> Voltar
                  </Link>
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="bg-foreground text-background hover:bg-foreground/90 ml-auto h-11 gap-2 px-5 text-[13px] font-semibold"
                  disabled={isPending || !slugAvailable}
                >
                  {isPending ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      Continuando…
                    </>
                  ) : (
                    <>
                      Próximo passo
                      <ArrowRightIcon className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* === Live preview (sticky desktop) === */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <p className="text-ink-4 mb-2.5 font-mono text-[10px] uppercase tracking-[0.05em]">
                Prévia ao vivo
              </p>
              <div className="bg-surface rounded-2xl border border-line p-[18px] shadow-md">
                <div className="mb-3.5 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-md font-semibold text-white"
                    style={{ background: watchedColor }}
                  >
                    {initial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold leading-[1.1]">
                      {watchedName.trim() || "Sua loja"}
                    </p>
                    <p className="text-ink-4 truncate font-mono text-[9.5px]">
                      {APP_URL_HOST}/{watchedSlug || "sua-loja"}
                    </p>
                  </div>
                </div>

                {/* Hero card gradient brand */}
                <div
                  className="flex flex-col justify-end rounded-[10px] p-3.5"
                  style={{
                    aspectRatio: "16 / 10",
                    background: `linear-gradient(135deg, color-mix(in oklch, ${watchedColor} 22%, white), color-mix(in oklch, ${watchedColor} 7%, white))`,
                  }}
                >
                  <p
                    className="font-mono text-[9px] font-semibold"
                    style={{ color: watchedColor }}
                  >
                    NOVA COLEÇÃO
                  </p>
                  <p className="mt-0.5 text-[18px] font-semibold leading-[1.1] tracking-[-0.4px]">
                    Linhas que respiram.
                  </p>
                </div>

                {/* 2 produtos ficcionais */}
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {[
                    { name: "Vestido linho", price: "R$ 249,00", tone: "oklch(0.78 0.04 60)" },
                    { name: "Calça wide", price: "R$ 199,00", tone: "oklch(0.45 0.03 270)" },
                  ].map((p) => (
                    <div key={p.name}>
                      <div
                        aria-hidden
                        className="rounded-md"
                        style={{ aspectRatio: "3 / 4", background: p.tone }}
                      />
                      <p className="mt-1 text-[10px] font-medium">{p.name}</p>
                      <p className="font-mono text-[10px] font-semibold tabular-nums">
                        {p.price}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-ink-4 mt-2.5 text-[10.5px] leading-[1.5]">
                Atualiza enquanto você digita.
              </p>
            </aside>
          </form>
        </div>
      </div>
    </OnboardingShell>
  );
}

interface SectionProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function Section({ label, hint, children }: SectionProps) {
  return (
    <section>
      <p className="mb-1 text-[13px] font-semibold">{label}</p>
      {hint ? (
        <p className="text-ink-4 mb-2.5 text-[11px]">{hint}</p>
      ) : null}
      {children}
    </section>
  );
}
