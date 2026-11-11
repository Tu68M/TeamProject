import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { dictionaryApi } from "@entities/dictionary/dictionaryApi";
import type { ViolationTypeBriefResponse } from "@shared/types/api";

interface ViolationTypesState {
  violationTypes: ViolationTypeBriefResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<ViolationTypeBriefResponse[]> | null;
  ensureLoaded: () => Promise<ViolationTypeBriefResponse[]>;
  refresh: () => Promise<ViolationTypeBriefResponse[]>;
}

export const useViolationTypesStore = create<ViolationTypesState>((set, get) => {
  function load(): Promise<ViolationTypeBriefResponse[]> {
    const sessionVersion = getSessionVersion();
    const promise = dictionaryApi
      .getBriefViolationTypes()
      .then((response) => {
        const value = Array.isArray(response) ? response : response ? [response] : [];
        if (sessionVersion === getSessionVersion()) set({ violationTypes: value, isLoading: false, isLoaded: true, error: null, inFlight: null });
        return value;
      })
      .catch((err) => {
        console.error("Ошибка загрузки справочника видов нарушений:", err);
        if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить справочник", inFlight: null });
        throw err;
      });
    set({ isLoading: true, inFlight: promise });
    return promise;
  }

  return {
    violationTypes: [],
    isLoading: false,
    isLoaded: false,
    error: null,
    inFlight: null,
    ensureLoaded: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      if (state.isLoaded) return Promise.resolve(state.violationTypes);
      return load();
    },
    refresh: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      return load();
    },
  };
});
