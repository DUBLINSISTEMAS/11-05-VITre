/**
 * Cupom térmico 80mm de venda — Sprint 4 (audit 2026-05-26).
 *
 * Layout linear, monospace, ~58 chars de largura útil em 80mm. Bate o
 * padrão "ESC/POS" visual do varejo BR (cupom de PDV de loja pequena).
 * NÃO emite bridge nativa ESC/POS — usa o print dialog do browser; quem
 * tem impressora térmica configurada no SO seleciona ela ali.
 *
 * Largura útil: ~70mm com 5mm de margem cada lado (ajustada via
 * `@page { size: 80mm auto }` no page.tsx).
 *
 * Render isomorphic — funciona como Server Component. Recebe o pedido
 * já hidratado pela page.
 */
import { PrintStoreHeader } from "@/components/admin/print/print-store-header";
import { formatBRL } from "@/lib/pricing";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Cartão débito",
  credit: "Cartão crédito",
  other: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  quote: "ORÇAMENTO",
  awaiting_whatsapp: "Aguardando contato",
  confirmed: "Confirmado",
  fulfilled: "Concluído",
  canceled: "Cancelado",
  expired: "Expirado",
  returned: "Devolvido",
};

interface ThermalItem {
  id: string;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  priceInCentsSnapshot: number;
  quantity: number;
  discountInCents: number | null;
}

interface ThermalPayment {
  id: string;
  method: string;
  amountInCents: number;
  cashReceivedInCents: number | null;
}

interface ThermalOrder {
  shortCode: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  customerNotes: string | null;
  totalInCents: number;
  discountInCents: number | null;
  surchargeInCents: number | null;
  quoteValidUntil: Date | null;
  createdAt: Date;
}

export interface SaleReceiptThermalProps {
  store: {
    name: string;
    slug: string;
    document: string | null;
    whatsappDisplay: string | null;
    logoUrl: string | null;
    addressStreet: string | null;
    addressNumber: string | null;
    addressNeighborhood: string | null;
    addressCity: string | null;
    addressState: string | null;
  };
  order: ThermalOrder;
  items: ThermalItem[];
  payments: ThermalPayment[];
}

