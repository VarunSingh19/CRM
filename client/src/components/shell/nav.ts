import type { IconName } from "@/components/ui/Icon";
import type { Role } from "@/lib/rbac";

export interface NavItem { href: string; label: string; icon: IconName }
export interface NavGroup { label: string; items: NavItem[] }

/**
 * One nav model for all three roles — sections are filtered, never forked.
 * Mirrors the permissions in lib/rbac.ts: everyone reads the catalog and the
 * calendar; partners are sales-side; users and settings are admin-only.
 */
export function navFor(role: Role): NavGroup[] {
  const base = `/${role}`;
  const groups: NavGroup[] = [
    { label: "Overview", items: [{ href: `${base}/dashboard`, label: "Dashboard", icon: "dashboard" }] },
    {
      label: "Work",
      items: [
        { href: `${base}/projects`, label: "Projects", icon: "projects" },
        { href: `${base}/calendar`, label: "Content calendar", icon: "calendar" },
      ],
    },
  ];

  if (role === "admin" || role === "sales") {
    groups.push({ label: "Records", items: [{ href: `${base}/partners`, label: "Partners", icon: "partners" }] });
  }

  const configure: NavItem[] = [{ href: `${base}/catalog`, label: "Offerings catalog", icon: "catalog" }];
  if (role === "admin") {
    configure.push({ href: `${base}/users`, label: "Users", icon: "users" });
    configure.push({ href: `${base}/settings`, label: "Settings", icon: "settings" });
    configure.push({ href: `${base}/audit`, label: "Audit log", icon: "history" });
  }
  groups.push({ label: role === "admin" ? "Configure" : "Reference", items: configure });

  return groups;
}

/** Longest-prefix match, so /admin/projects/123 highlights Projects. */
export function activeHref(pathname: string, groups: NavGroup[]): string | null {
  let best: string | null = null;
  for (const g of groups) {
    for (const i of g.items) {
      if ((pathname === i.href || pathname.startsWith(i.href + "/")) && (!best || i.href.length > best.length)) {
        best = i.href;
      }
    }
  }
  return best;
}

/** Human label for the current route, used by the topbar breadcrumb. */
export function labelFor(pathname: string, groups: NavGroup[]): string {
  const href = activeHref(pathname, groups);
  for (const g of groups) for (const i of g.items) if (i.href === href) return i.label;
  return "";
}
