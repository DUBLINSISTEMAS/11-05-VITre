# Plano de Finalização — Mangos Pay (pré-lojista real)

> **Documento vivo.** Fonte única de verdade desta fase.
> Atualizar a cada bloco fechado. Carregar no início de cada sessão de Claude.
> Nasceu 2026-05-22 a partir do diagnóstico em `docs/auditoria-2026-05-21-pre-lojista-real.md` + diagnóstico complementar Fase 1.

---

## Norte (não revisitar)

**Objetivo desta fase**: ambiente preparado, pronto, limpo e rápido para o **dono do estabelecimento** usar tranquilamente, diariamente — vendas, estoque, cadastro de produto, cliente, gestão da loja física e da loja online — tudo em sincronia, sem inconsistência, sem feature fantasma, sem código morto.

**Critério de pronto** (não negociável):
- Uma pessoa de administração (não dev) opera o sistema sem ajuda externa
- Tudo que aparece no admin tem efeito real no storefront e vice-versa
- Nada de feature inerte ("construída para quando alguém precisar")
- Código artesanal — limpo, lógico, sem boilerplate genérico

**Perspectiva obrigatória** em toda decisão: administrador de loja, contador, gerente, dono de PME. Não dev.

---

## Decisões fechadas (Anderson, 2026-05-22)

1. **Costurar todos os 5 fantasmas** — Coleção, Atributo, Cupom no storefront, Lead, Grupo de Cliente. Nenhum some, todos passam a funcionar de ponta a ponta.
2. **Commit chunked das 205 mudanças** — fatiar em commits temáticos por Onda/item ANTES de novas features. Como um senior faria.
3. **Foco**: resolver tudo do diagnóstico, nada oculto. P0 + P1 do briefing do Anderson, ordem importa.
4. **Sistema de memória ativo** — este arquivo + TaskList do Claude. A cada sessão, reler.

---

## Estado real (snapshot 2026-05-22)

- **Banco**: 64/64 SQLs aplicados (validado via `scripts/check-sql-applied.mjs` estendido pra cobrir 58-63)
- **Working tree**: 205 arquivos modificados, sem commitar (Onda 1 + Onda 2 inteiras)
- **Testes**: 498/498 unit + 39/39 integration verdes (último relatado em auditoria)
- **TypeScript**: zero warnings (último relatado)
- **Deploy Vercel**: feito, sem tráfego real

### Pendência operacional única
- Confirmar `CRON_SECRET` no painel Vercel ▸ Settings ▸ Environment Variables igual ao `.env.local` — senão crons voltam a 401.

---

## Bloco A — Fundação (sem isso nada anda) — **STATUS: feito 95%**

- [x] **A1**: SQLs 58–63 aplicadas em prod (2026-05-22)
- [x] **A2**: Sentinela `check-sql-applied.mjs` estendida — cobertura 11→63 (64 checks)
- [ ] **A3**: Confirmar `CRON_SECRET` no Vercel
- [ ] **A4**: Rodar `RUN_INTEGRATION=1 npm run test:integration` localmente — confirmar 39/39 contra DB com SQL 58 hardened

---

## Bloco B — 3 bugs ativos que sobreviveram às ondas

- [ ] **B1**: Deletar `quick-product-form.tsx` + remover toggle Rápido/Completo. O Completo já é leve o bastante (3 abas, autosave). Quick cria SKU sem estoque por hardcode → bug em produção
- [ ] **B2**: `allowOversell` honrado no PDV — `create-balcao-sale.ts:688` e `:986` precisam consultar `product.allow_oversell` antes de bloquear. Switch já existe (SQL 62 aplicado), só falta lógica
- [ ] **B3**: Unificar `COUNTABLE_STATUSES` em `src/actions/reports/range.ts`, importado por `load.ts`, `load-sales.ts`, `load-top.ts`, `load-margin.ts`, `load-dre.ts`. Hoje `load.ts` inclui `quote`/`awaiting_whatsapp` no faturamento — diverge dos relatórios oficiais

---

## Bloco C — Costurar 5 fantasmas (regra meta-2 do CLAUDE.md)

