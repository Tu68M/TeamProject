import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { userApi } from "@shared/api";
import type { ModuleResponse } from "@shared/types/api";

interface ModulesState {
  modules: ModuleResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<ModuleResponse[]> | null;
  ensureLoaded: () => Promise<ModuleResponse[]>;
  refresh: () => Promise<ModuleResponse[]>;
}

export const useModulesStore = create<ModulesState>((set, get) => {
  function load(): Promise<ModuleResponse[]> {
    const sessionVersion = getSessionVersion();
    const promise = userApi
      .getModules()
      .then((modules) => {
        const value = modules || [];
        if (sessionVersion === getSessionVersion()) set({ modules: value, isLoading: false, isLoaded: true, error: null, inFlight: null });
        return value;
      })
      .catch((err) => {
        console.error("Ошибка загрузки модулей:", err);
        if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить список модулей", inFlight: null });
        throw err;
      });
    set({ isLoading: true, inFlight: promise });
    return promise;
  }

  return {
    modules: [],
    isLoading: false,
    isLoaded: false,
    error: null,
    inFlight: null,
    ensureLoaded: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      if (state.isLoaded) return Promise.resolve(state.modules);
      return load();
    },
    refresh: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      return load();
    },
  };
});
