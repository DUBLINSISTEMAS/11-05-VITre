# ADR-0008: UX do catálogo público (storefront)

- **Data**: 2026-05-07
- **Status**: aceito

## Contexto

Anderson propôs uma referência de UX inspirada em Shopee/Shein/Mercado Livre incluindo:

1. Sidebar de categorias com **drill-down lateral** (clicou em "Roupas" → sidebar fecha → outra desliza com subcategorias + seta voltar)
2. Categoria sem sub → listagem direta
3. Subcategoria → listagem direta
4. Página de listagem com filtro de preço + busca contextual
5. **Busca global** com ícone de lupa
6. **Menu inferior fixo (bottom nav)** com 5 itens: Home · Categorias · Carrinho (centro) · Busca · **Perfil**
7. **Página de Perfil do cliente final** com: nome, WhatsApp, foto, endereço, favoritos, pedidos anteriores, contato/local da loja
8. **Conta de cliente final** (login/signup)

A proposta tem partes excelentes (drill-down, bottom nav, busca, listagem com filtros) e UMA parte que **conflita frontalmente com a tese central** do Vitrê documentada em ADR-0001, ADR-0002 e `docs/produto/visao.md`: **cliente final SEM conta**.

## Análise via Conselho-5-agentes

### O que aceitar (todas as ideias visuais e de navegação)
- Sidebar drill-down lateral (mais elegante que expand-inline) ✓
- Categoria sem sub → listagem direta ✓
- Subcategoria → listagem direta ✓
- Listagem com filtros (preço) e busca contextual ✓
- Busca global com lupa ✓
- Bottom nav fixo (mas com 4 itens, não 5) ✓
- Animações suaves, mobile-first, espaçamento confortável ✓
- Info da loja (endereço, WhatsApp, Instagram, Maps) acessível em `/sobre` e/ou rodapé ✓

### O que rejeitar (com argumento)
- ❌ **Conta de cliente final** — quebra wedge. Conversão cai 40-70% em e-commerce com login obrigatório (Baymard).
- ❌ **Foto de perfil** — storage explode (1k lojas × 100 clientes × 1 foto). Free tier morre.
- ❌ **Endereço do cliente armazenado** — lojista combina entrega no WhatsApp; sem necessidade.
- ❌ **Favoritos persistentes** — depende de conta. Padrão SHEIN (wishlist culture), não de loja pequena.
- ❌ **Histórico de pedidos no app** — sem conta, impossível. WhatsApp já é o histórico (cliente fala com Sandra).
- ❌ **5º item "Perfil" no bottom nav** — não há perfil.

### Riscos da conta de cliente (LÂMINA)
1. Conversão cai 40-70% (Baymard Institute).
2. LGPD: Vitrê vira controlador de dados de N consumidores de N lojas.
3. Storage explode com fotos.
4. Schema multiplica (`customer`, `customer_session`, `favorite`, `customer_address`, M2M, RLS por cliente).
5. Identificação requer OTP por SMS (Twilio = custo) ou OAuth WA (raro).
6. Vira concorrente direto de Loja Integrada/Nuvemshop sem ter gateway.

### Esforço (TRATOR)
- Adotar só as ideias que NÃO dependem de conta: **+6h** na Fase 1.5.
- Adotar tudo incluindo conta de cliente: **+40-60h** numa fase nova → Sandra atrasa 3-4 semanas.

### Persona ESPELHO — Joana (cliente final)
- Vê foto no Insta da Sandra → click → Vitrê.
- Tela de login antes do produto = **fecha aba**.
- Não vai favoritar 50 produtos. Loja pequena vende impulso, não recorrência.
- Lembra que comprou na Sandra → chama no WhatsApp pra repetir. Sandra LEMBRA dela. **Relação humana via WA é o que vende em loja pequena.**

## Decisão

### 1. Cliente final continua SEM conta
Reafirma o wedge: catálogo público é zero-login, carrinho em `localStorage`, fechamento via WhatsApp.

### 2. Adotar 80% da proposta visual e de navegação

#### Sidebar drill-down lateral
- Clica `☰` no header → desliza sidebar da esquerda com **categorias raiz**
- Categoria com `›` no fim = tem subcategorias
- Click em categoria com `›` → sidebar atual desliza pra esquerda → nova sidebar entra mostrando: `← Categoria-pai` + lista de subcategorias + "Ver tudo em [pai]"
- Click em categoria SEM `›` → fecha sidebar + navega pra `/[storeSlug]/categoria/[slug]`
- Click em subcategoria → fecha sidebar + navega pra `/[storeSlug]/categoria/[slug]`
- Footer da sidebar: WhatsApp, endereço, Instagram da loja