- [ ] **C1 Coleção (Vitrine)**: Storefront `[storeSlug]/page.tsx` lê coleções da loja e renderiza seção "Vitrines" entre banner e produtos. Cada vitrine vira link `/colecao/[slug]` (já existe)
- [ ] **C2 Atributo (Filtro)**: `category-filter-chips.tsx:9-15` deixa de hardcodar Tudo/Promoção/Novidades. Lê `attribute` da loja, renderiza chips dinâmicos. Filtro aplica via query string
- [ ] **C3 Cupom no checkout WhatsApp**: `storefront/checkout-panel.tsx:12` desativa o comentário "ESCONDIDO". Campo input "Tem código de desconto?" → valida server-side (já existe action) → aplica ao carrinho
- [ ] **C4 Recado (Lead)**: Storefront ganha página `/contato` (ou seção no footer) com form chamando `recordLead`. Admin lista deixa de ser eternos zeros
- [ ] **C5 Grupo de cliente com efeito real**: PDV consulta `groupId` do cliente vinculado. Se grupo == "Atacado", aplica `wholesalePrice` do produto automaticamente. Sem regra: feature deletada (não fica decorativa)

---

## Bloco D — Operação diária completa (vendas + clientes)

- [ ] **D1**: Devolução **parcial** item-a-item. `record-return.ts` aceita `returnType='partial'` + items array com quantidades. UI: dialog com checkbox por item + qty
- [ ] **D2**: Devolução com fiado em aberto **guiada** — em vez de bloquear com erro, mostra "Há R$X de fiado pendente. Estornar agora?" com botão inline que chama o estorno e prossegue
- [ ] **D3**: Busca de cliente por CPF/CNPJ — `customer/search.ts` aceita `documentNumber` (digits-only) em paralelo a nome/telefone. PDV: input aceita CPF mascarado
- [ ] **D4**: `customer.notes` visível no PDV — ao linkar cliente, mostra badge "anotações" se preenchido (collapse com texto). Operadora vê "deve há 3 meses" antes de liberar fiado
- [ ] **D5**: Histórico do cliente linka pro detalhe — `edit-customer-form.tsx:106-128` muda link de `?q=` pra `?detail={orderId}` (mesmo padrão Onda 2.12)
- [ ] **D6**: Filtro "só vendas com fiado pendente" — toolbar de `/admin/pedidos` ganha toggle `?fiado=pendente`. Query inclui apenas vendas com `receivable.status != 'paid'`
- [ ] **D7**: Caixa fechado — banner amarelo continua (Onda 2.6) MAS adicionar setting opcional "Exigir caixa aberto pra registrar venda" no `/admin/configuracoes`. Default OFF (não quebra fluxo atual)

---

## Bloco E — Relatórios contador-grade

- [ ] **E1**: Devoluções descontam em todos os relatórios — `load-sales.ts`, `load-top.ts`, `load-margin.ts`, `load-dre.ts` fazem LEFT JOIN com `order_return_item` e subtraem do total/CMV
- [ ] **E2**: Frete sai de "Receita" no DRE — separar `shipping_in_cents` num bucket próprio "Repasses (frete)"; "Acréscimos" fica só pra taxa de cartão/PIX
- [ ] **E3**: `<ReportLayout/>` consome `<PrintStoreHeader/>` — adiciona CNPJ aos 5 relatórios A4 (Onda 2.7 esqueceu este lugar)
- [ ] **E4**: Filtro por categoria/marca em `/admin/relatorios/vendas` + agrupamento por dia (subheaders com soma)
- [ ] **E5**: Aging 0-30 / 31-60 / 60+ em `/admin/financeiro/receber/relatorio`
- [ ] **E6**: Documentar critério de custeio no rodapé do relatório de margem ("Custo unitário fixado no momento da venda — snapshot histórico, não FIFO/médio")

---

## Bloco F — Impressão em impressora COMUM

- [ ] **F1**: Recibo PDV em mm + variant — `?fmt=a4|thermal` na URL. Default detecta via cookie ou prompt no 1º print. Layout térmico: `max-w-[80mm]`, `@page { size: 80mm auto }`. A4: `max-w-[210mm]`, header completo
- [ ] **F2**: Fechamento Z em layout A4 próprio (não reusar card da tela) — header + tabela densa + assinatura do operador
- [ ] **F3**: Rodapé universal — "Gerado em DD/MM/AAAA HH:MM por {operador} · Página X de Y" em recibo/A4/Z (hoje só ReportLayout tem)
- [ ] **F4**: Deletar `print-layout.tsx` (317 linhas, zero callers) + `print-store.ts` (helper desatualizado)

