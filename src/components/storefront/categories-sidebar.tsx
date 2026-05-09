"use client";

/**
 * Premium categories sidebar - modern e-commerce style.
 *
 * Features:
 * - Clean, minimal design com acentos neutros
 * - Smooth enter/exit animations
 * - Two-level navigation with slide transitions
 * - Search without auto-focus (prevents mobile keyboard)
 * - Store info footer (WhatsApp em --whatsapp)
 */
import { AnimatePresence,motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  MapPin,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  type CSSProperties,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Store } from "@/db/schema";
import type { CategoryNode } from "@/lib/storefront/categories-loader";
import { cn } from "@/lib/utils";

interface SidebarContextValue {
  open: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useCategoriesSidebarTrigger(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error(
      "useCategoriesSidebarTrigger so pode ser usado dentro de <CategoriesSidebar>",
    );
  }
  return ctx;
}

export interface CategoriesSidebarProps {
  store: Store;
  tree: CategoryNode[];
  brandStyle?: CSSProperties;
  children: React.ReactNode;
}

export function CategoriesSidebar({
  store,
  tree,
  brandStyle,
  children,
}: CategoriesSidebarProps) {
  const [open, setOpen] = useState(false);
  const [drilledRoot, setDrilledRoot] = useState<CategoryNode | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setDrilledRoot(null);
      }, 300);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const value = useMemo<SidebarContextValue>(
    () => ({ open: () => setOpen(true) }),
    [],
  );

  const baseHref = `/${store.slug}`;
  const hasWhatsApp = Boolean(store.whatsappNumber);
  const hasAddress = Boolean(store.addressCity);

  return (
    <SidebarContext.Provider value={value}>
      {children}
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-[340px] flex flex-col gap-0 p-0 bg-white border-r-0 shadow-2xl"
          style={brandStyle}
          aria-describedby={undefined}
        >
          {/* Header - Clean and minimal */}
          <SheetHeader className="px-6 py-5 border-b border-gray-100/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                {store.logoUrl ? (
                  <div className="size-11 rounded-2xl overflow-hidden bg-gray-50 ring-1 ring-gray-100 shadow-sm">
                    <Image
                      src={store.logoUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="size-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="size-11 rounded-2xl bg-foreground flex items-center justify-center shadow-sm">
                    <span className="text-background font-bold text-lg">
                      {store.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <SheetTitle className="text-[15px] font-semibold text-left text-foreground">
                    {store.name}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground text-left mt-0.5">
                    {drilledRoot ? drilledRoot.name : "Browse categories"}
                  </SheetDescription>
                </div>
              </div>
              
              <AnimatePresence mode="wait">
                {drilledRoot && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDrilledRoot(null)}
                      className="shrink-0 size-9 rounded-xl hover:bg-gray-100"
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="size-5" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SheetHeader>

          {/* Quick actions bar */}
          {!drilledRoot && (
            <div className="px-4 py-3 border-b border-gray-100/80 bg-gray-50/50">
              <Link
                href={baseHref}
                prefetch
                onClick={() => handleOpenChange(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted hover:bg-gray-200/80 transition-colors group"
              >
                <div className="size-8 rounded-lg bg-foreground flex items-center justify-center shadow-sm">
                  <Sparkles className="size-4 text-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground block">
                    All Products
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Explore everything
                  </span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            </div>
          )}

          {/* Navigation content */}
          <div className="relative flex-1 overflow-hidden">
            <div
              className={cn(
                "absolute inset-0 flex transition-transform duration-300 ease-out",
                drilledRoot ? "-translate-x-full" : "translate-x-0",
              )}
            >
              {/* Level 1: Root categories */}
              <div className="w-full shrink-0 overflow-y-auto">
                {tree.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="mx-auto mb-4 size-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Grid3X3 className="size-7 text-gray-400" />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">
                      No categories yet
                    </p>
                    <p className="text-muted-foreground/60 text-xs mt-1">
                      Categories will appear here
                    </p>
                  </div>
                ) : (
                  <ul className="py-2 px-3" role="list">
                    {tree.map((root, idx) => {
                      const hasChildren = root.children.length > 0;
                      const staggerStyle = { animationDelay: `${60 + idx * 35}ms` };
                      const staggerClass =
                        "animate-in fade-in-0 slide-in-from-left-3 [animation-fill-mode:backwards] duration-300";

                      if (hasChildren) {
                        return (
                          <li key={root.id} style={staggerStyle} className={staggerClass}>
                            <button
                              type="button"
                              onClick={() => setDrilledRoot(root)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3",
                                "px-3 py-3.5 my-0.5 rounded-xl text-left",
                                "text-[15px] font-medium text-foreground",
                                "hover:bg-gray-100/80 active:bg-gray-100 transition-colors",
                                "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              )}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                {root.imageUrl ? (
                                  <div className="size-11 rounded-xl overflow-hidden bg-gray-100 ring-1 ring-gray-100 shadow-sm shrink-0">
                                    <Image
                                      src={root.imageUrl}
                                      alt=""
                                      width={44}
                                      height={44}
                                      className="size-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="size-11 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center ring-1 ring-gray-100 shrink-0">
                                    <span className="text-gray-500 font-semibold text-sm">
                                      {root.name.charAt(0)}
                                    </span>
                                  </div>
                                )}
                                <span className="truncate">{root.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] font-medium text-muted-foreground bg-gray-100 px-2 py-1 rounded-lg">
                                  {root.children.length}
                                </span>
                                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                              </div>
                            </button>
                          </li>
                        );
                      }

                      return (
                        <li key={root.id} style={staggerStyle} className={staggerClass}>
                          <Link
                            href={`${baseHref}/categoria/${root.slug}`}
                            prefetch={false}
                            onClick={() => handleOpenChange(false)}
                            className={cn(
                              "flex items-center gap-3.5 px-3 py-3.5 my-0.5 rounded-xl",
                              "text-[15px] font-medium text-foreground",
                              "hover:bg-gray-100/80 active:bg-gray-100 transition-colors",
                              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            )}
                          >
                            {root.imageUrl ? (
                              <div className="size-11 rounded-xl overflow-hidden bg-gray-100 ring-1 ring-gray-100 shadow-sm shrink-0">
                                <Image
                                  src={root.imageUrl}
                                  alt=""
                                  width={44}
                                  height={44}
                                  className="size-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="size-11 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center ring-1 ring-gray-100 shrink-0">
                                <span className="text-gray-500 font-semibold text-sm">
                                  {root.name.charAt(0)}
                                </span>
                              </div>
                            )}
                            <span className="truncate">{root.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Level 2: Subcategories */}
              <div className="w-full shrink-0 overflow-y-auto bg-white">
                {drilledRoot && (
                  <>
                    {/* Parent category header */}
                    <Link
                      href={`${baseHref}/categoria/${drilledRoot.slug}`}
                      prefetch={false}
                      onClick={() => handleOpenChange(false)}
                      className={cn(
                        "flex items-center gap-3.5 px-6 py-4",
                        "bg-muted border-b border-gray-100",
                        "text-sm font-semibold text-foreground",
                        "hover:bg-gray-200/80 transition-colors",
                        "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      )}
                    >
                      <div className="size-9 rounded-lg bg-foreground flex items-center justify-center shadow-sm">
                        <Grid3X3 className="size-4 text-background" />
                      </div>
                      <div className="flex-1">
                        <span className="block text-foreground">View all in {drilledRoot.name}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {drilledRoot.children.length} subcategories
                        </span>
                      </div>
                    </Link>

                    {/* Subcategories list */}
                    <ul className="py-2 px-3" role="list">
                      {drilledRoot.children.map((child, idx) => (
                        <li
                          key={child.id}
                          style={{ animationDelay: `${60 + idx * 30}ms` }}
                          className="animate-in fade-in-0 slide-in-from-right-3 [animation-fill-mode:backwards] duration-300"
                        >
                          <Link
                            href={`${baseHref}/categoria/${child.slug}`}
                            prefetch={false}
                            onClick={() => handleOpenChange(false)}
                            className={cn(
                              "flex items-center gap-3.5 px-3 py-3 my-0.5 rounded-xl",
                              "text-[15px] font-medium text-foreground",
                              "hover:bg-gray-100/80 active:bg-gray-100 transition-colors",
                              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            )}
                          >
                            {child.imageUrl ? (
                              <div className="size-10 rounded-xl overflow-hidden bg-gray-100 ring-1 ring-gray-100 shadow-sm">
                                <Image
                                  src={child.imageUrl}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="size-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="size-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center ring-1 ring-gray-100">
                                <span className="text-gray-500 text-sm font-medium">
                                  {child.name.charAt(0)}
                                </span>
                              </div>
                            )}
                            <span className="truncate">{child.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Store info footer */}
          {(hasWhatsApp || hasAddress) && (
            <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4 space-y-2.5">
              {hasWhatsApp && (
                <a
                  href={`https://wa.me/${store.whatsappNumber.replace(/\D/g, "")}`}
                  className={cn(
                    "flex items-center gap-3 text-sm py-1",
                    "text-muted-foreground hover:text-whatsapp transition-colors"
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-whatsapp/10">
                    <MessageCircle className="size-4 text-whatsapp" aria-hidden />
                  </div>
                  <span className="font-medium">{store.whatsappDisplay}</span>
                </a>
              )}
              {hasAddress && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground py-1">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gray-200/60">
                    <MapPin className="size-4" aria-hidden />
                  </div>
                  <span>
                    {[store.addressCity, store.addressState].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </SidebarContext.Provider>
  );
}
