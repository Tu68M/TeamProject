
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { ImageThumbnail } from "@shared/ui/ImageThumbnail";
import { isImageFile } from "@shared/utils/fileType";
import { FilePreviewModal } from "@shared/ui/FilePreviewModal";
import { getPreviewKind, type PreviewKind } from "@shared/utils/fileType";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { caseApi } from "@/entities/case/api/caseApi";
import {
  useCaseDetail,
  useCaseDocuments,
  useCaseAssignees,
  useCaseLogs,
  useUploadDocument,
  useExplanationStatus,
} from "@/entities/case/api/useCaseQueries";
import { FileUploader, type FileItem } from "@shared/ui/FileUploader";
import { ParticipantsTab } from "@/entities/commission/ParticipantsTab";
import { CommissionTab } from "@/entities/commission/CommissionTab";
import { useCommissionTabAccess } from "@/entities/commission/useCommissionTabAccess";
import { CaseDocumentsList } from "@/entities/case/CaseDocumentsList";
import { GenerateDocumentModal } from "@entities/document/GenerateDocumentModal";
import { LawyerDecisionModal } from "./LawyerDecisionModal";
import { Export1cTab } from "./Export1cTab";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { formatServerDate, formatServerDateTime, parseServerDateTime } from "@shared/utils/datetime";
import { getCaseStatusBadgeClass, getCaseStatusLabel, isCaseLocked } from "@shared/utils/caseStatus";
import type {
  CaseDocumentResponse,
  CaseAssigneeResponse,
  CaseLogResponse,
  CaseTimerResponse,
  CaseTimerType,
  CaseAssigneeRole,
  CaseStatus,
  FullCaseResponse,
} from "@shared/types/api";
import { useAllCommissionsStore } from "@shared/model/allCommissionsStore";
import { useNavBadgeStore } from "@shared/model/navBadgeStore";
import { getDecisionTypeLabel, isCommissionOpen } from "@shared/utils/commissionStatus";
import { showAlert, showConfirm } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

interface DisplayFileItem extends FileItem {
  isPending: boolean;
}

