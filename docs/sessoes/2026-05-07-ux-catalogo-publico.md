# 2026-05-07 — Decisão de UX do catálogo público

Sessão de deliberação sobre a estrutura visual e de navegação do storefront `/[storeSlug]/...`.

## O que aconteceu

1. Anderson trouxe proposta inspirada em Shopee/Shein/Mercado Livre (sidebar drill-down, bottom nav 5 itens, conta de cliente final, perfil, favoritos, pedidos, foto, endereço).
2. Conselho-5-agentes aplicado.
3. Detectado conflito frontal entre **conta de cliente final** e a tese central documentada em ADR-0001, ADR-0002 e visão do produto.
4. Veredito do conselho: GO COM RESSALVAS — adotar todas as ideias visuais (drill-down, bottom nav, busca, listagem) mas **rejeitar conta de cliente** mantendo o wedge.
5. Anderson concordou com o veredito.

## Decisão

[ADR-0008 — UX do catálogo público (storefront)](../decisoes/0008-ux-catalogo-publico-storefront.md)

Resumo:
- **Cliente final continua sem conta** (carrinho em localStorage, checkout via WhatsApp).
- **Sidebar drill-down lateral** (substitui o expand-inline da proposta anterior).
- **Bottom nav fixo com 4 itens**: Home · Categorias · Buscar · Sacola.
- **Busca global** em `/[storeSlug]/buscar`.
- **Listagem com filtros** (preço, ordenação) recolhidos em drawer.
- **Página `/sobre`** da loja (não confundir com perfil de cliente — não existe).
- Roadmap restante: **80h → 86h** (+6h na Fase 1.5).

## Por que rejeitamos conta de cliente

- Login obrigatório mata 40-70% das vendas (Baymard).
- LGPD: Vitrê viraria controlador de dados de consumidores finais de N lojas.
- Storage de fotos explode no free tier.
- Schema multiplica em 5x (customer, session, favorite, address, M2M).
- Identificação exigia OTP SMS (Twilio = custo) ou OAuth WA (raro).
- Atrasaria Sandra Brito em 3-4 semanas.
- Vitrê viraria mini-Loja-Integrada **sem ter gateway de pagamento** — pior dos dois mundos.

## Por que aceitamos 80% das ideias visuais

- Sidebar drill-down é elegante e padrão Shopee/Shein.
- Bottom nav de 4 itens cabe em zona-polegar mobile.
- Busca global é útil quando lojas têm muito produto.
- Filtros em drawer mantêm UI limpa.
- Páginas dedicadas (`/buscar`, `/sobre`) > modais aninhados.

## Próximos passos

- Quando chegar Fase 1.5: ler ADR-0008 + este log.
- Mockups detalhados estão no ADR.
- Princípios de UX (Hick, Fitts, etc.) documentados no ADR para consultar ao codar componentes.

## Aprendizado capturado

Quando proposta do founder conflitar com tese documentada (ADRs, visão), **defender com argumentos** (não só "ADR diz não") e oferecer caminho de meio (Fase 2 futura, se 5+ lojistas pedirem). Founder validou abordagem e tomou decisão consciente.
