import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { dictionaryApi } from "@entities/dictionary/dictionaryApi";
import type { DecisionTypeResponse } from "@shared/types/api";

interface DecisionTypesState {
  decisionTypes: DecisionTypeResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<DecisionTypeResponse[]> | null;
  ensureLoaded: () => Promise<DecisionTypeResponse[]>;
  refresh: () => Promise<DecisionTypeResponse[]>;
}

export const useDecisionTypesStore = create<DecisionTypesState>((set, get) => {
  function load(): Promise<DecisionTypeResponse[]> {
    const sessionVersion = getSessionVersion();
    const promise = dictionaryApi
      .getDecisionTypes()
      .then((response) => {
        const value = Array.isArray(response) ? response : response ? [response] : [];
        if (sessionVersion === getSessionVersion()) set({ decisionTypes: value, isLoading: false, isLoaded: true, error: null, inFlight: null });
        return value;
      })
      .catch((err) => {
        console.error("Ошибка загрузки справочника видов взысканий:", err);
        if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить справочник", inFlight: null });
        throw err;
      });
    set({ isLoading: true, inFlight: promise });
    return promise;
  }

  return {
    decisionTypes: [],
    isLoading: false,
    isLoaded: false,
    error: null,
    inFlight: null,
    ensureLoaded: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      if (state.isLoaded) return Promise.resolve(state.decisionTypes);
      return load();
    },
    refresh: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      return load();
    },
  };
});
