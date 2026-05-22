# Smoke prod pré-lojista #1 — runbook

> Sprint 6.9-6.14. Antes do primeiro lojista real entrar, validar que
> tudo funciona com hardware real (impressora, dispositivo mobile, fotos
> de verdade). NÃO dá pra fazer só com agente — exige Anderson na
> ponta.

Checklist sequencial. Bloqueia entrada do lojista #1 se algo falhar.
Quando passar tudo, marcar `[x]` em `docs/VISAO-COMPLETA.md` Sprint 6.

---

## L1 — Venda balcão real com recibo impresso

**Setup**
- Cadastra 3 produtos com preço diferente
- Loja com nome real, endereço preenchido, CNPJ (formato 14 dígitos só números)
- Impressora ligada e configurada no SO

**Roteiro**
1. `/admin/pdv` — abrir caixa com R$ 50 de troco
2. Adicionar 3 produtos no carrinho, quantidades variadas
3. Finalizar como `Dinheiro`, valor recebido > total (gerar troco)
4. Clicar `Imprimir` na tela de "Venda registrada"
5. Tentar formato **Térmico 80mm** primeiro:
   - Papel sai estreito e centralizado, sem cortar texto
   - Logo + nome + CNPJ legíveis no topo
   - Total destacado, troco visível
6. Voltar e tentar formato **A4**:
   - Papel sai com margens generosas
   - Header centralizado com logo maior
   - Rodapé "Gerado em DD/MM HH:MM por {operador}"

**Esperado**: ambos os formatos imprimem sem cortar, sem ficar tira no meio da folha.

---

## L2 — Storefront em 3G mobile (rede do interior)

**Setup**
- Dispositivo Android real (não emulador)
- Operadora com 3G — desliga 4G/5G ou vai pra área de cobertura ruim
- 1 loja com ≥ 6 produtos + 2 categorias + 1 banner

**Roteiro**
1. Abrir `https://{storeSlug}.mangospay.app` (ou link direto)
2. Cronometrar até **primeiro produto visível** — alvo ≤ 4s em 3G
3. Tocar 1 produto, esperar PDP carregar
4. Adicionar à sacola, ir pro checkout
5. Preencher nome + WhatsApp, finalizar
6. Verificar redirect pro WhatsApp do lojista funcionou

**Esperado**: sem freezes, sem erro 5xx, fluxo completo em ≤ 60s.

**Se travar**: anotar onde travou (lista? PDP? checkout?), screenshot, defer pra investigação.

---

## L3 — Cadastrar 20 produtos com fotos reais

**Roteiro**
1. `/admin/produtos/novo`
2. Para cada produto:
   - Nome + preço + categoria (existente)
   - **Subir foto real** do produto (JPG/PNG > 1MB tirada com câmera)
3. Cronometrar tempo até a 20ª foto aparecer no storefront

**Esperado**:
- `sharp` comprime cada foto pra ≤ 800×800 WebP 75%
- Upload ≤ 3s por foto em internet normal
- Foto aparece na home / categoria / PDP após salvar

**Smoke check**: abrir 1 produto na home, comparar foto exibida vs foto original — deve estar nítida, sem distorção.

---

## L4 — Fluxo de exceção (devolução parcial + estorno fiado)

**Setup**
- 1 venda balcão registrada com 3 itens
- 1 venda balcão registrada como fiado (sem pagamento)

**Roteiro venda paga**
1. Abrir detalhe → "Registrar devolução"
2. Aba "Alguns itens" → marcar checkbox de 1 item, qty=1
3. Motivo: "Cliente trouxe de volta — defeito na costura"
4. Confirmar

**Esperado**: status da venda continua `confirmed`, badge mostra "−R$X devolvido", caixa registra saída proporcional.

**Roteiro fiado**
1. Abrir detalhe da venda fiado → "Registrar devolução"
2. Dialog mostra subtela "Fiado em aberto bloqueia devolução"
3. Clicar "Abrir fiado" → vai pra `/admin/financeiro/receber`
4. Marcar fiado como pago (ou estornar pagamento parcial se houver)
5. Voltar pra venda → "Registrar devolução" funciona

**Esperado**: fluxo guiado sem erro técnico, lojista entende cada passo.

---

## L5 — Fechamento Z impresso + enviar pro contador

**Roteiro**
1. Fechar caixa com contagem física + observação
2. Abrir `/admin/pdv/caixa/{id}` (Z final)
3. Clicar `Imprimir` — sai folha A4
4. Conferir:
   - CNPJ no header
   - Resumo (Esperado / Contagem / Diferença)
   - Movimentações + vendas balcão da sessão
   - Linha "Operador" / "Conferido por" pra assinatura
   - Rodapé "Gerado em ... por {operador} · Página N"
5. Tirar foto do papel impresso, mandar pro contador via WhatsApp
6. Contador responde se entendeu

**Esperado**: contador não pede informação adicional. Documento self-contained.

---

## L6 — Lighthouse mobile ≥ 90

**Setup**
- Chrome DevTools → Lighthouse → Mobile + Performance + Accessibility + SEO

**Roteiro**
1. URL: `https://{storeSlug}.mangospay.app` (loja com produto)
2. Run Lighthouse — Mobile, simulado fast 3G
3. Anotar 4 scores:
   - Performance ≥ 90
   - Accessibility ≥ 90
   - Best Practices ≥ 90
   - SEO ≥ 90

**Se algum < 90**: anotar 3 itens críticos do report. Defer ou ataca conforme prioridade.

---

## Após L1-L6 verde

1. Marcar `[x]` em `docs/VISAO-COMPLETA.md` Sprint 6.9-6.14
2. Atualizar histórico no doc com data
3. **Lojista #1 pode entrar.** Sandra ou outro piloto.
4. Próximas Sprints: PÓS-#1 (refator pdv-shell, importer CSV, multi-tenant signup).