---

## Bloco G — Importação CSV (produto + cliente)

- [ ] **G1**: Importer de produto — upload CSV em `/admin/produtos/importar`. Preview das primeiras 20 linhas, validação Zod por linha, batch insert idempotente com `internal_code` como chave. Relatório de erros por linha
- [ ] **G2**: Importer de cliente — `/admin/clientes/importar`. Mesmo padrão. CPF/CNPJ como chave de dedup

---

## Bloco H — Limpeza estrutural

- [ ] **H1**: Deletar `lib/supabase/server.ts` + remover dep `@supabase/supabase-js` do `package.json` (zero callers, contradiz CLAUDE.md "Não usamos Supabase Auth")
- [ ] **H2**: Deletar pasta `/logos` raiz (duplica `public/logos/`, não é servida)
- [ ] **H3**: Limpar `.claude/worktrees/agent-*` + `.claude/tmp-build-head/` — cópias velhas de worktree
- [ ] **H4**: `RETURNABLE_STATUSES` extraído pra `src/actions/order/constants.ts`, importado por `record-return.ts` + `order-status-actions.tsx`
- [ ] **H5**: **Decisão**: PDV full-page (`/admin/pdv`) vs modal `new-sale-modal.tsx` — qual fica? Recomendação: manter só o standalone (`/admin/pdv`), modal só pra "venda rápida 2 cliques" se justificar
- [ ] **H6**: **Decisão**: `ReportView` vs `ReportLayout` — recomendação: matar `ReportView`, dashboard `/admin/relatorios` vira só atalhos pros 5 A4 + KPIs leves
- [ ] **H7**: Resolver `drizzle/0033_order_item_discount.sql` + `supabase/sql/59` — drizzle cria coluna, supabase cria CHECKs. OK como está, mas documentar no MIGRATION.md (criar?) pra próximo dev entender

---

## Bloco I — Refator de monolitos (Onda 3 do CLAUDE.md)

- [ ] **I1**: `pdv-shell.tsx` 2745→partes — `usePdvCart` + `usePdvPayments` + `usePdvDiscount` + `<CartList/>` + `<PaymentSection/>` + `<CustomerPicker/>`
- [ ] **I2**: `create-balcao-sale.ts` 1228→partes — `prepareOrderContext` + `executeStockReservation` + `insertOrderWithRetry`. Sale/Quote/Fiado viram orquestradores ≤50 linhas
- [ ] **I3**: Paralelizar loaders — `/admin/pedidos`, `loadStockKpis`, `loadFullReport`
- [ ] **I4**: `next/dynamic` em componentes 400+ linhas client-side
- [ ] **I5**: Índice trigram em `product_variant.name` (SQL 64?)

---

## Bloco J — Multi-tenant pleno (Fase 2 oficial blocos 3-5)

- [ ] **J1**: Tela `/cadastro` self-service em transação atômica + wizard pós-signup
- [ ] **J2**: Email verification ON no Better Auth + Resend domínio próprio + rate limit signup
- [ ] **J3**: Middleware Next.js resolve `{slug}.mangospay.app` → loja `{slug}` (OU domínio próprio via CNAME)

---

## Bloco K — Commit chunked das 205 mudanças

Antes de começar B-J, fatiar a diff atual em commits temáticos:

1. `chore(db): aplicar SQLs 58-63 + estender check-sql-applied`
2. `feat(estoque): corrigir bug do estoque inicial (Onda 1.1)`
3. `feat(caixa): correção do fechamento Z + 6 tipos de adjustment (Onda 1.2)`
4. `feat(pedidos): recibo + listagem + modal multi-pagamento (Onda 1.3)`
5. `feat(pedidos): filtro de data + totalizador + split por método (Onda 1.4)`
6. `chore(infra): vercel.json gru1 + HMAC crons (Onda 1.5)`
7. `perf(relatorios): limites defensivos em queries pesadas (Onda 1.6)`
8. `chore(ui): find/replace vocabulário em 14 telas (Onda 1.7)`
9. `feat(ui): empty states ricos em 6 listas (Onda 1.8)`
10. `feat(produtos): form 5→3 abas + progressive disclosure (Onda 2.1-2.3)`
11. `feat(compras): CTA estoque aponta pra compras como batch (Onda 2.4)`
12. `feat(estoque): saída manual exige motivo (Onda 2.5)`
13. `feat(caixa): banner amarelo + cabeçalho universal impressão (Onda 2.6-2.7)`
14. `feat(ui): b3-btn 44px + asterisco required + H1 padronizado + autosave (Onda 2.8-2.9)`
15. `feat(produtos): glossário estoque + helpbars saneadas (Onda 2.10-2.11)`
16. `feat(pedidos): navegação ao detalhe + badge fiado + quebra caixa (Onda 2.12-2.14)`
17. `feat(produtos): allow_oversell schema + UI (Onda 2.15)`
18. `feat(seguranca): SQL 58 lead anon restrict (Fase 2 Bloco 2)`
19. `feat(brand): rebrand Mangos Pay — sidebar/logos/icons`
20. `docs(plano): diagnóstico Fase 1 + plano blocos A-K`

