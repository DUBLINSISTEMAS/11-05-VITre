import type { ReactNode } from "react";

/**
 * Header padrão de página do admin (canvas-v1 admin Lote 3).
 *
 * - Title 22px peso 600 ls -0.4 (`tracking-tight`)
 * - Subtitle 12.5px peso 500 muted-foreground
 * - Slot `actions` à direita (botões, dropdowns, links — alinhados a `end`)
 * - Border bottom + padding bottom uniforme — separa header do conteúdo
 *   sem precisar de margem manual nas pages
 *
 * Usado em todas as pages do admin pra padronizar a chamada visual e
 * abrir slot consistente pras CTAs primárias.
 */
export interface AdminPageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-5 sm:pb-6">
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[12.5px] font-medium text-muted-foreground sm:text-sm">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
