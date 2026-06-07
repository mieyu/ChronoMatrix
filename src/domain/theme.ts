export type ThemePreference = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export const themeOrder: ThemePreference[] = ["system", "light", "dark"];

export const themeLabels: Record<ThemePreference, string> = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色",
};

/**
 * Resolve a theme preference into the concrete theme that should be applied.
 * When the preference is "system", the supplied system value decides.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return preference;
}

/** Return the next preference when cycling through the toggle. */
export function nextThemePreference(
  preference: ThemePreference,
): ThemePreference {
  const index = themeOrder.indexOf(preference);
  return themeOrder[(index + 1) % themeOrder.length];
}
