import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, useAuthStore } from "@entities/session/model/authStore";

export interface StreamNotification {
  title: string;
  description?: string;
  link?: string;
  eventId?: string;
  timestamp?: string;
  isRead?: boolean;
  type?: string;
}

const STREAM_URL = `${import.meta.env.VITE_API_URL || ""}/api/v1/notifications/stream`;
const MIN_RETRY_MS = 2_000;
const MAX_RETRY_MS = 30_000;

export function useNotificationStream(onNew?: (notification: StreamNotification) => void): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const onNewRef = useRef(onNew);
  useEffect(() => {
    onNewRef.current = onNew;
  }, [onNew]);
  const employeeUid = useAuthStore((s) => s.context?.employeeUid);

  useEffect(() => {
    if (!employeeUid) return;
    const controller = new AbortController();
    let retryMs = MIN_RETRY_MS;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    async function connect() {
      while (!controller.signal.aborted) {
        try {
          const token = getAccessToken();
          const response = await fetch(STREAM_URL, {
            headers: { Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok || !response.body) throw new Error(`SSE: статус ${response.status}`);

          retryMs = MIN_RETRY_MS;
          setConnected(true);
          refresh();

          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            let boundary: number;
            while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
              const rawEvent = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "");
              const eventName = /^event:\s*(\S+)/m.exec(rawEvent)?.[1];
              if (eventName === "newNotification") {
                const data = rawEvent
                  .split(/\r?\n/)
                  .filter((line) => line.startsWith("data:"))
                  .map((line) => line.slice(5).replace(/^ /, ""))
                  .join("\n");
                try {
                  onNewRef.current?.(JSON.parse(data) as StreamNotification);
                } catch (err) {
                  console.warn("Не удалось разобрать уведомление из потока:", err);
                }
                refresh();
              } else if (eventName === "notificationRead") {
                refresh();
              }
            }
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          console.warn("Поток уведомлений прерван, переподключение:", err);
        }
        if (controller.signal.aborted) return;
        setConnected(false);
        await new Promise((resolve) => setTimeout(resolve, retryMs));
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      }
    }

    connect();
    return () => {
      controller.abort();
      setConnected(false);
    };
  }, [employeeUid, queryClient]);

  return connected;
}
