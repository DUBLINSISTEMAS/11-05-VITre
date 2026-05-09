"use client";

/**
 * Botão de favorito com animação premium estilo Instagram.
 *
 * Features:
 * - Bounce animation ao favoritar
 * - Partículas de coração ao curtir
 * - Haptic feedback visual
 * - Estados de loading
 */
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useCallback, useState } from "react";

import { type AddFavoriteInput,useFavorites } from "@/hooks/use-favorites";
import { t } from "@/lib/storefront/i18n";
import { cn } from "@/lib/utils";

export interface FavoriteButtonProps {
  product: AddFavoriteInput;
  className?: string;
  size?: "sm" | "md" | "lg";
  showParticles?: boolean;
}

// Partículas que aparecem ao favoritar
function HeartParticles({ show }: { show: boolean }) {
  if (!show) return null;
  
  const particles = [
    { x: -20, y: -25, rotate: -15, scale: 0.6 },
    { x: 20, y: -30, rotate: 15, scale: 0.5 },
    { x: -15, y: -40, rotate: -30, scale: 0.4 },
    { x: 25, y: -20, rotate: 25, scale: 0.5 },
    { x: 0, y: -35, rotate: 0, scale: 0.3 },
  ];

  return (
    <AnimatePresence>
      {particles.map((particle, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute"
          initial={{ opacity: 1, scale: 0, x: 0, y: 0, rotate: 0 }}
          animate={{
            opacity: [1, 1, 0],
            scale: [0, particle.scale, particle.scale],
            x: particle.x,
            y: particle.y,
            rotate: particle.rotate,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.6,
            delay: i * 0.05,
            ease: [0.32, 0.72, 0, 1],
          }}
        >
          <Heart className="size-3 fill-rose-400 text-rose-400" />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export function FavoriteButton({
  product,
  className,
  size = "md",
  showParticles = true,
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const isFav = isHydrated && isFavorite(product.productId);
  const [showHeartParticles, setShowHeartParticles] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Trigger particles only when adding to favorites
      if (!isFav && showParticles) {
        setShowHeartParticles(true);
        setTimeout(() => setShowHeartParticles(false), 700);
      }

      // Trigger bounce animation
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);

      toggleFavorite(product);
    },
    [isFav, showParticles, toggleFavorite, product]
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
    <motion.button
      type="button"
      onClick={handleClick}
      className={cn(
        "relative flex items-center justify-center rounded-full",
        "bg-white/95 shadow-md backdrop-blur-sm",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "transition-shadow hover:shadow-lg active:shadow-sm",
        sizeClasses,
        className
      )}
      aria-label={isFav ? t.product.unfavorite : t.product.favorite}
      whileTap={{ scale: 0.9 }}
    >
      {/* Particles */}
      {showParticles && <HeartParticles show={showHeartParticles} />}

      {/* Ring effect */}
      <AnimatePresence>
        {isAnimating && isFav && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-rose-400"
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Heart icon */}
      <motion.div
        animate={
          isAnimating
            ? {
                scale: [1, 1.3, 0.9, 1.1, 1],
                rotate: [0, -10, 10, -5, 0],
              }
            : {}
        }
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Heart
          className={cn(
            iconSize,
            "transition-all duration-200",
            isFav
              ? "fill-rose-500 text-rose-500 drop-shadow-sm"
              : "fill-transparent text-gray-500"
          )}
        />
      </motion.div>
    </motion.button>
  );
}
