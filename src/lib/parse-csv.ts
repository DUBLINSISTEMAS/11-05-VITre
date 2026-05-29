/**
 * Bloco I.8 (2026-05-29) — parser CSV RFC 4180-light pra import de clientes.
 *
 * Suporta:
 *   - aspas duplas envolvendo campo (com vírgula/quebra de linha dentro).
 *   - `""` como escape de `"` dentro de campo aspado.
 *   - delimitador `,` ou `;` (autodetect na primeira linha não-aspada).
 *   - `\n`, `\r\n`, `\r` como quebras de linha.
 *   - BOM UTF-8 inicial removido.
 *
 * Não suporta (e não precisamos hoje):
 *   - delimitadores customizados além de , e ;
 *   - linhas comentadas
 *   - múltiplos schemas no mesmo arquivo
 *
 * Loja média importa ≤500 linhas — performance trivial.
 */

export interface ParsedCSV {
  /** Header normalizado (trim + lowercase). Vazio se arquivo só tem 1 linha. */
  header: string[];
  /** Rows como arrays de strings (ordem do header). */
  rows: string[][];
}

function detectDelimiter(firstNonEmptyLine: string): "," | ";" {
  // Conta fora de aspas. Heurística simples — quem aparecer mais vence,
  // com tiebreaker pra ';' (mais comum em CSVs BR exportados do Excel pt-BR).
  let inQuote = false;
  let commas = 0;
  let semis = 0;
  for (let i = 0; i < firstNonEmptyLine.length; i++) {
    const ch = firstNonEmptyLine[i];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;
    if (ch === ",") commas++;
    else if (ch === ";") semis++;
  }
  if (semis > commas) return ";";
  return ",";
}

export function parseCSV(input: string): ParsedCSV {
  // Strip BOM se presente.
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  // Primeira linha não vazia pra detectar delimitador.
  const probeLine = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  const delim = detectDelimiter(probeLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      continue;
    }
    if (ch === delim) {
      pushField();
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      continue;
    }
    field += ch;
  }
  // Flush final.
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  // Remove linhas totalmente vazias.
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) {
    return { header: [], rows: [] };
  }
  const [headerRow, ...dataRows] = nonEmpty;
  const header = headerRow.map((h) => h.trim().toLowerCase());
  return { header, rows: dataRows };
}

/**
 * Mapeia header genérico do CSV pra chaves do customerSchema. Aceita
 * sinônimos PT-BR/EN comuns. Retorna mapa { schemaKey → indexNoHeader }.
 *
 * Headers reconhecidos:
 *   name      ← name, nome
 *   phone     ← phone, telefone, whatsapp, celular
 *   email     ← email, e-mail
 *   document  ← document, documento, cpf, cnpj, cpf/cnpj
 *   addressCity   ← cidade, city
 *   addressState  ← estado, uf, state
 *   notes     ← notes, observacoes, observações, obs
 */
const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "nome"],
  phone: ["phone", "telefone", "whatsapp", "celular", "tel"],
  email: ["email", "e-mail", "e mail"],
  document: ["document", "documento", "cpf", "cnpj", "cpf/cnpj", "cpf cnpj"],
  addressCity: ["cidade", "city", "endereço cidade", "endereco cidade"],
  addressState: ["estado", "uf", "state", "endereço uf", "endereco uf"],
  notes: ["notes", "observacoes", "observações", "obs", "observacao"],
};

export function mapHeaderToSchema(
  header: string[],
): Partial<Record<string, number>> {
  const map: Partial<Record<string, number>> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[key] = idx;
  }
  return map;
}
