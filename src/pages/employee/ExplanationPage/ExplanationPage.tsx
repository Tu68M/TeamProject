import { useEffect, useState } from "react";
import { ImageThumbnail } from "@shared/ui/ImageThumbnail";
import { isImageFile } from "@shared/utils/fileType";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { caseApi } from "@entities/case/api/caseApi";
import { useCaseDocuments, useExplanationStatus } from "@entities/case/api/useCaseQueries";
import { CaseDocumentsList } from "@entities/case/CaseDocumentsList";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { useNavBadgeStore } from "@shared/model/navBadgeStore";
import { formatServerDate, formatServerDateTime, parseServerDateTime } from "@shared/utils/datetime";
import { GenerateDocumentModal } from "@entities/document/GenerateDocumentModal";
import { FilePreviewModal } from "@shared/ui/FilePreviewModal";
import { getPreviewKind, type PreviewKind } from "@shared/utils/fileType";
import type { CaseDocumentResponse } from "@shared/types/api";
import { showAlert } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

const GENERATED_EXPLANATION_TYPE = "EXPLANATION_GENERATED";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHMS(ms: number): string {
  const abs = Math.max(0, ms);
  const totalSeconds = Math.floor(abs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function useCountdown(deadlineAt: string | undefined): number | null {
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    const target = deadlineAt ? parseServerDateTime(deadlineAt)?.getTime() : undefined;
    if (target === undefined) {
      setMsLeft(null);
      return;
    }
    setMsLeft(target - Date.now());
    const id = setInterval(() => {
      setMsLeft(target - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [deadlineAt]);

  return msLeft;
}

export default function ExplanationPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { timezone } = useTimezoneStore();
  const requestNavBadgeRefresh = useNavBadgeStore((s) => s.requestRefresh);
  const canUploadDocuments = useAuthStore((s) => s.hasPermission("case:document:write") && s.hasPermission("case:document:upload"));

  const canReadDocuments = useAuthStore((s) => s.hasPermission("case:document:read"));
  const { data: caseDocuments = [] } = useCaseDocuments(caseId ?? "", canReadDocuments);

  const queryClient = useQueryClient();
  const { data: request, isLoading: loading, error: queryError } = useExplanationStatus(
    caseId ?? "",
    Boolean(caseId)
  );

  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [signedAtRaw, setSignedAtRaw] = useState<string | null>(null);
  const [submittedDocuments, setSubmittedDocuments] = useState<CaseDocumentResponse[]>([]);
  const [isDraggingOver, setDraggingOver] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [preview, setPreview] = useState<{ blob: Blob; filename: string; kind: PreviewKind } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const userContext = useAuthStore((s) => s.context);

  useEffect(() => {
    if (request?.status === "ОБЪЯСНЕНИЕ_ПОЛУЧЕНО") {
      setText(request.explanationText || "");
      setSignedAtRaw(request.explanationSubmittedAt || null);
      setSubmittedDocuments(request.attachedDocuments || []);
    }
  }, [request]);

  const errorReason = (() => {
    if (!queryError) return null;
    const status = (queryError as any)?.response?.status;
    if (status === 403) {
      return "У вас нет прав на подачу объяснения по этому делу (возможно, вы не указаны как нарушитель).";
    }
    if (status === 404) return "Требование о предоставлении объяснения по этому делу не найдено.";
    console.error("Ошибка загрузки требования:", queryError);
    return "Произошла ошибка при загрузке данных.";
  })();

  const signedAt = signedAtRaw ? formatServerDateTime(signedAtRaw, timezone) : null;

  const msLeft = useCountdown(request?.deadlineAt);
  const hasDeadline = Boolean(request?.deadlineAt);
  const isTimerReady = msLeft !== null;
  const isExpired = (hasDeadline && isTimerReady && msLeft <= 0) || request?.status === "ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО";

  const timerVariant = !hasDeadline
    ? "bg-ntbg text-tx border-bd"
    : isExpired
      ? "bg-dgbg text-dgt border-dg/20"
      : !isTimerReady
        ? "bg-ntbg text-tx border-bd"
        : msLeft < 24 * 3600 * 1000
          ? "bg-wnbg text-wnt border-wn/20"
          : "bg-okbg text-okt border-ok/20";

  const serverDocuments = signedAt ? submittedDocuments : request?.attachedDocuments || [];
  const generatedDocument = serverDocuments.find((d) => d.documentTypeCode === GENERATED_EXPLANATION_TYPE);
  const hasGeneratedDocument = Boolean(generatedDocument);
  const canSubmit = confirmed && hasGeneratedDocument && !isSubmitting && !signedAt && !isExpired;

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPendingFiles((prev) => [...prev, ...Array.from(fileList)]);
  }

  function removeFile(name: string) {
    setPendingFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleSubmit() {
    if (!canSubmit || !caseId) return;
    setSubmitting(true);
    try {
      for (const file of pendingFiles) {
        await caseApi.uploadDocument(caseId, {
          file,
          documentTypeCode: "EXPLANATION",
          isVisibleToEmployee: true,
        });
      }

      const result = await caseApi.giveExplanation(caseId, { explanationText: text.trim() || undefined });

      setSignedAtRaw(result.explanationSubmittedAt || new Date().toISOString());
      setSubmittedDocuments(result.attachedDocuments || []);
      setPendingFiles([]);
      setReviewOpen(false);
      queryClient.invalidateQueries({ queryKey: ["explanation", caseId] });
      requestNavBadgeRefresh();
    } catch (error) {
      console.error("Ошибка отправки:", error);
      showAlert(getErrorMessage(error, "Не удалось отправить объяснение. Попробуйте позже."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(doc: CaseDocumentResponse) {
    if (!doc.downloadUrl || !doc.originalFilename) return;
    try {
      await caseApi.downloadDocumentFile(doc.downloadUrl, doc.originalFilename);
    } catch (error) {
      console.error("Ошибка скачивания:", error);
    }
  }

  async function handlePreview(doc: CaseDocumentResponse) {
    const kind = getPreviewKind(doc.originalFilename);
    if (!doc.id || !doc.downloadUrl || !doc.originalFilename || !kind) return;
    setPreviewLoadingId(doc.id);
    try {
      const blob = await caseApi.fetchDocumentBlob(doc.downloadUrl);
      setPreview({ blob, filename: doc.originalFilename, kind });
    } catch (error) {
      console.error("Ошибка загрузки документа для предпросмотра:", error);
      showAlert(getErrorMessage(error, "Не удалось загрузить документ для предпросмотра"));
    } finally {
      setPreviewLoadingId(null);
    }
  }

  function handleGenerateClosed() {
    setGenerateOpen(false);
    if (justGenerated) {
      setJustGenerated(false);
      setReviewOpen(true);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <div className="text-center py-10 text-tx">Загрузка данных...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-[12px] leading-[16px] text-tx2 mb-2">Мои дела</div>
            <h1 className="text-[28px] leading-[36px] font-bold text-tx">Заявка не найдена</h1>
            <div className="text-[14px] leading-[20px] text-dgl mt-2 font-medium">
              {errorReason || `По делу «${caseId}» не требуется объяснение или оно уже отправлено.`}
            </div>
          </div>
          <div>
            <button
              className="px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors cursor-pointer"
              onClick={() => navigate("/cases")}
            >
              К списку дел
            </button>
          </div>
        </div>
      </div>
    );
  }

  const attachedFiles = signedAt ? submittedDocuments.filter((d) => d.documentTypeCode !== GENERATED_EXPLANATION_TYPE) : [];

  const renderDocumentActions = (doc: CaseDocumentResponse) => (
    <div className="flex items-center gap-3 shrink-0">
      {doc.downloadUrl && getPreviewKind(doc.originalFilename) && (
        <button
          type="button"
          className="text-[14px] font-medium text-prl hover:text-prt transition-colors disabled:opacity-50"
          disabled={previewLoadingId === doc.id}
          onClick={() => handlePreview(doc)}
        >
          {previewLoadingId === doc.id ? "Загрузка..." : "Просмотр"}
        </button>
      )}
      <button
        type="button"
        className="text-[14px] font-medium text-prl hover:text-prt transition-colors"
        onClick={() => handleDownload(doc)}
      >
        Скачать
      </button>
    </div>
  );

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] leading-[16px] text-tx2 mb-2">
            Мои дела / {request.caseNumber || request.caseId}
          </div>
          <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-bold text-tx">
            Дать объяснения
          </h1>
          <div className="text-[14px] leading-[20px] text-tx2 mt-1">
            {request.violationTypeName || "Нарушение"} · дата совершения {formatServerDate(request.incidentDate, timezone)}
          </div>
        </div>

        <div className={`flex flex-col p-4 rounded-card border min-w-[250px] shrink-0 ${timerVariant}`}>
          <span className="text-[12px] leading-[16px] font-medium opacity-80">
            {signedAt ? "Объяснение отправлено" : isExpired ? "Срок истёк" : hasDeadline ? "Осталось на подачу объяснения" : "Срок не определён"}
          </span>
          {!signedAt && hasDeadline && (
            <span className="text-[28px] leading-[36px] font-bold tabular-nums my-1 flex items-center h-9">
              {isTimerReady ? (
                formatHMS(msLeft)
              ) : (
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </span>
          )}
          <span className="text-[12px] leading-[16px] opacity-70">
            до {formatServerDateTime(request.deadlineAt || request.discoveryDate, timezone)}
          </span>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-5 items-start">

        <div className="flex-1 min-w-0 flex flex-col gap-5 w-full">

          <div className="bg-bg border border-bd rounded-card p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h3 className="text-[16px] font-medium text-tx m-0">Требование о предоставлении письменного объяснения</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-okbg text-okt">
                Вручено {formatServerDate(request.requirementServedAt, timezone)}
              </span>
            </div>
            <p className="text-[14px] leading-[20px] text-tx mb-0">
              В соответствии со ст. 193 ТК РФ вам необходимо предоставить письменное объяснение
              по факту дисциплинарного нарушения «{request.violationTypeName || "не указано"}».
              В случае непредоставления объяснения по истечении установленного срока составляется
              соответствующий акт, что не является препятствием для применения дисциплинарного взыскания.
            </p>
          </div>

          <div className="bg-bg border border-bd rounded-card p-5">
            <h3 className="text-[16px] font-medium text-tx mb-2">Сообщение к объяснению</h3>
            <div className="text-[12px] leading-[16px] text-tx2 mb-3">
              Необязательно: можно кратко описать обстоятельства и причины произошедшего. Основной частью объяснения является документ объяснительной.
            </div>
            <textarea
              className="w-full min-h-[200px] border border-bd rounded-inp p-3 text-[14px] leading-[20px] text-tx outline-none transition-colors placeholder:text-txm focus:border-pr focus:ring-3 focus:ring-pr/10 resize-y disabled:bg-ntbg disabled:text-tx2"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isSubmitting || !!signedAt || isExpired}
              placeholder="Сообщение (необязательно)…"
            />
          </div>

          <div className="bg-bg border border-bd rounded-card p-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-[16px] font-medium text-tx m-0">Документ объяснительной</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-dgbg text-dgt">
                Обязателен
              </span>
            </div>
            <div className="text-[12px] leading-[16px] text-tx2 mb-3">
              Документ формируется по стандартному шаблону объяснительной: заполните поля и проверьте результат.
            </div>
            {generatedDocument ? (
              <div className="flex items-center gap-3 p-3 border border-bd rounded-inp bg-bg flex-wrap">
                <div className="w-8 h-8 rounded bg-ntbg flex items-center justify-center text-[12px] font-medium text-tx2 shrink-0">
                  {generatedDocument.originalFilename?.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE"}
                </div>
                <div className="flex-1 min-w-[140px]">
                  <div className="font-medium text-[14px] leading-[20px] text-tx truncate">{generatedDocument.originalFilename}</div>
                  <div className="text-[12px] leading-[16px] text-tx2">{formatFileSize(generatedDocument.fileSizeBytes)}</div>
                </div>
                {renderDocumentActions(generatedDocument)}
              </div>
            ) : (
              <div className="text-[14px] text-tx2 mb-1">Документ ещё не сформирован</div>
            )}
            {!signedAt && !isExpired && (
              <button
                type="button"
                className="mt-3 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors cursor-pointer"
                onClick={() => setGenerateOpen(true)}
              >
                {hasGeneratedDocument ? "Сформировать заново" : "Сформировать объяснительную"}
              </button>
            )}
          </div>
        </div>

        <div className="w-full xl:w-96 flex flex-col gap-5 shrink-0">

          {canReadDocuments && caseId && (
            <div className="bg-bg border border-bd rounded-card p-5">
              <h3 className="text-[16px] font-medium text-tx mb-3">Документы по делу</h3>
              <CaseDocumentsList caseId={caseId} documents={caseDocuments} showAccess={false} compact />
            </div>
          )}

          <div className="bg-bg border border-bd rounded-card p-5">
            <h3 className="text-[16px] font-medium text-tx mb-3">Приложенные файлы</h3>

            {!signedAt && !isExpired && canUploadDocuments && (
              <div
                className={`border-2 border-dashed rounded-card p-5 flex flex-col items-center gap-3 text-center transition-colors mb-4 ${isDraggingOver
                  ? "border-pr bg-pr/5 text-prl"
                  : "border-bd bg-surf text-tx2 hover:border-pr/50 hover:bg-pr/5"
                  }`}
                onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
                onDragLeave={() => setDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDraggingOver(false);
                  addFiles(e.dataTransfer.files);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M7 9l5-5 5 5" />
                  <path d="M4 17v3h16v-3" />
                </svg>
                <div className="font-medium text-[14px] text-tx">Перетащите файлы сюда</div>
                <span className="text-[12px] text-tx2">PDF, DOCX, JPG, PNG · до 25 МБ</span>
                <label className="px-3 py-2 rounded-inp font-medium text-[14px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors cursor-pointer mt-1">
                  Выбрать файлы
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {!signedAt && pendingFiles.map((f) => (
                <div key={`${f.name}-${f.size}`} className="flex items-center gap-3 p-3 border border-bd rounded-inp bg-bg">
                  {isImageFile(f.name) ? (
                    <ImageThumbnail filename={f.name} file={f} size={56} />
                  ) : (
                    <div className="w-8 h-8 rounded bg-ntbg flex items-center justify-center text-[12px] font-medium text-tx2 shrink-0">
                      {f.name.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[14px] leading-[20px] text-tx truncate">{f.name}</div>
                    <div className="text-[12px] leading-[16px] text-tx2">{formatFileSize(f.size)}</div>
                  </div>
                  <button
                    className="text-[14px] font-medium text-dgl hover:text-dgt transition-colors shrink-0"
                    onClick={() => removeFile(f.name)}
                  >
                    Удалить
                  </button>
                </div>
              ))}

              {signedAt && attachedFiles.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 border border-bd rounded-inp bg-bg">
                  {doc.downloadUrl && isImageFile(doc.originalFilename) ? (
                    <ImageThumbnail
                      filename={doc.originalFilename}
                      downloadUrl={doc.downloadUrl}
                      size={56}
                      onOpen={() => handlePreview(doc)}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-ntbg flex items-center justify-center text-[12px] font-medium text-tx2 shrink-0">
                      {doc.originalFilename?.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[14px] leading-[20px] text-tx truncate">{doc.originalFilename}</div>
                    <div className="text-[12px] leading-[16px] text-tx2">{formatFileSize(doc.fileSizeBytes)}</div>
                  </div>
                  {renderDocumentActions(doc)}
                </div>
              ))}

              {signedAt && attachedFiles.length === 0 && (
                <div className="text-center py-4 text-[14px] text-tx2">Дополнительные файлы не прикреплены</div>
              )}

              {!signedAt && pendingFiles.length === 0 && (
                <div className="text-center py-4 text-[14px] text-tx2">
                  {canUploadDocuments ? "Файлы не прикреплены" : "У вас нет прав на прикрепление файлов к объяснению"}
                </div>
              )}
            </div>
          </div>

          <div className="bg-bg border border-bd rounded-card p-5">
            <h3 className="text-[16px] font-medium text-tx mb-3">Подписание</h3>

            <label className={`flex items-start gap-3 mb-4 ${signedAt || isExpired ? "cursor-default opacity-60" : "cursor-pointer group"}`}>
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 rounded border-bd text-prl focus:ring-pr/20 disabled:opacity-50"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={!!signedAt || isExpired}
              />
              <span className="text-[14px] leading-[20px] text-tx group-hover:text-tx/90">
                Подтверждаю, что объяснение составлено мной лично и сведения в нём достоверны.
              </span>
            </label>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between py-2 border-b border-bd">
                <span className="text-[12px] leading-[16px] text-tx2">Подписант</span>
                <span className="text-[14px] leading-[20px] text-tx font-medium">{request.signerFio}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-bd">
                <span className="text-[12px] leading-[16px] text-tx2">Дата и время</span>
                <span className="text-[14px] leading-[20px] text-tx font-medium">
                  {signedAt || "Будет зафиксировано"}
                </span>
              </div>
            </div>

            <button
              className="w-full px-4 py-2.5 rounded-inp font-medium text-[14px] leading-[20px] bg-pr text-white border border-transparent hover:bg-prh disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              disabled={!canSubmit}
              onClick={() => setReviewOpen(true)}
            >
              {signedAt ? (
                "Отправлено"
              ) : isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Отправляем…
                </>
              ) : (
                "Проверить и отправить"
              )}
            </button>
            {!signedAt && !hasGeneratedDocument && !isExpired && (
              <div className="text-[12px] leading-[16px] text-dgt mt-2 text-center">
                Сначала сформируйте документ объяснительной
              </div>
            )}

            {signedAt && (
              <button
                type="button"
                className="w-full mt-3 px-4 py-2.5 rounded-inp font-medium text-[14px] leading-[20px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors flex items-center justify-center"
                onClick={() => navigate("/cases")}
              >
                Вернуться к делам
              </button>
            )}

            <div className="text-[12px] leading-[16px] text-tx2 mt-3 text-center">
              {signedAt
                ? "Объяснение доступно участникам дела и членам комиссии. Изменить текст нельзя."
                : "После отправки объяснение станет доступно участнмкам дела и членам комиссии. Изменить текст будет нельзя."}
            </div>
          </div>
        </div>
      </div>

      {generateOpen && (
        <GenerateDocumentModal
          caseId={request.caseId ?? caseId ?? ""}
          caseNumber={request.caseNumber}
          violationTypeCode=""
          violationTypeName={request.violationTypeName}
          violatorFullName={request.signerFio}
          violatorPosition={request.snapshotPosition || userContext?.position}
          generatorFullName={request.signerFio}
          generatorPosition={request.snapshotPosition || userContext?.position}
          domainName={request.snapshotDomain}
          departmentName={request.snapshotDepartment}
          employeeUid={userContext?.employeeUid}
          incidentDateIso={request.incidentDate}
          discoveryDateIso={request.discoveryDate}
          explanationDeadlineIso={request.deadlineAt}
          timezone={timezone}
          explanationMode
          title="Формирование объяснительной"
          onGenerated={() => {
            setJustGenerated(true);
            queryClient.invalidateQueries({ queryKey: ["explanation", caseId] });
          }}
          onClose={handleGenerateClosed}
        />
      )}

      {reviewOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg rounded-lg border border-bd w-full max-w-[640px] max-h-full shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-bd shrink-0">
              <h3 className="text-[18px] font-bold text-tx m-0">Проверьте, что будет отправлено</h3>
              <span className="text-[12px] text-tx2">После отправки изменить объяснение будет нельзя.</span>
            </div>
            <div className="p-4 overflow-y-auto flex flex-col gap-4">
              <div>
                <div className="text-[12px] text-tx2 mb-1">Сообщение</div>
                {text.trim() ? (
                  <div className="text-[14px] leading-[20px] text-tx whitespace-pre-wrap border border-bd rounded-inp p-3 bg-surf">{text.trim()}</div>
                ) : (
                  <div className="text-[14px] text-tx2">Без текстового сообщения — только документ</div>
                )}
              </div>
              <div>
                <div className="text-[12px] text-tx2 mb-1">Документы</div>
                <div className="flex flex-col gap-2">
                  {generatedDocument && (
                    <div className="flex items-center gap-3 p-3 border border-bd rounded-inp flex-wrap">
                      <div className="flex-1 min-w-[140px]">
                        <div className="font-medium text-[14px] text-tx truncate">{generatedDocument.originalFilename}</div>
                        <div className="text-[12px] text-tx2">Объяснительная · {formatFileSize(generatedDocument.fileSizeBytes)}</div>
                      </div>
                      {renderDocumentActions(generatedDocument)}
                    </div>
                  )}
                  {pendingFiles.map((f) => (
                    <div key={`${f.name}-${f.size}`} className="flex items-center gap-3 p-3 border border-bd rounded-inp">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[14px] text-tx truncate">{f.name}</div>
                        <div className="text-[12px] text-tx2">Приложение · {formatFileSize(f.size)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {!confirmed && (
                <div className="text-[12px] text-wnt">
                  Чтобы отправить, подтвердите достоверность сведений в блоке «Подписание».
                </div>
              )}
            </div>
            <div className="flex gap-3 p-4 border-t border-bd shrink-0">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors"
                onClick={() => setReviewOpen(false)}
                disabled={isSubmitting}
              >
                Назад
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {isSubmitting ? "Отправляем…" : "Подписать и отправить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <FilePreviewModal blob={preview.blob} filename={preview.filename} kind={preview.kind} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
