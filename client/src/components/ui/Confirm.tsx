"use client";
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { Modal } from "./Overlay";
import { Button } from "./primitives";

export interface ConfirmOptions {
  title: string;
  /** The explanation under the title. Say what happens, not "are you sure?". */
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for anything destructive. */
  danger?: boolean;
  /**
   * Exact text the user must type before the confirm button enables. For the
   * irreversible ones — deleting an account rather than deactivating it.
   */
  requireText?: string;
  /** Label above that box. Defaults to naming what has to be typed. */
  requireTextLabel?: string;
}

type Ask = (opts: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<Ask>(async () => false);

/**
 * One confirm host for the whole app, so no view reaches for window.confirm.
 *
 * The native dialogs are unstyled, unbranded, freeze the tab while they are up,
 * and prompt() in particular validates nothing until after the user has already
 * committed. This resolves a promise instead, so a call site keeps the shape it
 * had — `if (!(await confirm({…}))) return;` — and gets a real dialog.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState("");
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback<Ask>((o) => {
    setOpts(o);
    setTyped("");
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  // whoever is waiting must always be answered, including on an unmount
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
    setTyped("");
  }, []);

  const ready = !opts?.requireText || typed.trim() === opts.requireText;

  return (
    <Ctx.Provider value={ask}>
      {children}
      {opts && (
        <Modal
          title={opts.title}
          size="sm"
          onClose={() => settle(false)}
          foot={
            <>
              <Button variant="secondary" onClick={() => settle(false)}>
                {opts.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={opts.danger ? "danger" : "primary"}
                disabled={!ready}
                onClick={() => settle(true)}
              >
                {opts.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          <div className="stack">
            {opts.body && <div className="confirm-body">{opts.body}</div>}
            {opts.requireText && (
              <label className="confirm-verify">
                <span className="lbl">
                  {opts.requireTextLabel ?? <>Type <b>{opts.requireText}</b> to confirm</>}
                </span>
                <input
                  data-autofocus
                  value={typed}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && ready) settle(true); }}
                />
              </label>
            )}
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm(): Ask {
  return useContext(Ctx);
}
