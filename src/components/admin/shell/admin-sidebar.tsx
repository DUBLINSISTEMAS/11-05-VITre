// Sidebar lateral fixa do admin — desktop only (`hidden lg:flex`).
// Mobile usa o mesmo conteúdo dentro de um Sheet drawer (ver MobileHeader).
import { SidebarContent, type SidebarContentProps } from "./sidebar-content";

export type AdminSidebarProps = SidebarContentProps;

export function AdminSidebar(props: AdminSidebarProps) {
  return (
    <aside
      aria-label="Navegação principal"
      className="sticky top-0 hidden h-dvh w-[240px] shrink-0 border-r border-gray-200 lg:flex"
    >
      <SidebarContent {...props} />
    </aside>
  );
}
