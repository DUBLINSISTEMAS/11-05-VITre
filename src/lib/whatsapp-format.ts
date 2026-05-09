/**
 * Validação e formatação de número WhatsApp.
 *
 * Aceita formatos comuns brasileiros (com/sem DDD, com/sem 9, com/sem +55).
 * Retorna E.164 (`+5599981757512`) e display (`(99) 98175-7512`).
 */
import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

export interface ParsedPhone {
  e164: string;
  display: string;
}

/**
 * Lança erro se o número não é válido como BR. Pra usar em validação de form.
 */
export function parseWhatsAppBR(input: string): ParsedPhone {
  const parsed = parsePhoneNumberFromString(input, "BR");
  if (!parsed || !parsed.isValid() || parsed.country !== "BR") {
    throw new Error("Número de WhatsApp inválido.");
  }
  return {
    e164: parsed.number, // +5599981757512
    display: parsed.formatNational(), // (99) 98175-7512
  };
}

/**
 * Validação leve para Zod refine — true/false.
 */
export function isValidWhatsAppBR(input: string): boolean {
  try {
    return isValidPhoneNumber(input, "BR");
  } catch {
    return false;
  }
}
