"use client";

/**
 * Formulário público de contato — Sprint 5.2 (2026-05-22).
 *
 * RHF + Zod. Após enviar com sucesso, mostra estado "obrigada"
 * permanente (não permite reenviar — UX de "mensagem recebida").
 * Cliente recarrega pra mandar outra.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { submitContactMessage } from "@/actions/lead/submit-contact";
import { WhatsAppInput } from "@/components/onboarding/whatsapp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidWhatsAppBR } from "@/lib/whatsapp-format";

// Schema espelha o do server, mas em client-side (Zod resolver do RHF).
const formSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo.")
    .max(80, "Nome muito longo."),
  customerPhone: z
    .string()
    .trim()
    .refine(isValidWhatsAppBR, "Número de WhatsApp inválido."),
  message: z.string().trim().min(3, "Escreva sua mensagem.").max(500),
});

type FormValues = z.input<typeof formSchema>;

interface ContactFormProps {
  storeSlug: string;
  storeName: string;
}

export function ContactForm({ storeSlug, storeName }: ContactFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      message: "",
    },
    mode: "onBlur",
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const res = await submitContactMessage({
        storeSlug,
        ...values,
      });
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [field, msg] of Object.entries(res.fieldErrors)) {
            form.setError(field as keyof FormValues, { message: msg });
          }
        }
        toast.error(res.error);
        return;
      }
      setSubmitted(true);
      toast.success("Mensagem enviada!");
    });
  };

  if (submitted) {
    return (
      <div className="border-state-ok/30 bg-state-ok/10 rounded-xl border p-6 text-center">
        <CheckCircle2 className="text-state-ok mx-auto size-10" aria-hidden />
        <h2 className="text-foreground mt-3 text-lg font-semibold">
          Mensagem enviada
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          A {storeName} recebeu sua mensagem e vai responder pelo WhatsApp
          que você informou. Obrigada!
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="customerName" className="text-[12.5px] font-medium">
          Seu nome
          <span className="text-destructive ml-0.5">*</span>
        </Label>
        <Input
          id="customerName"
          autoComplete="name"
          placeholder="Como devemos te chamar?"
          className="h-10"
          {...form.register("customerName")}
          aria-invalid={!!form.formState.errors.customerName}
          disabled={isPending}
        />
        {form.formState.errors.customerName ? (
          <p className="text-destructive text-[11px] font-medium" role="alert">
            {form.formState.errors.customerName.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerPhone" className="text-[12.5px] font-medium">
          WhatsApp pra resposta
          <span className="text-destructive ml-0.5">*</span>
        </Label>
        <Controller
          control={form.control}
          name="customerPhone"
          render={({ field }) => (
            <WhatsAppInput
              id="customerPhone"
              value={field.value ?? ""}
              onChange={field.onChange}
              aria-invalid={!!form.formState.errors.customerPhone}
            />
          )}
        />
        {form.formState.errors.customerPhone ? (
          <p className="text-destructive text-[11px] font-medium" role="alert">
            {form.formState.errors.customerPhone.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message" className="text-[12.5px] font-medium">
          Mensagem
          <span className="text-destructive ml-0.5">*</span>
        </Label>
        <Textarea
          id="message"
          rows={4}
          placeholder="Ex: vocês fazem entrega no bairro X? Qual o horário sábado?"
          className="resize-none"
          {...form.register("message")}
          aria-invalid={!!form.formState.errors.message}
          disabled={isPending}
          maxLength={500}
        />
        {form.formState.errors.message ? (
          <p className="text-destructive text-[11px] font-medium" role="alert">
            {form.formState.errors.message.message}
          </p>
        ) : (
          <p className="text-muted-foreground text-[11px]">
            Mínimo 3 caracteres, máximo 500.
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <Send className="size-4" />
            Enviar mensagem
          </>
        )}
      </Button>
    </form>
  );
}
