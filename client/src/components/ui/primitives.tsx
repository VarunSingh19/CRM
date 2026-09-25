import { cloneElement, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

/* ------------------------------------------------------------------ button */
type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger";

export function Button({
  variant = "primary", size, icon, children, className = "", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: "sm" | "lg"; icon?: IconName;
}) {
  const cls = ["btn", variant === "primary" ? "" : variant, size ?? "", className]
    .filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 15} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ badge */
export type Tone = "neutral" | "info" | "ok" | "warn" | "bad" | "planner";

/** Content status → tone. Keeps status colouring identical everywhere. */
export function statusTone(status: string): Tone {
  return status === "Done" ? "ok"
    : status === "In Progress" ? "warn"
    : status === "Cancelled" ? "bad"
    : status === "Planner" ? "planner"
    : "neutral";
}

/** Derived calendar stage → tone. */
export function stageTone(stage: string): Tone {
  return stage === "Live" ? "ok"
    : stage === "Done" ? "info"
    : stage === "Cancelled" ? "bad"
    : stage === "Ended" ? "neutral"
    : stage === "Recorded — in post" ? "warn"
    : "neutral";
}

export function Badge({ tone = "neutral", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ card */
export function Card({
  title, actions, children, padded = true, className = "",
}: { title?: ReactNode; actions?: ReactNode; children: ReactNode; padded?: boolean; className?: string }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      {padded ? <div className="card-body">{children}</div> : children}
    </div>
  );
}

/* ------------------------------------------------------------------ field */
export function Field({
  label, required, hint, error, htmlFor, children,
}: {
  label: string; required?: boolean; hint?: ReactNode; error?: string;
  htmlFor?: string; children: ReactNode;
}) {
  const msgId = htmlFor ? `${htmlFor}-msg` : undefined;
  const hasMsg = !!(error || hint);

  /**
   * The message under a field was rendered but never pointed at, so a screen
   * reader read the input with no hint and no reason for the red border. The
   * control is cloned here rather than every call site being touched: it picks
   * up aria-describedby and, when invalid, aria-invalid. Anything that is not a
   * plain element (or already sets these itself) is left exactly as it was.
   */
  const control =
    isValidElement(children) && msgId && hasMsg
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-describedby":
            [(children.props as Record<string, unknown>)["aria-describedby"], msgId]
              .filter(Boolean).join(" "),
          ...(error ? { "aria-invalid": true } : {}),
        })
      : children;

  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label} {required && <span className="req" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {control}
      {error
        ? <span className="msg" id={msgId}>{error}</span>
        : hint
          ? <span className="hint" id={msgId}>{hint}</span>
          : null}
    </div>
  );
}

/* ------------------------------------------------------------------ banner */
export function Banner({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <div className={`banner ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "error" ? "alert" : "check"} size={15} />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ empty */
export function EmptyState({
  icon = "inbox", title, description, action,
}: { icon?: IconName; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ico"><Icon name={icon} size={20} /></div>
      <div className="t">{title}</div>
      {description && <div className="d">{description}</div>}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ page head */
export function PageHead({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
