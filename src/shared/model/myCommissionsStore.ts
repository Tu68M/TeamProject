import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { commissionApi } from "@/entities/commission/api/commissionApi";
import type { MyCommissionResponse } from "@shared/types/api";

interface MyCommissionsState {
  commissions: MyCommissionResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<MyCommissionResponse[]> | null;
  ensureLoaded: () => Promise<MyCommissionResponse[]>;
  refresh: () => Promise<MyCommissionResponse[]>;
}

export const useMyCommissionsStore = create<MyCommissionsState>((set, get) => {
  function load(): Promise<MyCommissionResponse[]> {
    const sessionVersion = getSessionVersion();
    const promise = commissionApi
      .getMyActiveCommissions()
      .then((list) => {
        const commissions = list || [];
        if (sessionVersion === getSessionVersion()) set({ commissions, isLoading: false, isLoaded: true, error: null, inFlight: null });
        return commissions;
      })
      .catch((err) => {
        console.error("Ошибка загрузки активных комиссий:", err);
        if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить комиссии", inFlight: null });
        throw err;
      });
    set({ isLoading: true, inFlight: promise });
    return promise;
  }

  return {
    commissions: [],
    isLoading: false,
    isLoaded: false,
    error: null,
    inFlight: null,
    ensureLoaded: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      if (state.isLoaded) return Promise.resolve(state.commissions);
      return load();
    },
    refresh: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      return load();
    },
  };
});
