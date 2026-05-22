"use client";

/**
 * ADR-0034 Camada 2 Onda D — Componente universal `<ReportLayout />`.
 *
 * Página A4 imprimível com header (logo + dados da loja), título,
 * período opcional, tabela densa com totais, e botões "Imprimir" +
 * "Exportar CSV". `window.print()` direto.
 *
 * Reaproveitado em (rotas que consomem esse pattern):
 *   - /admin/estoque/relatorio       (primeira aplicação — Camada 2)
 *   - /admin/relatorios/vendas/*     (Camada 5)
 *   - /admin/relatorios/margem/*     (Camada 5)
 *   - /admin/relatorios/dre/*        (Camada 5)
 *   - /admin/pedidos/[id]/relatorio  (alternativa A4 ao cupom térmico)
 *
 * Empresário varejo BR lida com PAPEL — usa relatório pra discutir com
 * contador/sócio/banco. ReportLayout é tão importante quanto export CSV.
 *
 * CSS print em globals.css via `@media print` esconde shell admin +
 * sidebar, mostra apenas .report-print-root em folha A4.
 */

import { DownloadIcon, PrinterIcon } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";

export type ColumnAlign = "left" | "right" | "center";

export interface ReportColumn<T> {
  /** Chave única — também usada como header da coluna em export CSV. */
  key: string;
  label: string;
  align?: ColumnAlign;
  /** Renderiza o valor da célula. Recebe row inteira. */
  render: (row: T) => React.ReactNode;
  /** Valor pra export CSV. Default usa render coerced via String(). */
  exportValue?: (row: T) => string | number;
  /** Largura sugerida (CSS — ex: "120px" ou "20%"). */
  width?: string;
  /** Esconder em modo print pra economizar espaço. */
  hideOnPrint?: boolean;
}

