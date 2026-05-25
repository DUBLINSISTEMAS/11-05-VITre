/**
 * Util CSV — extraído de `components/admin/report/report-layout.tsx`
 * pra ser reusado por exports inline (toolbar de tabelas) além do
 * relatório universal. Handoff Passo 6 (2026-05-25).
 *
 * Convenção de separador: ponto-e-vírgula (`;`), padrão BR pra Excel
 * abrir corretamente com locale pt-BR sem precisar usar "Abrir como".
 * BOM UTF-8 (`﻿`) garante acentos preservados.
 */

export function escapeCsvCell(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Monta CSV a partir de cabeçalho + linhas já formatadas como string/number.
 * Cada row é um array do mesmo tamanho que `headers`.
 */
export function buildCsv(
  headers: string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
): string {
  const headerLine = headers.map(escapeCsvCell).join(";");
  const bodyLines = rows
    .map((row) => row.map(escapeCsvCell).join(";"))
    .join("\n");
  return `${headerLine}\n${bodyLines}`;
}

/**
 * Dispara download via Blob + anchor temporário. Client-only —
 * usa `document` e `URL.createObjectURL`. BOM UTF-8 incluído.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
