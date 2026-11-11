const KEY = "sessionExpired";

export function markSessionExpired() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    return;
  }
}

export function isSessionExpired(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearSessionExpired() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
}
