import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { userApi } from "@shared/api";
import type { PermissionResponse } from "@shared/types/api";

interface AllPermissionsState {
  permissions: PermissionResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<PermissionResponse[]> | null;
  ensureLoaded: () => Promise<PermissionResponse[]>;
  refresh: () => Promise<PermissionResponse[]>;
}

export const useAllPermissionsStore = create<AllPermissionsState>((set, get) => {
  function load(): Promise<PermissionResponse[]> {
    const sessionVersion = getSessionVersion();
    const promise = userApi
      .getAllPermissions()
      .then((permissions) => {
        const value = permissions || [];
        if (sessionVersion === getSessionVersion()) set({ permissions: value, isLoading: false, isLoaded: true, error: null, inFlight: null });
        return value;
      })
      .catch((err) => {
        console.error("Ошибка загрузки прав:", err);
        if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить список прав", inFlight: null });
        throw err;
      });
    set({ isLoading: true, inFlight: promise });
    return promise;
  }

  return {
    permissions: [],
    isLoading: false,
    isLoaded: false,
    error: null,
    inFlight: null,
    ensureLoaded: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      if (state.isLoaded) return Promise.resolve(state.permissions);
      return load();
    },
    refresh: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      return load();
    },
  };
});
