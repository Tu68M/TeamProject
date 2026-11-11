import { resetUserData } from "@shared/model/resetUserData";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@entities/session/model/authStore";
import { userApi } from "@shared/api";

export function useAuthBootstrap() {
  const { token, setContext, logout, setLoading, isLoading } = useAuthStore();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const bootstrap = async () => {
      try {
        if (token) {
          const contextData = await userApi.getContext();
          
          setContext(contextData, token);
        } else {
          logout();
          resetUserData();
        }
      } catch (error) {
        console.error("Ошибка инициализации сессии:", error);
        logout();
        resetUserData();
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [token, setContext, logout, setLoading]);

  return isLoading;
}