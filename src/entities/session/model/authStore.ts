import { create } from "zustand";
import { resetLoginUnreadShown } from "@entities/notification/loginUnreadFlag";
import { persist } from "zustand/middleware";
import type { UserContextResponse } from "@/shared/types/api";

interface AuthState {
  context: UserContextResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setContext: (context: UserContextResponse, token: string) => void;
  setAccessToken: (token: string) => void;
  updateAvatarUrl: (avatarUrl: string | undefined) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  
  hasModule: (moduleCode: string) => boolean;
  canWriteModule: (moduleCode: string) => boolean;
  hasPermission: (permissionCode: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      context: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      setContext: (context, token) => {
        set({ context, token, isAuthenticated: true, isLoading: false });
      },

      setAccessToken: (token) => {
        set({ token, isAuthenticated: true });
      },

      updateAvatarUrl: (avatarUrl) => {
        const context = get().context;
        if (!context) return;
        set({ context: { ...context, avatarUrl } });
      },

      logout: () => {
        resetLoginUnreadShown();
        set({ context: null, token: null, isAuthenticated: false, isLoading: false });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      hasModule: (moduleCode: string) => {
        return get().context?.modules.some((m) => m.code === moduleCode) ?? false;
      },

      canWriteModule: (moduleCode: string) => {
        const mod = get().context?.modules.find((m) => m.code === moduleCode);
        return mod?.accessLevel === "WRITE";
      },

      hasPermission: (permissionCode: string) => {
        return get().context?.permissions.includes(permissionCode) ?? false;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        context: state.context,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setLoading(false);
        }
      },
    }
  )
);

export const useSession = useAuthStore;

export const getAccessToken = (): string | null => {
  return useAuthStore.getState().token;
};

export const getUserContext = (): UserContextResponse | null => {
  return useAuthStore.getState().context;
};