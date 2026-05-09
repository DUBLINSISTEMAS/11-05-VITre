/**
 * Schemas Zod compartilhados client/server (single source of truth).
 * Usados por react-hook-form no client e por server actions no server.
 */
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres")
  .max(128, "Senha muito longa");

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome muito curto")
    .max(80, "Nome muito longo"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Digite um email válido"),
  password: passwordSchema,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Digite um email válido"),
  password: z.string().min(1, "Digite sua senha"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const requestPasswordResetSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Digite um email válido"),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token ausente"),
    password: passwordSchema,
    // Validação leve aqui — o `.refine` abaixo cuida de "não coincidem".
    // Evita mostrar "≥8 caracteres" no campo confirmar quando o real
    // problema é só "as senhas diferem".
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
