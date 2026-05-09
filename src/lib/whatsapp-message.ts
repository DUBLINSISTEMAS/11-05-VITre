/**
 * Builder da mensagem WhatsApp de pedido.
 *
 * Formato (ADR-0010):
 *   "Olá {storeName}! Sou {customerName}.
 *
 *    Quero finalizar este pedido:
 *
 *    📦 *2× Anel Solitário* — R$ 89,90
 *    ...
 *
 *    💰 *Total:* R$ 324,80
 *
 *    🔗 vitre.app/p/A7K2
 *
 *    Aguardo confirmação."
 *
 * Cap em ~1700 chars (margem de 200 do limite WhatsApp 2048). Se
 * estourar, lista é truncada e mostra "+ X itens em vitre.app/p/code".
 */
import { formatBRL } from "@/lib/pricing";

export interface WhatsAppItemInput {
  productName: string;
  variantName: string | null;
  quantity: number;
  priceInCents: number;
}

export interface BuildMessageInput {
  storeName: string;
  customerName: string;
  items: WhatsAppItemInput[];
  totalInCents: number;
  shortCode: string;
  publicUrl: string; // ex: "https://vitre.app/p/A7K2"
  customerNotes?: string;
}

const MAX_LENGTH = 1700;

/**
 * WhatsApp interpreta `*foo*` (bold), `_foo_` (italic), `~foo~` (strikethrough)
 * e `` `foo` `` (mono). Se o nome do cliente ou produto contém esses chars
 * (`Cris*tina`, `produto_v2`), o pareamento quebra a formatação do template
 * inteiro — usuário vê `*1× produto_v2*` virando texto solto.
 *
 * Substituímos por lookalikes Unicode visualmente idênticos que o WhatsApp
 * NÃO reconhece como marcadores. Sem perda perceptível pro lojista/cliente.
 */
function escapeWhatsAppFormatting(s: string): string {
  return s
    .replace(/\*/g, "\u2217") // ∗  ASTERISK OPERATOR
    .replace(/_/g, "\uFF3F") // ＿  FULLWIDTH LOW LINE
    .replace(/~/g, "\u223C") // ∼  TILDE OPERATOR
    .replace(/`/g, "\u2035"); // ‵  REVERSED PRIME
}

function formatItem(item: WhatsAppItemInput): string {
  const productName = escapeWhatsAppFormatting(item.productName);
  const variantName = item.variantName
    ? escapeWhatsAppFormatting(item.variantName)
    : null;
  const name = variantName ? `${productName} — ${variantName}` : productName;
  return `📦 *${item.quantity}× ${name}* — ${formatBRL(item.priceInCents * item.quantity)}`;
}

export function buildOrderMessage(input: BuildMessageInput): string {
  const safeStoreName = escapeWhatsAppFormatting(input.storeName);
  const safeCustomerName = escapeWhatsAppFormatting(input.customerName);

  const header = `Olá ${safeStoreName}! Sou ${safeCustomerName}.

Quero finalizar este pedido:`;

  const totalLine = `💰 *Total:* ${formatBRL(input.totalInCents)}`;
  const linkLine = `🔗 ${input.publicUrl}`;
  const notes = input.customerNotes?.trim()
    ? `📝 ${escapeWhatsAppFormatting(input.customerNotes.trim())}`
    : null;
  const footer = "Aguardo confirmação.";

  // Tenta com lista completa.
  const fullItemsBlock = input.items.map(formatItem).join("\n");
  const fullMessage = [
    header,
    "",
    fullItemsBlock,
    "",
    totalLine,
    notes,
    linkLine,
    "",
    footer,
  ]
    .filter(Boolean)
    .join("\n");

  if (fullMessage.length <= MAX_LENGTH) return fullMessage;

  // Trunca a lista. Vai adicionando itens até chegar perto do limite,
  // reservando espaço pro "+ X itens" e o resto da mensagem.
  let included = 0;
  const lines: string[] = [];
  for (const item of input.items) {
    const candidate = formatItem(item);
    const truncatedBlock = [...lines, candidate].join("\n");
    const trailing = `\n... + ${input.items.length - included - 1} itens em ${input.publicUrl}`;
    const candidateMessage = [
      header,
      "",
      truncatedBlock + trailing,
      "",
      totalLine,
      notes,
      linkLine,
      "",
      footer,
    ]
      .filter(Boolean)
      .join("\n");
    if (candidateMessage.length > MAX_LENGTH) break;
    lines.push(candidate);
    included += 1;
  }

  const remaining = input.items.length - included;
  const itemsBlock =
    remaining > 0
      ? lines.join("\n") +
        `\n... + ${remaining} ${remaining === 1 ? "item" : "itens"} em ${input.publicUrl}`
      : lines.join("\n");

  return [
    header,
    "",
    itemsBlock,
    "",
    totalLine,
    notes,
    linkLine,
    "",
    footer,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Constrói a URL `wa.me` final pronta pra abrir.
 *
 * `whatsappE164` deve estar no formato `+5599981757512`. wa.me aceita
 * a parte numérica sem o `+`.
 */
export function buildWhatsAppUrl(
  whatsappE164: string,
  message: string,
): string {
  const number = whatsappE164.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
