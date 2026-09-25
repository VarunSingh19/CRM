"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import Icon from "@/components/ui/Icon";
import { THEME_COOKIE, writeCookie, type ThemeChoice } from "@/lib/theme";
import { type NavGroup } from "./nav";
import type { Role } from "@/lib/rbac";

const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", sales: "Sales", ops: "Operations" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Applies the choice immediately, then persists it for the next SSR pass. */
function applyTheme(choice: ThemeChoice) {
  const el = document.documentElement;
  if (choice === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", choice);
  writeCookie(THEME_COOKIE, choice);
}

export default function Topbar({
  groups, role, name, theme, onOpenSearch,
}: {
  groups: NavGroup[]; role: Role; name: string;
  theme: ThemeChoice; onOpenSearch: () => void;
}) {
  const [choice, setChoice] = useState<ThemeChoice>(theme);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      // Escape closes and hands focus back to the trigger, so the keyboard user
      // is not dropped at the top of the document
      if (e.key === "Escape") { setMenuOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // opening with the keyboard should land on the first entry, per the menu pattern
  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
  }, [menuOpen]);

  /** Up/Down cycle the entries; Escape and Tab leave. */
  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []
    );
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0
        : e.key === "End" ? items.length - 1
          : e.key === "ArrowDown" ? (i + 1) % items.length
            : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  function cycleTheme() {
    const next: ThemeChoice = choice === "light" ? "dark" : choice === "dark" ? "system" : "light";
    setChoice(next);
    applyTheme(next);
  }

  const themeIcon = choice === "light" ? "sun" : choice === "dark" ? "moon" : "monitor";
  const themeLabel = choice === "light" ? "Light" : choice === "dark" ? "Dark" : "System";

  return (
    <header className="topbar">
      {/* Phone only. With the sidebar off-canvas the header is free to carry the
          full wordmark, which the 64px rail could only ever show cropped. */}
      <Image src="/onfnewlogo.png" alt="Onference TV" className="tb-logo"
        width={1068} height={222} sizes="200px" />
      <div className="spacer" />

      <button type="button" className="searchbtn" onClick={onOpenSearch}>
        <Icon name="search" size={15} />
        <span className="lbl">Search projects, partners, content…</span>
        <kbd>Ctrl K</kbd>
      </button>

      {/* <button type="button" className="iconbtn" onClick={cycleTheme}
        title={`Theme: ${themeLabel}`} aria-label={`Theme: ${themeLabel}. Click to change.`}>
        <Icon name={themeIcon} size={16} />
      </button> */}

      <div className="usermenu" ref={menuRef}>
        <button type="button" className="usertrigger" ref={triggerRef}
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu" aria-expanded={menuOpen}>
          <span className="avatar">{initials(name)}</span>
          <span className="truncate">{name}</span>
          <Icon name="chevronDown" size={14} />
        </button>
        {menuOpen && (
          <div className="menu" role="menu" onKeyDown={onMenuKeyDown}>
            <div className="menu-head">
              <div className="nm">{name}</div>
              <div className="muted">{ROLE_LABEL[role]}</div>
            </div>
            <Link href={`/${role}/profile`} className="menu-item" role="menuitem"
              onClick={() => setMenuOpen(false)}>
              <Icon name="user" size={15} /> Your profile
            </Link>
            <button type="button" className="menu-item" role="menuitem" onClick={cycleTheme}>
              <Icon name={themeIcon} size={15} /> Theme: {themeLabel}
            </button>
            <button type="button" className="menu-item danger" role="menuitem"
              onClick={() => signOut({ callbackUrl: "/login" })}>
              <Icon name="logout" size={15} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