export interface ReportTotal {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface ReportStoreInfo {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  whatsapp?: string | null;
  /**
   * Sprint 4.1 — CNPJ ou CPF formatado pra impressão (já com pontuação).
   * `null` quando lojista ainda não cadastrou. Apenas exibido (não fiscal).
   */
  document?: string | null;
}

interface ReportLayoutProps<T> {
  title: string;
  /** Ex: "01/05/2026 a 19/05/2026". Opcional. */
  period?: string | null;
  storeInfo: ReportStoreInfo;
  columns: ReportColumn<T>[];
  rows: T[];
  /** Linha de totais no rodapé. Opcional. */
  totals?: ReportTotal[];
  /** Notas livres pro rodapé. Ex: "Gerado em 19/05/2026 13:45". */
  notes?: string;
  /** Nome do arquivo CSV (sem extensão). */
  csvFileName?: string;
  /** Mensagem mostrada quando rows vazio. */
  emptyMessage?: string;
  /**
   * Sprint 4.8 — operador que gerou o relatório. Aparece no rodapé
   * universal "Gerado em ... por {operador}". `null` = anônimo.
   */
  operatorName?: string | null;
}

function alignToClass(align?: ColumnAlign): string {
  switch (align) {
    case "right":
      return "text-right";
    case "center":
      return "text-center";
    default:
      return "text-left";
  }
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, content: string) {
  // BOM UTF-8 garante que Excel BR abre acentos corretamente.
  const blob = new Blob(["﻿" + content], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportLayout<T>({
  title,
  period,
  storeInfo,
  columns,
  rows,
  totals,
  notes,
  csvFileName,
  emptyMessage = "Nenhum dado pra exibir.",
  operatorName,
}: ReportLayoutProps<T>) {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportCsv = useCallback(() => {
    const header = columns.map((c) => escapeCsvCell(c.label)).join(";");
    const body = rows
      .map((row) =>
        columns
          .map((col) => {
            if (col.exportValue) {
              return escapeCsvCell(col.exportValue(row));
            }
            // Fallback: tenta render como string.
            const rendered = col.render(row);
            return escapeCsvCell(
              typeof rendered === "string" || typeof rendered === "number"
                ? rendered
                : "",
            );
          })
          .join(";"),
      )
      .join("\n");
    const csv = `${header}\n${body}`;
    downloadCsv(csvFileName ?? "relatorio", csv);
  }, [columns, rows, csvFileName]);

  return (
    <>
      {/* Toolbar (não vai pra impressão) */}
      <div className="report-toolbar mb-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleExportCsv}
          disabled={rows.length === 0}
        >
          <DownloadIcon className="size-3.5" /> Exportar CSV
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handlePrint}
          disabled={rows.length === 0}
        >
          <PrinterIcon className="size-3.5" /> Imprimir
        </Button>
      </div>

      <article className="report-print-root mx-auto max-w-[210mm] bg-white text-[11.5px] text-ink-1 shadow-sm print:max-w-full print:shadow-none">
        {/* Header — logo + dados da loja */}
        <header className="flex items-start justify-between gap-4 border-b border-ink-5 px-6 pb-3 pt-6 print:px-0">
          <div className="flex items-center gap-3">
            {storeInfo.logoUrl ? (
              // biome-ignore lint/performance/noImgElement: img nativa pra print
              <img
                src={storeInfo.logoUrl}
                alt={storeInfo.name}
                className="size-12 rounded object-contain"
              />
            ) : null}
            <div>
              <h1 className="text-[14px] font-semibold tracking-tight">
                {storeInfo.name}
              </h1>
              {storeInfo.document ? (
                <p className="font-mono text-[10.5px] leading-tight text-ink-3">
                  CNPJ/CPF: {storeInfo.document}
                </p>
              ) : null}
              {storeInfo.address ? (
                <p className="text-[10.5px] leading-tight text-ink-3">
                  {storeInfo.address}
                </p>
              ) : null}
              {storeInfo.whatsapp ? (
                <p className="text-[10.5px] leading-tight text-ink-3">
                  WhatsApp: {storeInfo.whatsapp}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-wide text-ink-4">
              Documento interno
            </p>
            <p className="text-[10px] text-ink-4">
              Este documento não tem valor fiscal.
            </p>
          </div>
        </header>

        {/* Title + period */}
        <div className="border-b border-ink-5 px-6 py-3 print:px-0">
          <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
          {period ? (
            <p className="text-[11px] text-ink-3">Período: {period}</p>
          ) : null}
        </div>

        {/* Tabela */}
        <div className="px-6 py-4 print:px-0">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-ink-3">{emptyMessage}</p>
          ) : (
            <table className="w-full border-collapse text-[11.5px] tabular-nums">
              <thead>
                <tr className="border-b border-ink-5">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`py-2 px-2 text-[10.5px] font-medium uppercase tracking-wide text-ink-3 ${alignToClass(col.align)} ${col.hideOnPrint ? "print:hidden" : ""}`}
                      style={col.width ? { width: col.width } : undefined}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-ink-5/40 print:break-inside-avoid"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`py-1.5 px-2 align-top ${alignToClass(col.align)} ${col.hideOnPrint ? "print:hidden" : ""}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {totals && totals.length > 0 ? (
                <tfoot>
                  <tr className="border-t-2 border-ink-2">
                    <td
                      colSpan={Math.max(1, columns.length - totals.length)}
                      className="pt-3 text-right text-[11px] font-medium uppercase tracking-wide text-ink-3"
                    >
                      Totais
                    </td>
                    {totals.map((t) => (
                      <td
                        key={t.label}
                        className={`pt-3 px-2 text-right ${t.emphasis ? "text-[13px] font-semibold" : "text-[11.5px] font-medium"}`}
                      >
                        <div className="text-[10px] uppercase tracking-wide text-ink-4">
                          {t.label}
                        </div>
                        <div>{t.value}</div>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          )}
        </div>

        {/* Rodapé universal — Sprint 4.8. "Gerado em DD/MM/AAAA HH:MM
            por {operador}". Contador de página renderizado APENAS na
            impressão via CSS counter(page) (regra em globals.css
            ".report-page-marker::after { content: counter(page); }").
            Sem "de Y" porque counter(pages) tem suporte inconsistente. */}
        <footer className="border-t border-ink-5 px-6 py-3 text-[10px] text-ink-4 print:px-0">
          {notes ? <p>{notes}</p> : null}
          <p className="mt-1">
            Gerado em{" "}
            {new Date().toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {operatorName ? ` por ${operatorName}` : ""}
            <span className="report-page-marker hidden print:inline">
              {" · Página "}
            </span>
          </p>
        </footer>
      </article>
    </>
  );
}
