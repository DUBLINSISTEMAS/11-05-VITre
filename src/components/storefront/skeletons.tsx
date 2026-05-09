"use client";

import { cn } from "@/lib/utils";

/**
 * Skeleton base component with shimmer animation.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-gray-200",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.5s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        className
      )}
      {...props}
    />
  );
}

/**
 * Product card skeleton - matches ProductCard dimensions
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Image */}
      <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
      
      {/* Category */}
      <Skeleton className="h-3 w-16" />
      
      {/* Name */}
      <Skeleton className="h-4 w-3/4" />
      
      {/* Price */}
      <Skeleton className="h-5 w-1/3" />
    </div>
  );
}

/**
 * Product grid skeleton - shows multiple product cards
 */
export function ProductGridSkeleton({ 
  count = 4,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Banner carousel skeleton
 */
export function BannerCarouselSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("aspect-[16/9] w-full rounded-3xl sm:aspect-[21/9]", className)} />
  );
}

/**
 * Category pills skeleton
 */
export function CategoryPillsSkeleton({ 
  count = 5,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-hidden", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton 
          key={i} 
          className="h-9 shrink-0 rounded-full" 
          style={{ width: `${60 + Math.random() * 40}px` }}
        />
      ))}
    </div>
  );
}

/**
 * Section header skeleton (title + see all link)
 */
export function SectionHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/**
 * Product detail skeleton - for product page
 */
export function ProductDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6 lg:flex-row lg:gap-12", className)}>
      {/* Gallery */}
      <div className="lg:w-1/2">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="size-14 rounded-full" />
          ))}
        </div>
      </div>
      
      {/* Info */}
      <div className="flex-1 space-y-6 lg:w-1/2">
        {/* Category */}
        <Skeleton className="h-4 w-24" />
        
        {/* Name */}
        <Skeleton className="h-8 w-3/4" />
        
        {/* Price */}
        <Skeleton className="h-10 w-32" />
        
        {/* Size selector */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="size-12 rounded-xl" />
            ))}
          </div>
        </div>
        
        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Search bar skeleton
 */
export function SearchBarSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("h-12 w-full rounded-full", className)} />
  );
}

/**
 * Header skeleton
 */
export function HeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-3", className)}>
      {/* Avatar + greeting */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      {/* Cart icon */}
      <Skeleton className="size-10 rounded-full" />
    </div>
  );
}

/**
 * Bottom nav skeleton
 */
export function BottomNavSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-around py-3", className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/**
 * Cart item skeleton
 */
export function CartItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-4", className)}>
      <Skeleton className="size-20 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}

/**
 * Favorite item skeleton
 */
export function FavoriteItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-4 rounded-2xl bg-gray-50 p-3", className)}>
      <Skeleton className="size-24 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}

export { Skeleton };
