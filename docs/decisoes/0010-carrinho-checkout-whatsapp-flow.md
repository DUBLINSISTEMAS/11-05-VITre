# ADR-0010: Fluxo de carrinho, checkout e código curto pós-WhatsApp

- **Data**: 2026-05-08
- **Status**: aceito

## Contexto

Fase 1.6 implementa o ciclo "vê produto → adiciona à sacola → finaliza pelo WhatsApp". O ADR-0002 fixou os pilares (carrinho client-side, código curto via nanoid, mensagem WhatsApp truncada em 1900 chars, pedido gravado server-side antes do redirect, página pública de pedido — depois migrada para `/p/[token]` no hardening P0 #2 pra eliminar leak de PII). Este ADR resolve as 8 decisões abertas que apareceram ao detalhar a fase.

O **pressuposto invisível** mais perigoso identificado no conselho: tratar o checkout como "fluxo de pagamento". Não é. O checkout do Vitrê é um **rito de transferência** — o cliente passa do "vitrine app" pro "WhatsApp pessoal da Sandra". O `orderTable` é snapshot pra Sandra atender, não compromisso de pagamento. Essa lente muda 3 decisões abaixo.

## Decisões fixadas

### 1. Carrinho `localStorage`

| Aspecto | Decisão |
|---|---|
| Chave | `vitre:cart:${storeSlug}` — humano-amigável pra debug; rename de slug é Fase 2+ e orfana cart antigo é aceitável |
| Schema | `{ items: [{ productId, variantId?, qty, cachedPriceCents }], savedAt: ISO8601 }` — sem snapshot de foto |
| TTL | 7 dias via check em `savedAt` no read; vencido = empty cart |
| Hidratação | CSR-only; server renderiza placeholder vazio até `useEffect` montar |
| Reconciliação | Server SEMPRE recalcula preço efetivo no momento do INSERT; `cachedPriceCents` é só pra UI client |

### 2. Captura de dados do cliente final

Form mínimo no `/sacola` (página de checkout):
- **Nome** (obrigatório, ≥ 2 chars)
- **WhatsApp** (obrigatório, formato BR validado via `whatsapp-format.ts` → E.164)
- **Email** (opcional, label "se quiser receber novidades" — não bloqueante; campo simples)
- **Endereço NÃO** — Sandra negocia entrega no WhatsApp. LGPD-friendly. Reafirma ADR-0008.
- **Notas opcionais** (`customerNotes`, max 500 chars) — campo de texto livre pro cliente especificar tamanho/cor/observação que não cabe na variante.

### 3. Server action `createOrderFromCart`

| Aspecto | Decisão |
|---|---|
| Rate limit | Bucket novo `order` — 5 pedidos/IP/min |
| Idempotency | **CRITICAL.** Coluna `idempotency_key TEXT NOT NULL` no `orderTable` com `UNIQUE(storeId, idempotencyKey)`. Cliente gera `crypto.randomUUID()` no mount do checkout. Server faz `INSERT ... ON CONFLICT (store_id, idempotency_key) DO NOTHING`. Sem isso = duplicatas garantidas em latency >500ms. |
| Validação de estoque | Atômica dentro de transação Drizzle. Se variant ou product `trackStock=true` e qty insuficiente → falha o pedido inteiro (não parcial), retorna lista de produtos esgotados pro cliente reconfirmar. Lock pessimista (`SELECT ... FOR UPDATE`) durante a transação |
| Snapshot de preço | Server recalcula via `pricing.ts` com `now()`. Se promo expirou desde o `cachedPriceCents` do client, server vence — pedido criado com preço atual. Sandra negocia desconto manual no WA se quiser honrar |
| shortCode | nanoid 4 chars alfanuméricos. Retry max 5 tentativas em colisão (UNIQUE violation). Após 5 falhas, lança erro (improvável: 14M combos por loja) |
| Stock decrement | **NÃO automatizar.** Sandra controla manual no admin. Pedidos via WA têm fricção real (negociação, troca, cancelamento) — decrement automático cria mais bug que valor |
| Reset do carrinho | Imediato após server action OK + antes do redirect WhatsApp. Idempotency cobre duplo-clique |

### 4. Mensagem WhatsApp

Esqueleto:
```
Olá {storeName}! Sou {customerName}.

Quero finalizar este pedido:

📦 *2× Anel Solitário — Ouro 18k* — R$ 89,90
📦 *1× Pulseira Berloque* — R$ 145,00
... (cap 8-10 itens)

💰 *Total:* R$ 324,80

🔗 vitre.app/p/A7K2

Aguardo confirmação.
```

| Aspecto | Decisão |
|---|---|
| Limite | 1900 chars (margem de 200 do limite WhatsApp 2048) |
| Truncamento | Cap 8-10 itens; resto vira "+ X itens em vitre.app/p/abc1" |
| Encoding | `encodeURIComponent` nativo (lida com espaços, emoji, quebra de linha) |
| URL final | `https://wa.me/${storeWhatsappE164}?text=${encoded}` |

### 5. Lottie de "pedido enviado"

| Aspecto | Decisão |
|---|---|
| Quando | Página `/sucesso` após server action OK + reset de carrinho — NÃO antes do redirect |
| Asset | Reusar `public/lottie/order-approved.json` (já importado na Fase 0) |
| Copy | "Pedido enviado · Sandra vai te chamar no WhatsApp" — NÃO "aprovado". Pedido NÃO foi aprovado, foi enviado pra Sandra confirmar |
| Bundle | `dynamic(() => import("lottie-react"), { ssr: false })` — ~50kB, one-shot na sucesso |
| Acessibilidade | Fallback estático com checkmark SVG quando `prefers-reduced-motion: reduce` |

### 6. `markWhatsAppOpened` server action

| Aspecto | Decisão |
|---|---|
| Quando dispara | `useTransition` no `onClick` do botão WhatsApp ANTES do `window.location` — NÃO bloqueia o redirect (fail-soft) |
| Importância | Analytics + state machine futura (% clientes que efetivamente abrem WA). NÃO é crítico, NÃO é compliance — fire-and-forget |
| Implementação | Atualiza `whatsappOpenedAt` timestamp no `orderTable`. Sem rate limit (idempotente, baixo volume) |

### 7. Página `/p/[token]` pública

| Aspecto | Decisão |
|---|---|
| Visibilidade | Pública (sem login), `noindex`, `robots.txt: Disallow: /p/`, excluída do `sitemap.xml` |
| Mostra | Logo + nome da loja + link wa.me + itens (foto, nome, qty, preço) + total + status do pedido + código curto |
| **NÃO mostra** | Nome/WhatsApp/notas do cliente. Risco de leak por compartilhamento (cliente envia link pra mãe pra mostrar look) — dados pessoais ficam fora |
| Função real | Fallback de continuidade (cliente perdeu o WA, reenvia link pra Sandra), não tracking de status |

### 8. Reset do carrinho após checkout

Imediato após server action retornar OK + antes do redirect WhatsApp. Se cliente voltar `/sacola`, está vazio (correto — pedido já foi). Idempotency key cobre duplo-clique no botão "Finalizar".

## Migrations necessárias

```sql
-- supabase/sql/03_order_idempotency.sql
ALTER TABLE "order"
  ADD COLUMN idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX order_store_idempotency_unique
  ON "order" (store_id, idempotency_key);
```

`DEFAULT gen_random_uuid()::text` cobre as linhas existentes (sem pedidos em produção ainda; seed de Sandra também recebe valores únicos).

## Consequências

- ✅ Cliente final fecha em < 5 cliques: Adicionar → Sacola → Finalizar → Send no WhatsApp
- ✅ Sandra recebe pedido com snapshot fiel + nome + WhatsApp do cliente, vai direto pro chat
- ✅ Idempotency garante zero duplicatas (vs. ~10% sem)
- ✅ LGPD: Vitrê NÃO armazena endereço de cliente final
- ✅ /p/[code] permite cliente reabrir conversa se perdeu mensagem
- ⚠️ Estoque pode esgotar entre client e server — falha clara (lista de esgotados pro cliente reconfirmar)
- ⚠️ Promo expirar entre client e server — server vence, cliente vê preço atual
- ⚠️ Fluxo termina no WhatsApp da Sandra — a conversão real é fora do nosso controle (aceitável; é o ponto)
- 🔧 Dívida: stock NÃO decrementa automático — Sandra precisa marcar manual; documentado no admin

## Quem decidiu

Anderson Felipe (founder) + Conselho-5-agentes deliberando 2026-05-08. Decisões alinhadas com ADR-0002 e ADR-0008.

## Referências

- [ADR-0002 — Checkout WhatsApp + código curto](0002-checkout-whatsapp-codigo-curto.md)
- [ADR-0006 — Rate limit Upstash](0006-rate-limit-upstash.md)
- [ADR-0008 — UX catálogo público](0008-ux-catalogo-publico-storefront.md)
