/**
 * Autosave de rascunho de formulário em localStorage — Onda 2.9 (2026-05-22).
 *
 * Antes: fechar a aba durante cadastro grande perdia tudo. Em form com
 * 30+ campos isso é quebra de confiança no sistema.
 *
 * Agora: a cada mudança debounced (500ms), valores são salvos. No mount,
 * se houver rascunho recente (<24h), o caller decide se restaura.
 *
 * Limpa o rascunho explicitamente após submit bem-sucedido.
 *
 * USO:
 *
 *   const draftKey = "product-create";
 *   useFormDraft(draftKey, watch(), { skip: !isCreating });
 *   // ao submeter:
 *   clearFormDraft(draftKey);
 *
 *   const savedDraft = loadFormDraft<ProductFormValues>(draftKey);
 *   if (savedDraft) { reset(savedDraft); }
 */
"use client";

import { useEffect, useRef } from "react";

const STORAGE_PREFIX = "mp:form-draft:";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredDraft<T> {
  savedAt: number;
  values: T;
}

export function loadFormDraft<T>(
  key: string,
  options?: { maxAgeMs?: number },
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    const ttl = options?.maxAgeMs ?? DEFAULT_TTL_MS;
    if (Date.now() - parsed.savedAt > ttl) {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return parsed.values;
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // localStorage indisponível (modo privado iOS, quota) — ignora.
  }
}

interface UseFormDraftOptions {
  /** Quando true, hook não salva (ex: tela de edit, não criar). */
  skip?: boolean;
  /** Debounce em ms. Default 500. */
  debounceMs?: number;
}

export function useFormDraft<T extends object>(
  key: string,
  values: T,
  options?: UseFormDraftOptions,
) {
  const { skip = false, debounceMs = 500 } = options ?? {};
  const lastSerialized = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skip) return;
    if (typeof window === "undefined") return;
    const serialized = safeStringify(values);
    if (serialized === lastSerialized.current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_PREFIX + key,
          JSON.stringify({
            savedAt: Date.now(),
            values,
          } satisfies StoredDraft<T>),
        );
        lastSerialized.current = serialized;
      } catch {
        // quota / privado / serialization issue — ignora silenciosamente.
      }
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, values, skip, debounceMs]);
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}
