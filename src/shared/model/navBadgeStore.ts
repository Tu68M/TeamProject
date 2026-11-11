import { create } from "zustand";

interface NavBadgeState {
  refreshToken: number;
  requestRefresh: () => void;
}

export const useNavBadgeStore = create<NavBadgeState>((set) => ({
  refreshToken: 0,
  requestRefresh: () => set((s) => ({ refreshToken: s.refreshToken + 1 })),
}));
