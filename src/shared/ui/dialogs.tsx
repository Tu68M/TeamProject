import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";

interface AlertOptions {
  title?: string;
  buttonLabel?: string;
}

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type DialogItem =
  | { id: number; kind: "alert"; message: string; title: string; buttonLabel: string; resolve: () => void }
  | {
      id: number;
      kind: "confirm";
      message: string;
      title: string;
      confirmLabel: string;
      cancelLabel: string;
      danger: boolean;
      resolve: (ok: boolean) => void;
    };

interface DialogStore {
  queue: DialogItem[];
  push: (item: DialogItem) => void;
  shift: () => void;
}

const useDialogStore = create<DialogStore>((set) => ({
  queue: [],
  push: (item) => set((s) => ({ queue: [...s.queue, item] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

let nextId = 1;

const ERROR_RE = /^(не удалось|ошибка|произошла ошибка)/i;

export function showAlert(message: string, options: AlertOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({
      id: nextId++,
      kind: "alert",
      message,
      title: options.title ?? (ERROR_RE.test(message) ? "Ошибка" : "Внимание"),
      buttonLabel: options.buttonLabel ?? "Понятно",
      resolve,
    });
  });
}

export function showConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({
      id: nextId++,
      kind: "confirm",
      message,
      title: options.title ?? "Подтверждение",
      confirmLabel: options.confirmLabel ?? "Подтвердить",
      cancelLabel: options.cancelLabel ?? "Отмена",
      danger: options.danger ?? false,
      resolve,
    });
  });
}

export function DialogHost() {
  const current = useDialogStore((s) => s.queue[0]);
  const shift = useDialogStore((s) => s.shift);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const close = (ok: boolean) => {
    if (!current) return;
    if (current.kind === "confirm") current.resolve(ok);
    else current.resolve();
    shift();
  };

  useEffect(() => {
    if (!current) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  const isConfirm = current.kind === "confirm";
  const primaryClass =
    current.kind === "confirm" && current.danger
      ? "bg-dg text-white hover:bg-dgh"
      : "bg-pr text-white hover:bg-prh";

  return createPortal(
    <div
      key={current.id}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => close(false)}
    >
      <div
        role={isConfirm ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
        className="bg-bg rounded-lg border border-bd w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-bd">
          <h3 id="app-dialog-title" className="text-[18px] font-bold text-tx">
            {current.title}
          </h3>
        </div>
        <div id="app-dialog-message" className="p-4 text-[14px] leading-[22px] text-tx whitespace-pre-wrap break-words">
          {current.message}
        </div>
        <div className="p-4 pt-0 flex gap-2 justify-end">
          {current.kind === "confirm" && (
            <button
              type="button"
              onClick={() => close(false)}
              className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors"
            >
              {current.cancelLabel}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={() => close(true)}
            className={`px-4 py-2 rounded-inp font-medium text-[14px] transition-colors ${primaryClass}`}
          >
            {current.kind === "confirm" ? current.confirmLabel : current.buttonLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