---

## Princípios operacionais (não esquecer)

1. **Código artesanal** — sem boilerplate, sem "cara de IA"
2. **Limpo** — removeu feature, removeu lixo junto
3. **Rápido** — queries otimizadas, sem N+1
4. **Testar pela perspectiva do usuário final** após cada entrega
5. **Atualizar este `.md`** a cada item fechado — marcar `[x]` + data + commit
6. **Pausar e mostrar** ao Anderson ao final de cada bloco antes de seguir
7. **Decisão ambígua → perguntar**, não assumir
8. **Honestidade brutal > cobertura** — se algo está quebrado, marcar como quebrado

---

## Ordem de execução (consenso do conselho 5 agentes, 2026-05-22)

```
SPRINT 0 (1 dia)        K → A3 → A4
SPRINT 1 (3-4 dias)     B + H4 + E1 (frente "estados de pedido + devolução desconta")
SPRINT 2 (1 semana)     E2 (frete fora de receita) → D1 (devolução parcial UI)
SPRINT 3 (3-4 dias)     D2-D7 (operação diária)
SPRINT 4 (3-4 dias)     E3-E6 (relatórios) + F (impressão A4)
SPRINT 5 (1 semana)     C reordenado: C3 → C4 → C1 → C5 → C2
SPRINT 6 (2-3 dias)     H (limpeza) + L (NOVO — smoke prod manual)
─────── primeiro lojista entra (via seed/admin manual) ───────
PÓS-#1                  I (refator) + G (CSV se necessário) + J (multi-tenant pleno)
```

**Justificativas-chave**:
- **K primeiro** porque 205 arquivos sem commit = risco catastrófico de perda física (1-2h pra eliminar)
- **B + H4 + E1 em PR único** porque tocam os mesmos conceitos ("status de pedido como verdade central")
- **C reordenado** porque cupom (C3) dá retorno comercial imediato e atributo (C2) é menos universal por nicho
- **L novo** porque smoke prod real (impressora, 3G, latência Brasil) não está no plano e é bloqueante pro #1
- **I + G + J adiados** porque (I) refator interno sem retorno direto pro lojista; (G) depende do perfil do #1 (≤50 SKUs migra mão); (J) signup público só após #1 validar

## Bloco L — Smoke prod manual (NOVO, pré-lojista #1)

- [ ] **L1**: Venda balcão real → recibo impresso em impressora do lojista (jato/laser ou térmica)
- [ ] **L2**: Storefront aberto em 3G mobile em rede do interior (latência real Brasil)
- [ ] **L3**: Cadastrar 20 produtos com fotos reais (validar upload sharp + cache)
- [ ] **L4**: 1 venda fiada parcial + 1 estorno + 1 devolução parcial — fluxo de exceção completo
- [ ] **L5**: Fechamento Z impresso A4 + envio pro contador via WhatsApp
- [ ] **L6**: Lighthouse mobile do storefront ≥ 90 com dados reais

## Histórico

| Data | Evento |
|---|---|
| 2026-05-22 | Diagnóstico Fase 1 entregue. Decisões A+B+C fechadas (costurar fantasmas, commit chunked, P0+P1 completo). SQLs 58-63 aplicadas em prod. Plano blocos A-K formalizado. |
| 2026-05-22 | Conselho 5 agentes definiu ordem: K → B+H4+E1 → resto E → D → F → C (reordenado) → H+L → lojista #1 → I/G/J pós. Bloco L (smoke prod) adicionado. |
