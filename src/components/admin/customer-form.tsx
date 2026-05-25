"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { useRef, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createCustomer } from "@/actions/customer/create";
import {
  type CreateCustomerInput,
  createCustomerSchema,
  type UpdateCustomerInput,
  updateCustomerSchema,
} from "@/actions/customer/schema";
import { updateCustomer } from "@/actions/customer/update";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerType } from "@/db/schema";
import { maskDocumentInput, normalizeDocument } from "@/lib/document";
import { cn } from "@/lib/utils";

/**
 * Form do domínio `customer` (Fase 3 — ADR-0014). Usado em
 * `/admin/clientes/novo` e `/admin/clientes/[id]` via dois wrappers
 * client (new-customer-form, edit-customer-form) que injetam o `mode`
 * e o handler de pós-save.
 *
 * Telefone E.164 — usuário digita com `+55`. Não normalizamos máscara
 * BR aqui (libphonenumber-js está em outro form). Validação Zod com
 * regex `^\+[1-9][0-9]{6,14}$`.
 *
 * Endereço todo opcional. Lojista pode salvar só name + phone.
 */

export interface CustomerInitialData {
  id?: string;
  name: string;
  phone: string;
  /** ADR-0021 — PF/PJ. Default 'individual' pra create. */
  type: CustomerType;
  /** ADR-0021 — CPF/CNPJ só dígitos. Display formata via maskDocumentInput. */
  document: string | null;
  email: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  notes: string | null;
}

export type CustomerFormMode = "create" | "edit";

interface CustomerFormProps {
  mode: CustomerFormMode;
  initialData: CustomerInitialData;
  onAfterSave: (opts: { customerId?: string }) => void;
  /**
   * PP2 (handoff 2026-05-25) — quando true, esconde os 2 save buttons
   * (desktop + mobile sticky) porque o drawer host renderiza próprio footer.
   * Default false (legacy pages /admin/clientes/[id] e /novo seguem com save).
   */
  embedded?: boolean;
  /**
   * Quando embedded, drawer footer dispara o submit via ref.click() — esse
   * ref aponta pra um botão type="submit" invisível dentro do form.
   */
  submitRef?: React.RefObject<HTMLButtonElement | null>;
}

