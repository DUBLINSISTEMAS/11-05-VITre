"use client";

/**
 * Sistema de impressão unificado (audit 2026-05-21).
 *
 * Antes desse componente, cada rota imprimível inventava seu próprio
 * <style>@media print</style> inline, header da loja, classes de
 * "esconder na impressão", etc. Resultado: inconsistência (cada doc
 * imprimia diferente), bugs (caixa imprimia chrome do admin), e
 * dificuldade de manter (mudar logo = editar 5 lugares).
 *
 * Solução: <PrintLayout> recebe `format` (a4 | thermal80) e
 * `documentType` (recibo, orçamento, fechamento, relatório), renderiza
 * o cabeçalho padrão da loja + seu próprio @page CSS + selo de
 * documento. Conteúdo do documento vai como children, sem se preocupar
 * com chrome de impressão.
 *
 * Formatos:
 *   - `a4`        — 210×297mm, margem 1.5cm, fonte sans, ideal pra
 *                   orçamento, relatório, pedido completo.
 *   - `thermal80` — 80mm × auto height, margem 0, mono, ideal pra
 *                   recibo balcão (impressora térmica Bematech/Elgin/Epson).
 *
 * Realidade de mercado:
 *   - 95% do uso em PDV é recibo térmico 80mm
 *   - 4% orçamento A4
 *   - 1% relatório A4
 *   - Térmicas USB ESC/POS (sem driver Windows) NÃO conseguem imprimir
 *     HTML/CSS — esses casos exigem ESC/POS binário, não atendido aqui.
 *     Térmica que aceita driver de sistema imprime nosso HTML normal.
 *
 * Limitação aceita: não escolhemos impressora via JS (não dá). Lojista
 * escolhe no diálogo do browser. Nosso trabalho é o documento aparecer
 * bonito independente do que ele escolher.
 */

import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PrintFormat = "a4" | "thermal80";

// Onda 1.7 (2026-05-22) — type identifier mantém "pedido" porque é
// chave técnica usada em vários callers (mudar quebraria call sites).
// Apenas o LABEL visível foi atualizado para "VENDA" (vocabulário canônico).
export type DocumentType =
  | "recibo"
  | "orcamento"
  | "fechamento"
  | "relatorio"
  | "pedido";

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  recibo: "RECIBO DE VENDA",
  orcamento: "ORÇAMENTO",
  fechamento: "FECHAMENTO DE CAIXA",
  relatorio: "RELATÓRIO",
  pedido: "VENDA",
};

const DOCUMENT_DISCLAIMER: Partial<Record<DocumentType, string>> = {
  // Per CLAUDE.md ADR-0033: Mangos Pay NÃO emite NF-e/NFC-e. Recibo,
  // orçamento, fechamento são documentos NÃO-FISCAIS — selo no rodapé
  // protege contra confusão jurídica/contábil.
  recibo: "Documento não-fiscal. NF emitida em sistema separado.",
  orcamento: "Apenas orçamento. Não tem valor fiscal nem efeito de venda.",
  fechamento:
    "Relatório gerencial. Não substitui livro caixa nem documento fiscal.",
};

export interface PrintStore {
  name: string;
  slug: string;
  /** CNPJ formatado (ou vazio se loja não preencheu). */
  cnpj?: string | null;
  /** Telefone (ou vazio). */
  phone?: string | null;
  /** Endereço completo em uma linha (ou null). */
  address?: string | null;
}

export interface PrintLayoutProps {
  format?: PrintFormat;
  documentType: DocumentType;
  /** Dados da loja pro cabeçalho padrão. */
  store: PrintStore;
  /** Nome do operador (lojista logado) — entra no "Gerado em…". */
  operatorName?: string | null;
  /** Identificador do documento (#shortCode, #orderId). Aparece logo
   *  abaixo do selo. */
  documentRef?: string | null;
  /** Auto-fire window.print() ao montar. Default true. */
  autoPrint?: boolean;
  /** Esconde botão "Imprimir novamente" (só faz sentido em tela). */
  hideRetryButton?: boolean;
  /** Conteúdo específico do documento (linhas de item, total, etc). */
  children: ReactNode;
}

/**
 * Wrapper de página imprimível. Renderiza:
 *   1. `<style>` específico do formato (size, margem, font)
 *   2. Botão "Imprimir novamente" (só na tela, hidden em print)
 *   3. Header padrão da loja (no topo do documento)
 *   4. Selo do tipo de documento (RECIBO / ORÇAMENTO / ...)
 *   5. `documentRef` em mono (se provided)
 *   6. {children} — conteúdo específico
 *   7. Footer com disclaimer + "Gerado em…"
 *
 * Format thermal80 aplica width fixo de 80mm e font mono compacto;
 * format a4 aplica margem 1.5cm e font sans normal.
 */
