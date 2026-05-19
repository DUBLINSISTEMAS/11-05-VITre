# ADR-0033: Veto fiscal explícito — Vitrê não emite documento fiscal

- **Data**: 2026-05-19
- **Status**: aceito
- **Formaliza**: veto informal já presente em [CLAUDE.md](../../CLAUDE.md) ("NF-e, SEFAZ, integração fiscal. Fora do escopo do pivô")
- **Relaciona com**: [ADR-0012](./0012-pivot-vitre-gestao.md) (pivô gestão), [ADR-0034](./0034-camada-comercial-vitre.md) (camada comercial — o que entra no lugar)

## Contexto

Em 2026-05-19 founder apresentou Vitrê a prospects que usam **GFIL** (ERP Delphi tradicional, versão 11.1.6). Screenshots do GFIL trazidos pra sessão mostram:

- Tela "Venda de Produtos (Mercadorias)" com colunas **CFOP**, **CST ICMS**, **Base ICMS**, **Alíq. ICMS**, **B.C. ICMS**, **Valor ICMS**, **B.C. ST**, **Valor S.T.**, **B.C. IPI**, **Valor IPI**, **F.C.P. S.T.**, **ICMS Deson.**
- Bloco "Impostos - I.C.M.S." com CFOP (F8), Situação Tributária - CSOSN, % Red.B.C., Base Cálculo, Alíquota, Valor ICMS, ICMS ST
- Bloco "I.P.I." com Situação Tributária (F8 busca), Alíquota, Valor IPI
- Menu **Nota Fiscal**, submenu **Imprimir** com Duplicatas / Carnê de Pagamento / Notas Promissórias / Boletos / Termo de Garantia
- Cadastro de produto com "Grupo de Tributação" (Simples Nacional) + "Gr. de Trib. Reforma" + "Informações Adicionais Para NFe"
- Botão **NFe** no menu principal

Prospects pediram features "mais completas" pra considerar migração. Conselho de 5 agentes (sessão 2026-05-19) avaliou e identificou:

1. **Prospects NÃO emitem NFe regularmente hoje** (confirmado pelo founder). MEI ou Simples com baixa emissão.
2. **Pedido por "campos fiscais visíveis" foi conforto visual** — confusão entre familiaridade com layout do GFIL e necessidade funcional real.
3. **"Sistema completo" ≠ "sistema fiscal"**. Vitrê pode ser comercialmente completo (margem, orçamento, recibo, comissão, livro caixa) sem nunca tocar em SEFAZ.
4. Entrar em fiscal real coloca Vitrê pra concorrer com **Bling, Tiny, Conta Azul, Omie** — empresas com times de 50+ pessoas só em fiscal, certificadora paga, ambiente de homologação por UF.

CLAUDE.md já trazia veto informal, mas veto informal não fecha porta — pedido pode voltar a cada novo prospect. **Este ADR formaliza para que o veto seja citável e a porta esteja fechada arquitetonicamente.**

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| A — Emitir NF-e nativamente | Concorre direto com Bling/Tiny; trava migração de lojista formalizado | 200-600h dev + R$2-5k/mês manutenção fiscal + certificadora paga + sai do free tier + responsabilidade civil por erro de cálculo + 27 UFs com regras próprias + concorrência com times de 50+ pessoas — inviável pra founder solo |
| B — Integrar com Bling/Tiny via API (lojista emite lá, Vitrê só sincroniza) | Lojista que precisa de NF tem caminho; Vitrê não toca em fiscal | Backlog, não bloqueante; primeiro precisa de cliente pagante pedindo |
| C — **Veto explícito + recibo não-fiscal + campo livre "doc fiscal" no order** (escolhida) | Fecha porta arquiteturalmente; libera tempo do founder pra camada comercial real; aceita perda de prospects 100% NF-dependentes (não são ICP) | Lojista que precisa de NF não migra sem solução B futura |

## Decisão

**Vitrê NÃO emite, processa, transmite, valida, calcula, nem armazena documento fiscal eletrônico de qualquer tipo.**

### Fora de escopo (vetado por este ADR)

