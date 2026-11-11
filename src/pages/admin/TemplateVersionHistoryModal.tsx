import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { caseApi, documentApi } from "@shared/api";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { formatServerDate } from "@shared/utils/datetime";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import type { DocumentTemplateResponse, DocumentTemplateVersionResponse } from "@shared/types/api";
import { showAlert, showConfirm } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

export function TemplateVersionHistoryModal({
  template,
  canWrite,
  onClose,
  onRestored,
}: {
  template: DocumentTemplateResponse;
  canWrite: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<DocumentTemplateVersionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewPlaceholders, setPreviewPlaceholders] = useState<string[]>([]);
  const { timezone } = useTimezoneStore();

  const fetchVersions = () => {
    if (!template.id) return;
    setLoading(true);
    setError(null);
    documentApi
      .getTemplateVersions(template.id)
      .then(setVersions)
      .catch((err) => {
        console.error("Ошибка загрузки истории версий шаблона:", err);
        setError(getErrorMessage(err, "Не удалось загрузить историю версий"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  const handleDownload = async (version: DocumentTemplateVersionResponse) => {
    if (!template.id || !version.id) return;
    try {
      await caseApi.downloadDocumentFile(
        `/api/v1/documents/templates/${template.id}/versions/${version.id}/download`,
        version.originalFilename || `v${version.versionNumber}.docx`
      );
    } catch (err) {
      console.error("Ошибка скачивания архивной версии шаблона:", err);
      showAlert(getErrorMessage(err, "Не удалось скачать файл версии"));
    }
  };

  const handlePreview = async (version: DocumentTemplateVersionResponse) => {
    if (!template.id || !version.id) return;
    setBusyId(version.id);
    try {
      const blob = await documentApi.getTemplateVersionFileBlob(template.id, version.id);
      const filename = version.originalFilename || `v${version.versionNumber}.docx`;
      const file = new File([blob], filename, {
        type: blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const { placeholders } = await documentApi.previewTemplate(file);
      setPreviewPlaceholders(placeholders || []);
      setPreviewFile(file);
    } catch (err) {
      console.error("Ошибка загрузки файла версии для предпросмотра:", err);
      showAlert(getErrorMessage(err, "Не удалось загрузить файл версии для предпросмотра"));
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (version: DocumentTemplateVersionResponse) => {
    if (!template.id || !version.id) return;
    if (
      !(await showConfirm(
        `Восстановить версию v${version.versionNumber} (${version.originalFilename}) как текущий файл шаблона? Текущий файл будет заархивирован.`, { title: "Восстановление версии", confirmLabel: "Восстановить" }))
    )
      return;
    setBusyId(version.id);
    try {
      await documentApi.restoreTemplateVersion(template.id, version.id);
      fetchVersions();
      onRestored();
    } catch (err) {
      console.error("Ошибка восстановления версии шаблона:", err);
      showAlert(getErrorMessage(err, "Не удалось восстановить версию"));
    } finally {
      setBusyId(null);
    }
  };

  const handleHardDelete = async (version: DocumentTemplateVersionResponse) => {
    if (!template.id || !version.id) return;
    if (
      !(await showConfirm(
        `Безвозвратно удалить версию v${version.versionNumber} (${version.originalFilename})? Файл будет удалён из хранилища, отменить это действие нельзя.`, { title: "Удаление версии", confirmLabel: "Удалить", danger: true }))
    )
      return;
    setBusyId(version.id);
    try {
      await documentApi.deleteTemplateVersion(template.id, version.id);
      setVersions((prev) => prev.filter((v) => v.id !== version.id));
    } catch (err) {
      console.error("Ошибка удаления версии шаблона:", err);
      showAlert(getErrorMessage(err, "Не удалось удалить версию"));
    } finally {
      setBusyId(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-bg rounded-lg border border-bd w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-bd shrink-0">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold text-tx">История версий</h3>
            <span className="text-[12px] text-tx2 truncate block">{template.name} · текущая версия v{template.version}</span>
          </div>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors cursor-pointer shrink-0">
            Закрыть
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading ? (
            <div className="text-[13px] text-tx2 text-center py-8">Загрузка...</div>
          ) : error ? (
            <div className="text-[13px] text-dgl text-center py-8">{error}</div>
          ) : versions.length === 0 ? (
            <div className="text-[13px] text-tx2 text-center py-8">
              Архивных версий пока нет — они появляются здесь после замены файла шаблона новой версией.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 border border-bd rounded-inp px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-tx">v{v.versionNumber}</div>
                    <div className="text-[12px] text-tx2 truncate" title={v.originalFilename}>{v.originalFilename}</div>
                    {v.archivedAt && (
                      <div className="text-[11px] text-tx2">архивирована {formatServerDate(v.archivedAt, timezone)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => handlePreview(v)}
                      disabled={busyId === v.id}
                      className="px-2 py-1 text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {busyId === v.id ? "..." : "Предпросмотр"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(v)}
                      className="px-2 py-1 text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors"
                    >
                      Скачать
                    </button>
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRestore(v)}
                          disabled={busyId === v.id}
                          className="px-2 py-1 text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors disabled:opacity-50"
                        >
                          Восстановить
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHardDelete(v)}
                          disabled={busyId === v.id}
                          className="px-2 py-1 text-[13px] font-medium text-dgl hover:text-dgl/80 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {previewFile && (
        <TemplatePreviewModal
          file={previewFile}
          mapping={{}}
          onMappingChange={() => {}}
          readOnly
          placeholders={previewPlaceholders}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>,
    document.body
  );
}
