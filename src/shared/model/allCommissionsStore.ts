import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { commissionApi } from "@/entities/commission/api/commissionApi";
import type { CommissionResponse } from "@shared/types/api";

interface AllCommissionsState {
  commissions: CommissionResponse[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<CommissionResponse[]> | null;
  ensureLoaded: () => Promise<CommissionResponse[]>;
  refresh: () => Promise<CommissionResponse[]>;
}

export const useAllCommissionsStore = create<AllCommissionsState>((set, get) => {
  let requestId = 0;

  function load(): Promise<CommissionResponse[]> {
    const sessionVersion = getSessionVersion();
    const currentRequestId = ++requestId;
    const promise = commissionApi
      .getCommissions()
      .then((list) => {
        const commissions = list || [];
        if (currentRequestId === requestId) {
          if (sessionVersion === getSessionVersion()) set({ commissions, isLoading: false, isLoaded: true, error: null, inFlight: null });
        }
        return commissions;
      })
      .catch((err) => {
        console.error("Ошибка загрузки комиссий:", err);
        if (currentRequestId === requestId) {
          if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить комиссии", inFlight: null });
        }
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
    refresh: () => load(),
  };
});
