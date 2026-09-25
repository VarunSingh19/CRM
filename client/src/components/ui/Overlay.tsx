"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Icon from "./Icon";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Escape-to-close, shared by every overlay so the behaviour never drifts. */
function useEscape(onClose: () => void) {
  // Callers pass an inline arrow, so depending on it would tear down and re-add
  // the listener on every render. The ref keeps the latest callback without
  // making the subscription itself churn.
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") latest.current(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Holds focus inside an open overlay and hands it back on close.
 *
 * Without this a Tab past the last control walks out into the page behind,
 * which for a keyboard or screen-reader user means the dialog is still up but
 * they are answering it blind. Returning focus to whatever opened the dialog is
 * the other half: land back on the button you pressed, not at the top of the
 * document.
 */
function useFocusTrap() {
  const ref = useRef<HTMLDivElement>(null);

  // Runs once, on open. It must never re-run: callers pass an inline onClose,
  // so a dependency on it fires this on every keystroke of any field inside the
  // dialog and throws focus back to the first control — which is the close
  // button. Nothing in here reads props, so an empty dependency list is correct.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const opener = document.activeElement as HTMLElement | null;

    // an explicit autofocus wins; otherwise the first control, else the panel
    const first = root.querySelector<HTMLElement>("[data-autofocus]")
      ?? root.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? root).focus();

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = Array.from(root!.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { e.preventDefault(); return; }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === firstEl || !root!.contains(active))) {
        e.preventDefault(); lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault(); firstEl.focus();
      }
    }

    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      // the opener may have been unmounted by whatever the dialog just did
      if (opener?.isConnected) opener.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}

/** The page behind an overlay must not scroll under it. */
function useScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
}

export function Modal({
  title, size = "full", onClose, head, foot, children, bodyClass = "modal-body",
}: {
  title: string; size?: "sm" | "md" | "full"; onClose: () => void;
  head?: ReactNode; foot?: ReactNode; children: ReactNode; bodyClass?: string;
}) {
  useEscape(onClose);
  useScrollLock();
  const ref = useFocusTrap();
  const cls = size === "full" ? "modal" : `modal auto ${size}`;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cls} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          {head}
          <div className="spacer" />
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        {bodyClass ? <div className={bodyClass}>{children}</div> : children}
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

export function Drawer({
  title, onClose, foot, children,
}: { title: string; onClose: () => void; foot?: ReactNode; children: ReactNode }) {
  useEscape(onClose);
  useScrollLock();
  const ref = useFocusTrap();
  return (
    <div className="overlay" style={{ padding: 0, justifyContent: "flex-end" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="spacer" />
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

export interface TabDef { key: string; label: string; count?: number }

/**
 * Tabs move with the arrow keys and expose the selected one, per the ARIA
 * pattern. Only the active tab is tabbable, so Tab leaves the strip rather
 * than stepping through every tab in it.
 *
 * No aria-controls: the panels these switch between are sibling fragments
 * rather than one wrapped element, so there is no id to point at. A dangling
 * IDREF reads worse to a screen reader than an absent one.
 */
export function Tabs({
  tabs, active, onChange,
}: { tabs: TabDef[]; active: string; onChange: (key: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null);

  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.findIndex((t) => t.key === active);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].key);
    wrap.current?.querySelectorAll<HTMLElement>("[role='tab']")[next]?.focus();
  }

  return (
    <div className="tabs" role="tablist" ref={wrap} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.key} type="button" role="tab"
          id={`tab-${t.key}`}
          aria-selected={active === t.key}
          tabIndex={active === t.key ? 0 : -1}
          className={`tab ${active === t.key ? "active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
