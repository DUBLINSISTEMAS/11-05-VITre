/**
 * Validadores BR de CPF/CNPJ — ADR-0021.
 *
 * Camada APP: algoritmo dos dígitos verificadores (bloqueia 111.111.111-11
 * e similares sintáticos mas inválidos). Camada DB já garante length + só
 * dígitos via SQL 28; este módulo cobre o que o CHECK não consegue.
 *
 * Zero dependências externas — algoritmo dos dígitos verificadores é
 * padronizado e implementado em ~30 linhas cada. Manter inline evita um
 * `cpf-cnpj-validator` ou similar (overhead de bundle + supply chain).
 *
 * Convenção de armazenamento: `document` no DB tem só dígitos (sem máscara).
 * Mascara é UX (input + display). Sempre normalizar via `normalizeDocument`
 * antes de gravar/buscar.
 */

import type { CustomerType } from "@/db/schema";

/** Tira tudo que não for dígito. NULL/undefined → "" (Zod chama antes de validar). */
export function normalizeDocument(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

/**
 * Valida CPF pelo algoritmo da Receita Federal — 11 dígitos, 2 dígitos
 * verificadores calculados mod 11.
 *
 * Rejeita:
 *   - length ≠ 11
 *   - todos dígitos iguais (000.000.000-00, 111.111.111-11, …)
 *   - dígito verificador errado
 */
export function isValidCpf(raw: string): boolean {
  const cpf = normalizeDocument(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  if (mod !== Number(cpf[9])) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  if (mod !== Number(cpf[10])) return false;

  return true;
}

/**
 * Valida CNPJ pelo algoritmo da Receita Federal — 14 dígitos, 2 dígitos
 * verificadores com pesos circulares 2-9.
 *
 * Rejeita:
 *   - length ≠ 14
 *   - todos dígitos iguais
 *   - dígito verificador errado
 */
export function isValidCnpj(raw: string): boolean {
  const cnpj = normalizeDocument(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (slice: string): number => {
    let sum = 0;
    let weight = slice.length - 7;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calcDigit(cnpj.substring(0, 12));
  if (d1 !== Number(cnpj[12])) return false;

  const d2 = calcDigit(cnpj.substring(0, 13));
  if (d2 !== Number(cnpj[13])) return false;

  return true;
}

/**
 * Dispatcher por tipo. Usado no Zod `.refine()` da action.
 */
export function isValidDocument(raw: string, type: CustomerType): boolean {
  return type === "individual" ? isValidCpf(raw) : isValidCnpj(raw);
}

/**
 * Formata CPF como 999.999.999-99 ou CNPJ como 99.999.999/9999-99.
 * Display-only — nunca gravar formatado. NULL/inválido → "" pra não
 * vazar lixo na UI.
 */
export function formatDocument(
  raw: string | null | undefined,
  type: CustomerType,
): string {
  const doc = normalizeDocument(raw);
  if (!doc) return "";
  if (type === "individual" && doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if (type === "company" && doc.length === 14) {
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  // Length não bate com type — devolve só os dígitos (não trava UI).
  return doc;
}

/**
 * Máscara incremental para uso em input controlado. Recebe o valor parcial
 * digitado, devolve formatado até onde dá. Diferente de `formatDocument`
 * porque aceita strings incompletas.
 */
export function maskDocumentInput(raw: string, type: CustomerType): string {
  const d = normalizeDocument(raw);
  if (type === "individual") {
    // 999.999.999-99
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }
  // company — 99.999.999/9999-99
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}
