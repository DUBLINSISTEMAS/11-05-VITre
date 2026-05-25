"use client";

/**
 * Botão "Mensagem em lote" do header de /admin/clientes — handoff PP12
 * (2026-05-25). Stub honesto: o botão aparece pra bater 1:1 o protótipo
 * (clientes.jsx linha 15) e abre Dialog explicando como vai funcionar.
 *
 * Decisão: schema (customer.phone E.164) + helpers (wa.me builder) já
 * existem. Falta UI (multi-select na tabela + template editor com
 * placeholders + execução em fila). Real implementation = PP12.x.
 *
 * Régua "funciona-ou-esconde" temporariamente suspensa durante a onda
 * PP (memory: pixel-perfect-redesign-decisao-2026-05-25).
 */
import { MessageCircleIcon } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BulkWhatsappStubButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="b3-btn b3-btn--sm"
        aria-label="Mandar mensagem em lote pelo WhatsApp"
        title="Mandar mensagem em lote pelo WhatsApp"
      >
        <MessageCircleIcon size={13} aria-hidden />
        <span className="hidden sm:inline">Mensagem em lote</span>
        <span className="sm:hidden">WhatsApp</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Mensagem em lote pelo WhatsApp</DialogTitle>
                <DialogDescription className="mt-1">
                  Selecione clientes na tabela + escreva uma mensagem
                  template + mandamos via WhatsApp (uma conversa por
                  cliente).
                </DialogDescription>
              </div>
              <span
                className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: "var(--mangos-yellow-soft)",
                  color: "var(--mangos-yellow-deep)",
                }}
              >
                Em construção
              </span>
            </div>
          </DialogHeader>

          <div className="space-y-3">
            <div
              className="rounded-[10px] p-4"
              style={{
                background: "var(--mangos-cream-soft)",
                border: "1px solid var(--brand-line)",
              }}
            >
              <p className="text-ink-2 text-[13px] font-semibold">
                Como vai funcionar
              </p>
              <ol className="text-ink-3 mt-2 space-y-1.5 text-[12.5px] list-decimal pl-4">
                <li>
                  Marca check nos clientes da tabela (multi-select bulk
                  toolbar aparece em baixo).
                </li>
                <li>
                  Escreve a mensagem template — placeholders
                  <code className="text-mangos-green-800 ml-1">
                    {"{nome}"}
                  </code>
                  ,{" "}
                  <code className="text-mangos-green-800">
                    {"{ultima_compra}"}
                  </code>{" "}
                  são substituídos por cliente.
                </li>
                <li>Confirma — abre 1 aba do WhatsApp Web por cliente
                  (você manda enviar enter pra cada). Sem mandar em
                  massa via API (ToS do WhatsApp).</li>
              </ol>
            </div>

            <p className="text-ink-4 text-[12px] leading-relaxed">
              <strong>Por que ainda não:</strong> manda mensagem em
              massa requer cuidado pra não virar SPAM (WhatsApp baniu
              contas de lojistas em 2025 por isso). Implementação
              correta exige preview com confirmação cliente-por-cliente,
              não disparo cego. PP12.x quando a feature for prioridade
              real — hoje o lojista usa o ícone WhatsApp da linha do
              cliente individualmente.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
