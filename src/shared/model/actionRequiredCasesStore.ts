import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { caseApi } from "@/entities/case/api/caseApi";
import type { CaseShortResponse } from "@shared/types/api";

interface ActionRequiredCasesState {
  cases: CaseShortResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<CaseShortResponse[]> | null;
  ensureLoaded: () => Promise<CaseShortResponse[]>;
  refresh: () => Promise<CaseShortResponse[]>;
}

export const useActionRequiredCasesStore = create<ActionRequiredCasesState>((set, get) => {
  function load(): Promise<CaseShortResponse[]> {
    const sessionVersion = getSessionVersion();
    const promise = caseApi
      .getActionRequiredCases()
      .then((cases) => {
        const value = cases || [];
        if (sessionVersion === getSessionVersion()) set({ cases: value, isLoading: false, isLoaded: true, error: null, inFlight: null });
        return value;
      })
      .catch((err) => {
        console.error("Ошибка загрузки дел, требующих действия:", err);
        if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить список дел", inFlight: null });
        throw err;
      });
    set({ isLoading: true, inFlight: promise });
    return promise;
  }

  return {
    cases: [],
    isLoading: false,
    isLoaded: false,
    error: null,
    inFlight: null,
    ensureLoaded: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      if (state.isLoaded) return Promise.resolve(state.cases);
      return load();
    },
    refresh: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      return load();
    },
  };
});
