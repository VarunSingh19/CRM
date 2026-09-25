import { cookies } from "next/headers";
import { THEME_COOKIE, SIDEBAR_COOKIE, type ThemeChoice } from "./theme";

/**
 * Read chrome preferences on the server so the first HTML already carries the
 * right theme and sidebar width. Reading them in the browser instead would
 * flash the wrong theme on every navigation.
 */
export async function getChrome(): Promise<{
  theme: ThemeChoice;
  sidebarCollapsed: boolean;
}> {
  const jar = await cookies();
  const raw = jar.get(THEME_COOKIE)?.value;
  const theme: ThemeChoice = raw === "light" || raw === "dark" ? raw : "system";
  return {
    theme,
    sidebarCollapsed: jar.get(SIDEBAR_COOKIE)?.value === "collapsed",
  };
}
