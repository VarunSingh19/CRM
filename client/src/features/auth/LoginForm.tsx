"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Field, Banner } from "@/components/ui/primitives";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const missingUser = touched && !username.trim();
  const missingPass = touched && !password;

  async function submit() {
    setTouched(true);
    setErr("");
    if (!username.trim() || !password) return;

    setBusy(true);
    const res = await signIn("credentials", { username, password, redirect: false });
    setBusy(false);

    if (res?.error) {
      setErr("Those sign-in details were not recognised.");
      setPassword("");
      return;
    }
    router.push("/"); // middleware forwards to the right dashboard
    router.refresh();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") submit();
  }

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <Field label="Username or email" htmlFor="username"
        error={missingUser ? "Enter your username or email." : undefined}>
        <input
          id="username" value={username} onChange={(e) => setUsername(e.target.value)}
          onKeyDown={onKeyDown} className={missingUser ? "bad" : ""}
          autoComplete="username" autoCapitalize="off" spellCheck={false} autoFocus
        />
      </Field>

      <Field label="Password" htmlFor="password" error={missingPass ? "Enter your password." : undefined}>
        <input
          id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKeyDown} className={missingPass ? "bad" : ""}
          autoComplete="current-password"
        />
      </Field>

      {err && <Banner tone="error">{err}</Banner>}

      <Button type="submit" size="lg" className="block" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
