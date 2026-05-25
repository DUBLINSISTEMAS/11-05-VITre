"use client";

/**
 * Botão "Importar CSV" do header de /admin/produtos — handoff PP11
 * (2026-05-25). Stub honesto: o botão aparece pra bater 1:1 o protótipo
 * (produtos.jsx linha 30) e abre Dialog explicando o que vai acontecer
 * quando a implementação real entrar.
 *
 * Decisão: schema + server action de createProductFromValues + ZodSchema
 * já existem. Falta UI tabular (parser CSV + preview por linha +
 * validação + execução em batch). Real implementation = PP11.x.
 *
 * Régua "funciona-ou-esconde" temporariamente suspensa durante a onda
 * PP (memory: pixel-perfect-redesign-decisao-2026-05-25).
 */
import { DownloadIcon, UploadIcon } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ImportCsvStubButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="b3-btn b3-btn--sm"
        aria-label="Importar produtos de CSV"
        title="Importar produtos de CSV"
      >
        <UploadIcon size={13} aria-hidden />
        <span className="hidden sm:inline">Importar CSV</span>
        <span className="sm:hidden">CSV</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Importar produtos em lote</DialogTitle>
                <DialogDescription className="mt-1">
                  Sobe planilha CSV com nome, preço, custo, categoria,
                  estoque inicial. Cada linha vira um produto.
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
                <li>Você baixa o template CSV com as colunas certas.</li>
                <li>Preenche cada linha = um produto (nome, preço, custo, etc).</li>
                <li>
                  Sobe o arquivo aqui — mostramos preview com validação por
                  linha (categoria existe? preço {">"} 0?).
                </li>
                <li>Confirma — produtos entram em batch (commit por linha).</li>
              </ol>
            </div>

            <p className="text-ink-4 text-[12px] leading-relaxed">
              <strong>Por que ainda não:</strong> o cadastro individual de
              produto via drawer 6 abas (PP1) está fluido o suficiente pros
              primeiros 30 SKUs. Quem chega com 100+ produtos de uma vez
              (migrando de GFIL/Bling/Tiny) é exatamente quem precisa
              dessa feature — implementação fica pra PP11.x quando o
              primeiro caso real apertar.
            </p>

            <button
              type="button"
              className="b3-btn b3-btn--sm w-full opacity-60 cursor-not-allowed"
              disabled
              title="Disponível em breve"
            >
              <DownloadIcon size={13} aria-hidden />
              Baixar template CSV (em breve)
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
