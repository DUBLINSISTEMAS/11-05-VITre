"use client";

// Popover do sino de notificações — handoff design 2026-05-25 (Passo 5).
//
// Substitui o botão `<BellIcon>` estático que estava na topbar (sem
// onClick, com `ndot` permanente sem origem real) por um Popover Radix
// honesto: clica → abre painel → mostra a lista (vazia hoje, com empty
// state explícito; quando houver tabela `notification`, basta trocar o
// data source).
//
// Régua "funciona ou esconde": o dot só aparece quando `unreadCount > 0`.
// Hoje hardcoded em 0 — sem dot, sem mistério.
//
// Visual: painel 360px alinhado à direita do trigger, com header (título
// + contador + "Marcar todas como lidas") e empty state cream. Tokens
// `.b3-notif-*` em globals.css.
//
// Atalho não definido (sino raramente vira ação muscle-memory; Cmd+K
// cobre busca global).
import { BellIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Forma de uma notificação — espelha o que o prototype usa.
 * Mantida exportada pra o dia em que `loadAdminNotifications()` virar
 * server action: o tipo já está pronto.
 */
export interface AdminNotification {
  id: string;
  type: "sale" | "warn" | "stock" | "message" | "fiado";
  title: string;
  body: string;
  /** Texto curto tipo "há 2 min" ou "ontem". */
  when: string;
  unread: boolean;
  /** Rota pra navegar no click (ex: /admin/pedidos?detail=xyz). */
  href: string;
}

export function NotificationsPopover() {
  // TODO: trocar por server action `loadAdminNotifications()` quando a
  // tabela `notification` existir. Empty state hoje é honesto: o sistema
  // ainda não emite notificações in-app (alerta de estoque, fiado vencido,
  // nova venda online, etc).
  const notifications: AdminNotification[] = [];
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="b3-top-icbtn"
          aria-label={
            unreadCount > 0
              ? `Notificações (${unreadCount} não lida${unreadCount === 1 ? "" : "s"})`
              : "Notificações"
          }
          title="Notificações"
        >
          <BellIcon size={18} aria-hidden />
          {unreadCount > 0 ? <span className="ndot" aria-hidden /> : null}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "b3-notif-panel z-50",
            "duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
          )}
        >
          <header className="b3-notif-head">
            <div>
              <p className="text-ink-1 text-[14px] font-bold">Notificações</p>
              <p className="text-ink-4 text-[11.5px]">
                {unreadCount === 0
                  ? "Tudo em dia"
                  : `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}`}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-mangos-green-800 text-[11.5px] font-semibold hover:underline"
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </header>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyState />
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id}>
                    {/* Placeholder — quando data source plugar, virar Link
                        pra `n.href` e marcar como lida no click. */}
                    <button
                      type="button"
                      className="b3-notif-item"
                      data-unread={n.unread ? "true" : undefined}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex justify-between gap-2">
                          <span className="text-ink-1 truncate text-[13px] font-semibold">
                            {n.title}
                          </span>
                          <span className="text-ink-4 font-mono text-[10.5px] tabular-nums">
                            {n.when}
                          </span>
                        </div>
                        <p className="text-ink-3 line-clamp-2 text-[12px] leading-snug">
                          {n.body}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function EmptyState() {
  return (
    <div className="text-ink-4 flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div
        aria-hidden
        className="grid size-10 place-items-center rounded-full"
        style={{ background: "var(--mangos-cream-soft)" }}
      >
        <BellIcon size={18} style={{ color: "var(--mangos-yellow-deep)" }} />
      </div>
      <p className="text-ink-2 text-[13px] font-medium">
        Sem notificações por enquanto
      </p>
      <p className="text-ink-4 max-w-[240px] text-[11.5px] leading-relaxed">
        Quando entrar venda nova, estoque ficar baixo ou fiado vencer, avisamos
        aqui.
      </p>
    </div>
  );
}
