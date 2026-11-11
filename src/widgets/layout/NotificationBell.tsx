import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@entities/notification/notificationApi";
import { installSoundUnlock, isSoundMuted, playNotificationSound, setSoundMuted } from "@entities/notification/notificationSound";
import { markLoginUnreadShown, wasLoginUnreadShown } from "@entities/notification/loginUnreadFlag";
import { useAuthStore } from "@entities/session/model/authStore";
import { useNotificationStream, type StreamNotification } from "@entities/notification/useNotificationStream";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { ErrorState } from "@shared/ui/ErrorState";
import { NotificationToast } from "@widgets/layout/NotificationToast";
import { formatServerDateTime } from "@shared/utils/datetime";
import type { InAppNotificationResponse } from "@shared/types/api";

const LIST_SIZE = 20;
const MAX_TOASTS = 3;

interface ToastItem {
  key: string;
  notification: StreamNotification;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [muted, setMuted] = useState(isSoundMuted);
  const seenEvents = useRef(new Set<string>());

  useEffect(() => {
    installSoundUnlock();
  }, []);

  const employeeUid = useAuthStore((s) => s.context?.employeeUid);
  useEffect(() => {
    if (!employeeUid || wasLoginUnreadShown(employeeUid)) return;
    markLoginUnreadShown(employeeUid);
    notificationApi
      .unread(MAX_TOASTS)
      .then((unread) => {
        if (unread.length === 0) return;
        const items = unread
          .filter((n) => !seenEvents.current.has(n.id))
          .slice(0, MAX_TOASTS)
          .reverse()
          .map((n) => {
            seenEvents.current.add(n.id);
            return {
              key: n.id,
              notification: {
                title: n.title,
                description: n.body,
                link: n.actionUrl,
                eventId: n.id,
                timestamp: n.createdAt,
                isRead: false,
                type: n.type,
              } as StreamNotification,
            };
          });
        if (items.length === 0) return;
        setToasts((prev) => [...prev, ...items].slice(-MAX_TOASTS));
        playNotificationSound();
      })
      .catch((err) => console.warn("Не удалось загрузить непрочитанные уведомления при входе:", err));
  }, [employeeUid]);

  const streamConnected = useNotificationStream((notification) => {
    if (notification.eventId) {
      if (seenEvents.current.has(notification.eventId)) return;
      seenEvents.current.add(notification.eventId);
    }
    queryClient.setQueryData<number>(["notifications", "counter"], (prev) => (prev ?? 0) + 1);
    setToasts((prev) =>
      [...prev, { key: notification.eventId ?? `${Date.now()}-${Math.random()}`, notification }].slice(-MAX_TOASTS)
    );
    playNotificationSound();
  });

  function closeToast(key: string) {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }

  async function openToast(toast: ToastItem) {
    closeToast(toast.key);
    const { link, title } = toast.notification;
    if (link) navigate(link);
    try {
      const unread = await notificationApi.unread(LIST_SIZE);
      const match = unread.find((n) => n.actionUrl === link && n.title === title);
      if (match) await notificationApi.markRead(match.id);
    } catch (err) {
      console.warn("Не удалось пометить уведомление прочитанным:", err);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    if (!next) playNotificationSound();
  }

  const timezone = useTimezoneStore((s) => s.timezone);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [isOpen, setOpen] = useState(false);
  const [isMounted, setMounted] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 120);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const counterQuery = useQuery({
    queryKey: ["notifications", "counter"],
    queryFn: notificationApi.counter,
    refetchInterval: streamConnected ? false : 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const listQuery = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationApi.unread(LIST_SIZE),
    enabled: isOpen,
    retry: false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onMutate: () => {
      queryClient.setQueryData<number>(["notifications", "counter"], 0);
      queryClient.setQueryData<InAppNotificationResponse[]>(["notifications", "unread"], []);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const count = counterQuery.data ?? 0;
  const items = listQuery.data ?? [];

  function openNotification(item: InAppNotificationResponse) {
    markRead.mutate(item.id);
    setOpen(false);
    if (item.actionUrl) navigate(item.actionUrl);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label={count > 0 ? `Уведомления, непрочитанных: ${count}` : "Уведомления"}
        aria-expanded={isOpen}
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-tx2 hover:text-tx hover:bg-surf transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-dg text-white text-[10px] font-bold leading-[18px] text-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {(isOpen || isMounted) && (
        <div
          className={`absolute top-full right-0 mt-1 w-[360px] max-w-[calc(100vw-2rem)] bg-bg border border-bd rounded-inp shadow-dropdown z-50 overflow-hidden origin-top-right motion-reduce:animate-none ${
            isOpen ? "animate-dropdownIn" : "animate-dropdownOut pointer-events-none"
          }`}
        >
          <div className="px-3 py-2.5 border-b border-bd flex items-center justify-between">
            <span className="font-medium text-[14px] leading-[20px] text-tx">Уведомления</span>
            <span className="flex items-center gap-2">
              {count > 0 && <span className="text-[12px] text-tx2">Непрочитанных: {count}</span>}
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="text-[12px] text-pr hover:underline disabled:opacity-50 transition-colors"
                >
                  Прочитать все
                </button>
              )}
              <button
                type="button"
                onClick={toggleMuted}
                aria-pressed={muted}
                title={muted ? "Включить звук уведомлений" : "Выключить звук уведомлений"}
                aria-label={muted ? "Включить звук уведомлений" : "Выключить звук уведомлений"}
                className="text-tx2 hover:text-tx transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H2v6h4l5 4z" />
                  {muted ? (
                    <>
                      <line x1="22" y1="9" x2="16" y2="15" />
                      <line x1="16" y1="9" x2="22" y2="15" />
                    </>
                  ) : (
                    <>
                      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                    </>
                  )}
                </svg>
              </button>
            </span>
          </div>

          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            {listQuery.isLoading ? (
              <div className="px-3 py-6 text-center text-[13px] text-tx2">Загрузка...</div>
            ) : listQuery.isError ? (
              <ErrorState compact error={listQuery.error} title="Не удалось загрузить уведомления" onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] text-tx2">Нет новых уведомлений</div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left border-b border-bd last:border-b-0 hover:bg-surf transition-colors"
                >
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-pr shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] leading-[20px] font-medium text-tx">{item.title}</span>
                    <span className="block text-[13px] leading-[18px] text-tx2 break-words">{item.body}</span>
                    <span className="block mt-1 text-[12px] leading-[16px] text-tx2">
                      {formatServerDateTime(item.createdAt, timezone)}
                      {item.actionLabel && item.actionUrl ? ` · ${item.actionLabel}` : ""}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {count > items.length && items.length > 0 && (
            <div className="px-3 py-2 border-t border-bd text-center text-[12px] text-tx2">
              Показаны последние {items.length}
            </div>
          )}
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed top-[72px] right-4 z-[60] flex flex-col gap-2 items-end">
          {toasts.map((toast) => (
            <NotificationToast
              key={toast.key}
              notification={toast.notification}
              onOpen={() => openToast(toast)}
              onClose={() => closeToast(toast.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
