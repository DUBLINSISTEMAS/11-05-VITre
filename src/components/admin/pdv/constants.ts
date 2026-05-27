/**
 * Constantes do PDV (S4.1 — extraídas de pdv-shell.tsx 3409).
 */
import {
  BanknoteIcon,
  CreditCardIcon,
  PackageIcon,
  ReceiptIcon,
} from "lucide-react";

import type { PaymentMethodOption } from "./types";

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: "cash", label: "Dinheiro", Icon: BanknoteIcon },
  { value: "pix", label: "PIX", Icon: ReceiptIcon },
  { value: "debit", label: "Cartão débito", Icon: CreditCardIcon },
  { value: "credit", label: "Cartão crédito", Icon: CreditCardIcon },
  { value: "other", label: "Outro", Icon: PackageIcon },
];

export const MAX_PAYMENT_LINES = 5;

/** Limite de parcelas oferecido no PDV — padrão varejo BR. */
export const MAX_PDV_INSTALLMENTS = 12;
