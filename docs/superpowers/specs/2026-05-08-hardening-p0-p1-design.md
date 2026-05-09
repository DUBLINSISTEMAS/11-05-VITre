# Hardening P0/P1 — Design

## Objetivo
Levar a Fatia 1 do Vitrê a um padrão sênior antes de cliente real: eliminar vazamento de dados em pedido público, reduzir enumeração de pedidos, corrigir estoque no checkout, remover rotas quebradas e fechar invariantes do modelo 1 lojista = 1 loja.

## Escopo desta fase

### Incluído
- Separar `shortCode` humano de `publicToken` público não enumerável.
- Migrar `/p/[shortCode]` para `/p/[publicToken]` sem expor PII.
- Garantir que a página pública de pedido não embuta nome, telefone ou notas do cliente em HTML/URL.
- Ajustar SQL/RLS para não existir `USING (true)` em `order` e `order_item`.
- Corrigir `store_owner_access` para anonymous não ter `FOR ALL`.
- Implementar reserva/decremento de estoque atômico no checkout.
- Criar rotas de storefront para `/destaques` e `/novidades` ou equivalente sem 404.
- Adicionar constraint única para `store.owner_id` enquanto o MVP for 1:1.
- Remover warning de lint conhecido.
- Adicionar testes unitários/contratuais para os comportamentos críticos.

### Fora desta fase
- P2/P3 de escala ampla: sitemap index, full-text search, Prettier/ESLint migration, restrição dinâmica de domínio Supabase, observabilidade avançada.
- Login de cliente final.
- Gateway de pagamento.

## Decisões arquiteturais

### Pedido público
`shortCode` continua existindo como código curto humano para admin/WhatsApp. A URL pública passa a usar `publicToken`, gerado server-side com entropia alta. O token é opaco e não deve carregar significado de loja ou sequência.

`/p/[publicToken]` carrega o pedido por token. A página pública pode mostrar loja, itens, total, status e código curto, mas não deve mostrar nem embutir em links: `customerName`, `customerPhone`, `customerNotes`.

A mensagem WhatsApp reconstruída pela página pública deve ser sanitizada: sem nome do cliente e sem notas. O fluxo imediato de checkout pode continuar usando a mensagem completa no retorno de `createOrderFromCart`, porque essa URL é entregue diretamente ao cliente após submissão do formulário.

### RLS
As policies públicas de pedido não podem ser `USING (true)`. Como a aplicação usa Drizzle com role que bypassa RLS, isso é defesa em profundidade e documentação operacional, mas ainda é obrigatório para não deixar o modelo inseguro quando algum acesso via Supabase anon for introduzido.

### Estoque
Ao criar pedido, se produto/variante rastreia estoque, a transação deve fazer decremento condicional. Se `stock_quantity < requested`, a action retorna `OUT_OF_STOCK`. Idempotência deve ser checada antes de novo decremento para evitar duplo desconto no retry.

### Rotas quebradas
A home já linka `/destaques` e `/novidades`. A correção menos invasiva é criar páginas server-rendered simples reaproveitando loaders existentes (`getFeaturedProducts`, `getRecentProducts`) e `ProductGrid`.

### Invariante 1:1 owner/store
Enquanto o MVP assume 1 loja por owner, o banco deve impor isso com unique em `store.owner_id`. Futuro multi-loja exigirá migration explícita removendo a constraint e alterando `getCurrentStore`.

## Test strategy
- Usar Node built-in test runner via `tsx --test`, sem introduzir Vitest/Jest nesta fase.
- Testes de unidade para helpers puros novos: token, sanitização de mensagem pública, montagem de links públicos.
- Testes contratuais de SQL para garantir policies perigosas não voltam.
- Testes de página/arquivo por inspeção estática para rotas existentes e links corrigidos quando teste de integração Next for caro demais.
- `npm run lint && npm run build` como gate final.

## Riscos
- Migration de `publicToken` em `order` precisa preencher dados existentes antes de `NOT NULL`.
- Decremento de estoque precisa tratar produto e variante sem descontar ambos.
- Idempotência precisa retornar pedido existente sem novo decremento.
- Alterar `/p/[shortCode]` para token pode quebrar pedidos antigos se migration não preencher token.
