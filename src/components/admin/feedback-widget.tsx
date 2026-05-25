"use client";

// Widget flutuante de feedback — handoff Passo 14 (2026-05-25).
//
// Botão ✦ amarelo no canto inferior-direito do admin + Sheet drawer com
// formulário (4 tipos · mensagem · contexto auto-preenchido do lojista).
// Mounted uma vez no admin-shell. Não aparece em mobile (visualmente
// poluiria o bottom-nav virtual + storefront iframe).
//
// Régua "funciona ou esconde": o envio é REAL (Resend → suporte@mangospay.app).
// Não persiste em DB pra não pedir schema change no meio da Fase 2.

import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  HeartIcon,
  Loader2Icon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitFeedback } from "@/actions/feedback/submit";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FeedbackType = "idea" | "bug" | "feature" | "praise";

interface FeedbackWidgetProps {
  ownerName: string;
  ownerEmail: string;
  storeName: string;
}

const TYPES: ReadonlyArray<{
  k: FeedbackType;
  label: string;
  Icon: typeof SparklesIcon;
  accent: "yellow" | "danger" | "green" | "ok";
}> = [
  { k: "idea", label: "Ideia", Icon: SparklesIcon, accent: "yellow" },
  { k: "bug", label: "Erro / bug", Icon: AlertTriangleIcon, accent: "danger" },
  { k: "feature", label: "Pedido", Icon: PlusIcon, accent: "green" },
  { k: "praise", label: "Elogio", Icon: HeartIcon, accent: "ok" },
];

const PLACEHOLDERS: Record<FeedbackType, string> = {
  idea: "Conta o que você imaginou…",
  bug: "O que aconteceu? Em qual tela? Como reproduzir?",
  feature: "O que você gostaria que o sistema fizesse?",
  praise: "Manda o elogio aí 😊",
};

export function FeedbackWidget({
  ownerName,
  ownerEmail,
  storeName,
}: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("idea");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Reset ao abrir/fechar.
  useEffect(() => {
    if (open) {
      setMessage("");
      setType("idea");
      setSent(false);
    }
  }, [open]);

  const canSubmit = !isPending && message.trim().length >= 8;

  const handleSubmit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await submitFeedback({ type, message });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSent(true);
      toast.success("Feedback enviado pro time Mangos. Obrigado!");
      setTimeout(() => setOpen(false), 1800);
    });
  };

  return (
    <>
      {/* Botão flutuante — só desktop (sm+). No mobile o bottom-nav do
          admin (header.tsx) já ocupa o canto inferior. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mandar feedback pro time Mangos"
        title="Mandar feedback pro time Mangos"
        className={cn(
          "hidden sm:inline-flex",
          "fixed bottom-5 right-5 z-40 size-12 items-center justify-center rounded-full",
          "border-0 outline-none transition-transform duration-200 hover:scale-105",
          "focus-visible:ring-2 focus-visible:ring-mangos-yellow/60 focus-visible:ring-offset-2",
        )}
        style={{
          background: "var(--mangos-yellow)",
          color: "var(--mangos-green-950)",
          boxShadow:
            "0 10px 30px -6px rgba(13,47,43,0.3), 0 4px 10px -2px rgba(246,183,60,0.4)",
        }}
      >
        <SparklesIcon className="size-5" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="border-line shrink-0 gap-0 border-b px-5 py-4">
            <div className="flex items-center gap-3">
              <div
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-[10px]"
                style={{
                  background: "var(--mangos-yellow)",
                  color: "var(--mangos-green-950)",
                }}
              >
                <SparklesIcon className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-ink-1 text-[15px] font-semibold tracking-tight">
                  Manda um feedback
                </SheetTitle>
                <SheetDescription className="text-ink-4 text-[12px]">
                  Vai direto pra equipe do Mangos. A gente lê todos.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {sent ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div
                aria-hidden
                className="grid size-16 place-items-center rounded-full"
                style={{
                  background: "var(--mangos-green-100)",
                  color: "var(--mangos-green-800)",
                }}
              >
                <CheckIcon className="size-7" aria-hidden />
              </div>
              <div>
                <p className="text-ink-1 text-[17px] font-bold">Recebido!</p>
                <p className="text-ink-3 mt-1 max-w-[280px] text-[13.5px]">
                  Se for algo que precisa de resposta, te chamamos no email
                  cadastrado em até 1 dia útil.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="space-y-2">
                <p className="text-ink-2 text-[12px] font-semibold">Tipo</p>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map((t) => {
                    const isActive = type === t.k;
                    const cls = isActive
                      ? t.accent === "yellow"
                        ? "border-mangos-yellow text-mangos-yellow-deep bg-mangos-yellow-soft"
                        : t.accent === "danger"
                          ? "border-danger text-danger bg-danger-wash"
                          : t.accent === "green"
                            ? "border-mangos-green-800 text-mangos-green-900 bg-mangos-cream-soft"
                            : "border-ok text-ok bg-ok-wash"
                      : "border-line bg-surface text-ink-1 hover:bg-bg-app";
                    return (
                      <button
                        key={t.k}
                        type="button"
                        onClick={() => setType(t.k)}
                        className={cn(
                          "flex items-center gap-2 rounded-[10px] border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition",
                          cls,
                        )}
                      >
                        <t.Icon className="size-3.5" aria-hidden />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="feedback-message"
                  className="text-ink-2 text-[12px] font-semibold"
                >
                  Sua mensagem
                </label>
                <Textarea
                  id="feedback-message"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={PLACEHOLDERS[type]}
                  className="min-h-[140px] resize-vertical"
                  maxLength={4000}
                  autoFocus
                  disabled={isPending}
                />
                <p className="text-ink-4 text-[11px]">
                  Mínimo 8 caracteres. Vale anexar prints depois por email.
                </p>
              </div>

              <div
                className="rounded-[10px] p-3"
                style={{
                  background: "var(--mangos-cream-soft)",
                  border: "1px solid var(--brand-line)",
                }}
              >
                <p className="text-eyebrow">De</p>
                <p className="text-ink-1 mt-1 text-[13px] font-semibold">
                  {ownerName} · {storeName}
                </p>
                <p className="text-ink-4 font-mono text-[11.5px]">
                  {ownerEmail}
                </p>
              </div>
            </div>
          )}

          {!sent ? (
            <SheetFooter className="border-line bg-surface shrink-0 flex-row items-center gap-2 border-t p-4">
              <p className="text-ink-4 text-[11px] mr-auto">
                Lemos tudo · resposta em até 1 dia útil
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="b3-btn b3-btn--sm"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  "b3-btn b3-btn--sm b3-btn--primary",
                  !canSubmit && "opacity-50 cursor-not-allowed",
                )}
              >
                {isPending ? (
                  <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <ArrowRightIcon className="size-3.5" aria-hidden />
                )}
                Enviar
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="sr-only"
              >
                <XIcon size={14} />
              </button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
