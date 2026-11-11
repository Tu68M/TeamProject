import { useEffect, useRef, useState } from "react";
import type { StreamNotification } from "@entities/notification/useNotificationStream";

const VISIBLE_MS = 7_000;
const LEAVE_MS = 120;

export function NotificationToast({
  notification,
  onOpen,
  onClose,
}: {
  notification: StreamNotification;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (hovered || leaving) return;
    const timer = setTimeout(() => setLeaving(true), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [hovered, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => closeRef.current(), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative w-[340px] max-w-[calc(100vw-2rem)] bg-bg border border-bd border-l-4 border-l-pr rounded-inp shadow-dropdown overflow-hidden origin-top-right motion-reduce:animate-none ${
        leaving ? "animate-dropdownOut pointer-events-none" : "animate-dropdownIn"
      }`}
    >
      <button type="button" onClick={onOpen} className="w-full text-left px-3 py-2.5 pr-9 hover:bg-surf transition-colors">
        <span className="block text-[14px] leading-[20px] font-medium text-tx">{notification.title}</span>
        {notification.description && (
          <span className="block text-[13px] leading-[18px] text-tx2 break-words">{notification.description}</span>
        )}
      </button>
      <button
        type="button"
        aria-label="Закрыть уведомление"
        onClick={() => setLeaving(true)}
        className="absolute top-2 right-2 text-tx2 hover:text-tx transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
