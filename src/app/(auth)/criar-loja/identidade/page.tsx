"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createStore } from "@/actions/store/create-store";
import {
  type CreateStoreInput,
  createStoreSchema,
} from "@/actions/store/schema";
import { AuthCard } from "@/components/auth/auth-card";
import { ColorPicker } from "@/components/onboarding/color-picker";
import { SlugInput } from "@/components/onboarding/slug-input";
import { WhatsAppInput } from "@/components/onboarding/whatsapp-input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NICHE_OPTIONS } from "@/lib/niche-categories";
import { generateSlug, isValidSlugFormat } from "@/lib/slug";
import { isValidWhatsAppBR } from "@/lib/whatsapp-format";

const APP_URL_HOST =
  (process.env.NEXT_PUBLIC_APP_URL ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "") || "vitre.app";

type OnboardingStep = 1 | 2 | 3;

export default function CriarLojaIdentidadePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [slugAvailable, setSlugAvailable] = useState(false);
  const slugManuallyEdited = useRef(false);

  const form = useForm<CreateStoreInput>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: {
      name: "",
      slug: "",
      niche: "roupa_feminina",
      whatsappNumber: "",
      primaryColor: "#1E3FE6",
      addressCity: "",
      addressState: "",
    },
    mode: "onTouched",
  });

  const watchedName = form.watch("name");
  useEffect(() => {
    if (slugManuallyEdited.current || !watchedName) return;
    const generated = generateSlug(watchedName);
    if (isValidSlugFormat(generated)) {
      form.setValue("slug", generated, { shouldValidate: true });
    }
  }, [watchedName, form]);

  const canProceedStep1 = form.watch("name").length >= 2;
  const canProceedStep2 =
    slugAvailable && isValidWhatsAppBR(form.watch("whatsappNumber"));

  const onSubmit = (values: CreateStoreInput) => {
    if (!slugAvailable) {
      toast.error("Confirme um endereco disponivel.");
      return;
    }
    startTransition(async () => {
      const result = await createStore(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Redirect to welcome page with store name
      router.push(`/criar-loja/bem-vindo?nome=${encodeURIComponent(values.name)}`);
      router.refresh();
    });
  };

  const nextStep = () => {
    if (step < 3) setStep((s) => (s + 1) as OnboardingStep);
  };

  const prevStep = () => {
    if (step > 1) setStep((s) => (s - 1) as OnboardingStep);
  };

  return (
    <AuthCard
      title={
        step === 1
          ? "Qual o nome da sua loja?"
          : step === 2
          ? "Detalhes da loja"
          : "Personalize sua marca"
      }
      subtitle={
        step === 1
          ? "Escolha um nome que represente seu negocio"
          : step === 2
          ? "Configure seu endereco e WhatsApp"
          : "Defina a cor e categoria da sua loja"
      }
      step={{ current: 2, total: 3, labels: ["Conta", "Loja", "Pronto"] }}
      compact
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Nome da loja
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Boutique da Maria"
                          autoComplete="organization"
                          autoFocus
                          disabled={isPending}
                          className="h-10 bg-muted/30 border-0 focus-visible:ring-1 text-center text-lg font-medium"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  className="w-full h-10 font-medium gap-2 group"
                  disabled={!canProceedStep1}
                  onClick={nextStep}
                >
                  Continuar
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Endereco da loja
                      </FormLabel>
                      <FormControl>
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsappNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        WhatsApp para pedidos
                      </FormLabel>
                      <FormControl>
                        <WhatsAppInput
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 px-3"
                    onClick={prevStep}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 h-10 font-medium gap-2 group"
                    disabled={!canProceedStep2}
                    onClick={nextStep}
                  >
                    Continuar
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="niche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        O que voce vende?
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full bg-muted/30 border-0">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {NICHE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Sparkles className="size-3 text-primary" />
                        Categorias serao criadas automaticamente
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Cor da marca
                      </FormLabel>
                      <FormControl>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 px-3"
                    onClick={prevStep}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-10 font-medium gap-2"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Check className="size-4" />
                        Criar minha loja
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </Form>
    </AuthCard>
  );
}
