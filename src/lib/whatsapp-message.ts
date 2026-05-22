/**
 * Builder da mensagem WhatsApp de pedido.
 *
 * Dois modos:
 *  - `buildOrderMessage`: layout fixo do sistema (default Mangos Pay).
 *  - `buildOrderMessageFromTemplate`: template editável pelo lojista
 *    no /admin/configuracoes (Onda 6 — 2026-05-13). Suporta placeholders:
 *      {cliente}, {loja}, {itens}, {total}, {codigo}, {link}, {observacoes}
 *
 * Cap em ~1700 chars (margem de 200 do limite WhatsApp 2048). Se
 * estourar, lista é truncada e mostra "+ X itens em mangospay.app/p/code".
 */
import { formatBRL } from "@/lib/pricing";

/**
 * Template default. Lojista vê isto como exemplo no admin e pode
 * editar. Mantemos exatamente o layout que `buildOrderMessage` produz
 * pra não haver regressão silenciosa pra lojas pré-Onda 6.
 */
export const DEFAULT_WHATSAPP_TEMPLATE = `Olá {loja}! Sou {cliente}.

Quero finalizar este pedido:

{itens}

💰 *Total:* {total}
{observacoes}
🔗 {link}

Aguardo confirmação.`;

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
  publicUrl: string; // ex: "https://mangospay.app/p/A7K2"
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

// ===========================================================================
// Template editável (Onda 6 — 2026-05-13)
// ===========================================================================

export interface RenderTemplateInput {
  template: string | null;
  storeName: string;
  customerName: string;
  items: WhatsAppItemInput[];
  totalInCents: number;
  shortCode: string;
  publicUrl: string;
  customerNotes?: string;
  /**
   * Texto livre de "como pagar" configurado pela lojista
   * (`storeTable.paymentMethodsNote`). Quando o template usa o
   * placeholder `{formaPagamento}` e este campo está preenchido,
   * é substituído pelo texto; senão substitui por string vazia.
   * Fase 2 — ADR-0013.
   */
  paymentMethodsNote?: string | null;
}

/**
 * Renderiza o template do lojista substituindo placeholders. Quando
 * `template` é null/empty, cai pro `DEFAULT_WHATSAPP_TEMPLATE`.
 *
 * Placeholders (case-sensitive):
 *  - `{cliente}`        → safeCustomerName (escape de markdown)
 *  - `{loja}`           → safeStoreName
 *  - `{itens}`          → lista formatada (📦 *Nx ProdutoVar* — R$ 99,00)
 *  - `{total}`          → "R$ 324,80"
 *  - `{codigo}`         → "ABCD" (shortCode)
 *  - `{link}`           → URL pública do pedido
 *  - `{observacoes}`    → "📝 obs do cliente" ou linha vazia
 *  - `{formaPagamento}` → texto livre de "como pagar" (storeTable.payment
 *                         MethodsNote) ou string vazia se não configurado.
 *                         Fase 2 — ADR-0013.
 *
 * Trunca itens (e renderiza "+ X itens em link") se o resultado passar
 * de MAX_LENGTH. Mesma lógica do builder default.
 */
export function buildOrderMessageFromTemplate(
  input: RenderTemplateInput,
): string {
  const tpl =
    input.template && input.template.trim().length > 0
      ? input.template
      : DEFAULT_WHATSAPP_TEMPLATE;

  const safeStoreName = escapeWhatsAppFormatting(input.storeName);
  const safeCustomerName = escapeWhatsAppFormatting(input.customerName);
  const notes = input.customerNotes?.trim()
    ? `📝 ${escapeWhatsAppFormatting(input.customerNotes.trim())}`
    : "";
  const paymentNote = input.paymentMethodsNote?.trim()
    ? escapeWhatsAppFormatting(input.paymentMethodsNote.trim())
    : "";

  const render = (itemsBlock: string) =>
    tpl
      .replaceAll("{cliente}", safeCustomerName)
      .replaceAll("{loja}", safeStoreName)
      .replaceAll("{itens}", itemsBlock)
      .replaceAll("{total}", formatBRL(input.totalInCents))
      .replaceAll("{codigo}", input.shortCode)
      .replaceAll("{link}", input.publicUrl)
      .replaceAll("{observacoes}", notes)
      .replaceAll("{formaPagamento}", paymentNote)
      // Limpa linhas em branco resultantes de placeholders vazios.
      .replace(/\n{3,}/g, "\n\n");

  // Tenta com todos os itens.
  const fullItemsBlock = input.items.map(formatItem).join("\n");
  const full = render(fullItemsBlock);
  if (full.length <= MAX_LENGTH) return full;

  // Trunca lista de itens, reservando espaço pro resto da mensagem.
  let included = 0;
  const lines: string[] = [];
  for (const item of input.items) {
    const candidate = formatItem(item);
    const truncatedBlock = [...lines, candidate].join("\n");
    const remaining = input.items.length - included - 1;
    const withTrailing =
      remaining > 0
        ? `${truncatedBlock}\n... + ${remaining} ${remaining === 1 ? "item" : "itens"} em ${input.publicUrl}`
        : truncatedBlock;
    if (render(withTrailing).length > MAX_LENGTH) break;
    lines.push(candidate);
    included += 1;
  }

  const finalRemaining = input.items.length - included;
  const itemsBlock =
    finalRemaining > 0
      ? `${lines.join("\n")}\n... + ${finalRemaining} ${finalRemaining === 1 ? "item" : "itens"} em ${input.publicUrl}`
      : lines.join("\n");

  return render(itemsBlock);
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