export function SaleReceiptThermal({
  store,
  order,
  items,
  payments,
}: SaleReceiptThermalProps) {
  const subtotalGross = items.reduce(
    (s, it) => s + it.priceInCentsSnapshot * it.quantity,
    0,
  );
  const itemDiscountsTotal = items.reduce(
    (s, it) => s + (it.discountInCents ?? 0),
    0,
  );
  const subtotalNet = subtotalGross - itemDiscountsTotal;
  const orderDiscount = order.discountInCents ?? 0;
  const orderSurcharge = order.surchargeInCents ?? 0;
  const hasAdjustments =
    itemDiscountsTotal > 0 || orderDiscount > 0 || orderSurcharge > 0;
  const trocoTotal = payments.reduce((acc, p) => {
    if (
      p.method === "cash" &&
      p.cashReceivedInCents !== null &&
      p.cashReceivedInCents > p.amountInCents
    ) {
      return acc + (p.cashReceivedInCents - p.amountInCents);
    }
    return acc;
  }, 0);

  const itemCount = items.reduce((s, it) => s + it.quantity, 0);
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  const isQuote = order.status === "quote";

  return (
    <article
      className="thermal-receipt mx-auto bg-white text-black"
      style={{
        // Largura útil. Em print vira o size do @page (80mm).
        maxWidth: "72mm",
        padding: "8px 6px",
        fontFamily:
          "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
        fontSize: "11px",
        lineHeight: 1.35,
        color: "black",
      }}
    >
      <PrintStoreHeader store={store} variant="thermal" />

      <Divider />

      {/* Cabeçalho do documento */}
      <div className="text-center">
        <div style={{ fontSize: "12px", fontWeight: 700 }}>
          {isQuote ? "ORÇAMENTO" : "VENDA"} #{order.shortCode}
        </div>
        <div style={{ fontSize: "10.5px", marginTop: "1px" }}>
          {order.createdAt.toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </div>
        {!isQuote ? (
          <div
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginTop: "1px",
            }}
          >
            {statusLabel}
          </div>
        ) : null}
        {isQuote && order.quoteValidUntil ? (
          <div style={{ fontSize: "10.5px", marginTop: "1px" }}>
            Validade:{" "}
            {order.quoteValidUntil.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </div>
        ) : null}
      </div>

      <Divider />

      {/* Cliente */}
      <div>
        <Eyebrow>Cliente</Eyebrow>
        <div style={{ fontWeight: 600 }}>{order.customerName}</div>
        {order.customerPhone ? (
          <div style={{ fontSize: "10.5px" }}>{order.customerPhone}</div>
        ) : null}
      </div>

      {order.customerNotes ? (
        <>
          <div style={{ marginTop: "4px" }}>
            <Eyebrow>Observação</Eyebrow>
            <div
              style={{
                fontSize: "10.5px",
                whiteSpace: "pre-wrap",
              }}
            >
              {order.customerNotes}
            </div>
          </div>
        </>
      ) : null}

      <Divider />

      {/* Itens */}
      <div>
        <Eyebrow>Itens</Eyebrow>
        {items.map((it) => {
          const lineGross = it.priceInCentsSnapshot * it.quantity;
          const lineDiscount = it.discountInCents ?? 0;
          const lineNet = lineGross - lineDiscount;
          return (
            <div key={it.id} style={{ marginTop: "3px" }}>
              <div style={{ fontWeight: 500 }}>{it.productNameSnapshot}</div>
              {it.variantNameSnapshot ? (
                <div style={{ fontSize: "10px", color: "#444" }}>
                  {it.variantNameSnapshot}
                </div>
              ) : null}
              <Row
                left={`  ${it.quantity} x ${formatBRL(it.priceInCentsSnapshot)}`}
                right={formatBRL(lineNet)}
              />
              {lineDiscount > 0 ? (
                <Row
                  left="  desconto"
                  right={`-${formatBRL(lineDiscount)}`}
                  muted
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <Divider />

      {/* Totais */}
      <div>
        {hasAdjustments ? (
          <>
            <Row
              left={`${itemCount} ${itemCount === 1 ? "item" : "itens"}`}
              right={formatBRL(subtotalGross)}
            />
            {itemDiscountsTotal > 0 ? (
              <Row
                left="Desc. por item"
                right={`-${formatBRL(itemDiscountsTotal)}`}
                muted
              />
            ) : null}
            {itemDiscountsTotal > 0 ? (
              <Row left="Subtotal" right={formatBRL(subtotalNet)} muted />
            ) : null}
            {orderDiscount > 0 ? (
              <Row
                left="Desconto geral"
                right={`-${formatBRL(orderDiscount)}`}
                muted
              />
            ) : null}
            {orderSurcharge > 0 ? (
              <Row
                left="Acréscimo"
                right={`+${formatBRL(orderSurcharge)}`}
                muted
              />
            ) : null}
          </>
        ) : (
          <Row
            left={`${itemCount} ${itemCount === 1 ? "item" : "itens"}`}
            right=""
            muted
          />
        )}
        <Row
          left="TOTAL"
          right={formatBRL(order.totalInCents)}
          bold
          big
        />
      </div>

      {payments.length > 0 ? (
        <>
          <Divider />
          <div>
            <Eyebrow>
              {payments.length > 1 ? "Pagamentos" : "Pagamento"}
            </Eyebrow>
            {payments.map((p) => {
              const label = PAYMENT_LABELS[p.method] ?? p.method;
              return (
                <div key={p.id}>
                  <Row left={label} right={formatBRL(p.amountInCents)} />
                  {p.method === "cash" &&
                  p.cashReceivedInCents !== null &&
                  p.cashReceivedInCents > p.amountInCents ? (
                    <Row
                      left="  Recebido"
                      right={formatBRL(p.cashReceivedInCents)}
                      muted
                    />
                  ) : null}
                </div>
              );
            })}
            {trocoTotal > 0 ? (
              <Row
                left="Troco"
                right={formatBRL(trocoTotal)}
                bold
              />
            ) : null}
          </div>
        </>
      ) : null}

      <Divider />

      {/* Rodapé */}
      <div
        style={{
          textAlign: "center",
          fontSize: "10px",
          marginTop: "4px",
          color: "#333",
        }}
      >
        {isQuote ? (
          <div style={{ marginBottom: "4px", fontWeight: 600 }}>
            Documento apenas orçamento. Sem valor fiscal.
          </div>
        ) : null}
        <div>Obrigado pela preferência!</div>
        <div style={{ marginTop: "2px" }}>
          vitre.site/{store.slug}
        </div>
      </div>
    </article>
  );
}

/**
 * Linha texto-valor com left e right alinhados. Espaço entre eles via
 * flex; quebra de linha se left for muito longo. Padrão de cupom.
 */
function Row({
  left,
  right,
  bold,
  big,
  muted,
}: {
  left: string;
  right: string;
  bold?: boolean;
  big?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "8px",
        fontWeight: bold ? 700 : 400,
        fontSize: big ? "13px" : "11px",
        color: muted ? "#444" : "black",
        marginTop: big ? "3px" : 0,
      }}
    >
      <span style={{ whiteSpace: "pre" }}>{left}</span>
      <span style={{ whiteSpace: "nowrap" }}>{right}</span>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "9.5px",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: "#555",
        marginBottom: "2px",
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        borderTop: "1px dashed #888",
        margin: "6px 0",
      }}
      aria-hidden
    />
  );
}
