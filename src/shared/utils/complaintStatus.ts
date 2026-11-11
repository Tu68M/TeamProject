import type { ComplaintStatus } from "@shared/types/api";

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  НОВАЯ: "Новая",
  ДЕЛО_СОЗДАНО: "Создано дело",
  ОТКЛОНЕНА: "Отклонена",
};

export function getComplaintStatusBadgeClass(status: ComplaintStatus): string {
  switch (status) {
    case "НОВАЯ":
      return "bg-wnbg text-wnt";
    case "ДЕЛО_СОЗДАНО":
      return "bg-okbg text-okt";
    default:
      return "bg-ntbg text-tx2";
  }
}

export const COMPLAINT_ALLOWED_EXTENSIONS = ["pdf", "docx", "jpg", "jpeg", "png", "webp"];
export const COMPLAINT_MAX_FILES = 5;
export const COMPLAINT_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const COMPLAINT_MIN_MESSAGE = 10;
export const COMPLAINT_MAX_MESSAGE = 5000;
