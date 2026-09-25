/** Shared, client-safe chrome preferences. No server-only imports here — the
 *  sidebar and topbar are client components and pull writeCookie from this file. */
export type ThemeChoice = "light" | "dark" | "system";

export const THEME_COOKIE = "onf-theme";
export const SIDEBAR_COOKIE = "onf-sidebar";

/** "system" stamps nothing, so prefers-color-scheme decides. */
export function themeAttr(theme: ThemeChoice): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

export function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax`;
}
