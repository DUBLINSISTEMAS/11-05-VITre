# Visão do Vitrê

SaaS de loja online com checkout WhatsApp para lojas de pequeno e médio porte (roupa, joia, semijoia, perfumaria) em cidades do interior do Brasil.

## Proposta de valor

- **Para a lojista**: substitui o "manda foto no Insta" por um catálogo profissional, com link único, foto pelo celular, gestão de estoque/promoção/banner.
- **Para o cliente final**: navegar produtos como em um e-commerce, fechar pedido em 2 cliques pelo WhatsApp da loja, sem precisar criar conta.
- **Para o Vitrê (negócio)**: SaaS recorrente, ticket-alvo R$ 30-100/mês. 1k lojistas = R$ 30-100k MRR.

## Não-objetivos no MVP

- Não temos gateway de pagamento próprio. A lojista vende pelo WhatsApp dela.
- Não competimos com Loja Integrada / Nuvemshop. Vitrê é mais simples por design.
- Não fazemos integração com Correios, ERP, marketplace, app nativo.

## Diferencial

- Onboarding em ≤ 5 min.
- Foto pela câmera nativa do celular no painel admin (mobile-first).
- Checkout WhatsApp com **código curto** registrado server-side (lojista correlaciona pedido com mensagem).
- Multi-tenant via Postgres RLS desde a primeira migration — segurança por construção.

## Tese central (a validar)

> Lojista de roupa/joia/perfumaria de cidade pequena pagaria R$ 30-100/mês para ter uma loja online com checkout WhatsApp em vez de mandar fotos soltas no Instagram.

Status: **validada parcialmente** (1 lojista — Sandra Brito Collection — confirmou interesse e aguarda entrega).
