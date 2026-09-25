"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { SIDEBAR_COOKIE, writeCookie } from "@/lib/theme";
import { activeHref, type NavGroup } from "./nav";

/**
 * Collapse state is mirrored into a cookie so the server renders the correct
 * width on the next request — no rail-width flash on navigation.
 */
export default function Sidebar({
  groups, collapsed, onToggle, onCloseMobile,
}: {
  groups: NavGroup[]; collapsed: boolean;
  onToggle: (next: boolean) => void; onCloseMobile: () => void;
}) {
  const pathname = usePathname() || "";
  const active = activeHref(pathname, groups);

  function toggle() {
    const next = !collapsed;
    writeCookie(SIDEBAR_COOKIE, next ? "collapsed" : "expanded");
    onToggle(next);
  }

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        {/* Collapsed, CSS crops this to the roundel so the rail keeps a mark. */}
        <Image src="/onfnewlogo.png" alt="Onference TV" className="sb-logo"
          width={1068} height={222} priority sizes="248px" />
        {/* phone only: the drawer needs a dismiss that isn't the scrim */}
        <button type="button" className="sb-close" onClick={onCloseMobile} aria-label="Close menu">
          <Icon name="close" size={18} />
        </button>
      </div>

      <nav className="sb-nav" aria-label="Main">
        {groups.map((g) => (
          <div className="sb-group" key={g.label} role="group" aria-labelledby={`sbg-${g.label}`}>
            <div className="sb-group-label" id={`sbg-${g.label}`}>{g.label}</div>
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={`sb-link ${active === i.href ? "active" : ""}`}
                title={collapsed ? i.label : undefined}
                aria-current={active === i.href ? "page" : undefined}
              >
                <span className="ico"><Icon name={i.icon} /></span>
                <span className="lbl">{i.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        <button type="button" className="sb-toggle" onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <span className="ico"><Icon name={collapsed ? "chevronRight" : "chevronLeft"} /></span>
          <span className="lbl">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
