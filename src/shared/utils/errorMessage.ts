
interface ErrorLike {
  message?: unknown;
  code?: unknown;
  isAxiosError?: unknown;
  response?: { status?: unknown; data?: unknown };
}

const CYRILLIC_RE = /[А-Яа-яЁё]/;
const MAX_SERVER_MESSAGE = 300;

function serverMessage(err: ErrorLike): string | null {
  const data = err.response?.data;
  const status = typeof err.response?.status === "number" ? err.response.status : 0;
  if (status >= 500) return null;
  const msg =
    typeof data === "string"
      ? data
      : data && typeof data === "object" && "message" in data
        ? (data as { message?: unknown }).message
        : null;
  if (typeof msg !== "string") return null;
  const trimmed = msg.trim();
  if (!trimmed || trimmed.length > MAX_SERVER_MESSAGE || !CYRILLIC_RE.test(trimmed)) return null;
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return null;
  return trimmed;
}

function failureReason(err: ErrorLike): string | null {
  const status = typeof err.response?.status === "number" ? err.response.status : null;
  if (status === null) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return "Сервер слишком долго не отвечает. Попробуйте ещё раз чуть позже.";
    }
    if (err.code === "ERR_CANCELED") return null;
    if (!err.isAxiosError) return null;
    return "Нет связи с сервером. Проверьте подключение к интернету и попробуйте ещё раз.";
  }
  if (status === 401) return "Сессия истекла. Войдите в систему заново.";
  if (status === 403) return "Недостаточно прав для выполнения этого действия.";
  if (status === 404) return "Запрошенные данные не найдены. Возможно, они были удалены.";
  if (status === 408 || status === 504) return "Сервер слишком долго не отвечает. Попробуйте ещё раз чуть позже.";
  if (status === 429) return "Слишком много запросов. Подождите немного и попробуйте снова.";
  if (status === 502 || status === 503) return "Сервис временно недоступен. Попробуйте ещё раз через несколько минут.";
  if (status >= 500) return "На сервере произошла ошибка. Мы уже знаем о проблеме — попробуйте позже.";
  return null;
}

export function getErrorMessage(err: unknown, fallback?: string): string {
  const e: ErrorLike = err && typeof err === "object" ? (err as ErrorLike) : {};
  const fromServer = serverMessage(e);
  if (fromServer) return fromServer;

  const reason = failureReason(e);
  if (reason) {
    if (!fallback) return reason;
    return `${fallback.replace(/[.!\s]+$/, "")}. ${reason}`;
  }
  return fallback ?? "Что-то пошло не так. Попробуйте обновить страницу или повторить действие позже.";
}
