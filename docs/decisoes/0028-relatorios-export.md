# ADR-0028: Relatórios + export CSV/PDF (sem deps novas)

- **Data**: 2026-05-18
- **Status**: aceito

## Contexto

Lojista precisa de relatórios pra acompanhar o negócio: vendas por período,
produtos mais vendidos, ticket médio, conversão de leads, estoque baixo.
Hoje só existe o dashboard do `/admin` (single snapshot) e o card "Caixa do
dia" (`/admin/pdv/caixa`). Falta:

1. Página dedicada `/admin/relatorios` com seleção de período
2. Visões: vendas / produtos / clientes / leads / estoque
3. Export pra consumir fora do Vitrê (planilha + impressão)

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| A. CSV download + window.print (PDF nativo do browser) | Zero deps, leve, "Excel abre CSV" | Sem layout rico no PDF (depende do CSS print) |
| B. xlsx + @react-pdf/renderer | XLSX nativo + PDF customizado | +200kb bundle; xlsx tem issues de maintenance (CDN-only); @react-pdf/renderer +400kb |
| C. Server-side PDF via puppeteer/chromium em edge function | Layout idêntico | Vercel free tier não comporta; cold start; complexidade |

## Decisão

**Opção A**. Page `/admin/relatorios` renderiza cards/tabelas server-side
(Drizzle queries agregadas). Botões "Baixar CSV" usam blob no client com
`encodeURI` + `download` attribute. Botão "Imprimir" chama `window.print()`
e CSS `@media print` esconde sidebar/header.

Período: `?periodo=7|30|90|custom&start=YYYY-MM-DD&end=YYYY-MM-DD` (padrão URL state).

5 relatórios no MVP:
1. **Vendas** — total / por método / por canal / linha temporal
2. **Produtos** — top vendidos por quantidade e por receita
3. **Clientes** — top compradores, novos do período, ticket médio
4. **Leads** — taxa de conversão, leads novos, leads convertidos
5. **Estoque** — produtos zerados, baixo (≤3), por entrada/saída

Quando lojista pedir XLSX nativo (Sandra ou outro cliente real), abre
ADR-0028b + instala xlsx via CDN-bundled mirror.

## Consequências

- ✅ Zero deps novas; sem inflar bundle
- ✅ CSV é universal (Excel/Sheets/Numbers abrem)
- ✅ Print fica responsabilidade do CSS (já temos `@media print` em outros lugares)
- ⚠️ PDF sem branding rico — só o conteúdo da página com cores apagadas
- 🔧 Se cliente pagante pedir XLSX/PDF custom, faz ADR-0028b

## Quem decidiu

Anderson Felipe (founder) — execução autônoma 2026-05-18 noite.
