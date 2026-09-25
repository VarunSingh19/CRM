"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface ToastCtx { toast: (msg: string) => void }
const Ctx = createContext<ToastCtx>({ toast: () => {} });

/** One toast host for the whole app, so views never render their own. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const toast = useCallback((m: string) => setMsg(m), []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3200);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {/* The live region is always mounted. A role="status" node that appears
          at the same moment as its text is frequently missed by screen readers,
          because there was no region being watched when the change happened. */}
      <div className="sr-only" role="status" aria-live="polite">{msg}</div>
      {msg && <div className="toast" aria-hidden="true">{msg}</div>}
    </Ctx.Provider>
  );
}

export function useToast(): (msg: string) => void {
  return useContext(Ctx).toast;
}
