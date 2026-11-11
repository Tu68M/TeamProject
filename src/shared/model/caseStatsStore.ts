import { create } from "zustand";
import { getSessionVersion } from "./sessionVersion";
import { caseApi } from "@/entities/case/api/caseApi";
import type { CaseStatsResponse } from "@shared/types/api";

const EMPTY_STATS: CaseStatsResponse = {
  total: 0,
  expiringSoon: 0,
  awaitingCommission: 0,
  overdue: 0,
  active: 0,
  actionRequired: 0,
};

interface CaseStatsState {
  stats: CaseStatsResponse;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  inFlight: Promise<CaseStatsResponse> | null;
  ensureLoaded: () => Promise<CaseStatsResponse>;
  refresh: () => Promise<CaseStatsResponse>;
}

export const useCaseStatsStore = create<CaseStatsState>((set, get) => {
  function load(): Promise<CaseStatsResponse> {
    const sessionVersion = getSessionVersion();
    const promise = caseApi
      .getDashboardStats()
      .then((stats) => {
        const value = stats || EMPTY_STATS;
        if (sessionVersion === getSessionVersion()) set({ stats: value, isLoading: false, isLoaded: true, error: null, inFlight: null });
        return value;
      })
      .catch((err) => {
        console.error("Ошибка загрузки статистики по делам:", err);
        if (sessionVersion === getSessionVersion()) set({ isLoading: false, error: "Не удалось загрузить статистику", inFlight: null });
        throw err;
      });
    set({ isLoading: true, inFlight: promise });
    return promise;
  }

  return {
    stats: EMPTY_STATS,
    isLoading: false,
    isLoaded: false,
    error: null,
    inFlight: null,
    ensureLoaded: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      if (state.isLoaded) return Promise.resolve(state.stats);
      return load();
    },
    refresh: () => {
      const state = get();
      if (state.inFlight) return state.inFlight;
      return load();
    },
  };
});