export function PrintLayout({
  format = "a4",
  documentType,
  store,
  operatorName,
  documentRef,
  autoPrint = true,
  hideRetryButton = false,
  children,
}: PrintLayoutProps) {
  useEffect(() => {
    if (!autoPrint) return;
    // Pequeno delay pra dar tempo do CSS @media print aplicar antes
    // do diálogo abrir (sem isso, o preview do navegador pode mostrar
    // o chrome do admin antes do CSS esconder).
    const id = window.setTimeout(() => window.print(), 200);
    return () => window.clearTimeout(id);
  }, [autoPrint]);

  const isThermal = format === "thermal80";
  const generatedAtLabel = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <>
      {/* CSS por formato — escopado em .print-layout pra não afetar resto */}
      <style>{getPrintCss(format)}</style>

      {/* Botão retry — só na tela, esconde em print */}
      {!hideRetryButton ? (
        <div className="sticky top-2 z-10 mx-auto flex max-w-[700px] justify-end px-4 py-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="b3-btn b3-btn--sm"
          >
            Imprimir novamente
          </button>
        </div>
      ) : null}

      {/* Container do documento. Classe `print-layout` é o marker
          principal — qualquer CSS @media print do globals usa pra
          identificar área imprimível. */}
      <article
        className={cn(
          "print-layout",
          isThermal ? "print-layout--thermal" : "print-layout--a4",
        )}
      >
        {/* ── Cabeçalho da loja — sempre no topo ── */}
        <header className="print-header">
          <div className="print-store-name">{store.name}</div>
          {store.cnpj || store.phone ? (
            <div className="print-store-meta">
              {[store.cnpj && `CNPJ ${store.cnpj}`, store.phone]
                .filter(Boolean)
                .join(" · ")}
            </div>
          ) : null}
          {store.address ? (
            <div className="print-store-meta">{store.address}</div>
          ) : null}
          <div className="print-store-meta mono">mangospay.app/{store.slug}</div>
        </header>

        {/* ── Selo do tipo de documento + ref ── */}
        <div className="print-stamp">
          <span className="print-stamp-type">{DOCUMENT_LABELS[documentType]}</span>
          {documentRef ? (
            <span className="print-stamp-ref mono">#{documentRef}</span>
          ) : null}
        </div>

        {/* ── Conteúdo específico do documento ── */}
        <div className="print-body">{children}</div>

        {/* ── Rodapé: disclaimer (se aplicável) + gerado em ── */}
        <footer className="print-footer">
          {DOCUMENT_DISCLAIMER[documentType] ? (
            <div className="print-footer-disclaimer">
              {DOCUMENT_DISCLAIMER[documentType]}
            </div>
          ) : null}
          <div className="print-footer-meta mono">
            Gerado em {generatedAtLabel}
            {operatorName ? ` por ${operatorName}` : ""}
          </div>
        </footer>
      </article>
    </>
  );
}

// =====================================================================
// CSS por formato — inline string injetada via <style>
// =====================================================================

function getPrintCss(format: PrintFormat): string {
  if (format === "thermal80") {
    return `
      .print-layout {
        font-family: "Geist Mono", ui-monospace, "Courier New", monospace;
        font-size: 11.5px;
        line-height: 1.4;
        color: black;
        background: white;
        max-width: 80mm;
        margin: 0 auto;
        padding: 8px 6px;
      }
      .print-header { text-align: center; padding-bottom: 6px; border-bottom: 1px dashed #000; }
      .print-store-name { font-size: 13px; font-weight: 700; }
      .print-store-meta { font-size: 10.5px; margin-top: 1px; }
      .print-stamp {
        margin-top: 6px;
        text-align: center;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .print-stamp-ref { display: block; font-size: 10.5px; font-weight: 400; margin-top: 2px; }
      .print-body { margin-top: 8px; }
      .print-footer {
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px dashed #000;
        text-align: center;
        font-size: 10px;
      }
      .print-footer-disclaimer { margin-bottom: 3px; }
      .print-footer-meta { color: #444; }
      .mono { font-family: inherit; }

      @media print {
        @page { size: 80mm auto; margin: 0; }
        body { background: white !important; margin: 0 !important; padding: 0 !important; }
        .print-layout { max-width: 100% !important; padding: 4mm 2mm !important; }
      }
    `;
  }

  // A4 (default)
  return `
    .print-layout {
      font-family: "Geist", system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: black;
      background: white;
      max-width: 700px;
      margin: 0 auto;
      padding: 24px;
    }
    .print-header { text-align: center; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.2); }
    .print-store-name { font-size: 17px; font-weight: 700; letter-spacing: -0.3px; }
    .print-store-meta { font-size: 12px; color: rgba(0,0,0,0.6); margin-top: 2px; }
    .print-stamp {
      margin-top: 14px;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-bottom: 6px;
      border-bottom: 1px dashed rgba(0,0,0,0.3);
    }
    .print-stamp-type {
      font-family: "Geist Mono", ui-monospace, monospace;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: rgba(0,0,0,0.7);
    }
    .print-stamp-ref {
      font-family: "Geist Mono", ui-monospace, monospace;
      font-size: 13px;
      font-weight: 600;
      color: black;
    }
    .print-body { margin-top: 14px; }
    .print-footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid rgba(0,0,0,0.2);
      text-align: center;
      font-size: 11px;
      color: rgba(0,0,0,0.55);
    }
    .print-footer-disclaimer { margin-bottom: 4px; font-style: italic; }
    .print-footer-meta { font-family: "Geist Mono", ui-monospace, monospace; }
    .mono { font-family: "Geist Mono", ui-monospace, monospace; }

    @media print {
      @page { size: A4; margin: 1.5cm; }
      body { background: white !important; }
      .print-layout {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  `;
}