export function CustomerForm({
  mode,
  initialData,
  onAfterSave,
  embedded = false,
  submitRef,
}: CustomerFormProps) {
  const [isPending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  type FormInput = CreateCustomerInput & { id?: string };
  const schema = mode === "edit" ? updateCustomerSchema : createCustomerSchema;

  const {
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty },
    setError,
  } = useForm<FormInput>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      ...(mode === "edit" && initialData.id ? { id: initialData.id } : {}),
      name: initialData.name,
      phone: initialData.phone,
      type: initialData.type,
      // Mascarado já no initial pra não exibir só dígitos no edit.
      document: initialData.document
        ? maskDocumentInput(initialData.document, initialData.type)
        : "",
      email: initialData.email ?? "",
      addressStreet: initialData.addressStreet ?? "",
      addressNumber: initialData.addressNumber ?? "",
      addressComplement: initialData.addressComplement ?? "",
      addressNeighborhood: initialData.addressNeighborhood ?? "",
      addressCity: initialData.addressCity ?? "",
      addressState: initialData.addressState ?? "",
      addressZip: initialData.addressZip ?? "",
      notes: initialData.notes ?? "",
    } as FormInput,
  });

  // ADR-0021 — watch do type pra label dinâmica + máscara correta.
  // Memory `zod-action-input-type-with-defaults.md` — usar watch
  // destructurado em vez de useWatch generic.
  const currentType = (watch("type") ?? "individual") as CustomerType;
  const isCompany = currentType === "company";

  const onSubmit = (values: FormInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    startTransition(async () => {
      try {
        const result =
          mode === "edit"
            ? await updateCustomer(values as UpdateCustomerInput)
            : await createCustomer(values as CreateCustomerInput);

        if (!result.ok) {
          if (result.fieldErrors) {
            for (const [field, message] of Object.entries(result.fieldErrors)) {
              setError(field as keyof FormInput, { message });
            }
          }
          toast.error(result.error);
          return;
        }

        toast.success(mode === "edit" ? "Cliente atualizado." : "Cliente cadastrado.");
        const newId =
          mode === "create" && "customer" in result
            ? (result.customer as { id: string }).id
            : undefined;
        onAfterSave({ customerId: newId });
      } finally {
        submittingRef.current = false;
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-36 lg:pb-4">
      <FormCard
        title="Dados principais"
        description="Nome e telefone são obrigatórios — o telefone é a chave que identifica o cliente."
      >
        {/* ADR-0021 — Toggle PF/PJ. Muda label do nome e máscara do documento.
            Trocar de tipo limpa o documento (CPF e CNPJ têm length diferentes). */}
        <div className="space-y-1.5">
          <Label className="text-[12.5px]">Tipo</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <div
                role="tablist"
                aria-label="Tipo de cliente"
                className="border-line inline-flex rounded-[8px] border bg-[var(--bg-app)] p-0.5"
              >
                {(
                  [
                    { v: "individual" as const, label: "Pessoa física" },
                    { v: "company" as const, label: "Pessoa jurídica" },
                  ] as const
                ).map((opt) => {
                  const active = field.value === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={isPending}
                      onClick={() => {
                        if (active) return;
                        field.onChange(opt.v);
                        // Trocar de tipo limpa documento — length diferente.
                        setValue("document", "", { shouldDirty: true });
                      }}
                      className={cn(
                        "rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium transition",
                        active
                          ? "bg-surface text-ink-1 shadow-sm"
                          : "text-ink-3 hover:text-ink-1",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>

        <Field
          label={isCompany ? "Razão social" : "Nome"}
          htmlFor="cust-name"
          error={errors.name?.message}
          required
        >
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input
                id="cust-name"
                placeholder={
                  isCompany ? "Padaria do João Ltda" : "Maria da Silva"
                }
                disabled={isPending}
                aria-invalid={!!errors.name}
                {...field}
              />
            )}
          />
        </Field>

        <Field
          label={isCompany ? "CNPJ (opcional)" : "CPF (opcional)"}
          htmlFor="cust-document"
          error={errors.document?.message}
          hint={
            isCompany
              ? "14 dígitos. Pode digitar com ou sem máscara."
              : "11 dígitos. Pode digitar com ou sem máscara."
          }
        >
          <Controller
            name="document"
            control={control}
            render={({ field }) => {
              const maxLen = isCompany ? 18 : 14; // com máscara
              return (
                <Input
                  id="cust-document"
                  inputMode="numeric"
                  placeholder={
                    isCompany
                      ? "12.345.678/0001-99"
                      : "999.999.999-99"
                  }
                  maxLength={maxLen}
                  disabled={isPending}
                  aria-invalid={!!errors.document}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    // Aplica máscara on-change pra UX, mas Zod normaliza
                    // pra digits no boundary. Ambos lados consistentes.
                    const digits = normalizeDocument(e.target.value);
                    const cap = isCompany ? digits.slice(0, 14) : digits.slice(0, 11);
                    field.onChange(maskDocumentInput(cap, currentType));
                  }}
                  onBlur={field.onBlur}
                />
              );
            }}
          />
        </Field>

        <Field
          label="Telefone (com DDD)"
          htmlFor="cust-phone"
          error={errors.phone?.message}
          required
          hint="Use formato internacional com DDI: +5511999999999"
        >
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <Input
                id="cust-phone"
                placeholder="+5511999999999"
                inputMode="tel"
                disabled={isPending}
                aria-invalid={!!errors.phone}
                {...field}
              />
            )}
          />
        </Field>

        <Field label="E-mail (opcional)" htmlFor="cust-email" error={errors.email?.message}>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input
                id="cust-email"
                type="email"
                placeholder="maria@email.com"
                disabled={isPending}
                aria-invalid={!!errors.email}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>
      </FormCard>

      <FormCard
        title="Endereço (opcional)"
        description="Útil pra delivery e pra registrar venda balcão depois."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field
            label="Rua / Logradouro"
            htmlFor="cust-street"
            error={errors.addressStreet?.message}
          >
            <Controller
              name="addressStreet"
              control={control}
              render={({ field }) => (
                <Input
                  id="cust-street"
                  disabled={isPending}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field
            label="Número"
            htmlFor="cust-number"
            error={errors.addressNumber?.message}
          >
            <Controller
              name="addressNumber"
              control={control}
              render={({ field }) => (
                <Input
                  id="cust-number"
                  disabled={isPending}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        </div>

        <Field
          label="Complemento"
          htmlFor="cust-complement"
          error={errors.addressComplement?.message}
        >
          <Controller
            name="addressComplement"
            control={control}
            render={({ field }) => (
              <Input
                id="cust-complement"
                placeholder="Apto 101, fundos…"
                disabled={isPending}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>

        <Field
          label="Bairro"
          htmlFor="cust-neighborhood"
          error={errors.addressNeighborhood?.message}
        >
          <Controller
            name="addressNeighborhood"
            control={control}
            render={({ field }) => (
              <Input
                id="cust-neighborhood"
                disabled={isPending}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-[1fr_80px]">
          <Field label="Cidade" htmlFor="cust-city" error={errors.addressCity?.message}>
            <Controller
              name="addressCity"
              control={control}
              render={({ field }) => (
                <Input
                  id="cust-city"
                  disabled={isPending}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field label="UF" htmlFor="cust-state" error={errors.addressState?.message}>
            <Controller
              name="addressState"
              control={control}
              render={({ field }) => (
                <Input
                  id="cust-state"
                  maxLength={2}
                  placeholder="MA"
                  className="uppercase"
                  disabled={isPending}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
        </div>

        <Field
          label="CEP"
          htmlFor="cust-zip"
          error={errors.addressZip?.message}
          hint="Somente números (8 dígitos)"
        >
          <Controller
            name="addressZip"
            control={control}
            render={({ field }) => (
              <Input
                id="cust-zip"
                inputMode="numeric"
                placeholder="65725000"
                maxLength={8}
                disabled={isPending}
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>
      </FormCard>

      <FormCard
        title="Observações"
        description="Anotações livres pra você se lembrar. Cliente não vê."
      >
        <Controller
          name="notes"
          control={control}
          render={({ field }) => {
            const text = field.value ?? "";
            return (
              <div className="space-y-1.5">
                <Textarea
                  id="cust-notes"
                  rows={3}
                  maxLength={1000}
                  placeholder="Ex: prefere bijuteria dourada, compra pro marido em datas comemorativas, atrasou pagamento 1x…"
                  disabled={isPending}
                  aria-invalid={!!errors.notes}
                  value={text}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                />
                <div className="text-ink-4 flex justify-end text-xs">
                  <span className="tabular-nums">{text.length}/1000</span>
                </div>
                {errors.notes?.message ? (
                  <p className="text-destructive text-xs">{errors.notes.message}</p>
                ) : null}
              </div>
            );
          }}
        />
      </FormCard>

      {/* PP2 — quando embedded, drawer footer chama submit via submitRef. */}
      {embedded ? (
        <button
          ref={submitRef}
          type="submit"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
        >
          Salvar (dispatched by drawer footer)
        </button>
      ) : null}

      {/* Save desktop — escondido em modo embedded. */}
      {!embedded ? (
        <div className="hidden justify-end pt-4 lg:flex">
          <Button type="submit" disabled={isPending} className="min-w-32">
            {isPending ? (
              <>
                <Loader2Icon className="animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <SaveIcon /> {mode === "edit" ? "Salvar" : "Cadastrar"}
              </>
            )}
          </Button>
        </div>
      ) : null}

      {/* Save mobile sticky — escondido em modo embedded. */}
      {!embedded ? (
        <div
          className={cn("surface-elevated fixed inset-x-0 z-50 px-4 py-3 lg:hidden")}
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 3.5rem + 0.25rem)",
          }}
        >
          <Button type="submit" disabled={isPending} className="w-full" size="lg">
            {isPending ? (
              <>
                <Loader2Icon className="animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <SaveIcon /> {mode === "edit" ? "Salvar" : "Cadastrar"}
              </>
            )}
          </Button>
        </div>
      ) : null}

      {/* isDirty é só usado pra silenciar o lint quando o componente for
          mais conservador. Atualmente o botão é habilitado sempre (cliente
          novo precisa salvar mesmo sem mudar nada do default vazio). */}
      <div className="hidden" aria-hidden>
        {isDirty ? "dirty" : "clean"}
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, required, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[12.5px]">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-ink-4 text-[11px]">{hint}</p> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

interface FormCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function FormCard({ title, description, children }: FormCardProps) {
  return (
    <section className="b3-card p-4 sm:p-5">
      <header className="mb-4 space-y-0.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-ink-1">{title}</h2>
        {description ? (
          <p className="text-ink-4 text-xs leading-relaxed">{description}</p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
