# 03 — Convenções e ruído

**Escopo:** emojis em código, console statements esquecidos, TODOs órfãos, arquivos gigantes, qualquer ruído que um dev senior rejeitaria.

---

## Resumo

| Dimensão | Status |
|---|---|
| Emojis decorativos em UI interno | 3 pontos (a corrigir) |
| Emojis em templates ao cliente | 13 (legítimos — mantém) |
| Emojis em desenhos ASCII em comments | 4 (legítimos — mantém) |
| `console.*` em src/ | 5 ocorrências (3 a converter pra logger, 2 aceitáveis) |
| TODOs órfãos | 0 (2 TODOs existentes têm contexto Sprint) |
| `@ts-ignore` / `@ts-expect-error` | **0** |
| `any` explícito | **0** |
| Imports comentados | **0** |
| Sufixos `_unused`, `_OLD`, `_DEPRECATED` | **0** |
| Arquivos > 1000 linhas | 2 (`pdv-shell.tsx` 2154, `create-balcao-sale.ts` 1141) |

**Veredito:** higiene de código é **boa para excelente**. Pontos a corrigir são poucos e localizados. **2 arquivos gigantes** merecem refator (não urgente, mas vale planejar).

---

## 1. Emojis

### 1.1 Em UI interno do admin — REMOVER (3 ocorrências)

| Arquivo:linha | String | Contexto | Substituição |
|---|---|---|---|
| `src/components/admin/pdv/pdv-shell.tsx:1466` | `✓ Pagamento completo` | UI do PDV (introduzido na Sprint 1A Fase 2) | Texto puro `"Pagamento completo"` + verde via `text-ok` |
| `src/components/onboarding/slug-input.tsx:145` | `"Disponível ✓"` | Validação de slug em onboarding | Texto puro `"Disponível"` + ícone Lucide `CheckIcon` |
| `src/lib/env.ts:75` | `console.error("❌ Variáveis de ambiente inválidas:")` | Boot do server (terminal) | Texto puro `"Variáveis de ambiente inválidas:"` |

### 1.2 Em templates ao cliente final — MANTER (13 ocorrências)

WhatsApp template (`src/lib/whatsapp-message.ts`, `src/components/admin/whatsapp-template-card.tsx`, `src/components/admin/order-detail-dialog.tsx:138`):
- `📦` antes de cada item da lista
- `💰` antes do total
- `🔗` antes do link
- `📝` antes das observações
- `🙂` no template auto-handoff

**Razão:** WhatsApp é canal informal; emojis aumentam destaque visual da mensagem ao cliente. Precedente Sprint 0 vocabulário: "mensagens que SAEM do sistema pro cliente final mantêm vocabulário do storefront". Aplica-se aqui também.

### 1.3 Em desenhos ASCII em comentários — MANTER (4 ocorrências)

- `success-ctas.tsx:8`: `[💬]` no ASCII art que representa botão WhatsApp
- `desktop-header.tsx:8`: `[🔍 ♥ 🛍]` no ASCII art do header storefront
- `product-detail-view.tsx:8`: `[←] [🔍]` no ASCII art da PDP
- `category-pills.tsx:6`: `[✨ Dresses]` exemplo de layout (DEMO — sem efeito runtime)
- `whatsapp-template-card.tsx:13,17`: documentação dos placeholders `📦` e `📝`
- `product/schema.ts:302`: `⚠️ MANTENHA SINCRONIZADO` warning em comment

**Razão:** documentam intenção visual sem afetar runtime. Útil pra próximo dev entender layout sem rodar o app.

---

## 2. Console statements em src/ (5)

| Arquivo:linha | Tipo | Conteúdo | Ação |
|---|---|---|---|
| `src/actions/order/balcao/create-balcao-sale.ts:516` | `console.info("[QUOTE] orçamento criado", {...})` | Adicionado por mim na Sprint 1A Fase 4 | **Converter pra `logger.info`** |
| `src/actions/order/balcao/create-balcao-sale.ts:764` | `console.info("[FIADO] venda fiada registrada", {...})` | Adicionado por mim na Sprint 1A Fase 5 | **Converter pra `logger.info`** |
| `src/lib/env.ts:75-76` | `console.error("❌ Variáveis de ambiente inválidas:")` | Boot do server | **Manter (terminal-only)** mas remover `❌` |
| `src/lib/image-client.ts:126` | `console.warn("[image-client] compressão falhou...")` | Client-side fallback | Aceitável — client não tem acesso ao logger backend |

**Razão pra converter:** `src/lib/logger.ts` existe e é usado em todo o resto do codebase. Esses 2 do balcão (que **eu** acabei de adicionar) escaparam.

