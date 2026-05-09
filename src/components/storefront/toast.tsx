"use client";

/**
 * Toast system para feedback de ações.
 * Leve, sem dependências externas, com animações suaves.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Check, Heart, ShoppingBag, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "cart" | "favorite";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  image?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

// Ícones por tipo
const icons: Record<ToastType, ReactNode> = {
  success: <Check className="size-5 text-success" />,
  error: <X className="size-5 text-destructive" />,
  cart: <ShoppingBag className="size-5 text-foreground" />,
  favorite: <Heart className="size-5 fill-rose-500 text-rose-500" />,
};

// Cores de fundo por tipo
const bgColors: Record<ToastType, string> = {
  success: "bg-success-soft border-success/30",
  error: "bg-destructive-soft border-destructive/30",
  cart: "bg-card border-border",
  favorite: "bg-rose-50 border-rose-200",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm",
        "min-w-[280px] max-w-[360px]",
        bgColors[toast.type]
      )}
    >
      {/* Image or icon */}
      {toast.image ? (
        <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-white">
          <img
            src={toast.image}
            alt=""
            className="size-full object-cover"
          />
        </div>
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
          {icons[toast.type]}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-xs text-muted-foreground truncate">
            {toast.description}
          </p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onRemove}
        className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const newToast: Toast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    const duration = toast.duration ?? 3000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-24 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem
                toast={toast}
                onRemove={() => removeToast(toast.id)}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// Helper hooks para tipos específicos
export function useCartToast() {
  const { addToast } = useToast();
  
  return useCallback(
    (productName: string, image?: string) => {
      addToast({
        type: "cart",
        title: "Adicionado à sacola",
        description: productName,
        image,
      });
    },
    [addToast]
  );
}

export function useFavoriteToast() {
  const { addToast } = useToast();
  
  return useCallback(
    (added: boolean, productName?: string) => {
      addToast({
        type: "favorite",
        title: added ? "Adicionado aos favoritos" : "Removido dos favoritos",
        description: productName,
        duration: 2000,
      });
    },
    [addToast]
  );
}
