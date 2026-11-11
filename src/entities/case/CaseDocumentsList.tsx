import { useState } from "react";
import { ImageThumbnail } from "@shared/ui/ImageThumbnail";
import { isImageFile } from "@shared/utils/fileType";
import { caseApi } from "@/entities/case/api/caseApi";
import {
  useDocumentVisibilityLogs,
  useUpdateDocumentVisibility,
  useDeleteDocument,
  useRestoreDocument,
} from "@/entities/case/api/useCaseQueries";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { getFileTypeStyle, getPreviewKind, type PreviewKind } from "@shared/utils/fileType";
import { FilePreviewModal } from "@shared/ui/FilePreviewModal";
import { formatServerDate, formatServerDateTime } from "@shared/utils/datetime";
import { formatShortName } from "@entities/document/autoFillValues";
import { ActionsMenu, ActionsMenuItem } from "@shared/ui/ActionsMenu";
import type { CaseDocumentResponse } from "@shared/types/api";
import { showAlert, showConfirm } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function VisibilityDot({ visible }: { visible: boolean }) {
  return <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${visible ? "bg-ok" : "bg-txm"}`} />;
}

const ROW_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_72px_96px_200px_132px] md:items-center md:gap-x-4";
const ROW_GRID_NO_ACCESS = "md:grid md:grid-cols-[minmax(0,1fr)_72px_96px_132px] md:items-center md:gap-x-4";

function VisibilityToggle({
  document,
  caseId,
}: {
  document: CaseDocumentResponse;
  caseId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [reason, setReason] = useState("");

  const updateVisibility = useUpdateDocumentVisibility(caseId);

  const isVisible = Boolean(document.isVisibleToEmployee);
  const isSaving = updateVisibility.isPending;

  const handleConfirm = async () => {
    if (!document.id) return;
    try {
      await updateVisibility.mutateAsync({
        documentId: document.id,
        data: {
          isVisibleToEmployee: !isVisible,
          reason: reason.trim() || undefined,
        },
      });

      setIsEditing(false);
      setReason("");
    } catch (err: any) {
      console.error("Ошибка изменения видимости документа:", err);
      showAlert(getErrorMessage(err, "Не удалось изменить видимость документа"));
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="border border-bd rounded-inp px-2 py-1 text-[12px] outline-none focus:border-pr focus:ring-2 focus:ring-pr/10 w-[160px]"
          placeholder="Причина (необязательно)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <button
          type="button"
          className="text-[12px] font-medium text-prl hover:text-prt disabled:opacity-50"
          disabled={isSaving}
          onClick={handleConfirm}
        >
          {isSaving ? "..." : "Подтвердить"}
        </button>
        <button type="button" className="text-[12px] text-tx2 hover:text-tx" onClick={() => setIsEditing(false)}>
          Отмена
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] whitespace-nowrap rounded-sm text-tx hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
      onClick={() => setIsEditing(true)}
      title={isVisible ? "Скрыть от сотрудника" : "Открыть сотруднику"}
    >
      <VisibilityDot visible={isVisible} />
      {isVisible ? "Видим сотруднику" : "Скрыт от сотрудника"}
    </button>
  );
}

function VisibilityHistoryPanel({ caseId, documentId }: { caseId: string; documentId: string }) {
  const { timezone } = useTimezoneStore();
  const { data, isLoading, isError } = useDocumentVisibilityLogs(caseId, documentId);
  const logs = data?.content || [];

  const visibilityLabel = (visible?: boolean) => (visible ? "Видим сотруднику" : "Скрыт от сотрудника");

  return (
    <div className="px-3 py-2.5 border-t border-line bg-surf">
      {isLoading ? (
        <div className="text-[12px] text-tx2">Загрузка истории...</div>
      ) : isError ? (
        <div className="text-[12px] text-dgt">Не удалось загрузить историю изменений видимости</div>
      ) : logs.length === 0 ? (
        <div className="text-[12px] text-tx2">Видимость документа ещё не менялась</div>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log, i) => (
            <div key={i} className="text-[12px] leading-[16px] border-l border-bd pl-2.5">
              <div className="text-tx font-medium">
                {visibilityLabel(log.previousVisibility)} → {visibilityLabel(log.newVisibility)}
              </div>
              <div className="text-tx2">{formatServerDateTime(log.changedAt, timezone)}</div>
              {log.reason && <div className="text-tx2">Причина: {log.reason}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CaseDocumentsListProps {
  caseId: string;
  documents: CaseDocumentResponse[];
  showAccess?: boolean;
  compact?: boolean;
}

export function CaseDocumentsList({ caseId, documents, showAccess = true, compact = false }: CaseDocumentsListProps) {
  const rowGrid = compact ? "" : showAccess ? ROW_GRID : ROW_GRID_NO_ACCESS;
  const colsOnly = compact ? "hidden" : "hidden md:block";
  const metaUnderName = compact ? "" : "md:hidden";
  const { hasPermission } = useAuthStore();
  const { timezone } = useTimezoneStore();
  const formatDate = (iso?: string) => formatServerDate(iso, timezone);
  const canChangeVisibility =
    hasPermission("case:document:change_visibility") && hasPermission("case:document:write");
  const canDelete = hasPermission("case:document:delete") && hasPermission("case:document:write");
  const canRestore = hasPermission("case:document:restore") && hasPermission("case:document:write");

  const deleteDocument = useDeleteDocument(caseId);
  const restoreDocument = useRestoreDocument(caseId);

  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

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

  const handleDelete = async (doc: CaseDocumentResponse) => {
    if (!doc.id) return;
    if (!(await showConfirm(`Удалить документ «${doc.originalFilename}»? Документ можно будет восстановить.`, { title: "Удаление документа", confirmLabel: "Удалить", danger: true }))) return;
    try {
      await deleteDocument.mutateAsync(doc.id);
    } catch (err: any) {
      console.error("Ошибка удаления документа:", err);
      showAlert(getErrorMessage(err, "Не удалось удалить документ"));
    }
  };

  const handleRestore = async (doc: CaseDocumentResponse) => {
    if (!doc.id) return;
    try {
      await restoreDocument.mutateAsync(doc.id);
    } catch (err: any) {
      console.error("Ошибка восстановления документа:", err);
      showAlert(getErrorMessage(err, "Не удалось восстановить документ"));
    }
  };

  if (documents.length === 0) {
    return (
      <div className="border border-bd rounded-md bg-bg px-4 py-6 text-[14px] leading-[20px] text-tx2">
        Документы отсутствуют
      </div>
    );
  }

  return (
    <div className="border border-bd rounded-md bg-bg overflow-hidden" role="table" aria-label="Документы дела">
      <div role="row" className={`hidden ${compact ? "" : rowGrid} px-3 py-2 bg-surf border-b border-bd text-[12px] leading-[16px] font-medium text-tx2`}>
        <div role="columnheader">Файл</div>
        <div role="columnheader">Размер</div>
        <div role="columnheader">Добавлен</div>
        {showAccess && <div role="columnheader">Доступ</div>}
        <div role="columnheader" className="text-right">
          Действия
        </div>
      </div>

      {documents.map((doc) => {
        const style = getFileTypeStyle(doc.originalFilename);
        const isDeleted = Boolean(doc.isDeleted);
        const showPassiveStatus = !canChangeVisibility;
        const isHistoryOpen = Boolean(doc.id) && historyOpenId === doc.id;
        const hasActions = Boolean(doc.downloadUrl || (isDeleted ? canRestore : canDelete));

        return (
          <div key={doc.id} className="border-b border-line last:border-b-0">
            <div
              role="row"
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors hover:bg-surf ${rowGrid} ${isDeleted ? "bg-dgbg/10" : ""}`}
            >
              <div role="cell" className={`flex items-center gap-3 min-w-[160px] ${compact ? "flex-1" : "flex-1 md:flex-none md:min-w-0"}`}>
                {doc.downloadUrl && isImageFile(doc.originalFilename) && !isDeleted ? (
                  <ImageThumbnail
                    filename={doc.originalFilename}
                    downloadUrl={doc.downloadUrl}
                    size={44}
                    onOpen={() => handlePreview(doc)}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className={`w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${style.badgeClass} ${isDeleted ? "opacity-50" : ""}`}
                  >
                    {style.label}
                  </div>
                )}
                <div className="min-w-0">
                  <div
                    className={`text-[14px] leading-[20px] font-medium truncate ${isDeleted ? "text-tx2 line-through" : "text-tx"}`}
                    title={doc.originalFilename}
                  >
                    {doc.originalFilename || "Без названия"}
                  </div>
                  <div className={`${metaUnderName} text-[12px] leading-[16px] text-tx2`}>
                    {style.label} · {formatFileSize(doc.fileSizeBytes)} · добавлен {formatDate(doc.uploadedAt)}
                  </div>
                  {isDeleted && (
                    <div className="text-[12px] leading-[16px] text-dgt">
                      Удалён {formatServerDateTime(doc.deletedAt ?? undefined, timezone)}
                      {doc.deletedByName && ` · ${formatShortName(doc.deletedByName)}`}
                    </div>
                  )}
                </div>
              </div>

              <div role="cell" className={`${colsOnly} text-[13px] leading-[18px] text-tx2 tabular-nums`}>
                {formatFileSize(doc.fileSizeBytes)}
              </div>
              <div role="cell" className={`${colsOnly} text-[13px] leading-[18px] text-tx2 tabular-nums`}>
                {formatDate(doc.uploadedAt)}
              </div>

              {showAccess && (
                <div role="cell" className="min-w-0">
                  {isDeleted ? (
                    <span className="text-[13px] leading-[18px] text-dgt">Удалён</span>
                  ) : showPassiveStatus ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] text-tx2 whitespace-nowrap">
                      <VisibilityDot visible={Boolean(doc.isVisibleToEmployee)} />
                      {doc.isVisibleToEmployee ? "Видим сотруднику" : "Скрыт от сотрудника"}
                    </span>
                  ) : (
                    <VisibilityToggle document={doc} caseId={caseId} />
                  )}
                </div>
              )}

              <div role="cell" className={`flex items-center justify-end gap-2 ml-auto ${compact ? "" : "md:ml-0"}`}>
                {canChangeVisibility && doc.id && (
                  <button
                    type="button"
                    onClick={() => setHistoryOpenId(isHistoryOpen ? null : doc.id!)}
                    aria-expanded={isHistoryOpen}
                    className="text-[13px] leading-[18px] text-tx2 hover:text-tx hover:underline underline-offset-2 whitespace-nowrap rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                  >
                    {isHistoryOpen ? "Скрыть историю" : "История"}
                  </button>
                )}
                {hasActions && (
                  <ActionsMenu ariaLabel="Действия с документом">
                    {doc.downloadUrl && getPreviewKind(doc.originalFilename) && (
                      <ActionsMenuItem onClick={() => handlePreview(doc)} disabled={previewLoadingId === doc.id}>
                        {previewLoadingId === doc.id ? "Загрузка..." : "Предпросмотр"}
                      </ActionsMenuItem>
                    )}
                    {doc.downloadUrl && <ActionsMenuItem onClick={() => handleDownload(doc)}>Скачать</ActionsMenuItem>}
                    {!isDeleted && canDelete && (
                      <>
                        <div className="h-px bg-bd my-1" />
                        <ActionsMenuItem onClick={() => handleDelete(doc)} danger disabled={deleteDocument.isPending}>
                          Удалить
                        </ActionsMenuItem>
                      </>
                    )}
                    {isDeleted && canRestore && (
                      <>
                        <div className="h-px bg-bd my-1" />
                        <ActionsMenuItem onClick={() => handleRestore(doc)} disabled={restoreDocument.isPending}>
                          Восстановить
                        </ActionsMenuItem>
                      </>
                    )}
                  </ActionsMenu>
                )}
              </div>
            </div>
            {isHistoryOpen && doc.id && <VisibilityHistoryPanel caseId={caseId} documentId={doc.id} />}
          </div>
        );
      })}
      {preview && (
        <FilePreviewModal blob={preview.blob} filename={preview.filename} kind={preview.kind} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
