import type { CaseStatus, Export1cStatus } from "@shared/types/api";
import { formatServerDate, parseServerDateTime } from "@shared/utils/datetime";

export const CASE_STATUS_LABELS: Record<string, string> = {
  НОВОЕ: "Новое",
  ЗАПРОШЕНО_ОБЪЯСНЕНИЕ: "Истребование объяснений",
  ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО: "Объяснение не получено",
  ОБЪЯСНЕНИЕ_ПОЛУЧЕНО: "Объяснение получено",
  КОМИССИОННОЕ_РАССМОТРЕНИЕ: "Рассмотрение комиссией",
  ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ: "Ожидается акт о решении",
  РЕШЕНИЕ_ПРИНЯТО: "Решение вынесено",
  ИСПОЛНЕНО: "Исполнено",
  ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ: "Закрыто без взыскания",
};

export function getCaseStatusLabel(status?: CaseStatus | string | null): string {
  if (!status) return "Неизвестный статус";
  return CASE_STATUS_LABELS[status] || status;
}

export function getCaseStatusBadgeClass(status?: CaseStatus | string | null): string {
  switch (status) {
    case "НОВОЕ":
    case "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ":
      return "bg-wnbg text-wnt";
    case "ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО":
      return "bg-dgbg text-dgt";
    case "ИСПОЛНЕНО":
    case "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ":
      return "bg-okbg text-okt";
    case "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ":
      return "bg-wnbg text-wnt";
    case "РЕШЕНИЕ_ПРИНЯТО":
      return "bg-pr/10 text-prl";
    default:
      return "bg-ntbg text-tx";
  }
}

const CASE_TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "РЕШЕНИЕ_ПРИНЯТО",
  "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ",
  "ИСПОЛНЕНО",
]);

export function isCaseLocked(status?: CaseStatus | string | null): boolean {
  return Boolean(status && CASE_TERMINAL_STATUSES.has(status));
}

const NEXT_ACTION_LABELS: Record<string, string> = {
  НОВОЕ: "Направить требование объяснения",
  ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО: "Оформить акт об отказе от объяснений",
  ОБЪЯСНЕНИЕ_ПОЛУЧЕНО: "Назначить комиссию",
  КОМИССИОННОЕ_РАССМОТРЕНИЕ: "Провести заседание и вынести решение",
  ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ: "Сформировать акт о решении комиссии",
};

export function getNextActionLabel(
  status?: CaseStatus | string | null,
  isOverdue?: boolean,
  export1cStatus?: Export1cStatus | null
): string {
  if (status === "РЕШЕНИЕ_ПРИНЯТО") {
    return export1cStatus === "FAILED" ? "Повторить отправку в 1С" : "Отправить в 1С";
  }
  if (status === "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ") {
    return isOverdue ? "Объяснение не получено в срок — принять меры" : "Ожидание объяснения от сотрудника";
  }
  if (!status) return "—";
  return NEXT_ACTION_LABELS[status] || "—";
}

export interface DeadlineInfo {
  isOverdue: boolean;
  isExpiringSoon: boolean;
  deadlineLabel: string;
  overdueDays: number;
}

const EXPIRING_SOON_DAYS = 7;

export function calculateDeadline(
  isOverdue: boolean,
  nearestOverdue: string | null | undefined,
  timeZone: string,
  overdueSince?: string | null
): DeadlineInfo {
  const nearestOverdueMs = parseServerDateTime(nearestOverdue)?.getTime();
  const overdueSinceMs = parseServerDateTime(overdueSince)?.getTime();

  if (isOverdue && overdueSinceMs !== undefined) {
    const diffMs = Math.max(0, Date.now() - overdueSinceMs);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const label = diffDays >= 1 ? `Просрочено на ${diffDays} дн.` : `Просрочено на ${Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)))} ч.`;
    return { isOverdue: true, isExpiringSoon: false, deadlineLabel: label, overdueDays: diffDays };
  }
  if (isOverdue && nearestOverdueMs !== undefined) {
    const diffDays = Math.max(0, Math.floor((Date.now() - nearestOverdueMs) / (1000 * 60 * 60 * 24)));
    return { isOverdue: true, isExpiringSoon: false, deadlineLabel: `Просрочено на ${diffDays} дн.`, overdueDays: diffDays };
  }
  if (isOverdue) return { isOverdue: true, isExpiringSoon: false, deadlineLabel: "Просрочено", overdueDays: 0 };

  if (nearestOverdueMs !== undefined) {
    const diffDays = Math.ceil((nearestOverdueMs - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= EXPIRING_SOON_DAYS && diffDays >= 0) {
      return { isOverdue: false, isExpiringSoon: true, deadlineLabel: `Осталось ${diffDays} дн.`, overdueDays: 0 };
    }
    return { isOverdue: false, isExpiringSoon: false, deadlineLabel: `до ${formatServerDate(nearestOverdue, timeZone)}`, overdueDays: 0 };
  }
  return { isOverdue: false, isExpiringSoon: false, deadlineLabel: "Срок соблюдён", overdueDays: 0 };
}
