import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { caseApi } from "@/entities/case/api/caseApi";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { formatServerDateTime } from "@shared/utils/datetime";
import type { Case1cExportResponse, CaseStatus, Export1cStatus } from "@shared/types/api";

type StepState = "done" | "current" | "error" | "pending";

interface StepView {
  title: string;
  description: string;
  state: StepState;
  busy?: boolean;
}

const POLL_INTERVAL_MS = 3000;

function buildSteps(
  caseStatus: CaseStatus | undefined,
  hasPenaltyOrder: boolean,
  latest: Case1cExportResponse | undefined
): StepView[] {
  const executed = caseStatus === "ИСПОЛНЕНО";
  const status: Export1cStatus | undefined = latest?.status;
  const documentStep: StepView = {
    title: "Приказ о взыскании",
    description: hasPenaltyOrder
      ? latest?.documentFilename || "Приказ сформирован"
      : "Приказ ещё не сформирован",
    state: hasPenaltyOrder || executed ? "done" : "current",
  };

  let integrationState: StepState = "pending";
  let integrationDescription = "Ожидает отправки";
  let integrationBusy = false;
  if (status === "QUEUED") {
    integrationState = "current";
    integrationBusy = true;
    integrationDescription = "Приказ передаётся в сервис интеграции с 1С";
  } else if (status === "SENT") {
    integrationState = "done";
    integrationDescription = "Сервис интеграции с 1С принял приказ";
  } else if (status === "FAILED" && latest?.failedStep === "INTEGRATION") {
    integrationState = "error";
    integrationDescription = latest.errorMessage || "Не удалось передать приказ в сервис интеграции с 1С";
  } else if (status === "FAILED") {
    integrationState = "done";
    integrationDescription = "Сервис интеграции с 1С принял приказ";
  } else if (hasPenaltyOrder) {
    integrationDescription = "Готово к отправке";
  }

  let onecState: StepState = "pending";
  let onecDescription = "Ожидает передачи";
  if (status === "SENT") {
    onecState = "done";
    onecDescription = "1С приняла приказ, дело исполнено";
  } else if (status === "QUEUED") {
    onecState = "pending";
    onecDescription = "Ожидается подтверждение от 1С";
  } else if (status === "FAILED" && latest?.failedStep === "ONEC") {
    onecState = "error";
    onecDescription = latest.errorMessage || "1С не приняла приказ";
  }

  return [
    documentStep,
    { title: "Передача в сервис интеграции с 1С", description: integrationDescription, state: integrationState, busy: integrationBusy },
    { title: "Отправка в 1С", description: onecDescription, state: onecState },
  ];
}

const EXPORT_STATUS_LABEL: Record<Export1cStatus, string> = {
  QUEUED: "В процессе",
  SENT: "Отправлено",
  FAILED: "Ошибка",
};

const EXPORT_STATUS_CLASS: Record<Export1cStatus, string> = {
  QUEUED: "bg-wnbg text-wnt",
  SENT: "bg-okbg text-okt",
  FAILED: "bg-dgbg text-dgt",
};

