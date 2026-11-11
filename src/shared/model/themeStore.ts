import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: "light", label: "Светлая", description: "Всегда светлое оформление" },
  { value: "dark", label: "Тёмная", description: "Всегда тёмное оформление" },
  { value: "system", label: "Автоматически", description: "Как в настройках системы" },
];

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemPrefersDark() ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  refresh: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: "system",
      resolved: resolveTheme("system"),
      setPreference: (preference) => {
        const resolved = resolveTheme(preference);
        applyTheme(resolved);
        set({ preference, resolved });
      },
      refresh: () => {
        const resolved = resolveTheme(get().preference);
        applyTheme(resolved);
        if (resolved !== get().resolved) set({ resolved });
      },
    }),
    {
      name: "theme-storage",
      version: 1,
      partialize: (state) => ({ preference: state.preference }),
      merge: (persisted, current) => {
        const stored = (persisted as { preference?: ThemePreference } | undefined)?.preference;
        const preference: ThemePreference =
          stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
        return { ...current, preference, resolved: resolveTheme(preference) };
      },
    }
  )
);

if (typeof window !== "undefined") {
  applyTheme(useThemeStore.getState().resolved);
  try {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (useThemeStore.getState().preference === "system") useThemeStore.getState().refresh();
    };
    media.addEventListener("change", onChange);
  } catch {
  }
}
