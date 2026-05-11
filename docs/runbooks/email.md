# Email Transacional

## Quando Usar

Use antes de vender para clientes reais, ao trocar dominio, ou quando password reset/verificacao de email nao chegar.

## Pre-Requisitos

- Acesso ao painel Resend.
- Acesso ao DNS do dominio.
- Acesso as variaveis de ambiente da Vercel.
- Dominio definitivo ou subdominio de envio, por exemplo `seudominio.com`.

## Passos

1. Entre no Resend.
2. Acesse `Domains`.
3. Clique em `Add Domain`.
4. Informe o dominio de envio, por exemplo `seudominio.com`.
5. Copie os registros DNS indicados pelo Resend.
6. No provedor DNS, adicione os registros SPF, DKIM e demais registros exigidos.
7. Aguarde a propagacao e a verificacao do Resend. Normalmente leva de 5 a 30 minutos.
8. Na Vercel, atualize `RESEND_FROM_EMAIL` para um remetente do dominio verificado, por exemplo `noreply@seudominio.com`.
9. Confirme que `RESEND_API_KEY` esta configurada no ambiente correto.
10. Faca um redeploy.

## Verificacao

1. Solicite reset de senha em `/recuperar` usando um email real que nao seja o dono da conta Resend.
2. Confirme que o email chega na caixa de entrada.
3. Confirme que o link abre `/redefinir` e permite trocar a senha.
4. Verifique logs da Vercel/Sentry. Nao deve aparecer `email.using_resend_dev_in_prod`.

## Rollback

1. Se emails falharem depois da troca, volte `RESEND_FROM_EMAIL` na Vercel para o remetente anterior verificado.
2. Redeploy.
3. Refaca a verificacao acima.

## Observacoes

- Nao use `@resend.dev` em producao com cliente real. Esse dominio e util para desenvolvimento, mas nao garante entrega para usuarios finais.
- A verificacao de email de signup continua desligada por decisao de produto; password reset precisa funcionar desde o primeiro cliente pagante.
