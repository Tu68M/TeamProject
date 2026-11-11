import { useEffect, useState } from "react";
import { documentApi } from "@shared/api";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { parseAutoFillParams } from "@entities/document/autoFillSources";
import type { DocumentTemplateResponse, PlaceholderAutoFillSetting } from "@shared/types/api";
import { getErrorMessage } from "@shared/utils/errorMessage";

function initialMappingFromTemplate(template: DocumentTemplateResponse): Record<string, PlaceholderAutoFillSetting> {
  const result: Record<string, PlaceholderAutoFillSetting> = {};
  (template.placeholders || []).forEach((p) => {
    if (!p.key) return;
    if (p.autoFillSource) {
      result[p.key] = {
        source: p.autoFillSource,
        editable: p.autoFillEditable ?? true,
        grammaticalCase: p.grammaticalCase || undefined,
        isRequired: p.isRequired ?? true,
        params: parseAutoFillParams(p.autoFillParams),
      };
    } else if (p.isRequired === false) {
      result[p.key] = { isRequired: false };
    }
  });
  return result;
}

export function EditPlaceholderMappingModal({
  template,
  onClose,
  onSaved,
}: {
  template: DocumentTemplateResponse;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, PlaceholderAutoFillSetting>>(() =>
    initialMappingFromTemplate(template)
  );
  const [isLoadingFile, setIsLoadingFile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!template.id) return;
    let cancelled = false;
    documentApi
      .getTemplateFileBlob(template.id)
      .then((blob) => {
        if (cancelled) return;
        const filename = template.originalFilename || `${template.code || "template"}.docx`;
        setFile(
          new File([blob], filename, {
            type: blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          })
        );
      })
      .catch((err) => {
        console.error("Ошибка загрузки файла шаблона для изменения автозаполнения:", err);
        if (!cancelled) setError(getErrorMessage(err, "Не удалось загрузить файл шаблона"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [template.id, template.originalFilename, template.code]);

  const handleSave = async () => {
    if (!template.id) return;
    setIsSaving(true);
    setError(null);
    try {
      await documentApi.updateTemplatePlaceholderMapping(template.id, mapping);
      onSaved();
      onClose();
    } catch (err) {
      console.error("Ошибка изменения автозаполнения плейсхолдеров:", err);
      setError(getErrorMessage(err, "Не удалось сохранить сопоставление"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingFile || !file) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-bg rounded-lg border border-bd px-6 py-4 text-[14px]" onClick={(e) => e.stopPropagation()}>
          {isLoadingFile ? <span className="text-tx2">Загрузка файла шаблона...</span> : <span className="text-dgl">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <TemplatePreviewModal
      file={file}
      mapping={mapping}
      onMappingChange={setMapping}
      onClose={onClose}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
    />
  );
}
