import AppShell from "@/components/shell/AppShell";
import { requireRole } from "@/lib/session";
import { getChrome } from "@/lib/theme.server";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("sales");
  const { theme, sidebarCollapsed } = await getChrome();
  return (
    <AppShell role={user.role} name={user.name} theme={theme} initialCollapsed={sidebarCollapsed}>
      {children}
    </AppShell>
  );
}