---

## 3. TODOs e FIXMEs (2 válidos, 0 órfãos)

| Arquivo:linha | Conteúdo |
|---|---|
| `src/components/admin/order-detail-dialog.tsx:279` | `// como TODO num follow-up (Sprint 1B)` — referência ao débito "Transformar quote em venda" |
| `src/components/admin/product-form/tab-identidade.tsx:104` | `// TODO (Sprint 2): substituir por Select com botão "+ Nova marca"` — depende migration 49 |

Ambos têm **contexto Sprint** anotado. Não são órfãos.

Outras menções da string `TODOS` no grep eram falso-positivo (palavra em PT-BR, não keyword).

---

## 4. Qualidade TypeScript

```
@ts-ignore                  0 ocorrências
@ts-expect-error            0 ocorrências
: any                       0 ocorrências
as any                      0 ocorrências
<any> generic               0 ocorrências
```

**Excelente.** Type safety total em `src/`. Senior-grade.

---

## 5. Arquivos gigantes (>800 linhas)

| Arquivo | Linhas | Veredito |
|---|---|---|
| `src/components/admin/pdv/pdv-shell.tsx` | **2154** | **DEMAIS.** Cresceu nas Sprints 1A. Precisa extrair sub-componentes (`CartPanel`, `PaymentSection`, `ProductSearchPicker`, `CustomerComboboxLight` já existem como funções internas — podem virar arquivos próprios). |
| `src/actions/order/balcao/create-balcao-sale.ts` | **1141** | Grande. Branches `sale`/`quote`/`fiado` duplicam código de estoque + retry loop. Refator: extrair helper `runShortCodeRetryLoop(...)` que recebe callback. Cortaria ~300 linhas. |
| `src/actions/order/create-from-cart.ts` | 748 | Grande mas justificável (action crítica do checkout WhatsApp com idempotência e retry). |
| `src/components/admin/customer-form.tsx` | 574 | Aceitável (form complexo). |
| Outros | 380-540 | OK. |

### 5.1 Refator proposto pro `pdv-shell.tsx` (2154 → ~1200)

Extrair pra `src/components/admin/pdv/`:
- `pdv-cart-panel.tsx` (CartPanel — ~120 linhas)
- `pdv-payment-section.tsx` (PaymentSection com PaymentLineRow — ~400 linhas)
- `pdv-product-search-picker.tsx` (ProductSearchPicker — ~270 linhas)
- `pdv-customer-combobox.tsx` (CustomerComboboxLight — ~250 linhas)
- `pdv-fkeys-legend.tsx` (FKeysLegend — ~25 linhas)

Shell fica orquestração + state global + handlers (~1000 linhas, ainda grande mas manejável).

### 5.2 Refator proposto pro `create-balcao-sale.ts` (1141 → ~800)

Extrair pra `src/actions/order/balcao/`:
- `_helpers/run-shortcode-retry.ts` — função genérica que recebe callback de tx e faz retry de colisão de short_code
- `_helpers/lock-and-check-stock.ts` — função que faz advisory lock + releitura + check de estoque por item (duplicada hoje nos branches sale e fiado)

---

## 6. Findings com severidade

| # | Severidade | Finding | Ação | Esforço |
|---|---|---|---|---|
| 1 | **MÉDIO** | 3 emojis em UI interno (PDV check, slug, env) | Substituir | 5 min |
| 2 | **MÉDIO** | 2 `console.info` em create-balcao-sale (QUOTE/FIADO) | Converter pra `logger.info` | 5 min |
| 3 | **MÉDIO** | `pdv-shell.tsx` com 2154 linhas | Extrair 5 sub-componentes | 2-3h |
| 4 | **BAIXO** | `create-balcao-sale.ts` com 1141 linhas (~300 duplicadas) | Extrair 2 helpers | 1-2h |
| 5 | **BAIXO** | 1 emoji `❌` em `console.error` boot env | Remover emoji | 1 min |
| 6 | **INFO** | TODOs Sprint 1B e Sprint 2 anotados | Manter — débito documentado | — |

**Crítico/Alto:** **nenhum.**

---

## 7. Recomendação executiva

Limpeza de convenções pode ser feita em **1 sessão de 30 min**:

1. Substituir 3 emojis em UI interno (PDV check, slug, env)
2. Converter 2 `console.info` pra `logger.info`
3. Remover emoji `❌` em `env.ts`

Refator de arquivos gigantes (`pdv-shell.tsx` + `create-balcao-sale.ts`) fica como **Sprint dedicada (1.5)** — não urgente, mas vale fazer antes da Sprint 2 que vai mexer em alguns desses arquivos.
