import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { dictionaryApi } from "@entities/dictionary/dictionaryApi";
import type { CommissionTypeResponse } from "@shared/types/api";

interface CommissionTypesState {
  commissionTypes: CommissionTypeResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<CommissionTypeResponse[]> | null;
  ensureLoaded: () => Promise<CommissionTypeResponse[]>;
  refresh: () => Promise<CommissionTypeResponse[]>;
}

export const useCommissionTypesStore = create<CommissionTypesState>((set, get) => {
  function load(): Promise<CommissionTypeResponse[]> {
    const sessionVersion = getSessionVersion();
    const promise = dictionaryApi
      .getCommissionTypes()
      .then((response) => {
        const value = Array.isArray(response) ? response : response ? [response] : [];
        if (sessionVersion === getSessionVersion()) set({ commissionTypes: value, isLoading: false, isLoaded: true, error: null, inFlight: null });
        return value;
      })
      .catch((err) => {
        console.error("Ошибка загрузки справочника типов комиссий:", err);
        if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить справочник", inFlight: null });
        throw err;
      });
    set({ isLoading: true, inFlight: promise });
    return promise;
  }

  return {
    commissionTypes: [],
    isLoading: false,
    isLoaded: false,
    error: null,
    inFlight: null,
    ensureLoaded: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      if (state.isLoaded) return Promise.resolve(state.commissionTypes);
      return load();
    },
    refresh: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      return load();
    },
  };
});