function pluralFiles(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} файлов`;
  if (mod10 === 1) return `${n} файл`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} файла`;
  return `${n} файлов`;
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / (24 * 3600 * 1000));
  const hours = Math.floor((abs / (3600 * 1000)) % 24);
  const minutes = Math.floor((abs / (60 * 1000)) % 60);
  const seconds = Math.floor((abs / 1000) % 60);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (days >= 1) {
    return `${days} д`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

type StageWindow = { start?: string; end?: string };

function buildStageWindows(detail: FullCaseResponse, logs: CaseLogResponse[]): Map<CaseStatus, StageWindow> {
  const sortedLogs = [...logs]
    .filter((l): l is CaseLogResponse & { newStatus: CaseStatus; updatedAt: string } =>
      Boolean(l.newStatus && l.updatedAt)
    )
    .sort(
      (a, b) =>
        (parseServerDateTime(a.updatedAt)?.getTime() ?? 0) - (parseServerDateTime(b.updatedAt)?.getTime() ?? 0)
    );

  const boundaries: { status: CaseStatus; at: string }[] = [
    { status: "НОВОЕ", at: detail.createdAt || "" },
    ...sortedLogs.map((l) => ({ status: l.newStatus, at: l.updatedAt })),
  ];

  const windows = new Map<CaseStatus, StageWindow>();
  boundaries.forEach((b, idx) => {
    windows.set(b.status, { start: b.at, end: boundaries[idx + 1]?.at });
  });
  return windows;
}

function isWithinWindow(timestamp: string | undefined, window: StageWindow | undefined): boolean {
  if (!timestamp || !window?.start) return false;
  const t = parseServerDateTime(timestamp)?.getTime() ?? 0;
  const start = parseServerDateTime(window.start)?.getTime() ?? 0;
  if (t < start) return false;
  if (window.end) {
    const end = parseServerDateTime(window.end)?.getTime() ?? Infinity;
    if (t >= end) return false;
  }
  return true;
}

function resolveActorName(
  uid: string | null | undefined,
  detail: FullCaseResponse,
  assignees: CaseAssigneeResponse[],
  fallback: string
): string {
  if (!uid) return fallback;
  if (uid === detail.createdBy && detail.createdByName) return detail.createdByName;
  const assignee = assignees.find((a) => a.employeeUid === uid);
  return assignee?.fullName || fallback;
}

type DeadlineBadgeTone = "ok" | "dg" | "mut";

const DEADLINE_BADGE_CLASSES: Record<DeadlineBadgeTone, string> = {
  ok: "bg-okbg text-okt",
  dg: "bg-dgbg text-dgt",
  mut: "bg-surf text-tx2",
};

function DeadlineCard({
  label,
  timer,
  now,
  soonDays,
}: {
  label: string;
  timer?: CaseTimerResponse;
  now: Date;
  soonDays: number;
}) {
  const { timezone } = useTimezoneStore();

  let value: string | null = null;
  let badge: { text: string; tone: DeadlineBadgeTone } | null = null;
  let highlight = "";
  let note = "Срок будет установлен на следующем этапе";

  if (timer?.fireAt) {
    const target = parseServerDateTime(timer.fireAt);
    const diffMs = (target?.getTime() ?? 0) - now.getTime();
    const isExpired = Boolean(timer.firedAt) || diffMs < 0;
    const isExplanationDeadline = timer.timerType === "EXPLANATION_DEADLINE";

    if (isExplanationDeadline && isExpired && timer.actionTaken === "EXPLANATION_SUBMITTED") {
      badge = { text: "Получено в срок", tone: "ok" };
    } else if (isExplanationDeadline && isExpired && Boolean(timer.firedAt)) {
      badge = { text: "Не получено в срок", tone: "dg" };
    } else if (isExpired) {
      badge = { text: "Просрочено", tone: "dg" };
      value = diffMs < 0 ? formatDuration(diffMs) : null;
      highlight = "bg-dgbg/40";
    } else {
      value = formatDuration(diffMs);
      if (diffMs <= soonDays * 24 * 3600 * 1000) highlight = "bg-wnbg/60";
    }
    note = `Дедлайн: ${formatServerDate(timer.fireAt, timezone)}`;
  }

  return (
    <div className={`px-4 py-3 min-w-0 transition-colors ${highlight}`}>
      <div className="text-[12px] leading-[16px] font-medium text-tx2">{label}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[24px]">
        {!timer?.fireAt ? (
          <span className="text-[14px] leading-[20px] text-txm">Не назначен</span>
        ) : (
          <>
            {value && (
              <span className="text-[16px] leading-[24px] font-semibold text-tx tabular-nums">
                {badge ? value : `Осталось ${value}`}
              </span>
            )}
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-[12px] leading-[16px] font-medium ${DEADLINE_BADGE_CLASSES[badge.tone]}`}>
                {badge.text}
              </span>
            )}
          </>
        )}
      </div>
      <div className="mt-0.5 text-[12px] leading-[16px] text-tx2 tabular-nums">{note}</div>
    </div>
  );
}

function wasCaseOverdue(timers: CaseTimerResponse[]): boolean {
  return timers.some(
    (t) =>
      (t.timerType === "DISCIPLINARY_ACTION_FROM_DISCOVERY_DEADLINE" ||
        t.timerType === "DISCIPLINARY_ACTION_FROM_VIOLATION_DEADLINE") &&
      Boolean(t.firedAt)
  );
}

const CASE_STAGE_SEQUENCE: { status: CaseStatus; label: string }[] = [
  { status: "НОВОЕ", label: "Дело создано" },
  { status: "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ", label: "Истребование объяснений" },
  { status: "ОБЪЯСНЕНИЕ_ПОЛУЧЕНО", label: "Объяснение получено" },
  { status: "КОМИССИОННОЕ_РАССМОТРЕНИЕ", label: "Рассмотрение комиссией" },
  { status: "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ", label: "Ожидается акт о решении" },
  { status: "РЕШЕНИЕ_ПРИНЯТО", label: "Решение вынесено" },
  { status: "ИСПОЛНЕНО", label: "Исполнено" },
];

function getStageDate(status: CaseStatus, detail: FullCaseResponse, logs: CaseLogResponse[]): string | null {
  if (status === "НОВОЕ") return detail.createdAt || null;
  return logs.find((l) => l.newStatus === status)?.updatedAt || null;
}

interface StageAction {
  actor: string;
  action: string;
  timestamp: string;
}

function getStageActions(
  status: CaseStatus,
  detail: FullCaseResponse,
  logs: CaseLogResponse[],
  documents: CaseDocumentResponse[],
  assignees: CaseAssigneeResponse[],
  window: StageWindow | undefined,
  finalDecisionLabel?: string | null
): StageAction[] {
  const actions: StageAction[] = [];

  const stageDocuments = documents.filter((d) => isWithinWindow(d.uploadedAt, window));

  const byUploader = new Map<string, { name: string; docs: CaseDocumentResponse[] }>();
  stageDocuments.forEach((doc) => {
    const key = doc.uploadedByUid || "unknown";
    const name = resolveActorName(doc.uploadedByUid, detail, assignees, "Пользователь");
    if (!byUploader.has(key)) byUploader.set(key, { name, docs: [] });
    byUploader.get(key)!.docs.push(doc);
  });
  byUploader.forEach(({ name, docs }) => {
    const sorted = [...docs].sort(
      (a, b) =>
        (parseServerDateTime(a.uploadedAt)?.getTime() ?? 0) - (parseServerDateTime(b.uploadedAt)?.getTime() ?? 0)
    );
    actions.push({
      actor: name,
      action:
        docs.length === 1
          ? `Загрузил документ «${docs[0].originalFilename || "файл"}»`
          : `Загрузил ${docs.length} документ(а)`,
      timestamp: sorted[sorted.length - 1]?.uploadedAt || "",
    });
  });

  switch (status) {
    case "НОВОЕ": {
      if (detail.createdBy) {
        actions.push({
          actor: detail.createdByName || "Система",
          action: "Создал дело",
          timestamp: detail.createdAt || "",
        });
      }
      break;
    }
    case "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ": {
      const requestLog = logs.find((l) => l.newStatus === "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ");
      if (requestLog) {
        actions.push({
          actor: resolveActorName(requestLog.updatedBy, detail, assignees, "Система"),
          action: "Запросил объяснение",
          timestamp: requestLog.updatedAt || "",
        });
      }
      break;
    }
    case "ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО": {
      const notReceivedLog = logs.find((l) => l.newStatus === "ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО");
      if (notReceivedLog) {
        actions.push({
          actor: resolveActorName(notReceivedLog.updatedBy, detail, assignees, "Система"),
          action: "Срок предоставления объяснения истёк",
          timestamp: notReceivedLog.updatedAt || "",
        });
      }
      break;
    }
    case "ОБЪЯСНЕНИЕ_ПОЛУЧЕНО": {
      const receivedLog = logs.find((l) => l.newStatus === "ОБЪЯСНЕНИЕ_ПОЛУЧЕНО");
      if (receivedLog) {
        actions.push({
          actor: resolveActorName(receivedLog.updatedBy, detail, assignees, "Сотрудник"),
          action: "Предоставил объяснение",
          timestamp: receivedLog.updatedAt || "",
        });
      }
      break;
    }
    case "КОМИССИОННОЕ_РАССМОТРЕНИЕ": {
      const commissionLog = logs.find((l) => l.newStatus === "КОМИССИОННОЕ_РАССМОТРЕНИЕ");
      if (commissionLog) {
        actions.push({
          actor: resolveActorName(commissionLog.updatedBy, detail, assignees, "Секретарь комиссии"),
          action: "Назначил комиссию",
          timestamp: commissionLog.updatedAt || "",
        });
      }
      break;
    }
    case "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ": {
      const awaitingLog = logs.find((l) => l.newStatus === "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ");
      if (awaitingLog) {
        actions.push({
          actor: resolveActorName(awaitingLog.updatedBy, detail, assignees, "Комиссия"),
          action: finalDecisionLabel ? `Комиссия вынесла решение: ${finalDecisionLabel}` : "Комиссия вынесла решение",
          timestamp: awaitingLog.updatedAt || "",
        });
      }
      break;
    }
    case "РЕШЕНИЕ_ПРИНЯТО": {
      const decisionLog = logs.find((l) => l.newStatus === "РЕШЕНИЕ_ПРИНЯТО");
      if (decisionLog) {
        actions.push({
          actor: resolveActorName(decisionLog.updatedBy, detail, assignees, "Председатель комиссии"),
          action: "Сформировал акт о решении",
          timestamp: decisionLog.updatedAt || "",
        });
      }
      break;
    }
    case "ИСПОЛНЕНО": {
      const executedLog = logs.find((l) => l.newStatus === "ИСПОЛНЕНО");
      if (executedLog) {
        actions.push({
          actor: resolveActorName(executedLog.updatedBy, detail, assignees, "Система"),
          action: "Отправил приказ о взыскании в 1С",
          timestamp: executedLog.updatedAt || "",
        });
      }
      break;
    }
    case "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ": {
      const closedLog = logs.find((l) => l.newStatus === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ");
      if (closedLog) {
        actions.push({
          actor: resolveActorName(closedLog.updatedBy, detail, assignees, "Система"),
          action: "Закрыл дело без взыскания",
          timestamp: closedLog.updatedAt || "",
        });
      }
      break;
    }
    default:
      break;
  }

  return actions.sort(
    (a, b) =>
      (parseServerDateTime(a.timestamp)?.getTime() ?? 0) - (parseServerDateTime(b.timestamp)?.getTime() ?? 0)
  );
}

function StageStepper({
  detail,
  logs,
  documents,
  assignees,
  isEmployee,
  caseId,
  finalDecisionLabel,
  canRequestExplanation,
  onRequestExplanation,
  isRequestingExplanation,
  canGenerateDecisionAct,
  onGenerateDecisionAct,
  canCloseByExplanation,
  onCloseByExplanation,
  isClosingByExplanation,
}: {
  canCloseByExplanation: boolean;
  onCloseByExplanation: () => void;
  isClosingByExplanation: boolean;
  canGenerateDecisionAct: boolean;
  onGenerateDecisionAct: () => void;
  canRequestExplanation: boolean;
  onRequestExplanation: () => void;
  isRequestingExplanation: boolean;
  detail: FullCaseResponse;
  logs: CaseLogResponse[];
  documents: CaseDocumentResponse[];
  assignees: CaseAssigneeResponse[];
  isEmployee: boolean;
  caseId: string;
  finalDecisionLabel?: string | null;
}) {
  const navigate = useNavigate();
  const { timezone } = useTimezoneStore();
  const isClosedWithoutPenalty = detail.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ";
  const isExplanationNotReceived = detail.status === "ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО";
  const stageWindows = useMemo(() => buildStageWindows(detail, logs), [detail, logs]);

  const steps = isClosedWithoutPenalty
    ? [...CASE_STAGE_SEQUENCE.slice(0, 4), { status: "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ" as CaseStatus, label: "Закрыто без взыскания" }]
    : isExplanationNotReceived
      ? [...CASE_STAGE_SEQUENCE.slice(0, 2), { status: "ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО" as CaseStatus, label: "Объяснение не получено" }]
      : CASE_STAGE_SEQUENCE;

  const matchedIndex = steps.findIndex((s) => s.status === detail.status);
  const currentIndex = matchedIndex === -1 ? steps.length - 1 : matchedIndex;

  const showDetails = !isEmployee;

  return (
    <div className="bg-bg border border-bd rounded-md p-4 w-full">
      <h3 className="text-[16px] leading-[24px] font-medium text-tx mb-5">Ход дела</h3>
      <div className="flex flex-col gap-0">
        {steps.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isLastStep = idx === steps.length - 1;
          const isNeutralBranch = isClosedWithoutPenalty && isLastStep;
          const isDangerBranch = isExplanationNotReceived && isLastStep;
          const date = getStageDate(step.status, detail, logs);

          const actions = showDetails
            ? getStageActions(
                step.status,
                detail,
                logs,
                documents,
                assignees,
                stageWindows.get(step.status),
                finalDecisionLabel
              )
            : [];

          const dotClass = isDangerBranch
            ? "bg-dgbg border-dg text-dgt"
            : isNeutralBranch
              ? "bg-ntbg border-tx2 text-tx2"
              : isDone
                ? "bg-pr border-pr text-white"
                : isCurrent
                  ? "bg-bg border-pr text-prl"
                  : "bg-bg border-bd text-tx2";

          return (
            <div key={step.status} className="flex items-start gap-4 relative">
              {idx < steps.length - 1 && (
                <div
                  className={`absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] ${isDone ? "bg-pr" : "bg-bd"}`}
                  style={{ height: "calc(100% - 8px)" }}
                />
              )}

              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 text-[13px] font-bold z-10 ${dotClass}`}>
                {isDone ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>

              <div className="flex-1 pb-6 pt-0.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className={`text-[14px] leading-[20px] font-medium ${isCurrent ? "text-prl" : isDone ? "text-tx" : "text-tx2"}`}>
                    {step.label}
                  </div>

                  {isCurrent && step.status === "НОВОЕ" && canRequestExplanation && (
                    <button
                      className="px-3 py-1.5 rounded-inp text-[13px] font-medium whitespace-nowrap transition-colors bg-pr text-white hover:bg-prh disabled:opacity-50"
                      onClick={onRequestExplanation}
                      disabled={isRequestingExplanation}
                    >
                      {isRequestingExplanation ? "Подготовка..." : "Сформировать требование об объяснении"}
                    </button>
                  )}

                  {isCurrent && step.status === "ОБЪЯСНЕНИЕ_ПОЛУЧЕНО" && canCloseByExplanation && (
                    <button
                      className="px-3 py-1.5 rounded-inp text-[13px] font-medium whitespace-nowrap transition-colors bg-bg text-dgt border border-bd hover:bg-surf disabled:opacity-50"
                      onClick={onCloseByExplanation}
                      disabled={isClosingByExplanation}
                    >
                      {isClosingByExplanation ? "Закрытие..." : "Закрыть дело"}
                    </button>
                  )}

                  {isCurrent && step.status === "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ" && canGenerateDecisionAct && (
                    <button
                      className="px-3 py-1.5 rounded-inp text-[13px] font-medium whitespace-nowrap transition-colors bg-pr text-white hover:bg-prh"
                      onClick={onGenerateDecisionAct}
                    >
                      Сформировать акт о решении
                    </button>
                  )}

                  {isCurrent && isEmployee && step.status === "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ" && (
                    <button
                      className="px-3 py-1.5 rounded-inp text-[13px] font-medium whitespace-nowrap transition-colors bg-pr text-white hover:bg-prh"
                      onClick={() => navigate(`/cases/${caseId}/explanation`)}
                    >
                      Дать объяснение
                    </button>
                  )}
                </div>

                <div className="text-[12px] leading-[16px] text-tx2 mt-0.5">
                  {date ? formatServerDate(date, timezone) : isCurrent ? "текущий этап" : "—"}
                </div>

                {showDetails && actions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {actions.map((action, actionIdx) => (
                      <div key={actionIdx} className="text-[12px] leading-[16px] text-tx2 flex items-center gap-2 flex-wrap">
                        <span className="text-tx font-medium">{action.actor}</span>
                        <span className="text-txm">·</span>
                        <span>{action.action}</span>
                        {action.timestamp && (
                          <>
                            <span className="text-txm">·</span>
                            <span className="text-txm">{formatServerDate(action.timestamp, timezone)}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExplanationTab({
  caseId,
  canCloseByExplanation,
  onCloseByExplanation,
  isClosingByExplanation,
}: {
  caseId: string;
  canCloseByExplanation: boolean;
  onCloseByExplanation: () => void;
  isClosingByExplanation: boolean;
}) {
  const { timezone } = useTimezoneStore();
  const { data, isLoading, isError } = useExplanationStatus(caseId);
  const [preview, setPreview] = useState<{ blob: Blob; filename: string; kind: PreviewKind } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const handlePreview = async (doc: CaseDocumentResponse) => {
    const kind = getPreviewKind(doc.originalFilename);
    if (!doc.id || !doc.downloadUrl || !doc.originalFilename || !kind) return;
    setPreviewLoadingId(doc.id);
    try {
      const blob = await caseApi.fetchDocumentBlob(doc.downloadUrl);
      setPreview({ blob, filename: doc.originalFilename, kind });
    } catch (err) {
      console.error("Ошибка загрузки документа для предпросмотра:", err);
      showAlert(getErrorMessage(err, "Не удалось загрузить документ для предпросмотра"));
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleDownload = async (doc: CaseDocumentResponse) => {
    if (!doc.downloadUrl || !doc.originalFilename) return;
    try {
      await caseApi.downloadDocumentFile(doc.downloadUrl, doc.originalFilename);
    } catch (err) {
      console.error("Ошибка скачивания документа:", err);
      showAlert(getErrorMessage(err, "Не удалось скачать документ"));
    }
  };

  if (isLoading) {
    return (
      <div className="bg-bg border border-bd rounded-md p-4">
        <div className="text-[14px] text-tx2">Загрузка данных объяснения...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-bg border border-bd rounded-md p-4">
        <div className="text-[14px] text-tx2">Требование о предоставлении объяснения по делу не найдено.</div>
      </div>
    );
  }

  const isSubmitted = Boolean(data.explanationSubmittedAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-bg border border-bd rounded-md p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="text-[16px] font-medium text-tx m-0">Объяснение сотрудника</h3>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium ${
              isSubmitted ? "bg-okbg text-okt" : "bg-ntbg text-tx2"
            }`}
          >
            {isSubmitted ? "Предоставлено" : "Ещё не предоставлено"}
          </span>
          {isSubmitted && canCloseByExplanation && (
            <button
              type="button"
              className="ml-auto px-3 py-1.5 rounded-inp text-[13px] font-medium whitespace-nowrap transition-colors bg-bg text-dgt border border-bd hover:bg-surf disabled:opacity-50 cursor-pointer"
              onClick={onCloseByExplanation}
              disabled={isClosingByExplanation}
            >
              {isClosingByExplanation ? "Закрытие..." : "Закрыть дело"}
            </button>
          )}
        </div>

        {isSubmitted ? (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-tx2 mb-3">
              <span>Подписант: {data.signerFio || "—"}</span>
              <span>Отправлено: {formatServerDateTime(data.explanationSubmittedAt, timezone)}</span>
            </div>
            {data.explanationText ? (
              <div className="text-[14px] leading-[20px] text-tx whitespace-pre-wrap">
                {data.explanationText}
              </div>
            ) : (
              <div className="text-[14px] leading-[20px] text-tx2">
                Текстового сообщения нет — объяснение подано документом.
              </div>
            )}
          </>
        ) : (
          <div className="text-[14px] leading-[20px] text-tx2">
            Срок предоставления: {formatServerDateTime(data.deadlineAt, timezone)}.{" "}
            {data.status === "ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО"
              ? "Сотрудник не предоставил объяснение в установленный срок."
              : "Ожидается объяснение от сотрудника."}
          </div>
        )}
      </div>

      {isSubmitted && (
        <div className="bg-bg border border-bd rounded-md p-4">
          <h3 className="text-[16px] font-medium text-tx mb-3">Приложенные документы</h3>
          {(data.attachedDocuments || []).length === 0 ? (
            <div className="text-[14px] text-tx2">Документы не приложены</div>
          ) : (
            <div className="flex flex-col gap-2">
              {(data.attachedDocuments || []).map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 border border-bd rounded-inp bg-bg">
                  {doc.downloadUrl && isImageFile(doc.originalFilename) && (
                    <ImageThumbnail
                      filename={doc.originalFilename}
                      downloadUrl={doc.downloadUrl}
                      size={56}
                      onOpen={() => handlePreview(doc)}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[14px] leading-[20px] text-tx truncate">
                      {doc.originalFilename || "Без названия"}
                    </div>
                    <div className="text-[12px] leading-[16px] text-tx2">{formatFileSize(doc.fileSizeBytes ?? 0)}</div>
                  </div>
                  {doc.downloadUrl && getPreviewKind(doc.originalFilename) && (
                    <button
                      type="button"
                      onClick={() => handlePreview(doc)}
                      disabled={previewLoadingId === doc.id}
                      className="text-[14px] leading-[20px] font-medium text-prl hover:text-prt transition-colors shrink-0 disabled:opacity-50"
                    >
                      {previewLoadingId === doc.id ? "Загрузка..." : "Просмотр"}
                    </button>
                  )}
                  {doc.downloadUrl && (
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="text-[14px] leading-[20px] font-medium text-prl hover:text-prt transition-colors shrink-0"
                    >
                      Скачать
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {preview && (
        <FilePreviewModal blob={preview.blob} filename={preview.filename} kind={preview.kind} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

const ALL_TABS = [
  { id: "stages", label: "Этапы" },
  { id: "documents", label: "Документы" },
  { id: "explanation", label: "Объяснение" },
  { id: "participants", label: "Участники дела" },
  { id: "commission", label: "Комиссия" },
  { id: "export1c", label: "1С" },
];
const TAB_IDS = new Set(ALL_TABS.map((t) => t.id));

export default function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const now = useNow();
  const { hasPermission, context: user } = useAuthStore();
  const { timezone } = useTimezoneStore();
  const canUploadDocuments = hasPermission("case:document:upload") && hasPermission("case:document:write");
  const canGenerateDocuments = hasPermission("document:generate");
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  const { data: detail, isLoading, isError } = useCaseDetail(caseId ?? "");
  const { data: documents = [] } = useCaseDocuments(caseId ?? "");
  const { data: assignees = [] } = useCaseAssignees(caseId ?? "");
  const { data: logs = [] } = useCaseLogs(caseId ?? "");

  const uploadDocument = useUploadDocument(caseId ?? "");

  const queryClient = useQueryClient();
  const handleCaseChangedByCommission = () => {
    if (!caseId) return;
    queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    queryClient.invalidateQueries({ queryKey: ["caseLogs", caseId] });
  };

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get("tab");
    return requested && TAB_IDS.has(requested) ? requested : "stages";
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const currentUserEmployeeUid = user?.employeeUid;
  const isEmployee = Boolean(currentUserEmployeeUid) && currentUserEmployeeUid === detail?.employeeUid;

  const initiatorEmployeeUid = assignees.find((a) => a.role === "INITIATOR")?.employeeUid;
  const canRequestExplanation =
    canGenerateDocuments &&
    detail?.status === "НОВОЕ" &&
    Boolean(currentUserEmployeeUid) &&
    currentUserEmployeeUid === initiatorEmployeeUid;
  const canCloseNew =
    detail?.status === "НОВОЕ" && Boolean(currentUserEmployeeUid) && currentUserEmployeeUid === initiatorEmployeeUid;
  const canLawyerDecide =
    Boolean(detail?.status) &&
    !isCaseLocked(detail?.status) &&
    Boolean(currentUserEmployeeUid) &&
    assignees.some((a) => a.role === "LAWYER" && a.employeeUid === currentUserEmployeeUid);
  const [lawyerDecisionOpen, setLawyerDecisionOpen] = useState(false);
  const [lawyerDecision, setLawyerDecision] = useState<string | null | undefined>(undefined);
  const [isClosingNew, setIsClosingNew] = useState(false);
  const handleCloseNew = async () => {
    if (!caseId) return;
    const ok = await showConfirm(
      "Дело будет закрыто без решения. Нарушитель о нём не узнает. Это действие нельзя отменить.",
      { title: "Закрыть дело без решения?", confirmLabel: "Закрыть дело", danger: true }
    );
    if (!ok) return;
    setIsClosingNew(true);
    try {
      await caseApi.closeNewCase(caseId);
      handleCaseChangedByCommission();
    } catch (err) {
      console.error("Ошибка закрытия дела:", err);
      showAlert(getErrorMessage(err, "Не удалось закрыть дело"));
    } finally {
      setIsClosingNew(false);
    }
  };
  const canReopen =
    (detail?.status === "РЕШЕНИЕ_ПРИНЯТО" || detail?.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ") &&
    !isEmployee &&
    hasPermission("case:write") &&
    (hasPermission("case:read:department") || hasPermission("case:read:domain") || hasPermission("case:read:all")) &&
    (detail?.timers ?? [])
      .filter(
        (t) =>
          t.timerType === "DISCIPLINARY_ACTION_FROM_DISCOVERY_DEADLINE" ||
          t.timerType === "DISCIPLINARY_ACTION_FROM_VIOLATION_DEADLINE"
      )
      .every((t) => !t.firedAt && (!t.fireAt || (parseServerDateTime(t.fireAt)?.getTime() ?? 0) > now.getTime()));
  const canCloseByExplanation =
    detail?.status === "ОБЪЯСНЕНИЕ_ПОЛУЧЕНО" &&
    Boolean(currentUserEmployeeUid) &&
    assignees.some(
      (a) => (a.role === "INITIATOR" || a.role === "DEPARTMENT_HEAD") && a.employeeUid === currentUserEmployeeUid
    );
  const [isClosingByExplanation, setIsClosingByExplanation] = useState(false);
  const handleCloseByExplanation = async () => {
    if (!caseId) return;
    const ok = await showConfirm(
      "Дело будет закрыто без взыскания по результатам объяснения сотрудника, комиссия проводиться не будет.",
      { title: "Закрыть дело по результатам объяснения?", confirmLabel: "Закрыть дело", danger: true }
    );
    if (!ok) return;
    setIsClosingByExplanation(true);
    try {
      await caseApi.closeByExplanation(caseId);
      handleCaseChangedByCommission();
    } catch (err) {
      console.error("Ошибка закрытия дела по объяснению:", err);
      showAlert(getErrorMessage(err, "Не удалось закрыть дело"));
    } finally {
      setIsClosingByExplanation(false);
    }
  };
  const [isReopening, setIsReopening] = useState(false);
  const handleReopen = async () => {
    if (!caseId) return;
    const ok = await showConfirm(
      "Дело будет возвращено в статус до комиссии, а все участники получат уведомление. Результат комиссии и решение по делу будут сброшены.",
      { title: "Открыть дело повторно?", confirmLabel: "Открыть повторно" }
    );
    if (!ok) return;
    setIsReopening(true);
    try {
      await caseApi.reopenCase(caseId);
      handleCaseChangedByCommission();
    } catch (err) {
      console.error("Ошибка повторного открытия дела:", err);
      showAlert(getErrorMessage(err, "Не удалось открыть дело повторно"));
    } finally {
      setIsReopening(false);
    }
  };
  const [requestModalDeadline, setRequestModalDeadline] = useState<string | null | undefined>(undefined);
  const [isPreparingRequest, setPreparingRequest] = useState(false);
  const handleOpenRequestModal = async () => {
    if (!caseId) return;
    setPreparingRequest(true);
    try {
      const preview = await caseApi.getExplanationRequestPreview(caseId).catch(() => null);
      if (preview?.violatorBlocked) {
        showAlert(
          hasPermission("user:lock")
            ? "Учётная запись сотрудника заблокирована. Сначала разблокируйте её в разделе «Администрирование», затем запросите объяснение."
            : "Учётная запись сотрудника заблокирована. Обратитесь к администратору для разблокировки учётной записи сотрудника."
        );
        return;
      }
      setRequestModalDeadline(preview?.deadlineAt ?? null);
    } finally {
      setPreparingRequest(false);
    }
  };

  const { loading: checkingCommissionAccess, canSee: canSeeCommissionByRole } = useCommissionTabAccess(caseId);
  const canSeeCommissionTab = canSeeCommissionByRole && !isEmployee;
  const allCommissions = useAllCommissionsStore((s) => s.commissions);
  const ensureAllCommissionsLoaded = useAllCommissionsStore((s) => s.ensureLoaded);

  useEffect(() => {
    if (!canSeeCommissionTab) return;
    ensureAllCommissionsLoaded().catch(() => {});
  }, [canSeeCommissionTab, ensureAllCommissionsLoaded]);

  const hasActiveCommission = useMemo(
  () =>
    canSeeCommissionTab &&
    allCommissions.some((c) => c.caseId === caseId && isCommissionOpen(c.status)),
  [canSeeCommissionTab, allCommissions, caseId]
);

  const decidedCommission = useMemo(
    () =>
      allCommissions
        .filter(
          (c) => c.caseId === caseId && (c.status === "ЗАВЕРШЕНО" || c.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ")
        )
        .sort((a, b) => (b.iterationNumber ?? 0) - (a.iterationNumber ?? 0))[0],
    [allCommissions, caseId]
  );
  const canGenerateDecisionAct =
    detail?.status === "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ" &&
    hasPermission("document:generate") &&
    decidedCommission?.status === "ЗАВЕРШЕНО" &&
    Boolean(user?.employeeUid) &&
    Boolean(
      decidedCommission.members?.some((m) => m.employeeUid === user?.employeeUid && m.roles?.includes("ПРЕДСЕДАТЕЛЬ"))
    );
  const [decisionActOpen, setDecisionActOpen] = useState(false);
  const requestNavBadgeRefresh = useNavBadgeStore((s) => s.requestRefresh);

  const hasPenaltyOrder = documents.some((d) => d.documentTypeCode === "PENALTY_ORDER" && !d.isDeleted);
  const manages1c =
    Boolean(currentUserEmployeeUid) &&
    assignees.some(
      (a) => (a.role === "INITIATOR" || a.role === "DEPARTMENT_HEAD") && a.employeeUid === currentUserEmployeeUid
    );
  const canSendTo1c =
    detail?.status === "РЕШЕНИЕ_ПРИНЯТО" &&
    Boolean(detail?.decisionTypeName) &&
    manages1c &&
    detail?.export1cStatus !== "QUEUED" &&
    detail?.export1cStatus !== "SENT";
  const show1cTab =
    manages1c &&
    ((detail?.status === "РЕШЕНИЕ_ПРИНЯТО" && Boolean(detail?.decisionTypeName)) || detail?.status === "ИСПОЛНЕНО");
  const [penaltyOrderOpen, setPenaltyOrderOpen] = useState(false);
  const [isSendingTo1c, setIsSendingTo1c] = useState(false);
  const sendTo1c = async () => {
    if (!caseId) return;
    setIsSendingTo1c(true);
    try {
      await caseApi.sendTo1c(caseId);
      handleCaseChangedByCommission();
      queryClient.invalidateQueries({ queryKey: ["export1c", caseId] });
      setActiveTab("export1c");
      return true;
    } catch (err) {
      console.error("Ошибка отправки дела в 1С:", err);
      showAlert(getErrorMessage(err, "Не удалось отправить дело в 1С"));
      handleCaseChangedByCommission();
      queryClient.invalidateQueries({ queryKey: ["export1c", caseId] });
      return false;
    } finally {
      setIsSendingTo1c(false);
    }
  };
  const handleSendTo1c = async () => {
    if (!hasPenaltyOrder) {
      setPenaltyOrderOpen(true);
      return;
    }
    const ok = await showConfirm(
      "Приказ о взыскании уже сформирован. Он будет отправлен в 1С, а дело получит статус «Исполнено».",
      { title: "Отправить дело в 1С?", confirmLabel: "Отправить в 1С" }
    );
    if (ok) await sendTo1c();
  };

  const closedByLawyer = documents.some((d) => d.documentTypeCode === "LAWYER_CONCLUSION" && !d.isDeleted);
  const commissionDecision = closedByLawyer ? undefined : decidedCommission;
  const closedWithoutPenalty = detail?.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ";
  const closedByExpiry =
    closedWithoutPenalty &&
    !closedByLawyer &&
    commissionDecision?.status !== "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ" &&
    wasCaseOverdue(detail?.timers || []);
  const closedByInitiator =
    closedWithoutPenalty &&
    !closedByLawyer &&
    !closedByExpiry &&
    !commissionDecision &&
    logs.some((l) => l.oldStatus === "НОВОЕ" && l.newStatus === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ");
  const closedByExplanation =
    closedWithoutPenalty &&
    !closedByLawyer &&
    !closedByExpiry &&
    !commissionDecision &&
    logs.some((l) => l.oldStatus === "ОБЪЯСНЕНИЕ_ПОЛУЧЕНО" && l.newStatus === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ");
  const isNoPenaltyDecision = commissionDecision
    ? commissionDecision.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ"
    : closedWithoutPenalty;
  const finalDecisionLabel = useMemo(() => {
    if (commissionDecision) {
      if (commissionDecision.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ") return "Взыскание не применено";
      return getDecisionTypeLabel(commissionDecision.decision?.finalDecisionCode, commissionDecision.decision?.finalDecisionName);
    }
    if (detail?.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ") return "Взыскание не применено";
    return detail?.decisionTypeName || null;
  }, [commissionDecision, detail?.status, detail?.decisionTypeName]);
  const resultCaption = isNoPenaltyDecision
    ? closedByLawyer
      ? "Юрист закрыл дело без заседания комиссии на основании заключения юриста — взыскание не применено."
      : closedByExpiry
        ? "Дело закрыто автоматически: истёк срок привлечения к дисциплинарной ответственности (ст. 193 ТК РФ)."
        : closedByExplanation
          ? "Дело закрыто без взыскания по результатам объяснения сотрудника, комиссия не проводилась."
          : closedByInitiator
          ? "Инициатор закрыл дело без решения."
          : "Комиссия рассмотрела дело и решила не применять взыскание."
    : closedByLawyer
      ? "Взыскание применено юристом без заседания комиссии на основании заключения юриста."
      : canSeeCommissionTab
        ? "Решение вынесено дисциплинарной комиссией — подробности в истории рассмотрений на вкладке «Комиссия»."
        : "Решение вынесено дисциплинарной комиссией и оформлено актом.";
  const showExplanationTab = !isEmployee && detail?.status !== "НОВОЕ";
  const visibleTabs = ALL_TABS.filter((t) => {
    if (t.id === "commission") return canSeeCommissionTab;
    if (t.id === "explanation") return showExplanationTab;
    if (t.id === "participants") return !isEmployee;
    if (t.id === "export1c") return show1cTab;
    return true;
  });

  useEffect(() => {
    if (activeTab === "commission" && !checkingCommissionAccess && !canSeeCommissionTab) {
      setActiveTab("stages");
    }
  }, [activeTab, checkingCommissionAccess, canSeeCommissionTab]);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const btn = tabRefs.current[activeTab];
      const container = tabsContainerRef.current;
      if (!btn || !container) return;
      setIndicator({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeTab, visibleTabs.length, isLoading]);

  const handleFilesAdd = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList);
    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileRemove = (fileName: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleSaveFiles = async () => {
    if (pendingFiles.length === 0 || !caseId) return;

    try {
      for (const file of pendingFiles) {
        await uploadDocument.mutateAsync({ file, isVisibleToEmployee: false });
      }
      setPendingFiles([]);
    } catch (err: any) {
      console.error("Ошибка сохранения файлов:", err);
      showAlert(getErrorMessage(err, "Ошибка при загрузке файлов"));
    }
  };

  const handleDownloadAllDocuments = async () => {
    const downloadable = documents.filter((doc) => doc.downloadUrl && doc.originalFilename);
    if (downloadable.length === 0) {
      showAlert("У этого дела нет документов для выгрузки");
      return;
    }
    const safeNumber = String(detail?.caseNumber || detail?.id || caseId).replace(/[\\/:*?"<>|]+/g, "-");
    const { added, failed } = await caseApi.downloadDocumentsZip(
      downloadable.map((doc) => ({ downloadUrl: doc.downloadUrl!, filename: doc.originalFilename! })),
      `Документы_по_делу_${safeNumber}.zip`
    );
    if (added === 0) {
      showAlert("Не удалось скачать документы дела");
    } else if (failed > 0) {
      showAlert(`Не удалось добавить в архив файлов: ${failed}`);
    }
  };

  const getTimer = (type: CaseTimerType) => detail?.timers?.find((t) => t.timerType === type);
  const getAssignee = (role: CaseAssigneeRole) => assignees.find((a) => a.role === role);

  const pendingDisplayFiles = useMemo<DisplayFileItem[]>(() => {
    return pendingFiles.map((file) => ({
      id: `pending-${file.name}-${file.size}`,
      name: file.name,
      sizeLabel: formatFileSize(file.size),
      isPending: true,
      addedAt: "Сейчас",
    }));
  }, [pendingFiles]);

  const totalFilesCount = documents.length + pendingFiles.length;

  if (isLoading) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <div className="text-center py-10 text-tx">Загрузка данных дела...</div>
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <div className="flex items-start gap-6 mb-5">
          <div>
            <div className="text-[12px] leading-[16px] text-tx2 mb-2">Реестр дел</div>
            <h1 className="text-[28px] leading-[36px] font-bold text-tx">Дело не найдено</h1>
            <div className="text-[14px] leading-[20px] text-tx2 mt-2">
              Дело «{caseId}» отсутствует в системе или было удалено.
            </div>
          </div>
          <div className="ml-auto">
            <button
              className="px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors cursor-pointer"
              onClick={() => navigate("/cases")}
            >
              К реестру дел
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isLocked = isCaseLocked(detail.status);
  const caseStatusTextClass = getCaseStatusBadgeClass(detail.status).split(" ").find((c) => c.startsWith("text-")) ?? "text-tx";
  const showDeadlineSummary = !isEmployee && isLocked;
  const caseOverdue = wasCaseOverdue(detail.timers || []);

  return (
    <div className="flex-1 px-6 py-5 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <header className="flex flex-wrap items-start gap-x-6 gap-y-3 mb-4">
        <div className="flex-1 min-w-[260px]">
          <div className="text-[12px] leading-[16px] text-tx2 mb-1">
            Реестр дел / {detail.caseNumber || detail.id}
          </div>
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <h1 className="text-[32px] leading-[38px] font-bold tracking-tight text-tx">
              {detail.caseNumber || detail.id}
            </h1>
            <span className={`inline-flex items-center gap-1.5 text-[14px] leading-[20px] font-medium ${caseStatusTextClass}`}>
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-current shrink-0" />
              {getCaseStatusLabel(detail.status)}
            </span>
            {isLocked && (
              <span
                className="inline-flex items-center gap-1 text-[13px] leading-[18px] text-tx2"
                title="Дело в итоговом статусе: документы и состав участников изменять нельзя"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Редактирование заблокировано
              </span>
            )}
          </div>
          <div className="mt-2 text-[18px] leading-[24px] font-semibold text-tx">
            {detail.snapshotFullName || "Сотрудник не указан"}
          </div>
          <div className="text-[13px] leading-[18px] text-tx2">
            {detail.snapshotPosition || "Должность не указана"} · {detail.snapshotDepartment || "Подразделение не указано"} · таб. № {detail.snapshotTabNumber || "—"}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {isLocked && (
            <button
              type="button"
              className="px-3.5 py-2 rounded-md font-medium text-[13px] leading-[18px] bg-bg text-tx border border-bd hover:bg-surf transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
              onClick={handleDownloadAllDocuments}
            >
              Выгрузить материалы
            </button>
          )}
          {canLawyerDecide && (
            <button
              type="button"
              className="px-3.5 py-2 rounded-md font-medium text-[13px] leading-[18px] bg-pr text-white hover:bg-prh transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
              onClick={() => setLawyerDecisionOpen(true)}
            >
              Решение юриста
            </button>
          )}
          {canCloseNew && (
            <button
              type="button"
              disabled={isClosingNew}
              className="px-3.5 py-2 rounded-md font-medium text-[13px] leading-[18px] bg-bg text-dgt border border-bd hover:bg-surf transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
              onClick={handleCloseNew}
            >
              {isClosingNew ? "Закрытие..." : "Закрыть без решения"}
            </button>
          )}
          {canSendTo1c && (
            <button
              type="button"
              disabled={isSendingTo1c}
              className="px-3.5 py-2 rounded-md font-medium text-[13px] leading-[18px] bg-pr text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
              onClick={handleSendTo1c}
            >
              {isSendingTo1c ? "Отправка..." : detail?.export1cStatus === "FAILED" ? "Повторить отправку в 1С" : "Отправить в 1С"}
            </button>
          )}
          {canReopen && (
            <button
              type="button"
              disabled={isReopening}
              className="px-3.5 py-2 rounded-md font-medium text-[13px] leading-[18px] bg-bg text-tx border border-bd hover:bg-surf transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
              onClick={handleReopen}
            >
              {isReopening ? "Открытие..." : "Открыть повторно"}
            </button>
          )}
          <button
            type="button"
            className="px-3 py-2 rounded-md text-[13px] leading-[18px] text-tx2 hover:text-tx hover:bg-bg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
            onClick={() => navigate("/cases")}
          >
            ← Назад
          </button>
        </div>
      </header>

      {(finalDecisionLabel || showDeadlineSummary) && (
        <section aria-label="Результат дела" className="mb-4 bg-bg border border-bd rounded-lg overflow-hidden">
          <div
            className={`grid grid-cols-1 divide-y md:divide-y-0 divide-line ${
              finalDecisionLabel && showDeadlineSummary ? "md:grid-cols-2 md:divide-x" : ""
            }`}
          >
            {finalDecisionLabel && (
              <div className="px-4 py-3 min-w-0">
                <div className="text-[12px] leading-[16px] font-medium text-tx2">Решение</div>
                <div className="mt-1 text-[16px] leading-[24px] font-semibold text-tx">
                  {finalDecisionLabel}
                </div>
                <div className="mt-0.5 text-[12px] leading-[16px] text-tx2">
                  {resultCaption}
                </div>
              </div>
            )}
            {showDeadlineSummary && (
              <div className="px-4 py-3 min-w-0">
                <div className="text-[12px] leading-[16px] font-medium text-tx2">Срок обработки</div>
                <div className="mt-1">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[12px] leading-[16px] font-medium ${caseOverdue ? "bg-dgbg text-dgt" : "bg-okbg text-okt"}`}>
                    {caseOverdue ? "Срок привлечения нарушен" : "В установленный срок"}
                  </span>
                </div>
                <div className="mt-1 text-[12px] leading-[16px] text-tx2">
                  {caseOverdue
                    ? "Один из сроков привлечения к дисциплинарной ответственности (ст. 193 ТК РФ) истёк до вынесения решения."
                    : "Решение по делу принято до истечения сроков привлечения к дисциплинарной ответственности."}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {!isEmployee && !isLocked && (
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line bg-bg border border-bd rounded-lg overflow-hidden mb-4">
          <DeadlineCard label="Запрос объяснения" timer={getTimer("EXPLANATION_DEADLINE")} now={now} soonDays={1} />
          <DeadlineCard label="Вынесение решения" timer={getTimer("DISCIPLINARY_ACTION_FROM_DISCOVERY_DEADLINE")} now={now} soonDays={7} />
          <DeadlineCard label="Предельный срок взыскания" timer={getTimer("DISCIPLINARY_ACTION_FROM_VIOLATION_DEADLINE")} now={now} soonDays={7} />
        </div>
      )}

      <div
        ref={tabsContainerRef}
        role="tablist"
        aria-label="Разделы дела"
        className="relative flex border-b border-bd mb-4 overflow-x-auto scrollbar-thin"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[tab.id] = el; }}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`px-3 py-2 text-[14px] leading-[20px] cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pr
              ${activeTab === tab.id
                ? "text-tx font-medium"
                : "text-tx2 font-normal hover:text-tx"}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === "commission" && hasActiveCommission && (
            <span
            aria-label="Есть активная комиссия"
            className="inline-block w-2 h-2 rounded-full bg-pr shrink-0"
            />
            )}
            {tab.id === "documents" && totalFilesCount > 0 && (
              <span className="text-[12px] leading-[16px] font-normal text-tx2 tabular-nums">{totalFilesCount}</span>
            )}
          </button>
        ))}

        {indicator.width > 0 && (
          <span
            aria-hidden="true"
            className="absolute bottom-0 h-0.5 bg-pr transition-all duration-200 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}
      </div>

      <div key={activeTab} className="animate-fadeIn motion-reduce:animate-none">
      
      {activeTab === "documents" && caseId && (
        <section aria-labelledby="case-documents-heading">
          <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-baseline gap-3">
              <h2 id="case-documents-heading" className="text-[18px] leading-[24px] font-semibold text-tx m-0">Документы дела</h2>
              <span className="text-[13px] leading-[18px] text-tx2">{pluralFiles(totalFilesCount)}</span>
            </div>
            {!isLocked && (
              <button
                type="button"
                className="px-3 py-1.5 rounded-md font-medium text-[13px] leading-[18px] bg-bg text-tx border border-bd hover:bg-surf transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                onClick={handleDownloadAllDocuments}
              >
                Выгрузить материалы
              </button>
            )}
          </div>

          <CaseDocumentsList caseId={caseId} documents={documents} showAccess={!isEmployee} />

          {!isLocked && (canUploadDocuments || canGenerateDocuments) && (
            <div className="mt-6 pt-4 border-t border-bd">
              {canUploadDocuments && (
                <>
                  <FileUploader
                    files={pendingDisplayFiles}
                    onFilesAdd={handleFilesAdd}
                    onFileRemove={handleFileRemove}
                    maxSizeMB={25}
                    acceptedFormats=".pdf,.docx,.jpg,.png,.jpeg"
                    label="Прикрепите документы"
                  />

                  {pendingFiles.length > 0 && (
                    <button
                      className="w-full mt-4 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white border border-transparent hover:bg-prh disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      onClick={handleSaveFiles}
                      disabled={uploadDocument.isPending}
                    >
                      {uploadDocument.isPending ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Сохранение...
                        </>
                      ) : (
                        "Сохранить новые документы"
                      )}
                    </button>
                  )}
                </>
              )}

              {canUploadDocuments && canGenerateDocuments && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-bd" />
                  <span className="text-[12px] leading-[16px] text-tx2">или</span>
                  <div className="flex-1 h-px bg-bd" />
                </div>
              )}

              {canGenerateDocuments && (
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-md font-medium text-[13px] leading-[18px] bg-bg text-prl border border-pr hover:bg-pr/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                  onClick={() => setGenerateModalOpen(true)}
                >
                  Сгенерировать документ
                </button>
              )}

              {canUploadDocuments && (
                <div className="mt-3 text-[12px] leading-[16px] text-tx2">
                  Поддерживаемые форматы: PDF, DOCX, JPG, PNG. Максимальный размер: 25 МБ.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {generateModalOpen && !isLocked && caseId && detail && (
        <GenerateDocumentModal
          caseId={caseId}
          caseNumber={detail.caseNumber}
          violationTypeCode={detail.violationTypeCode || ""}
          violationTypeName={detail.violationTypeName}
          violatorFullName={detail.snapshotFullName}
          violatorPosition={detail.snapshotPosition}
          generatorFullName={user?.fullName}
          generatorPosition={user?.position}
          domainName={detail.snapshotDomain}
          departmentName={detail.snapshotDepartment}
          employeeUid={detail.employeeUid}
          incidentDateIso={detail.incidentDate}
          discoveryDateIso={detail.discoveryDate}
          explanationDeadlineIso={detail.timers?.find((t) => t.timerType === "EXPLANATION_DEADLINE")?.fireAt}
          timezone={timezone}
          onClose={() => setGenerateModalOpen(false)}
        />
      )}

      {requestModalDeadline !== undefined && caseId && detail && (
        <GenerateDocumentModal
          caseId={caseId}
          caseNumber={detail.caseNumber}
          violationTypeCode={detail.violationTypeCode || ""}
          violationTypeName={detail.violationTypeName}
          violatorFullName={detail.snapshotFullName}
          violatorPosition={detail.snapshotPosition}
          generatorFullName={user?.fullName}
          generatorPosition={user?.position}
          domainName={detail.snapshotDomain}
          departmentName={detail.snapshotDepartment}
          employeeUid={detail.employeeUid}
          incidentDateIso={detail.incidentDate}
          discoveryDateIso={detail.discoveryDate}
          explanationDeadlineIso={requestModalDeadline}
          timezone={timezone}
          purposeCode="EXPLANATION_REQUEST"
          title="Формирование требования о предоставлении объяснения"
          onClose={() => setRequestModalDeadline(undefined)}
        />
      )}

      {lawyerDecisionOpen && lawyerDecision === undefined && (
        <LawyerDecisionModal
          caseNumber={detail?.caseNumber}
          onContinue={setLawyerDecision}
          onClose={() => setLawyerDecisionOpen(false)}
        />
      )}

      {lawyerDecisionOpen && lawyerDecision !== undefined && caseId && detail && (
        <GenerateDocumentModal
          caseId={caseId}
          caseNumber={detail.caseNumber}
          violationTypeCode={detail.violationTypeCode || ""}
          violationTypeName={detail.violationTypeName}
          violatorFullName={detail.snapshotFullName}
          violatorPosition={detail.snapshotPosition}
          generatorFullName={user?.fullName}
          generatorPosition={user?.position}
          domainName={detail.snapshotDomain}
          departmentName={detail.snapshotDepartment}
          employeeUid={detail.employeeUid}
          incidentDateIso={detail.incidentDate}
          discoveryDateIso={detail.discoveryDate}
          timezone={timezone}
          lawyerConclusionMode
          lawyerDecisionTypeCode={lawyerDecision ?? undefined}
          title="Заключение юриста"
          onGenerated={() => {
            handleCaseChangedByCommission();
            useAllCommissionsStore.getState().refresh().catch(() => {});
            requestNavBadgeRefresh();
          }}
          onClose={() => {
            setLawyerDecisionOpen(false);
            setLawyerDecision(undefined);
          }}
        />
      )}

      {penaltyOrderOpen && caseId && detail && (
        <GenerateDocumentModal
          caseId={caseId}
          caseNumber={detail.caseNumber}
          violationTypeCode={detail.violationTypeCode || ""}
          violationTypeName={detail.violationTypeName}
          violatorFullName={detail.snapshotFullName}
          violatorPosition={detail.snapshotPosition}
          generatorFullName={user?.fullName}
          generatorPosition={user?.position}
          domainName={detail.snapshotDomain}
          departmentName={detail.snapshotDepartment}
          employeeUid={detail.employeeUid}
          incidentDateIso={detail.incidentDate}
          discoveryDateIso={detail.discoveryDate}
          protocolNumber={decidedCommission?.decision?.protocolNumber}
          commission={decidedCommission}
          timezone={timezone}
          purposeCode="PENALTY_ORDER"
          title="Приказ о взыскании"
          onGenerated={() => {
            void sendTo1c();
          }}
          onClose={() => setPenaltyOrderOpen(false)}
        />
      )}

      {decisionActOpen && caseId && detail && (
        <GenerateDocumentModal
          caseId={caseId}
          caseNumber={detail.caseNumber}
          violationTypeCode={detail.violationTypeCode || ""}
          violationTypeName={detail.violationTypeName}
          violatorFullName={detail.snapshotFullName}
          violatorPosition={detail.snapshotPosition}
          generatorFullName={user?.fullName}
          generatorPosition={user?.position}
          domainName={detail.snapshotDomain}
          departmentName={detail.snapshotDepartment}
          employeeUid={detail.employeeUid}
          incidentDateIso={detail.incidentDate}
          discoveryDateIso={detail.discoveryDate}
          protocolNumber={decidedCommission?.decision?.protocolNumber}
          commission={decidedCommission}
          timezone={timezone}
          decisionActMode
          title="Формирование акта о решении комиссии"
          onGenerated={() => {
            handleCaseChangedByCommission();
            useAllCommissionsStore.getState().refresh().catch(() => {});
            requestNavBadgeRefresh();
          }}
          onClose={() => setDecisionActOpen(false)}
        />
      )}

      {activeTab === "explanation" && caseId && showExplanationTab && (
        <ExplanationTab
          caseId={caseId}
          canCloseByExplanation={canCloseByExplanation}
          onCloseByExplanation={handleCloseByExplanation}
          isClosingByExplanation={isClosingByExplanation}
        />
      )}

      {activeTab === "stages" && (
        <div className="flex flex-col md:flex-row gap-5 w-full items-start">
          <div className="w-full md:w-2/3">
            <StageStepper
              detail={detail}
              logs={logs}
              documents={documents}
              assignees={assignees}
              isEmployee={isEmployee}
              caseId={caseId ?? ""}
              finalDecisionLabel={finalDecisionLabel}
              canRequestExplanation={canRequestExplanation}
              onRequestExplanation={handleOpenRequestModal}
              isRequestingExplanation={isPreparingRequest}
              canGenerateDecisionAct={canGenerateDecisionAct}
              onGenerateDecisionAct={() => setDecisionActOpen(true)}
              canCloseByExplanation={canCloseByExplanation}
              onCloseByExplanation={handleCloseByExplanation}
              isClosingByExplanation={isClosingByExplanation}
            />
          </div>

          <div className="w-full md:w-1/3 bg-bg border border-bd rounded-md p-4">
            <h3 className="text-[16px] leading-[24px] font-medium text-tx mb-3">Сведения о деле</h3>

            <div className="flex py-2.5 border-b border-line gap-4">
              <span className="w-[140px] shrink-0 text-[12px] leading-[16px] text-tx2 pt-0.5">Вид нарушения</span>
              <div className="text-[14px] leading-[20px] text-tx">{detail.violationTypeName || "—"}</div>
            </div>
            <div className="flex py-2.5 border-b border-line gap-4">
              <span className="w-[140px] shrink-0 text-[12px] leading-[16px] text-tx2 pt-0.5">Дата и время совершения</span>
              <div className="text-[14px] leading-[20px] text-tx">{formatServerDateTime(detail.incidentDate, timezone)}</div>
            </div>
            <div className="flex py-2.5 border-b border-line gap-4">
              <span className="w-[140px] shrink-0 text-[12px] leading-[16px] text-tx2 pt-0.5">Дата и время обнаружения</span>
              <div className="text-[14px] leading-[20px] text-tx">{formatServerDateTime(detail.discoveryDate, timezone)}</div>
            </div>
            {!isEmployee && (
              <div className="flex py-2.5 gap-4">
                <span className="w-[140px] shrink-0 text-[12px] leading-[16px] text-tx2 pt-0.5">Инициатор</span>
                <div className="text-[14px] leading-[20px] text-tx">{getAssignee("INITIATOR")?.fullName || "Не назначен"}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "export1c" && show1cTab && caseId && (
        <Export1cTab
          caseId={caseId}
          caseStatus={detail.status}
          hasPenaltyOrder={hasPenaltyOrder}
          isSending={isSendingTo1c}
          onGenerate={() => setPenaltyOrderOpen(true)}
          onSend={() => void sendTo1c()}
        />
      )}

      {activeTab === "participants" && caseId && (
        <ParticipantsTab
          caseId={caseId}
          assignees={assignees}
          documents={documents}
          onRefetch={() => queryClient.invalidateQueries({ queryKey: ["caseAssignees", caseId] })}
        />
      )}

      {activeTab === "commission" && canSeeCommissionTab && caseId && (
        <CommissionTab
          caseId={caseId}
          caseContext={{
            caseNumber: detail.caseNumber,
            violationTypeName: detail.violationTypeName,
            violatorFullName: detail.snapshotFullName,
            violatorPosition: detail.snapshotPosition,
            domainName: detail.snapshotDomain,
            departmentName: detail.snapshotDepartment,
            employeeUid: detail.employeeUid,
            incidentDateIso: detail.incidentDate,
            discoveryDateIso: detail.discoveryDate,
          }}
          caseStatus={detail.status}
          violationTypeCode={detail.violationTypeCode}
          assignees={assignees}
          onCaseChanged={handleCaseChangedByCommission}
        />
      )}
      </div>
    </div>
  );
}