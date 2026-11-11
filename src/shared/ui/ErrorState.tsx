import { getErrorMessage } from "@shared/utils/errorMessage";

interface ErrorStateProps {
  error?: unknown;
  message?: string | null;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}

export function ErrorState({
  error,
  message,
  title = "Не удалось загрузить данные",
  onRetry,
  retryLabel = "Попробовать снова",
  compact = false,
}: ErrorStateProps) {
  const description = message || getErrorMessage(error);
  return (
    <div role="alert" className={`flex flex-col items-center text-center ${compact ? "py-6 px-4" : "py-16 px-4"}`}>
      <div className="w-11 h-11 rounded-full bg-dgbg text-dgt flex items-center justify-center mb-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12.5" />
          <circle cx="12" cy="16" r="0.6" fill="currentColor" />
        </svg>
      </div>
      <div className="text-[16px] font-semibold text-tx">{title}</div>
      <div className="mt-1 max-w-[420px] text-[14px] leading-[20px] text-tx2">{description}</div>
      {onRetry && (
        <button
          type="button"
          className="mt-4 px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors cursor-pointer"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
