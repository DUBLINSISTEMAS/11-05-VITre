"use client";

/**
 * Botão de favorito com animação premium estilo Instagram.
 *
 * Migrado de framer-motion → CSS puro na Onda 4 da auditoria 2026-05-10:
 *  - Bounce do botão: `active:scale-90 transition-transform`
 *  - Wobble do coração: keyframe `heart-pop` (globals.css)
 *  - Ring burst ao favoritar: keyframe `heart-ring-burst`
 *
 * Partículas ornamentais foram removidas — escolha consciente do founder.
 */
import { Heart } from "lucide-react";
import { useCallback, useState } from "react";

import { type AddFavoriteInput, useFavorites } from "@/hooks/use-favorites";
import { t } from "@/lib/storefront/i18n";
import { cn } from "@/lib/utils";

export interface FavoriteButtonProps {
  product: AddFavoriteInput;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function FavoriteButton({
  product,
  className,
  size = "md",
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const isFav = isHydrated && isFavorite(product.productId);
  const [animKey, setAnimKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // `key` força React a re-montar o nó e a animação ser re-disparada
      // em cliques consecutivos (sem isso, o CSS já está "no estado final").
      setAnimKey((k) => k + 1);
      setIsAnimating(true);
      // Cleanup do ring após o tempo da animação.
      window.setTimeout(() => setIsAnimating(false), 400);

      toggleFavorite(product);
    },
    [toggleFavorite, product],
  );

  const sizeClasses = {
    sm: "size-8",
    md: "size-10",
    lg: "size-12",
  }[size];

  const iconSize = {
    sm: "size-4",
    md: "size-5",
    lg: "size-6",
  }[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "relative flex items-center justify-center rounded-full",
        "bg-white/95 shadow-md backdrop-blur-sm",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "transition-all duration-150 hover:shadow-lg active:scale-90 active:shadow-sm",
        sizeClasses,
        className,
      )}
      aria-label={isFav ? t.product.unfavorite : t.product.favorite}
    >
      {/* Ring effect ao adicionar — só renderiza durante a animação pra
          não custar GPU em estado idle. */}
      {isAnimating && isFav && (
        <span
          key={`ring-${animKey}`}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400 animate-heart-ring-burst"
        />
      )}

      {/* Heart icon — `key` força re-mount pra animação disparar. */}
      <span
        key={`heart-${animKey}`}
        className={cn(
          "inline-flex",
          // Só anima quando o botão é clicado (não no mount inicial).
          animKey > 0 && "animate-heart-pop",
        )}
      >
        <Heart
          className={cn(
            iconSize,
            "transition-all duration-200",
            isFav
              ? "fill-rose-500 text-rose-500 drop-shadow-sm"
              : "fill-transparent text-gray-500",
          )}
        />
      </span>
    </button>
  );
}
