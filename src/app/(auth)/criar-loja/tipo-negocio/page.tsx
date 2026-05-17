"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Loader2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createStore } from "@/actions/store/create-store";
import { type CreateStoreInput } from "@/actions/store/schema";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import {
  ONBOARDING_IDENTITY_KEY,
  SIGNUP_WHATSAPP_KEY,
} from "@/components/onboarding/storage-keys";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// 4 nichos visuais (extraídos de /criar-loja/identidade durante a Onda 3
// do port Dublin v3, ADR-0019). "outro" não aparece como card — quem não
// se encaixa escolhe o mais próximo e edita depois em /admin/configuracoes.
const NICHE_CARDS = [
  { value: "roupa_feminina", label: "Roupa", color: "oklch(0.45 0.18 250)" },
  { value: "joia", label: "Joia", color: "oklch(0.55 0.12 75)" },
  { value: "semijoia", label: "Semijoia", color: "oklch(0.62 0.13 25)" },
  { value: "perfumaria", label: "Perfumaria", color: "oklch(0.42 0.08 175)" },
] as const;

type Niche = (typeof NICHE_CARDS)[number]["value"];

type IdentitySnapshot = Pick<
  CreateStoreInput,
  | "name"
  | "slug"
  | "whatsappNumber"
  | "primaryColor"
  | "addressCity"
  | "addressState"
>;

export default function CriarLojaTipoNegocioPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [niche, setNiche] = useState<Niche>("roupa_feminina");
  const [includeCategories, setIncludeCategories] = useState(true);
  const [identity, setIdentity] = useState<IdentitySnapshot | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Lê snapshot da identidade do passo 2. Se faltar, volta pra
  // /criar-loja/identidade (usuária pulou passos).
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(ONBOARDING_IDENTITY_KEY);
      if (!stored) {
        router.replace("/criar-loja/identidade");
        return;
      }
      const parsed = JSON.parse(stored) as IdentitySnapshot;
      if (!parsed.name || !parsed.slug) {
        router.replace("/criar-loja/identidade");
        return;
      }
      setIdentity(parsed);
      setHydrated(true);
    } catch {
      router.replace("/criar-loja/identidade");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = () => {
    if (!identity) return;
    startTransition(async () => {
      const result = await createStore({
        ...identity,
        niche,
        includeNicheCategories: includeCategories,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Limpa sessionStorage do onboarding (já persistido na store).
      try {
        sessionStorage.removeItem(SIGNUP_WHATSAPP_KEY);
        sessionStorage.removeItem(ONBOARDING_IDENTITY_KEY);
      } catch {
        /* ignore */
      }
      const params = new URLSearchParams({
        nome: identity.name,
        slug: identity.slug,
      });
      router.push(`/criar-loja/bem-vindo?${params.toString()}`);
      router.refresh();
    });
  };

  // Loading state enquanto hidrata sessionStorage.
  if (!hydrated) {
    return (
      <OnboardingShell step={3}>
        <div className="flex items-center justify-center py-16">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={3}>
      <div className="overflow-y-auto px-4 pb-16 pt-8 sm:px-8 sm:pt-10 sm:pb-[60px]">
        <div className="mx-auto max-w-[720px]">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
            PASSO 3 DE 4
          </p>
          <h1 className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[-0.6px] sm:text-[32px] sm:tracking-[-0.8px]">
            Que tipo de loja você tem?
          </h1>
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            Usamos pra preparar categorias e exemplos relevantes pro seu nicho.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NICHE_CARDS.map((n) => {
              const active = niche === n.value;
              return (
                <button
                  key={n.value}
                  type="button"
                  onClick={() => setNiche(n.value)}
                  disabled={isPending}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-3 rounded-[12px] border-[1.5px] px-4 py-5 text-left transition-colors hocus:border-foreground/40",
                    active ? "shadow-sm" : "border-border bg-card",
                  )}
                  style={
                    active
                      ? {
                          borderColor: n.color,
                          background: `color-mix(in oklch, ${n.color} 8%, white)`,
                        }
                      : undefined
                  }
                >
                  <span
                    aria-hidden
                    className="size-9 rounded-lg"
                    style={{ background: n.color }}
                  />
                  <span
                    className="text-[14px] font-semibold"
                    style={{ color: active ? n.color : undefined }}
                  >
                    {n.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Opt-in: criar categorias sugeridas do nicho */}
          <label
            className={cn(
              "mt-6 flex items-start gap-3 rounded-[12px] border bg-card px-4 py-4 transition-colors",
              "hocus-within:border-foreground/30 cursor-pointer",
            )}
          >
            <Checkbox
              checked={includeCategories}
              onCheckedChange={(checked) =>
                setIncludeCategories(checked === true)
              }
              disabled={isPending}
              className="mt-0.5"
              aria-label="Criar categorias sugeridas do nicho"
            />
            <div className="flex-1">
              <span className="text-foreground block text-[13px] font-medium">
                Criar categorias sugeridas
              </span>
              <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-[1.4]">
                Adicionamos algumas categorias comuns do seu nicho. Você
                pode editar, renomear ou apagar depois.
              </p>
            </div>
          </label>

          {/* Botões */}
          <div className="mt-8 flex items-center gap-2">
            <Button
              asChild
              type="button"
              variant="outline"
              size="lg"
              className="h-11 px-4 text-[13px]"
              disabled={isPending}
            >
              <Link href="/criar-loja/identidade">
                <ArrowLeftIcon className="size-4" /> Voltar
              </Link>
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 ml-auto h-11 gap-2 px-5 text-[13px] font-semibold"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Criando sua loja…
                </>
              ) : (
                <>
                  Criar minha loja
                  <ArrowRightIcon className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
