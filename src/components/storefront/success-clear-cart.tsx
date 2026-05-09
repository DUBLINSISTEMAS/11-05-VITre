"use client";

/**
 * Componente client minúsculo que limpa o carrinho ao montar.
 *
 * O server action já criou o pedido; aqui só precisamos garantir que
 * `localStorage` reflita "carrinho vazio" pra evitar que o cliente
 * volte ao /sacola e veja itens fantasmas.
 *
 * Idempotência: se o cliente recarregar /sucesso, clearCart é idempotente.
 */
import { useEffect } from "react";

import { useCart } from "@/hooks/use-cart";

export function SuccessClearCart() {
  const { clearCart } = useCart();
  useEffect(() => {
    clearCart();
  }, [clearCart]);
  return null;
}
