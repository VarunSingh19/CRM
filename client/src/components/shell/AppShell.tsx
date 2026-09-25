"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CommandPalette from "./CommandPalette";
import Icon from "@/components/ui/Icon";
import { navFor } from "./nav";
import type { ThemeChoice } from "@/lib/theme";
import type { Role } from "@/lib/rbac";

type Point = { x: number; y: number };

const FAB_KEY = process.env.NEXT_PUBLIC_FAB_KEY || "onf-navfab";  // for testing 
const FAB_SIZE = 42;
const FAB_EDGE = 10;       // never let it touch the screen edge
const DRAG_SLOP = 4;       // a tap wobbles a few pixels; past this it's a drag

/** Keeps a remembered spot on screen after a rotation or a resize. */
function clampToViewport(p: Point): Point {
  const maxX = Math.max(FAB_EDGE, window.innerWidth - FAB_SIZE - FAB_EDGE);
  const maxY = Math.max(FAB_EDGE, window.innerHeight - FAB_SIZE - FAB_EDGE);
  return {
    x: Math.min(Math.max(p.x, FAB_EDGE), maxX),
    y: Math.min(Math.max(p.y, FAB_EDGE), maxY),
  };
}

export default function AppShell({
  role, name, theme, initialCollapsed, children,
}: {
  role: Role; name: string; theme: ThemeChoice;
  initialCollapsed: boolean; children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const groups = navFor(role);

  // null = wherever the stylesheet puts it (top-left, under the header)
  const [fab, setFab] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number; moved: boolean; last?: Point } | null>(null);
  const suppressClick = useRef(false);

  // On a phone the sidebar is off-canvas, so a tap through to a new page has to
  // dismiss it — otherwise the drawer stays over the page it just navigated to.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // While the drawer is over the page, the page behind it must not scroll.
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [navOpen]);

  // Read after mount, never during render: the server has no localStorage, and
  // a remembered spot would otherwise mismatch the markup it sent.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAB_KEY);
      if (!raw) return;
      const p: unknown = JSON.parse(raw);
      if (p && typeof p === "object"
        && typeof (p as Point).x === "number" && typeof (p as Point).y === "number") {
        setFab(clampToViewport(p as Point));
      }
    } catch {
      // private mode, or a stale value — the default position is fine
    }
  }, []);

  useEffect(() => {
    function onResize() { setFab((p) => (p ? clampToViewport(p) : p)); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onFabPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onFabPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const next = clampToViewport({ x: e.clientX - d.dx, y: e.clientY - d.dy });
    if (!d.moved) {
      const r = e.currentTarget.getBoundingClientRect();
      if (Math.abs(next.x - r.left) < DRAG_SLOP && Math.abs(next.y - r.top) < DRAG_SLOP) return;
      d.moved = true;
      setDragging(true);
    }
    d.last = next;
    setFab(next);
  }

  function onFabPointerUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d?.moved) return;
    // a drag must not also count as a tap and open the drawer
    suppressClick.current = true;
    if (d.last) {
      try { window.localStorage.setItem(FAB_KEY, JSON.stringify(d.last)); } catch { /* ignore */ }
    }
  }

  function onFabClick() {
    if (suppressClick.current) { suppressClick.current = false; return; }
    setNavOpen(true);
  }

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""} ${navOpen ? "navopen" : ""}`}>
      {/* must stay the first focusable thing on the page */}
      <a className="skip-link" href="#main">Skip to main content</a>
      {navOpen && <div className="navscrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <Sidebar groups={groups} collapsed={collapsed} onToggle={setCollapsed}
        onCloseMobile={() => setNavOpen(false)} />

      <div className="main">
        <Topbar groups={groups} role={role} name={name} theme={theme}
          onOpenSearch={() => setPaletteOpen(true)} />
        <main className="content" id="main" tabIndex={-1}>{children}</main>
      </div>

      {/* Phone-only, and floating over the page rather than docked in the topbar,
          so the sidebar can leave the layout entirely and hand back its width.
          Draggable, because wherever it rests it will cover something. */}
      <button
        type="button"
        className={`navfab ${dragging ? "dragging" : ""}`}
        style={fab ? { left: fab.x, top: fab.y } : undefined}
        onPointerDown={onFabPointerDown}
        onPointerMove={onFabPointerMove}
        onPointerUp={onFabPointerUp}
        onPointerCancel={onFabPointerUp}
        onClick={onFabClick}
        aria-expanded={navOpen}
        aria-label="Open menu — drag to move"
      >
        <Icon name="menu" size={20} strokeWidth={2} />
      </button>

      {paletteOpen && <CommandPalette groups={groups} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
