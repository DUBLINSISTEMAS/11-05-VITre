/**
 * Cliente Resend + helpers de envio de email transacional.
 *
 * Templates HTML inline (sem react-email para manter o bundle leve).
 * Pegada visual: azul `#1E3FE6` do Mangos Pay, mobile-first, minimo de adornos.
 */
import { Resend } from "resend";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const resend = new Resend(env.RESEND_API_KEY);

const BRAND_PRIMARY = "#1E3FE6";

if (
  process.env.NODE_ENV === "production" &&
  env.RESEND_FROM_EMAIL.endsWith("@resend.dev")
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
    from: `Mangos Pay <${env.RESEND_FROM_EMAIL}>`,
    to,
    subject: "Confirme seu e-mail no Mangos Pay",
    html: buildEmailHtml({
      title: firstName ? `Bem-vindo, ${firstName}!` : "Bem-vindo ao Mangos Pay!",
      bodyText:
        "Confirme seu e-mail clicando no botão abaixo para começar a usar o Mangos Pay.",
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
    from: `Mangos Pay <${env.RESEND_FROM_EMAIL}>`,
    to,
    subject: "Redefinir sua senha no Mangos Pay",
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

/**
 * Feedback do lojista pro time Mangos — handoff Passo 14 (2026-05-25).
 *
 * Formato plaintext-ish (sem CTA button) pra preservar o conteúdo bruto
 * digitado. Destinatário fixo (suporte@mangospay.app). Reply-to do
 * lojista pra responder fechar o loop sem pular email.
 */
interface SendFeedbackEmailInput {
  fromOwnerName: string;
  fromOwnerEmail: string;
  storeName: string;
  storeSlug: string;
  type: "idea" | "bug" | "feature" | "praise";
  message: string;
}

const FEEDBACK_TYPE_LABEL: Record<SendFeedbackEmailInput["type"], string> = {
  idea: "💡 Ideia",
  bug: "🐛 Bug / erro",
  feature: "➕ Pedido de feature",
  praise: "🙌 Elogio",
};

export async function sendFeedbackEmail({
  fromOwnerName,
  fromOwnerEmail,
  storeName,
  storeSlug,
  type,
  message,
}: SendFeedbackEmailInput) {
  const typeLabel = FEEDBACK_TYPE_LABEL[type];
  const subject = `[Feedback] ${typeLabel} — ${storeName}`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a0a0a;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e5e5e5;">
        <tr><td style="padding-bottom:16px;">
          <div style="display:inline-block;background:#174D44;color:#FFF8E8;border-radius:10px;padding:6px 12px;font-weight:700;font-size:13px;">${escapeHtml(typeLabel)}</div>
        </td></tr>
        <tr><td style="font-size:18px;font-weight:700;line-height:1.3;padding-bottom:8px;">${escapeHtml(storeName)}</td></tr>
        <tr><td style="font-size:13px;color:#525252;padding-bottom:20px;">${escapeHtml(fromOwnerName)} &lt;${escapeHtml(fromOwnerEmail)}&gt; · mangospay.app/${escapeHtml(storeSlug)}</td></tr>
        <tr><td style="padding-bottom:8px;border-top:1px solid #f5f5f5;padding-top:20px;font-size:11px;color:#a3a3a3;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;">Mensagem</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:#0a0a0a;white-space:pre-wrap;">${escapeHtml(message)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const result = await resend.emails.send({
    from: `Mangos Pay Feedback <${env.RESEND_FROM_EMAIL}>`,
    to: env.FEEDBACK_TO_EMAIL ?? "suporte@mangospay.app",
    replyTo: fromOwnerEmail,
    subject,
    html,
  });
  if (result.error) {
    throw new Error(`Resend falhou ao enviar feedback: ${result.error.message}`);
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
              <div style="display:inline-block;background:${BRAND_PRIMARY};border-radius:12px;padding:10px 20px;color:#ffffff;font-weight:700;font-size:18px;letter-spacing:-0.02em;">Mangos Pay</div>
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
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:16px;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;line-height:1.5;color:#a3a3a3;padding-top:24px;border-top:1px solid #f5f5f5;">
              Se o botão não funcionar, copie e cole este link no navegador:<br>
              <a href="${escapeHtml(ctaUrl)}" style="color:${BRAND_PRIMARY};word-break:break-all;">${escapeHtml(ctaUrl)}</a>
            </td>
          </tr>
        </table>
        <div style="font-size:12px;color:#a3a3a3;margin-top:16px;">Mangos Pay — loja online com checkout WhatsApp</div>
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
