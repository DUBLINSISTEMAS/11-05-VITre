# ADR-0032: Storefront bottom-nav com 5 tabs (ratifica override do ADR-0008)

- **Data**: 2026-05-19
- **Status**: aceito — substitui parcialmente [ADR-0008](0008-ux-catalogo-publico-storefront.md) (apenas item "4 tabs"; demais decisões do 0008 permanecem)

## Contexto

[ADR-0008](0008-ux-catalogo-publico-storefront.md) (2026-05-07) fixou
bottom-nav do storefront em **4 itens**: Início · Categorias · Buscar ·
Sacola. O 5º item original da proposta ("Perfil") foi explicitamente
rejeitado naquele ADR por exigir conta de cliente final — o que **quebra
o wedge** "zero login no storefront".

Em 2026-05-11 turno 9 (commit `c00114e`, mandato sênior 7.5→9 pré-Stripe)
o bottom-nav foi expandido para **5 tabs** adicionando **Favoritos**:

```
Início · Categorias · Favoritos · Buscar · Sacola
```

A entrada foi adicionada como **override consciente** do pacote master,
mas o ADR-0008 nunca foi formalmente revisado. O comportamento está em
produção há ~8 dias (auditoria F1 em 2026-05-19 flagou a inconsistência).
O memory `pacote-master-13-items-2026-05-12` e
`favoritos-storefront-localstorage-confirmado` documentam que:

1. Favoritos vive 100% em `localStorage` — não há tabela `favorite`, não
   há FK pra cliente, não há sync de servidor.
2. A página `/favoritos` é client-only, lê localStorage e busca os
   produtos correspondentes por slug/id público.
3. **Nenhum login, nenhuma identificação** — favoritos somem se o
   usuário trocar de dispositivo ou limpar storage. Comportamento
   idêntico ao carrinho (também localStorage, ADR-0010).

Ou seja, Favoritos **NÃO** introduz nada que o ADR-0008 rejeitou:
- Sem conta de cliente final → ok
- Sem foto, endereço, histórico persistido em DB → ok
- Sem storage explodindo no Supabase → ok (cliente armazena local)
- Sem LGPD por dados de consumidor (Vitrê não vê esses favoritos) → ok

A única regra do ADR-0008 violada é a **literal "bottom nav com 4 itens"**.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **A. Ratificar 5 tabs via ADR novo** | UX já em prod estável; favoritos é função genuína; localStorage preserva wedge; reversão custaria ~2h + risco de regressão sem ganho | Quebra contrato textual do ADR-0008; precisa documentar override |
| B. Reverter pra 4 tabs (mover Favoritos pra menu lateral / `/sobre`) | Cumpre ADR-0008 ao pé da letra | Favoritos enterrado em sub-menu reduz uso; estamos a 8 dias do comportamento atual; nenhum cliente pediu reversão |
| C. Reverter pra 4 tabs deletando Favoritos | Mais simples | Remove feature funcional já entregue + testada em piloto Sandra |

## Decisão

**Opção A.** Storefront bottom-nav passa a permitir oficialmente 5 tabs:
**Início · Categorias · Favoritos · Buscar · Sacola** — desde que
**Favoritos seja sempre localStorage-only**, sem login nem persistência
em servidor.

Atualizações textuais necessárias:

1. `CLAUDE.md` → seção "O que NÃO fazer" → mudar `Bottom nav do storefront
   com mais de 4 itens. ADR-0008 fixou: Home · Categorias · Buscar · Sacola.`
   para `Bottom nav do storefront com mais de 5 itens (ADR-0032). Lista
   canônica: Início · Categorias · Favoritos · Buscar · Sacola. Favoritos
   tem que continuar localStorage-only — qualquer tentativa de persistir
   favoritos em DB exige novo ADR.`
2. `ADR-0008` → adicionar nota no topo: "Item 'bottom nav 4 itens'
   superado por ADR-0032. Demais decisões deste ADR permanecem
   válidas."

## Consequências

- ✅ Comportamento UX em produção formalmente sancionado, sem retrabalho.
- ✅ Wedge "zero login storefront" reafirmado e fortalecido — qualquer
  feature futura que tente expandir Favoritos pra ter sync entre devices
  agora precisa explicitamente passar por novo ADR (gate forte).
- ✅ Documentação interna agora reflete o código (gap fechado).
- ⚠️ Trade-off aceito: 5 ícones em 360px de largura ficam apertados em
  telas pequenas. Variante `pill` usa labels de 10.5px — testado em
  iPhone SE (375px) e funciona; em <360px (raro) pode haver overlap.
  Aceitar por ora; revisitar se >2 reports de UX.
- 🔧 Dívida técnica: precisa atualizar `CLAUDE.md` + adicionar nota
  retroativa no ADR-0008. Ambos triviais (~3 linhas cada).

## Invariantes preservados

- **Sem login no storefront** (carrinho + favoritos = localStorage).
- **Sem perfil de cliente final** — não há rota `/perfil` no storefront.
- **Sem foto/endereço/histórico em DB pra cliente final** — tabela
  `customer` é admin-only (ADR-0014).
- **Bottom-nav admin permanece independente** — ADR-0011 e ADR-0032 se
  aplicam só ao storefront público (ver memory
  `admin-bottom-nav-separate-from-adr-0011`).

## Quem decidiu

Anderson Felipe (founder) + auditoria sênior 2026-05-19 (frente F1).
Override formalizado retroativamente.
