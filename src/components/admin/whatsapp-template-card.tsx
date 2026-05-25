"use client";

/**
 * Card de configuração do template WhatsApp — /admin/configuracoes.
 *
 * Onda 6 (2026-05-13). Lojista edita a mensagem que vai chegar no
 * WhatsApp dele quando um cliente finaliza um pedido. Sem custo de
 * setup: o default do sistema já funciona; este card é "power user".
 *
 * Placeholders disponíveis (chips clicáveis abaixo do textarea):
 *  - {cliente}     — nome digitado pelo cliente no checkout
 *  - {loja}        — nome da loja
 *  - {itens}       — lista formatada com 📦 *Nx Produto* — preço
 *  - {total}       — total em R$
 *  - {codigo}      — código curto do pedido (ABCD)
 *  - {link}        — URL pública do pedido (mangospay.app/p/xxxx)
 *  - {observacoes} — "📝 obs do cliente" ou linha vazia
 */
import { CopyIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateWhatsAppTemplate } from "@/actions/store/update-whatsapp-template";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildOrderMessageFromTemplate,
  DEFAULT_WHATSAPP_TEMPLATE,
} from "@/lib/whatsapp-message";

const PLACEHOLDERS: Array<{ token: string; label: string }> = [
  { token: "{cliente}", label: "nome do cliente" },
  { token: "{loja}", label: "nome da loja" },
  { token: "{itens}", label: "lista de produtos" },
  { token: "{subtotal}", label: "subtotal antes do cupom" },
  { token: "{desconto}", label: "linha do desconto (cupom)" },
  { token: "{total}", label: "total final em R$" },
  { token: "{codigo}", label: "código do pedido" },
  { token: "{link}", label: "link do pedido" },
  { token: "{observacoes}", label: "obs do cliente" },
];

interface WhatsAppTemplateCardProps {
  initialTemplate: string | null;
}

export function WhatsAppTemplateCard({
  initialTemplate,
}: WhatsAppTemplateCardProps) {
  const [value, setValue] = useState<string>(
    initialTemplate ?? DEFAULT_WHATSAPP_TEMPLATE,
  );
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(
    initialTemplate,
  );
  const [isPending, startTransition] = useTransition();

  // Estado "sujo" se diferente do que está no banco. O banco guarda null
  // pra default; comparamos o valor renderizado com o snapshot.
  const currentNullish = value.trim() === DEFAULT_WHATSAPP_TEMPLATE.trim();
  const savedRendered = savedSnapshot ?? DEFAULT_WHATSAPP_TEMPLATE;
  const isDirty = value !== savedRendered;

  const preview = buildOrderMessageFromTemplate({
    template: currentNullish ? null : value,
    storeName: "Sandra Brito Collection",
    customerName: "Maria",
    items: [
      {
        productName: "Vestido Linho",
        variantName: "P",
        quantity: 1,
        priceInCents: 18990,
      },
      {
        productName: "Brinco Pérola",
        variantName: null,
        quantity: 2,
        priceInCents: 7990,
      },
    ],
    // Total final (pós-cupom MAIO10 de 10% no exemplo) + subtotal/desconto
    // pra preview mostrar como fica o fluxo com cupom. Linha "💸 Desconto"
    // é auto-inserida acima do total em templates legados.
    totalInCents: 31473,
    subtotalInCents: 34970,
    discountInCents: 3497,
    shortCode: "A7K2",
    publicUrl: "https://mangospay.app/p/exemplo",
    customerNotes: "Retirar no fim da tarde.",
    // Preview do placeholder {formaPagamento} — não puxa do banco aqui
    // (template-card é client puro), só ilustra como ficaria quando
    // lojista configurar em /admin/configuracoes (seção Pagamento).
    paymentMethodsNote:
      "PIX, dinheiro ou cartão (até 10x). Combine pelo WhatsApp.",
  });

  const handleSave = () => {
    // Quando lojista voltou ao default, salva como null pra herdar
    // atualizações futuras do sistema.
    const payload = currentNullish ? null : value;
    startTransition(async () => {
      const res = await updateWhatsAppTemplate({ template: payload });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSavedSnapshot(payload);
      toast.success(
        payload == null
          ? "Template restaurado pro padrão Mangos Pay."
          : "Template salvo.",
      );
    });
  };

  const handleReset = () => {
    setValue(DEFAULT_WHATSAPP_TEMPLATE);
  };

  const handleInsertPlaceholder = (token: string) => {
    setValue((prev) => `${prev}${prev.endsWith(" ") || prev.length === 0 ? "" : " "}${token}`);
  };

  return (
    <section className="b3-card p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink-1">
          Mensagem da venda (WhatsApp)
        </h2>
        <p className="text-ink-4 mt-1 text-[12.5px] leading-relaxed">
          Esta é a mensagem que CHEGA NO SEU WHATSAPP quando um cliente
          finaliza a compra. Edite à vontade. Use os placeholders abaixo
          pra inserir nome do cliente, total, etc.
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="whatsapp-template" className="text-[12.5px]">
          Template
        </Label>
        <Textarea
          id="whatsapp-template"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={12}
          disabled={isPending}
          className="font-mono text-[12.5px] leading-relaxed"
          spellCheck={false}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PLACEHOLDERS.map((p) => (
          <button
            key={p.token}
            type="button"
            onClick={() => handleInsertPlaceholder(p.token)}
            className="hocus:bg-bg-app inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-ink-1 transition-colors"
            title={`Inserir ${p.token} — ${p.label}`}
          >
            <CopyIcon className="size-3 opacity-60" aria-hidden />
            {p.token}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-bg-app p-3">
        <div className="mb-2 text-[12px] font-semibold text-ink-1">
          Prévia da mensagem
        </div>
        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-3">
          {preview}
        </pre>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={isPending}
        >
          Restaurar padrão
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isPending}
        >
          {isPending ? "Salvando…" : "Salvar template"}
        </Button>
      </div>
    </section>
  );
}
