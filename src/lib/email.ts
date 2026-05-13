/**
 * Cliente Resend + helpers de envio de email transacional.
 *
 * Templates HTML inline (sem react-email para manter o bundle leve).
 * Pegada visual: Vitre azul `#1E3FE6`, mobile-first, minimo de adornos.
 */
import { Resend } from "resend";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const resend = new Resend(env.RESEND_API_KEY);

const VITRE_PRIMARY = "#1E3FE6";

// Fallback para desenvolvimento quando RESEND_FROM_EMAIL não está configurado
const FROM_EMAIL = env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

if (
  process.env.NODE_ENV === "production" &&
  FROM_EMAIL.endsWith("@resend.dev")
) {
  logger.warn("email.using_resend_dev_in_prod", {
    note:
      "Resend dev domain so envia para o dono da conta. Configurar dominio verificado antes de cliente real.",
  });
}

interface SendVerificationEmailInput {
  to: string;
  url: string;
  name: string;
}

export async function sendVerificationEmail({
  to,
  url,
  name,
}: SendVerificationEmailInput) {
  const firstName = name?.split(" ")[0] ?? "";
  const result = await resend.emails.send({
    from: `Vitrê <${FROM_EMAIL}>`,
    to,
    subject: "Confirme seu e-mail no Vitrê",
    html: buildEmailHtml({
      title: firstName ? `Bem-vindo, ${firstName}!` : "Bem-vindo ao Vitrê!",
      bodyText:
        "Confirme seu e-mail clicando no botão abaixo para começar a usar o Vitrê.",
      ctaUrl: url,
      ctaLabel: "Confirmar e-mail",
    }),
  });
  if (result.error) {
    throw new Error(`Resend falhou ao enviar verificação: ${result.error.message}`);
  }
  return result;
}

interface SendPasswordResetEmailInput {
  to: string;
  url: string;
  name?: string;
}

export async function sendPasswordResetEmail({
  to,
  url,
  name,
}: SendPasswordResetEmailInput) {
  const firstName = name?.split(" ")[0];
  const result = await resend.emails.send({
    from: `Vitrê <${FROM_EMAIL}>`,
    to,
    subject: "Redefinir sua senha no Vitrê",
    html: buildEmailHtml({
      title: firstName ? `Olá, ${firstName}` : "Redefinição de senha",
      bodyText:
        "Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para escolher uma nova. Se você não fez essa solicitação, ignore este e-mail — sua senha continua a mesma.",
      ctaUrl: url,
      ctaLabel: "Redefinir senha",
    }),
  });
  if (result.error) {
    throw new Error(`Resend falhou ao enviar reset: ${result.error.message}`);
  }
  return result;
}

interface BuildEmailInput {
  title: string;
  bodyText: string;
  ctaUrl: string;
  ctaLabel: string;
}

function buildEmailHtml({
  title,
  bodyText,
  ctaUrl,
  ctaLabel,
}: BuildEmailInput): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0a0a0a;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e5e5;">
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <div style="display:inline-block;background:${VITRE_PRIMARY};border-radius:12px;padding:10px 20px;color:#ffffff;font-weight:700;font-size:18px;letter-spacing:-0.02em;">Vitrê</div>
            </td>
          </tr>
          <tr>
            <td style="font-size:24px;font-weight:700;line-height:1.3;padding-bottom:12px;color:#0a0a0a;">${escapeHtml(title)}</td>
          </tr>
          <tr>
            <td style="font-size:16px;line-height:1.6;color:#525252;padding-bottom:32px;">${escapeHtml(bodyText)}</td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${VITRE_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:16px;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;line-height:1.5;color:#a3a3a3;padding-top:24px;border-top:1px solid #f5f5f5;">
              Se o botão não funcionar, copie e cole este link no navegador:<br>
              <a href="${escapeHtml(ctaUrl)}" style="color:${VITRE_PRIMARY};word-break:break-all;">${escapeHtml(ctaUrl)}</a>
            </td>
          </tr>
        </table>
        <div style="font-size:12px;color:#a3a3a3;margin-top:16px;">Vitrê — vitrine digital com checkout WhatsApp</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
