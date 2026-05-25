"use client";

// Host global do drawer de cliente — handoff PP2 (2026-05-25).
//
// Montado uma única vez em <AdminShell />. Mesmo padrão dos outros
// listeners (OrderDetail, ProductForm):
//   1. Escuta OPEN_CUSTOMER_FORM_EVENT.
//   2. Lê `?customer=<id|new>` da URL ao montar — preserva deep-link.
//   3. Sincroniza URL no open/close via router.replace.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CustomerFormDrawer } from "./customer-form-drawer";
import {
  OPEN_CUSTOMER_FORM_EVENT,
  type OpenCustomerFormEventDetail,
} from "./customer-form-events";

export function CustomerFormDrawerListener() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customerFromUrl = searchParams.get("customer");

  const [target, setTarget] = useState<string | "new" | null>(customerFromUrl);

  useEffect(() => {
    setTarget(customerFromUrl);
  }, [customerFromUrl]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenCustomerFormEventDetail>;
      const id = ce.detail?.customerId ?? null;
      const next = id ?? "new";
      setTarget(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("customer", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };
    window.addEventListener(OPEN_CUSTOMER_FORM_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CUSTOMER_FORM_EVENT, onOpen);
  }, [pathname, router, searchParams]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setTarget(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("customer");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, {
          scroll: false,
        });
        router.refresh();
      }
    },
    [pathname, router, searchParams],
  );

  return <CustomerFormDrawer target={target} onOpenChange={handleOpenChange} />;
}