- **NF-e** (Nota Fiscal Eletrônica modelo 55)
- **NFC-e** (Nota Fiscal de Consumidor Eletrônica modelo 65)
- **MDF-e** (Manifesto Eletrônico de Documentos Fiscais)
- **CT-e** (Conhecimento de Transporte Eletrônico)
- **SAT-CF-e** (Sistema Autenticador e Transmissor de Cupons Fiscais Eletrônicos)
- Cálculo automático de **ICMS**, **ICMS-ST**, **ISS**, **IPI**, **PIS**, **COFINS**, **CSOSN**, **CST**, **FCP**
- Determinação automática de **CFOP**
- Geração de **SPED Fiscal**, **SPED Contribuições**, **EFD ICMS/IPI**, **ECF**
- Integração com **SEFAZ** de qualquer UF (homologação ou produção)
- Geração de **boleto bancário** com código de barras e linha digitável emitida (instrumento financeiro)
- **Duplicata mercantil** (instrumento jurídico de cobrança regulada por lei)
- **Carnê de cobrança** com boleto associado
- **Nota promissória** (instrumento de crédito)
- Armazenamento de **certificado digital A1/A3**

### Aceitável (continua dentro de escopo)

- **Recibo não-fiscal** impresso (térmica ou PDF) com obrigatório texto rodapé "**ESTE DOCUMENTO NÃO TEM VALOR FISCAL**"
- **Orçamento** (proposta comercial) impresso — não é documento fiscal, é proposta
- **Termo de garantia** impresso (instrumento contratual entre lojista e cliente, sem dimensão fiscal)
- **Controle interno** de "pago / a pagar / vencido" sem geração de boleto bancário real
- **Campo livre `documento_fiscal_externo`** (texto) na `orderTable` onde lojista anota número de NF emitida em OUTRO sistema (Bling, emissor da contadora, etc.)
- **Marcador de status** "nota emitida sim/não" para controle interno

### Quando reabrir este veto

**Nunca por iniciativa interna.** Só revisitar se TODAS as condições abaixo forem verdadeiras em mesmo trimestre:

1. ≥10 clientes pagantes em contrato ativo (mín. R$ 50/mês cada)
2. ≥7 destes 10 clientes pedirem NF-e explicitamente como bloqueador de uso
3. Caixa do Vitrê comportar contratação de especialista fiscal full-time (R$ 8-15k/mês)
4. Founder aceitar que produto vai virar concorrente direto de Bling/Tiny

Cumpridas as 4, o caminho preferido **ainda é integração via API com Bling/Tiny**, não emissão própria. Emissão própria só com calçamento de 18+ meses de runway dedicado.

## Consequências

- ✅ **Foco protegido**: founder solo não vira fornecedor de software fiscal por acidente. Cada vez que um prospect pedir "campo de CFOP", a resposta é: "Vitrê não emite NF — quando precisar, integramos com seu emissor (futuro)."
- ✅ **Citável em conversa comercial**: ADR-0033 é referência objetiva. Veto não é capricho, é arquitetura.
- ✅ **Superfície de suporte reduzida**: sem reclamações de "calculou ICMS errado" / "rejeitou na SEFAZ" / "linha digitável inválida".
- ✅ **Free tier preservado**: certificadora + ambiente SEFAZ exigem custo recorrente que sai do R$ 0/mês.
- ✅ **Risco jurídico zerado**: Vitrê não calcula tributo, logo não responde por erro de cálculo de tributo.
- ⚠️ **Prospects 100% NF-dependentes não migram**. Aceito — eles não são ICP do Vitrê.
- ⚠️ **Necessário canal claro para o lojista**: tela do PDV / orçamento deve deixar explícito que o documento impresso é não-fiscal. UI da Onda C3 (impressão térmica) cobre isso.
- 🔧 **Migration futura**: orderTable ganhará coluna `external_fiscal_doc text NULL` (texto livre) — entra junto com Onda C3 ou C4 da camada comercial.

## Atualizações em CLAUDE.md

Seção "O que NÃO fazer" já cita veto fiscal. **Acrescentar referência cruzada**: "❌ **NF-e, SEFAZ, integração fiscal.** [ADR-0033](docs/decisoes/0033-veto-fiscal-explicito.md) formaliza."

## Quem decidiu

Anderson Felipe (founder) — após sessão de Conselho-5-agentes em 2026-05-19, gatilho foi apresentação de Vitrê a prospects usuários de GFIL. Resposta direta do founder à pergunta "prospects emitem NF-e regular hoje?": "Não, ou só esporadicamente". Plano de execução: Claude Code (sessão 2026-05-19).