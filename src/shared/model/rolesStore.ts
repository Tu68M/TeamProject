import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { userApi } from "@shared/api";
import type { RoleShortResponse } from "@shared/types/api";

interface RolesState {
  roles: RoleShortResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<RoleShortResponse[]> | null;
  ensureLoaded: () => Promise<RoleShortResponse[]>;
  refresh: () => Promise<RoleShortResponse[]>;
}

export const useRolesStore = create<RolesState>((set, get) => {
  function load(): Promise<RoleShortResponse[]> {
    const sessionVersion = getSessionVersion();
    const promise = userApi
      .getRoles()
      .then((roles) => {
        const value = roles || [];
        if (sessionVersion === getSessionVersion()) set({ roles: value, isLoading: false, isLoaded: true, error: null, inFlight: null });
        return value;
      })
      .catch((err) => {
        console.error("Ошибка загрузки ролей:", err);
        if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить список ролей", inFlight: null });
        throw err;
      });
    set({ isLoading: true, inFlight: promise });
    return promise;
  }

  return {
    roles: [],
    isLoading: false,
    isLoaded: false,
    error: null,
    inFlight: null,
    ensureLoaded: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      if (state.isLoaded) return Promise.resolve(state.roles);
      return load();
    },
    refresh: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      return load();
    },
  };
});
