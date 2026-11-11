const KEY = "unreadToastsShownFor";

export function wasLoginUnreadShown(employeeUid: string): boolean {
  try {
    return sessionStorage.getItem(KEY) === employeeUid;
  } catch {
    return false;
  }
}

export function markLoginUnreadShown(employeeUid: string) {
  try {
    sessionStorage.setItem(KEY, employeeUid);
  } catch {
    return;
  }
}

export function resetLoginUnreadShown() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
}
