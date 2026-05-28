"use client";

// Popover do sino de notificações — handoff design 2026-05-25 (Passo 5).
// Sprint final Vendas (audit 2026-05-26): integrado com `loadAdminNotifications`
// que varre venda WhatsApp pendente (não aberta) + estoque baixo crítico.
//
// Antes: notifications=[] hardcoded, nunca aparecia dot.
// Agora: useEffect carrega na montagem + refetch a cada 60s enquanto a aba
// estiver visível. Click no item navega via Link pra rota apropriada.
//
// Régua "funciona ou esconde": o dot só renderiza com unreadCount > 0.
// Quando vazio (loja madura sem nada urgente), empty state cream.

import { BellIcon, MessageCircleIcon, PackageIcon } from "lucide-react";
import Link from "next/link";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useCallback, useEffect, useState } from "react";

import {
  type AdminNotificationItem,
  loadAdminNotifications,
} from "@/actions/notifications/load";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 60_000;

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const r = await loadAdminNotifications();
      setNotifications(r.items);
      setUnreadCount(r.unreadCount);
    } catch {
      // Falha silenciosa — sino mantém estado anterior.
    }
  }, []);

  // Mount: fetch + start polling. Visibility-aware: pausa quando aba
  // some (lojista trocou de aba) pra não martelar o server.
  useEffect(() => {
    refetch();
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(refetch, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    if (document.visibilityState === "visible") start();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Voltou a ficar visível — refetch imediato + reativa poll.
        void refetch();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refetch]);

  // Refresh sempre que abre o popover — dá feedback de "tá atualizado"
  // mesmo entre os 60s do polling.
  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="b3-topbar-iconbtn relative"
          aria-label={
            unreadCount > 0
              ? `Notificações (${unreadCount} não lida${unreadCount === 1 ? "" : "s"})`
              : "Notificações"
          }
          title="Notificações"
        >
          <BellIcon size={16} aria-hidden />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute top-1.5 right-2 size-2 rounded-full border-2 border-surface bg-mangos-yellow"
            />
          ) : null}
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
                  : `${unreadCount} pendente${unreadCount === 1 ? "" : "s"}`}
              </p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyState />
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="b3-notif-item block"
                      data-unread={n.unread ? "true" : undefined}
                    >
                      <div className="flex items-start gap-2">
                        <NotifIcon type={n.type} />
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex justify-between gap-2">
                            <span className="text-ink-1 truncate text-[13px] font-semibold">
                              {n.title}
                            </span>
                            <span className="text-ink-4 font-mono text-[10.5px] tabular-nums shrink-0">
                              {formatRelativeDate(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-ink-3 line-clamp-2 text-[12px] leading-snug">
                            {n.body}
                          </p>
                        </div>
                      </div>
                    </Link>
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

function NotifIcon({ type }: { type: AdminNotificationItem["type"] }) {
  if (type === "sale") {
    return (
      <span
        aria-hidden
        className="text-ok bg-ok-wash mt-0.5 grid size-7 shrink-0 place-items-center rounded-md"
      >
        <MessageCircleIcon size={13} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="text-warn bg-warn/15 mt-0.5 grid size-7 shrink-0 place-items-center rounded-md"
    >
      <PackageIcon size={13} />
    </span>
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
        Tudo em dia
      </p>
      <p className="text-ink-4 max-w-[240px] text-[11.5px] leading-relaxed">
        Quando entrar venda nova ou estoque ficar crítico, avisamos aqui em
        até 1 minuto.
      </p>
    </div>
  );
}