#### Bottom nav (fixo) — **4 itens**
```
🏠 Início  ·  ☰ Categorias  ·  🔍 Buscar  ·  🛒 Sacola (badge)
```
- Sempre visível (mobile)
- Carrinho com badge da quantidade (cor da loja)
- "Categorias" abre a mesma sidebar drill-down (atalho do bottom nav)
- "Buscar" abre `/[storeSlug]/buscar` (página dedicada)
- "Início" navega para `/[storeSlug]`

#### Busca global
- `/[storeSlug]/buscar?q=...` página dedicada
- Input grande no topo, foco automático
- Resultado em grid 2 colunas
- Estado vazio: "Digite o nome do produto"
- Sem resultado: "Nada encontrado por '...'"
- Implementação MVP: `ILIKE %q%` no nome (Postgres). Trocar por full-text na Fase 2 se ficar lento.

#### Página de listagem (categoria ou busca)
- Header com nome da categoria/busca
- Filtros recolhidos atrás de botão "Filtrar" (drawer pela direita)
  - Faixa de preço (min, max)
  - Ordenar por: relevância, menor preço, maior preço, novidades
- Grid 2 colunas de cards
- Botão "Adicionar ao carrinho" no card (ou "Ver" se houver variantes)
- Paginação ou scroll infinito (decidir Fase 1.5)

#### Carrinho (drawer da direita)
- `Sheet` lateral, slide suave
- Lista de itens (foto + nome + qty + preço + remover)
- Total destacado
- 2 CTAs: "Continuar comprando" (fecha) | "Finalizar pelo WhatsApp →" (vai pra `/[storeSlug]/checkout`)

#### Página `/sobre` da loja (não-perfil)
- Endereço completo + Maps embed
- WhatsApp clicável (`wa.me`)
- Instagram link
- Texto descritivo da loja (do `store.description`)
- Acessível pelo rodapé do storefront

### 3. Página `/perfil` do cliente final NÃO EXISTE
Em vez disso:
- Info da LOJA fica em `/sobre`
- Cliente final não tem perfil, favoritos, pedidos anteriores

## Princípios de UX aplicados

| Princípio | Aplicação Vitrê |
|---|---|
| Hick's Law | Top categorias na home; resto no hamburger; bottom nav fixo |
| Fitts's Law | CTAs ≥ 44px; hamburger top-left; carrinho top-right; bottom nav zona-polegar |
| Recognition over Recall | Foto grande → preço → nome (ordem visual) |
| Lei do Mínimo Esforço | Cliente fecha em 2 cliques; descrição opcional, foto obrigatória |
| Trust signals | Footer + /sobre com dados da loja |
| Mobile thumb zones | "Adicionar ao carrinho" FIXO no bottom da tela do produto |
| Promo dopamine | Badge `-30%` + preço riscado, com parcimônia |
| WhatsApp = alívio | CTA verde + ícone WA; cliente sabe que fala com pessoa real |
| Drill-down lateral | Suaviza transição; reduz carga cognitiva por nível |
| Bottom nav 4 itens | < 5 itens cabe em zona-polegar; > 4 polui |

## Implicações no roadmap

| Fase | Antes | Depois | Delta |
|---|---|---|---|
| 1.3 | 24h | 24h | — |
| 1.4 | 17h | 17h | — |
| 1.5 | 21h | **27h** | +6h (sidebar drill-down + bottom nav + busca + listagem com filtros) |
| 1.6 | 12h | 12h | — |
| 1.7 | 6h | 6h | — |
| **Total restante** | 80h | **86h** | **+6h** |

## Trade-offs aceitos

- ✅ Wedge competitivo preservado (Vitrê é "catálogo simples + WA", não mini-Shopee).
- ✅ Conversão alta (sem barreira de login).
- ✅ LGPD simples (Vitrê só processa dados de lojistas, não consumidores finais).
- ✅ MVP em ~3 semanas, não 5-6.
- ⚠️ Sem fidelização de cliente final via app (vai via WhatsApp/Instagram).
- ⚠️ "Pedidos anteriores" no client-side via localStorage só (sem cross-device).

## Caminho de evolução (não bloqueia MVP)

Se 5+ lojistas pedirem "conta de cliente" depois do MVP no ar, abrir nova fase:
- ADR de adoção
- Schema novo
- Avaliar OTP por WhatsApp via API oficial (Meta) — investimento sério
- Considerar se faz sentido cobrar plano premium pra justificar custo

## Quem decidiu

Anderson Felipe (founder) + Conselho-5-agentes deliberando 2026-05-07. Anderson concordou com o veredito do conselho (rejeitar conta de cliente, adotar 80% da proposta visual).

## Referências

- [ADR-0001 — Multi-tenant + RLS](0001-multi-tenant-rls-postgres.md)
- [ADR-0002 — Checkout WhatsApp](0002-checkout-whatsapp-codigo-curto.md)
- [Visão do produto](../produto/visao.md)
- [Personas](../produto/personas.md)
- [Sessão 2026-05-07 — UX catálogo público](../sessoes/2026-05-07-ux-catalogo-publico.md)
