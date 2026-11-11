import { useState } from "react";
import { ImageThumbnail } from "@shared/ui/ImageThumbnail";
import { isImageFile } from "@shared/utils/fileType";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { caseApi } from "@entities/case/api/caseApi";
import { complaintApi } from "@entities/complaint/complaintApi";
import { useAuthStore } from "@entities/session/model/authStore";
import { userApi } from "@entities/user/userApi";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import Avatar from "@shared/ui/Avatar";
import { ErrorState } from "@shared/ui/ErrorState";
import { FilePreviewModal } from "@shared/ui/FilePreviewModal";
import { showAlert } from "@shared/ui/dialogs";
import { formatServerDateTime } from "@shared/utils/datetime";
import { getErrorMessage } from "@shared/utils/errorMessage";
import { getFileTypeStyle, getPreviewKind, type PreviewKind } from "@shared/utils/fileType";
import { COMPLAINT_STATUS_LABELS, getComplaintStatusBadgeClass } from "@shared/utils/complaintStatus";
import type { ComplaintAttachmentResponse } from "@shared/types/api";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function RejectModal({
  onClose,
  onConfirm,
  busy,
}: {
  onClose: () => void;
  onConfirm: (comment: string) => void;
  busy: boolean;
}) {
  const [comment, setComment] = useState("");
  const valid = comment.trim().length >= 3;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-bd">
          <h3 className="text-[18px] font-bold text-tx">Отклонить жалобу</h3>
        </div>
        <div className="p-4 flex flex-col gap-2">
          <label className="text-[13px] font-medium text-tx2" htmlFor="reject-comment">
            Причина отклонения (её увидит автор жалобы)
          </label>
          <textarea
            id="reject-comment"
            autoFocus
            className="w-full border border-bd rounded-inp bg-bg px-3 py-2.5 text-[14px] text-tx outline-none focus:border-pr focus:ring-3 focus:ring-pr/10 min-h-[110px] resize-y"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <div className="p-4 pt-0 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => onConfirm(comment.trim())}
            className="px-4 py-2 rounded-inp font-medium text-[14px] bg-dg text-white hover:bg-dgh transition-colors disabled:opacity-50"
          >
            {busy ? "Отклонение..." : "Отклонить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timezone = useTimezoneStore((s) => s.timezone);
  const myEmployeeUid = useAuthStore((s) => s.context?.employeeUid);
  const canCreateCase = useAuthStore((s) => s.hasPermission("case:create"));

  const [rejectOpen, setRejectOpen] = useState(false);
  const [preview, setPreview] = useState<{ blob: Blob; filename: string; kind: PreviewKind } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const { data: complaint, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["complaint", id],
    queryFn: () => complaintApi.get(id!),
    enabled: Boolean(id),
  });

  const reject = useMutation({
    mutationFn: (comment: string) => complaintApi.decide(id!, { decision: "REJECT", comment }),
    onSuccess: () => {
      setRejectOpen(false);
      queryClient.invalidateQueries({ queryKey: ["complaint", id] });
      queryClient.invalidateQueries({ queryKey: ["complaintsInbox"] });
      queryClient.invalidateQueries({ queryKey: ["complaintSummary"] });
    },
    onError: (err) => showAlert(getErrorMessage(err, "Не удалось отклонить жалобу")),
  });

  async function handleDownload(file: ComplaintAttachmentResponse) {
    try {
      await caseApi.downloadDocumentFile(file.downloadUrl, file.originalFilename);
    } catch (err) {
      console.error("Ошибка скачивания:", err);
      showAlert(getErrorMessage(err, "Не удалось скачать файл"));
    }
  }

  async function handlePreview(file: ComplaintAttachmentResponse) {
    const kind = getPreviewKind(file.originalFilename);
    if (!kind) return;
    setPreviewLoadingId(file.id);
    try {
      const blob = await caseApi.fetchDocumentBlob(file.downloadUrl);
      setPreview({ blob, filename: file.originalFilename, kind });
    } catch (err) {
      console.error("Ошибка загрузки файла для предпросмотра:", err);
      showAlert(getErrorMessage(err, "Не удалось загрузить файл для предпросмотра"));
    } finally {
      setPreviewLoadingId(null);
    }
  }

  const back = (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-1.5 text-[14px] font-medium text-tx2 hover:text-tx transition-colors mb-4"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Назад
    </button>
  );

  if (isError) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        {back}
        <ErrorState error={error} title="Не удалось загрузить жалобу" onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !complaint) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        {back}
        <div className="max-w-[820px] mx-auto bg-bg border border-bd rounded-card h-[300px] animate-pulse" />
      </div>
    );
  }

  const isHrBp = complaint.hrBpUid === myEmployeeUid || complaint.departmentHeadUid === myEmployeeUid;
  const isNew = complaint.status === "НОВАЯ";

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="max-w-[820px] mx-auto">
        {back}
        <div className="bg-bg border border-bd rounded-card">
          <div className="px-5 py-4 border-b border-bd flex flex-wrap items-center gap-3">
            <h1 className="text-[20px] leading-[26px] font-bold text-tx">Жалоба</h1>
            <span className={`px-2 py-0.5 rounded-full text-[12px] font-medium ${getComplaintStatusBadgeClass(complaint.status)}`}>
              {COMPLAINT_STATUS_LABELS[complaint.status]}
            </span>
            {complaint.anonymous && (
              <span className="px-2 py-0.5 rounded-full bg-ntbg text-tx2 text-[12px] font-medium">Анонимно</span>
            )}
            <span className="ml-auto text-[13px] text-tx2">{formatServerDateTime(complaint.createdAt, timezone)}</span>
          </div>

          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-bd">
            {[
              { label: "На сотрудника", uid: complaint.accusedUid as string | undefined, name: complaint.accusedName, position: complaint.accusedPosition, link: true },
              complaint.anonymous && !complaint.complainantUid
                ? { label: "От сотрудника", uid: undefined, name: "Анонимный сотрудник", position: "Автор скрыт", link: false }
                : { label: "От сотрудника", uid: complaint.complainantUid, name: complaint.complainantName, position: complaint.complainantPosition, link: isHrBp },
            ].map((p) => (
              <div key={p.label}>
                <div className="text-[12px] font-semibold text-tx2 uppercase tracking-wider mb-2">{p.label}</div>
                <div className="flex items-center gap-2.5">
                  <Avatar avatarUrl={p.uid ? userApi.employeeAvatarUrl(p.uid) : undefined} name={p.name || "?"} size={36} />
                  <div className="min-w-0">
                    {p.link && p.uid ? (
                      <Link to={`/employees/${p.uid}`} className="block text-[14px] font-medium text-prl hover:text-prt hover:underline truncate">
                        {p.name || "—"}
                      </Link>
                    ) : (
                      <span className="block text-[14px] font-medium text-tx truncate">{p.name || "—"}</span>
                    )}
                    {p.position && <span className="block text-[12px] text-tx2 truncate">{p.position}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-b border-bd">
            <div className="text-[12px] font-semibold text-tx2 uppercase tracking-wider mb-2">Сообщение</div>
            <div className="text-[14px] leading-[22px] text-tx whitespace-pre-wrap break-words">{complaint.message}</div>
          </div>

          <div className="px-5 py-4 border-b border-bd">
            <div className="text-[12px] font-semibold text-tx2 uppercase tracking-wider mb-2">
              Документы{complaint.attachments.length > 0 ? ` (${complaint.attachments.length})` : ""}
            </div>
            {complaint.attachments.length === 0 ? (
              <div className="text-[14px] text-tx2">Документы не приложены</div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {complaint.attachments.map((file) => {
                  const style = getFileTypeStyle(file.originalFilename);
                  const canPreview = Boolean(getPreviewKind(file.originalFilename));
                  return (
                    <li key={file.id} className="flex items-center gap-2.5 px-3 py-2 rounded-inp border border-bd">
                      {isImageFile(file.originalFilename) ? (
                        <ImageThumbnail
                          filename={file.originalFilename}
                          downloadUrl={file.downloadUrl}
                          size={48}
                          onOpen={() => handlePreview(file)}
                        />
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${style.badgeClass}`}>{style.label}</span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[14px] text-tx">{file.originalFilename}</span>
                      <span className="text-[12px] text-tx2 shrink-0">{formatSize(file.sizeBytes)}</span>
                      {canPreview && (
                        <button
                          type="button"
                          disabled={previewLoadingId === file.id}
                          onClick={() => handlePreview(file)}
                          className="text-[13px] font-medium text-prl hover:text-prt transition-colors disabled:opacity-50 shrink-0"
                        >
                          {previewLoadingId === file.id ? "Загрузка..." : "Просмотр"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownload(file)}
                        className="text-[13px] font-medium text-prl hover:text-prt transition-colors shrink-0"
                      >
                        Скачать
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="px-5 py-4">
            {isNew && isHrBp ? (
              <div className="flex flex-col gap-3">
                <div className="text-[12px] font-semibold text-tx2 uppercase tracking-wider">Решение</div>
                <div className="flex flex-wrap gap-2">
                  {canCreateCase ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/cases/new?complaintId=${complaint.id}&employeeUid=${complaint.accusedUid}`)}
                      className="px-4 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors"
                    >
                      Создать дело
                    </button>
                  ) : (
                    <span className="text-[13px] text-tx2 self-center">
                      У вас нет права создавать дела — можно только отклонить жалобу.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setRejectOpen(true)}
                    className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-dgl border border-dg/40 hover:bg-dg/5 transition-colors"
                  >
                    Отклонить жалобу
                  </button>
                </div>
              </div>
            ) : isNew ? (
              <div className="text-[14px] text-tx2">Жалоба ожидает решения HR BP или руководителя подразделения сотрудника.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="text-[12px] font-semibold text-tx2 uppercase tracking-wider">Решение</div>
                {complaint.status === "ДЕЛО_СОЗДАНО" ? (
                  <div className="text-[14px] text-tx">
                    По жалобе создано дело{" "}
                    {complaint.caseId && isHrBp ? (
                      <Link to={`/cases/${complaint.caseId}`} className="font-medium text-prl hover:text-prt hover:underline">
                        {complaint.caseNumber || "открыть"}
                      </Link>
                    ) : (
                      <span className="font-medium">{complaint.caseNumber}</span>
                    )}
                  </div>
                ) : (
                  <div className="text-[14px] text-tx">Жалоба отклонена. Причина: {complaint.decisionComment}</div>
                )}
                {complaint.decidedAt && (
                  <div className="text-[12px] text-tx2">{formatServerDateTime(complaint.decidedAt, timezone)}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {rejectOpen && (
        <RejectModal busy={reject.isPending} onClose={() => setRejectOpen(false)} onConfirm={(c) => reject.mutate(c)} />
      )}
      {preview && (
        <FilePreviewModal blob={preview.blob} filename={preview.filename} kind={preview.kind} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
