import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_TIMEZONE = "Europe/Moscow";

function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("ru-RU", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getSystemTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && isValidTimezone(detected)) return detected;
  } catch {
  }
  return DEFAULT_TIMEZONE;
}

interface TimezoneState {
  manualTimezone: string | null;
  timezone: string;
  setTimezone: (timezone: string) => void;
  resetToSystemTimezone: () => void;
  syncSystemTimezone: () => void;
}

export const useTimezoneStore = create<TimezoneState>()(
  persist(
    (set, get) => ({
      manualTimezone: null,
      timezone: getSystemTimezone(),
      setTimezone: (timezone) => set({ manualTimezone: timezone, timezone }),
      resetToSystemTimezone: () => set({ manualTimezone: null, timezone: getSystemTimezone() }),
      syncSystemTimezone: () => {
        if (get().manualTimezone !== null) return;
        const system = getSystemTimezone();
        if (system !== get().timezone) set({ timezone: system });
      },
    }),
    {
      name: "timezone-storage",
      version: 1,
      partialize: (state) => ({ manualTimezone: state.manualTimezone }),
      migrate: (persisted, version) => {
        if (version < 1) {
          const old = (persisted as { timezone?: string } | null)?.timezone;
          const manual = old && isValidTimezone(old) && old !== getSystemTimezone() ? old : null;
          return { manualTimezone: manual };
        }
        return persisted as { manualTimezone: string | null };
      },
      merge: (persisted, current) => {
        const stored = (persisted as { manualTimezone?: string | null } | undefined)?.manualTimezone ?? null;
        const manual = stored && isValidTimezone(stored) ? stored : null;
        return { ...current, manualTimezone: manual, timezone: manual ?? getSystemTimezone() };
      },
    }
  )
);

if (typeof window !== "undefined") {
  const sync = () => useTimezoneStore.getState().syncSystemTimezone();
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sync();
  });
}

export const getTimezone = (): string => useTimezoneStore.getState().timezone;
