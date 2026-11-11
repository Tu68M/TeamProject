import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useAuthStore } from "@entities/session/model/authStore";
import { userApi } from "@/shared/api";
import { resetUserData } from "@shared/model/resetUserData";
import { clearSessionExpired, isSessionExpired } from "@entities/session/sessionExpiredFlag";
import { getErrorMessage } from "@shared/utils/errorMessage";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setContext } = useAuthStore();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(isSessionExpired);

  useEffect(() => {
    clearSessionExpired();
  }, []);

  useEffect(() => {
    if (!sessionExpired) return;
    const timer = setTimeout(() => setSessionExpired(false), 6000);
    return () => clearTimeout(timer);
  }, [sessionExpired]);

  useEffect(() => {
    const loginInput = document.getElementById("login-input");
    if (loginInput) {
      loginInput.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const authResponse = await userApi.login({ username: login, password });

      if (!authResponse.accessToken) {
        throw new Error("Сервер не вернул токен доступа");
      }
      useAuthStore.getState().setAccessToken(authResponse.accessToken);

      queryClient.clear();
      resetUserData();

      const contextData = await userApi.getContext();

      setContext(contextData, authResponse.accessToken);

      const modules = contextData.modules.map(m => m.code);

      if (modules.includes("dashboard")) {
        navigate("/");
      } else if (modules.includes("cases")) {
        navigate("/cases");
      } else if (modules.includes("dictionaries")) {
        navigate("/dictionaries");
      } else if (modules.includes("organization")) {
        navigate("/organization");
      } else {
        navigate("/");
      }
    } catch (err: unknown) {
      console.error("Ошибка авторизации:", err);

      if (err instanceof AxiosError && err.response) {
        switch (err.response.status) {
          case 401:
            setError("Неверный логин или пароль");
            break;
          case 403:
            setError("Учётная запись отключена администратором");
            break;
          case 423:
            setError("Учётная запись временно заблокирована из-за множества неудачных попыток");
            break;
          case 400:
            setError("Некорректный формат запроса");
            break;
          default:
            setError(getErrorMessage(err, "Не удалось войти"));
        }
      } else if (err instanceof Error) {
        setError(getErrorMessage(err, "Не удалось войти"));
      } else {
        setError("Не удалось соединиться с сервером");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass =
    "w-full min-h-[44px] border border-bd rounded-inp bg-bg pl-10 pr-3 py-2.5 text-[14px] leading-[20px] text-tx outline-none transition-colors placeholder:text-txm focus:border-pr focus:ring-3 focus:ring-pr/10 disabled:bg-ntbg";

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-bg">
      {sessionExpired && (
        <div className="fixed top-4 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)]">
          <div
            role="status"
            aria-live="polite"
            className="relative bg-bg border border-bd border-l-4 border-l-pr rounded-inp shadow-dropdown animate-dropdownIn motion-reduce:animate-none"
          >
            <span className="block px-3 py-2.5 pr-9 text-[14px] leading-[20px] font-medium text-tx">
              Сессия истекла, войдите ещё раз
            </span>
            <button
              type="button"
              aria-label="Закрыть уведомление"
              onClick={() => setSessionExpired(false)}
              className="absolute top-2 right-2 text-tx2 hover:text-tx transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <aside className="relative hidden lg:flex flex-col justify-start overflow-hidden bg-gradient-to-br from-[#005BA8] via-[#0071CE] to-[#00AEEF] p-12 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-ac/40 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1.5px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative flex items-center gap-4">
          <img src="/logo-white.svg" alt="Т1 Дисциплина" className="h-[52px] w-auto -mt-[15px]" />
        </div>
      </aside>

      <main className="flex items-center justify-center bg-surf lg:bg-bg px-5 py-10">
        <div className="w-full max-w-[400px] animate-fadeIn">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/logo-blue-grey.svg" alt="Т1 Дисциплина" className="h-[44px] w-auto -my-[6px] dark:hidden" />
            <img src="/logo-blue-white.svg" alt="Т1 Дисциплина" className="hidden h-[44px] w-auto -my-[6px] dark:block" />
          </div>

          <div className="mb-8">
            <h1 className="text-[30px] leading-[38px] font-bold text-tx mb-2">Добро пожаловать</h1>
            <p className="text-[14px] leading-[20px] text-tx2">Войдите в систему, чтобы продолжить работу</p>
          </div>

          {error && (
            <div role="alert" className="p-3 px-4 bg-dgbg text-dgt rounded-inp mb-5 text-[14px] leading-[20px] flex items-start gap-2 border border-dg/20">
              <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col">
              <label htmlFor="login-input" className="text-[14px] leading-[20px] font-medium text-tx mb-2">
                Логин
              </label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="login-input"
                  type="text"
                  className={fieldClass}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Введите логин"
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label htmlFor="password-input" className="text-[14px] leading-[20px] font-medium text-tx mb-2">
                Пароль
              </label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  className={`${fieldClass} pr-11`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-tx2 hover:text-tx hover:bg-ntbg transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] px-4 py-2.5 rounded-inp font-medium text-[14px] leading-[20px] bg-pr text-white border border-transparent hover:bg-prh disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Вход...
                </>
              ) : (
                "Войти"
              )}
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}
