export interface FileTypeStyle {
  label: string;
  badgeClass: string;
}

const FILE_TYPE_STYLES: Record<string, FileTypeStyle> = {
  pdf: { label: "PDF", badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" },

  doc: { label: "DOC", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },
  docx: { label: "DOCX", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },

  xls: { label: "XLS", badgeClass: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },
  xlsx: { label: "XLSX", badgeClass: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },
  csv: { label: "CSV", badgeClass: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },

  ppt: { label: "PPT", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" },
  pptx: { label: "PPTX", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" },

  jpg: { label: "JPG", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" },
  jpeg: { label: "JPEG", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" },
  png: { label: "PNG", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" },
  gif: { label: "GIF", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" },
  heic: { label: "HEIC", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" },

  zip: { label: "ZIP", badgeClass: "bg-skel text-tx3" },
  rar: { label: "RAR", badgeClass: "bg-skel text-tx3" },
  "7z": { label: "7Z", badgeClass: "bg-skel text-tx3" },
  txt: { label: "TXT", badgeClass: "bg-skel text-tx3" },
};

const DEFAULT_BADGE_CLASS = "bg-ntbg text-tx2";

export function getFileExtension(filename?: string | null): string {
  if (!filename) return "";
  const idx = filename.lastIndexOf(".");
  return idx >= 0 && idx < filename.length - 1 ? filename.slice(idx + 1).toLowerCase() : "";
}

export function getFileTypeStyle(filename?: string | null): FileTypeStyle {
  const ext = getFileExtension(filename);
  if (ext && FILE_TYPE_STYLES[ext]) return FILE_TYPE_STYLES[ext];
  return { label: ext ? ext.toUpperCase().slice(0, 4) : "FILE", badgeClass: DEFAULT_BADGE_CLASS };
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export type PreviewKind = "docx" | "image" | "pdf";

export function getPreviewKind(filename?: string | null): PreviewKind | null {
  const ext = getFileExtension(filename);
  if (ext === "docx") return "docx";
  if (ext === "pdf") return "pdf";
  if (ext in IMAGE_MIME_BY_EXT) return "image";
  return null;
}

export function getImageMimeType(filename?: string | null): string {
  return IMAGE_MIME_BY_EXT[getFileExtension(filename)] || "application/octet-stream";
}

export function isImageFile(filename?: string | null): boolean {
  return getPreviewKind(filename) === "image";
}