export function Export1cTab({
  caseId,
  caseStatus,
  hasPenaltyOrder,
  isSending,
  onGenerate,
  onSend,
}: {
  caseId: string;
  caseStatus: CaseStatus | undefined;
  hasPenaltyOrder: boolean;
  isSending: boolean;
  onGenerate: () => void;
  onSend: () => void;
}) {
  const { timezone } = useTimezoneStore();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["export1c", caseId],
    queryFn: () => caseApi.getExports1c(caseId),
    refetchInterval: (query) =>
      query.state.data?.some((e) => e.status === "QUEUED") ? POLL_INTERVAL_MS : false,
  });

  const exports = data ?? [];
  const latest = exports[0];
  const latestStatus = latest?.status;
  const previousStatus = useRef<Export1cStatus | undefined>(undefined);
  useEffect(() => {
    if (previousStatus.current === "QUEUED" && latestStatus && latestStatus !== "QUEUED") {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["caseLogs", caseId] });
    }
    previousStatus.current = latestStatus;
  }, [latestStatus, caseId, queryClient]);

  if (isLoading) return <div className="text-[13px] text-tx2 py-6">Загрузка...</div>;
  if (isError) return <div className="text-[13px] text-dgt py-6">Не удалось загрузить историю отправки в 1С</div>;

  const steps = buildSteps(caseStatus, hasPenaltyOrder, latest);
  const canStart = caseStatus === "РЕШЕНИЕ_ПРИНЯТО" && latestStatus !== "QUEUED" && latestStatus !== "SENT";
  const isRetry = latestStatus === "FAILED";

  return (
    <div className="flex flex-col gap-5 max-w-[720px]">
      {latestStatus === "FAILED" && (
        <div role="alert" className="border border-bd bg-dgbg text-dgt rounded-inp px-3.5 py-2.5 text-[13px] leading-[18px]">
          Не удалось отправить приказ в 1С{latest?.errorMessage ? `: ${latest.errorMessage}` : ""}. Повторите отправку.
        </div>
      )}

      <div className="flex flex-col">
        {steps.map((step, idx) => {
          const dotClass =
            step.state === "done"
              ? "bg-pr border-pr text-white"
              : step.state === "error"
                ? "bg-dgbg border-dg text-dgt"
                : step.state === "current"
                  ? "bg-bg border-pr text-prl"
                  : "bg-bg border-bd text-tx2";
          return (
            <div key={step.title} className="flex items-start gap-4 relative">
              {idx < steps.length - 1 && (
                <div
                  className={`absolute left-4 top-8 w-0.5 ${step.state === "done" ? "bg-pr" : "bg-bd"}`}
                  style={{ height: "calc(100% - 8px)" }}
                />
              )}
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 text-[13px] font-bold z-10 ${dotClass}`}>
                {step.busy ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-label="Выполняется">
                    <path d="M12 3a9 9 0 1 0 9 9" />
                  </svg>
                ) : step.state === "done" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : step.state === "error" ? (
                  "!"
                ) : (
                  idx + 1
                )}
              </div>
              <div className="flex-1 pb-6 pt-0.5 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className={`text-[14px] leading-[20px] font-medium ${
                      step.state === "error" ? "text-dgt" : step.state === "current" ? "text-prl" : step.state === "done" ? "text-tx" : "text-tx2"
                    }`}
                  >
                    {step.title}
                  </div>
                  {step.state === "current" && latestStatus === "QUEUED" && (
                    <span className="text-[12px] text-tx2">выполняется…</span>
                  )}
                </div>
                <div className="text-[12px] leading-[16px] text-tx2 mt-0.5 break-words">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {canStart && (
        <div className="flex items-center gap-3 flex-wrap">
          {hasPenaltyOrder ? (
            <button
              type="button"
              disabled={isSending}
              onClick={onSend}
              className="px-3.5 py-2 rounded-md font-medium text-[13px] leading-[18px] bg-pr text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSending ? "Отправка..." : isRetry ? "Повторить отправку в 1С" : "Отправить в 1С"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerate}
              className="px-3.5 py-2 rounded-md font-medium text-[13px] leading-[18px] bg-pr text-white hover:opacity-90 transition-colors cursor-pointer"
            >
              Сформировать приказ и отправить в 1С
            </button>
          )}
        </div>
      )}

      {exports.length > 0 && (
        <section aria-label="История отправки">
          <h4 className="text-[13px] font-semibold text-tx mb-2">История попыток</h4>
          <ul className="flex flex-col divide-y divide-bd border-y border-bd">
            {exports.map((e, idx) => (
              <li key={e.id} className="flex items-start gap-3 py-2 text-[12px] leading-[16px]">
                <span className="text-tx2 tabular-nums w-5 shrink-0">{exports.length - idx}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-tx">{formatServerDateTime(e.requestedAt, timezone)}</div>
                  {e.errorMessage && <div className="text-dgt mt-0.5 break-words">{e.errorMessage}</div>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${EXPORT_STATUS_CLASS[e.status]}`}>
                  {EXPORT_STATUS_LABEL[e.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
