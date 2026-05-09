# ADR-0004: Path-based routing no MVP

- **Data**: 2026-05-07
- **Status**: aceito

## Contexto

Catálogo público de cada loja precisa de URL própria. Duas estratégias clássicas: subdomínio (`sandra.vitre.com.br`) ou path (`vitre.com.br/sandra-brito`).

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Path | Simples, 1 SSL, 1 DNS, deploy trivial na Vercel | Visualmente menos "premium" |
| Subdomínio | Mais profissional | SSL wildcard, DNS dinâmico por loja, cookie scoping complexo |
| Domínio próprio | Top em branding | Lojista compra domínio, configura DNS — atrito alto |

## Decisão

**Path-based no MVP**. `vitre.com.br/[storeSlug]/...`. Subdomínio na Fase 4+, domínio próprio mais tarde.

Rotas reservadas (não podem ser slugs de loja):
`admin`, `api`, `app`, `www`, `sobre`, `precos`, `entrar`, `criar-loja`, `p` (atalho de pedido), `_next`, `_legacy`, `assets`, `static`.

## Consequências

- ✅ 1/10 do esforço operacional vs subdomínio.
- ✅ Público-alvo chega pelo link (Insta/WA), não digita URL — visual da URL não impacta conversão.
- ⚠️ Reservar palavras desde já. Validar slug contra lista no momento do signup.
- 🔧 Migração futura para subdomínio precisa de redirect 301 mantendo SEO.

## Quem decidiu

Anderson Felipe (founder) + Conselho-5-agentes (NEXUS argumentou que path-based resolve 90% do valor com 10% do esforço).
