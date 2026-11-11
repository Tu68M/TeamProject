import { parseAutoFillParams } from "@entities/document/autoFillSources";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { caseApi, documentApi } from "@shared/api";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { formatServerDate } from "@shared/utils/datetime";
import { generateUuidV4 } from "@shared/utils/uuid";
import { getPageNumbers } from "@shared/utils/pagination";
import { ActionsMenu, ActionsMenuItem } from "@shared/ui/ActionsMenu";
import { FadeSwap } from "@shared/ui/FadeSwap";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { EditPlaceholderMappingModal } from "./EditPlaceholderMappingModal";
import { TemplateVersionHistoryModal } from "./TemplateVersionHistoryModal";
import { AssignmentsTab } from "./AssignmentsTab";
import { TemplateFolders, ALL_TEMPLATES_FOLDER, folderKey, type TemplateFolder } from "./TemplateFolders";
import { useViolationTypes, type ViolationTypeOption } from "@entities/document/useViolationTypes";
import type {
  DocumentPurposeResponse,
  DocumentTemplateResponse,
  PlaceholderAutoFillSetting,
  TemplateFoldersResponse,
} from "@shared/types/api";
import { showAlert, showConfirm } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

const PAGE_TABS = [
  { id: "templates", label: "Шаблоны" },
  { id: "assignments", label: "Назначение шаблонов" },
];

const PAGE_SIZE = 8;

const SELECT_CLASS =
  "w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] bg-bg focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none";

function ViolationTypeSelect({
  value,
  onChange,
  violationTypes,
}: {
  value: string;
  onChange: (code: string) => void;
  violationTypes: ViolationTypeOption[];
}) {
  const unknown = value && !violationTypes.some((v) => v.code === value);
  return (
    <select className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Общий (для всех видов нарушений) —</option>
      {unknown && <option value={value}>{value}</option>}
      {violationTypes.map((v) => (
        <option key={v.code} value={v.code}>{v.name}</option>
      ))}
    </select>
  );
}

function UploadTemplateModal({
  onClose,
  onCreated,
  violationTypes,
  defaultViolationTypeCode,
}: {
  onClose: () => void;
  onCreated: () => void;
  violationTypes: ViolationTypeOption[];
  defaultViolationTypeCode: string;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [violationTypeCode, setViolationTypeCode] = useState(defaultViolationTypeCode);
  const [purposeCode, setPurposeCode] = useState("");
  const [purposes, setPurposes] = useState<DocumentPurposeResponse[]>([]);
  const [mapping, setMapping] = useState<Record<string, PlaceholderAutoFillSetting>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    documentApi
      .getPurposes()
      .then(setPurposes)
      .catch((err) => console.error("Не удалось загрузить назначения документов:", err));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIsSaving(true);
    setError(null);
    try {
      const created = await documentApi.uploadTemplate(
        {
          file,
          name,
          description: description || undefined,
          violationTypeCode: violationTypeCode || undefined,
          placeholderAutoFill: mapping,
        },
        generateUuidV4()
      );
      if (purposeCode && created.id) {
        try {
          if (violationTypeCode) {
            await documentApi.setPurposeViolationTemplate(purposeCode, violationTypeCode, created.id);
          } else {
            await documentApi.setPurposeTemplate(purposeCode, created.id);
          }
        } catch (assignErr) {
          console.error("Ошибка назначения загруженного шаблона:", assignErr);
          showAlert("Шаблон загружен, но назначить его не удалось. Назначьте его на вкладке «Назначение шаблонов».");
        }
      }
      onCreated();
      onClose();
    } catch (err) {
      console.error("Ошибка загрузки шаблона документа:", err);
      setError(getErrorMessage(err, "Не удалось загрузить шаблон."));
    } finally {
      setIsSaving(false);
    }
  };

  const mappedCount = Object.keys(mapping).length;
  const violationName = violationTypes.find((v) => v.code === violationTypeCode)?.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[18px] font-bold text-tx">Загрузка шаблона документа</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Название</label>
            <input required className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Описание</label>
            <textarea className="w-full min-h-[70px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none resize-y"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Вид нарушения</label>
            <ViolationTypeSelect value={violationTypeCode} onChange={setViolationTypeCode} violationTypes={violationTypes} />
            <div className="text-[12px] text-tx2 mt-1">Шаблон появится в папке этого вида нарушения.</div>
          </div>
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Файл шаблона</label>
            <input required type="file" accept=".docx"
              className="w-full text-[13px] text-tx2 file:mr-3 file:px-3 file:py-1.5 file:rounded-inp file:border file:border-bd file:bg-bg file:text-[13px] file:font-medium file:text-tx file:cursor-pointer hover:file:bg-surf"
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                setFile(selected);
                setMapping({});
                if (selected) setShowPreview(true);
              }} />
            <div className="text-[12px] text-tx2 mt-1">Плейсхолдеры в тексте документа в формате {"{{ключ}}"} будут найдены автоматически при загрузке.</div>
          </div>
          {file && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-inp border border-bd bg-surf text-[13px]">
              <span className="text-tx2 truncate">
                {mappedCount > 0 ? `Сопоставлено полей автозаполнения: ${mappedCount}` : "Плейсхолдеры ещё не сопоставлены"}
              </span>
              <button type="button" onClick={() => setShowPreview(true)} className="shrink-0 text-prl hover:text-prt font-medium cursor-pointer">
                Открыть предпросмотр
              </button>
            </div>
          )}
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Сразу использовать для</label>
            <select className={SELECT_CLASS} value={purposeCode} onChange={(e) => setPurposeCode(e.target.value)}>
              <option value="">— Не назначать —</option>
              {purposes.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
            {purposeCode && (
              <div className="text-[12px] text-tx2 mt-1">
                {violationTypeCode
                  ? `Шаблон будет использоваться для вида нарушения «${violationName || violationTypeCode}» вместо шаблона по умолчанию.`
                  : "Шаблон будет использоваться по умолчанию для всех видов нарушений."}
              </div>
            )}
          </div>
          {error && <div className="text-[13px] text-dgl">{error}</div>}
          <div className="flex gap-3 mt-2 pt-4 border-t border-bd">
            <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors disabled:opacity-50">
              Отмена
            </button>
            <button type="submit" disabled={isSaving || !file} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50">
              {isSaving ? "Загрузка..." : "Загрузить"}
            </button>
          </div>
        </form>
      </div>

      {showPreview && file && (
        <TemplatePreviewModal file={file} mapping={mapping} onMappingChange={setMapping} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}

function EditTemplateModal({
  template,
  onClose,
  onSaved,
  violationTypes,
}: {
  template: DocumentTemplateResponse;
  onClose: () => void;
  onSaved: () => void;
  violationTypes: ViolationTypeOption[];
}) {
  const [name, setName] = useState(template.name || "");
  const [description, setDescription] = useState(template.description || "");
  const [violationTypeCode, setViolationTypeCode] = useState(template.violationTypeCode || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!template.id) return;
    setIsSaving(true);
    setError(null);
    try {
      await documentApi.updateTemplateMetadata(template.id, {
        name,
        description: description || undefined,
        violationTypeCode: violationTypeCode || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Ошибка изменения шаблона документа:", err);
      setError(getErrorMessage(err, "Не удалось сохранить изменения"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <div>
            <h3 className="text-[18px] font-bold text-tx">Изменение шаблона</h3>
            <span className="text-[12px] text-tx2">{template.name}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Название</label>
            <input required className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Описание</label>
            <textarea className="w-full min-h-[70px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none resize-y"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Вид нарушения</label>
            <ViolationTypeSelect value={violationTypeCode} onChange={setViolationTypeCode} violationTypes={violationTypes} />
            <div className="text-[12px] text-tx2 mt-1">Определяет папку шаблона и вид нарушения, для которого его можно назначить.</div>
          </div>
          {error && <div className="text-[13px] text-dgl">{error}</div>}
          <div className="flex gap-3 mt-2 pt-4 border-t border-bd">
            <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors disabled:opacity-50">
              Отмена
            </button>
            <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50">
              {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReplaceFileModal({
  template,
  onClose,
  onReplaced,
}: {
  template: DocumentTemplateResponse;
  onClose: () => void;
  onReplaced: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, PlaceholderAutoFillSetting>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !template.id) return;
    setIsSaving(true);
    setError(null);
    try {
      await documentApi.replaceTemplateFile(template.id, file, generateUuidV4(), mapping);
      onReplaced();
      onClose();
    } catch (err) {
      console.error("Ошибка замены файла шаблона:", err);
      setError(getErrorMessage(err, "Не удалось заменить файл шаблона"));
    } finally {
      setIsSaving(false);
    }
  };

  const mappedCount = Object.keys(mapping).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <div>
            <h3 className="text-[18px] font-bold text-tx">Новая версия файла</h3>
            <span className="text-[12px] text-tx2">{template.name} · текущая версия v{template.version}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Новый файл</label>
            <input required type="file" accept=".docx"
              className="w-full text-[13px] text-tx2 file:mr-3 file:px-3 file:py-1.5 file:rounded-inp file:border file:border-bd file:bg-bg file:text-[13px] file:font-medium file:text-tx file:cursor-pointer hover:file:bg-surf"
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                setFile(selected);
                setMapping({});
                if (selected) setShowPreview(true);
              }} />
          </div>
          {file && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-inp border border-bd bg-surf text-[13px]">
              <span className="text-tx2 truncate">
                {mappedCount > 0 ? `Сопоставлено полей автозаполнения: ${mappedCount}` : "Плейсхолдеры ещё не сопоставлены"}
              </span>
              <button type="button" onClick={() => setShowPreview(true)} className="shrink-0 text-prl hover:text-prt font-medium cursor-pointer">
                Открыть предпросмотр
              </button>
            </div>
          )}
          {error && <div className="text-[13px] text-dgl">{error}</div>}
          <div className="flex gap-3 mt-2 pt-4 border-t border-bd">
            <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors disabled:opacity-50">
              Отмена
            </button>
            <button type="submit" disabled={isSaving || !file} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50">
              {isSaving ? "Загрузка..." : "Заменить"}
            </button>
          </div>
        </form>
      </div>

      {showPreview && file && (
        <TemplatePreviewModal file={file} mapping={mapping} onMappingChange={setMapping} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}

function TemplatesListSkeleton() {
  return (
    <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup><col className="w-[38%]" /><col className="w-[22%]" /><col className="w-[8%]" /><col className="w-[32%]" /></colgroup>
        <thead>
          <tr>
            {Array.from({ length: 4 }).map((_, i) => (
              <th key={i} className="text-left py-2 px-3 bg-bg border-b border-bd">
                <div className="h-3.5 w-20 bg-skel rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="py-2 px-3 border-b border-bd/70 align-middle">
                <div className="h-4 w-40 max-w-full bg-skel rounded" />
                <div className="h-3 w-32 max-w-full bg-skel rounded mt-1" />
              </td>
              <td className="py-2 px-3 border-b border-bd/70 align-middle">
                <div className="h-4 w-32 max-w-full bg-skel rounded" />
                <div className="h-3 w-20 max-w-full bg-skel rounded mt-1" />
              </td>
              <td className="py-2 px-3 border-b border-bd/70 align-middle">
                <div className="h-4 w-8 bg-skel rounded" />
              </td>
              <td className="py-2 px-3 border-b border-bd/70 align-middle">
                <div className="flex items-center justify-end gap-3">
                  <div className="h-4 w-24 bg-skel rounded" />
                  <div className="h-4 w-16 bg-skel rounded" />
                  <div className="h-6 w-6 bg-skel rounded" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TemplatesTab({ canWrite }: { canWrite: boolean }) {
  const [templates, setTemplates] = useState<DocumentTemplateResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplateResponse | null>(null);
  const [replacingFileTemplate, setReplacingFileTemplate] = useState<DocumentTemplateResponse | null>(null);
  const [versionHistoryTemplate, setVersionHistoryTemplate] = useState<DocumentTemplateResponse | null>(null);
  const [editingMappingTemplate, setEditingMappingTemplate] = useState<DocumentTemplateResponse | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<DocumentTemplateResponse | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [folder, setFolder] = useState<TemplateFolder>(ALL_TEMPLATES_FOLDER);
  const [folders, setFolders] = useState<TemplateFoldersResponse | null>(null);
  const [loadedFolderKey, setLoadedFolderKey] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const { timezone } = useTimezoneStore();
  const { violationTypes, loading: violationTypesLoading } = useViolationTypes();
  const violationName = (code?: string | null) =>
    code ? violationTypes.find((v) => v.code === code)?.name || code : undefined;
  const currentFolderKey = folderKey(folder);

  const inFlightRef = useRef<{ key: string; promise: Promise<void> } | null>(null);

  const fetchData = () => {
    const key = `${currentFolderKey}:${page}`;
    if (inFlightRef.current?.key === key) return inFlightRef.current.promise;

    const requestId = ++requestIdRef.current;
    const requestedFolderKey = currentFolderKey;
    setLoading(true);
    setError(null);
    documentApi
      .getTemplateFolders()
      .then(setFolders)
      .catch((err) => console.error("Ошибка загрузки папок шаблонов:", err));
    const promise = documentApi
      .getTemplates({
        page,
        size: PAGE_SIZE,
        sort: ["createdAt,desc"],
        violationTypeCode: folder.kind === "violation" ? folder.code : undefined,
      })
      .then((templatesPage) => {
        if (requestId !== requestIdRef.current) return;
        setTemplates(templatesPage.content || []);
        setTotalPages(templatesPage.totalPages || 0);
        setTotalElements(templatesPage.totalElements || 0);
        setLoadedFolderKey(requestedFolderKey);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        console.error("Ошибка загрузки шаблонов документов:", err);
        setError(getErrorMessage(err, "Не удалось загрузить список шаблонов"));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        inFlightRef.current = null;
      });
    inFlightRef.current = { key, promise };
    return promise;
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, currentFolderKey]);

  const handleSelectFolder = (next: TemplateFolder) => {
    if (folderKey(next) === currentFolderKey) return;
    setFolder(next);
    setPage(0);
  };

  const handleDownload = async (template: DocumentTemplateResponse) => {
    if (!template.id || !template.originalFilename) return;
    try {
      await caseApi.downloadDocumentFile(documentApi.templateDownloadUrl(template.id), template.originalFilename);
    } catch (err) {
      console.error("Ошибка скачивания шаблона:", err);
      showAlert(getErrorMessage(err, "Не удалось скачать файл шаблона"));
    }
  };

  const handlePreview = async (template: DocumentTemplateResponse) => {
    if (!template.id) return;
    setPreviewLoadingId(template.id);
    try {
      const blob = await documentApi.getTemplateFileBlob(template.id);
      const filename = template.originalFilename || `${template.code || "template"}.docx`;
      setPreviewFile(
        new File([blob], filename, {
          type: blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      );
      setPreviewingTemplate(template);
    } catch (err) {
      console.error("Ошибка загрузки файла шаблона для предпросмотра:", err);
      showAlert(getErrorMessage(err, "Не удалось загрузить файл шаблона для предпросмотра"));
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleToggleActive = async (template: DocumentTemplateResponse) => {
    if (!template.id) return;
    if (template.isActive && !(await showConfirm("Деактивировать шаблон? Он перестанет быть доступен для назначения и генерации документов.", { title: "Деактивация шаблона", confirmLabel: "Деактивировать", danger: true }))) return;
    setBusyId(template.id);
    try {
      if (template.isActive) {
        await documentApi.deactivateTemplate(template.id);
      } else {
        await documentApi.activateTemplate(template.id);
      }
      await fetchData();
    } catch (err) {
      console.error("Ошибка изменения статуса шаблона:", err);
      showAlert(getErrorMessage(err, "Не удалось изменить статус шаблона"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (template: DocumentTemplateResponse) => {
    if (!template.id) return;
    if (!(await showConfirm(`Удалить шаблон «${template.name}»? Это действие необратимо.`, { title: "Удаление шаблона", confirmLabel: "Удалить", danger: true }))) return;
    setBusyId(template.id);
    try {
      await documentApi.deleteTemplate(template.id);
      await fetchData();
    } catch (err) {
      console.error("Ошибка удаления шаблона:", err);
      showAlert(getErrorMessage(err, "Не удалось удалить шаблон"));
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <div className="w-full border border-bd rounded-lg bg-bg p-8 text-center text-dgl text-[14px]">{error}</div>;

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <TemplateFolders
          folders={folders}
          violationTypes={violationTypes}
          loading={violationTypesLoading}
          selected={folder}
          onSelect={handleSelectFolder}
        />

        <div className="flex flex-col gap-4 flex-1 min-w-0 w-full">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] text-tx2">
            {folder.kind === "violation"
              ? `Шаблоны для вида нарушения «${violationName(folder.code)}».`
              : "Файлы .docx с плейсхолдерами вида {{ключ}}, которые заполняются при генерации документа."}
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => setIsUploading(true)}
              className="shrink-0 px-4 py-2 rounded-inp font-medium text-[14px] leading-[20px] bg-pr text-white border border-transparent hover:bg-prh transition-colors cursor-pointer"
            >
              Загрузить шаблон
            </button>
          )}
        </div>

        <FadeSwap
          showSkeleton={loading && loadedFolderKey !== currentFolderKey}
          skeleton={<TemplatesListSkeleton />}
        >
        <div className="flex flex-col gap-4">
        <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup><col className="w-[38%]" /><col className="w-[22%]" /><col className="w-[8%]" /><col className="w-[32%]" /></colgroup>
            <thead>
              <tr>
                <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd whitespace-nowrap">Название</th>
                <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd whitespace-nowrap">Файл</th>
                <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd whitespace-nowrap">Версия</th>
                <th className="text-right font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd whitespace-nowrap"><span className="sr-only">Действия</span></th>
              </tr>
            </thead>
            <tbody className={`transition-opacity ${loading && templates.length > 0 ? "opacity-50" : "opacity-100"}`}>
              {templates.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-tx2">{folder.kind === "violation" ? "В этой папке шаблонов пока нет" : "Шаблоны не найдены"}</td></tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id} className="hover:bg-surf transition-colors">
                    <td className={`py-2 px-3 border-b border-bd/70 align-middle min-w-0 ${t.isActive ? "" : "opacity-60"}`}>
                      <div className="font-medium text-[14px] text-tx break-words">
                        {t.name}
                        {!t.isActive && <span className="ml-2 text-[11px] font-normal text-tx2">Неактивно</span>}
                      </div>
                      {t.description && <div className="text-[12px] text-tx2 mt-0.5 line-clamp-2 break-words">{t.description}</div>}
                      <span className="text-[11px] text-tx2 truncate block" title={violationName(t.violationTypeCode) || "Общий шаблон"}>
                        {violationName(t.violationTypeCode) || "Общий шаблон"}
                      </span>
                    </td>
                    <td className={`py-2 px-3 border-b border-bd/70 align-middle min-w-0 ${t.isActive ? "" : "opacity-60"}`}>
                      <span className="text-[13px] text-tx2 truncate block" title={t.originalFilename}>{t.originalFilename}</span>
                      {t.createdAt && <span className="text-[11px] text-tx2">от {formatServerDate(t.createdAt, timezone)}</span>}
                    </td>
                    <td className={`py-2 px-3 border-b border-bd/70 align-middle text-[13px] text-tx2 whitespace-nowrap ${t.isActive ? "" : "opacity-60"}`}>v{t.version}</td>
                    <td className="py-2 px-3 border-b border-bd/70 align-middle text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handlePreview(t)}
                          disabled={previewLoadingId === t.id}
                          className="px-2 py-1 text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {previewLoadingId === t.id ? "Загрузка..." : "Предпросмотр"}
                        </button>
                        <button type="button" onClick={() => handleDownload(t)} className="px-2 py-1 text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors">Скачать</button>
                        {canWrite && (
                          <ActionsMenu>
                            <ActionsMenuItem onClick={() => setEditingTemplate(t)} disabled={busyId === t.id}>Изменить</ActionsMenuItem>
                            <ActionsMenuItem onClick={() => setReplacingFileTemplate(t)} disabled={busyId === t.id}>Заменить файл</ActionsMenuItem>
                            <ActionsMenuItem onClick={() => setEditingMappingTemplate(t)} disabled={busyId === t.id}>Изменить автозаполнение</ActionsMenuItem>
                            <ActionsMenuItem onClick={() => setVersionHistoryTemplate(t)} disabled={busyId === t.id}>История версий</ActionsMenuItem>
                            <ActionsMenuItem onClick={() => handleToggleActive(t)} disabled={busyId === t.id}>
                              {t.isActive ? "Деактивировать" : "Активировать"}
                            </ActionsMenuItem>
                            <div className="h-px bg-bd my-1" />
                            <ActionsMenuItem onClick={() => handleDelete(t)} disabled={busyId === t.id} danger>Удалить</ActionsMenuItem>
                          </ActionsMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalElements > 0 && (
          <div className="text-[13px] text-tx2 text-center -mt-2">
            {totalElements} {totalElements === 1 ? "шаблон" : "шаблонов"}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button
              className="px-3 py-1.5 rounded-inp text-[13px] font-medium bg-bg border border-bd hover:bg-surf disabled:opacity-40 transition-colors"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Назад
            </button>
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <span key={`ellipsis-${i}`} className="px-1.5 text-[13px] text-tx2">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-[34px] px-2 py-1.5 rounded-inp text-[13px] font-medium transition-colors ${
                    p === page ? "bg-pr text-white" : "bg-bg border border-bd text-tx hover:bg-surf"
                  }`}
                >
                  {p + 1}
                </button>
              )
            )}
            <button
              className="px-3 py-1.5 rounded-inp text-[13px] font-medium bg-bg border border-bd hover:bg-surf disabled:opacity-40 transition-colors"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Далее
            </button>
          </div>
        )}
        </div>
        </FadeSwap>

        </div>

        {isUploading && (
          <UploadTemplateModal
            onClose={() => setIsUploading(false)}
            onCreated={fetchData}
            violationTypes={violationTypes}
            defaultViolationTypeCode={folder.kind === "violation" ? folder.code : ""}
          />
        )}

        {editingTemplate && (
          <EditTemplateModal template={editingTemplate} onClose={() => setEditingTemplate(null)} onSaved={fetchData} violationTypes={violationTypes} />
        )}

        {replacingFileTemplate && (
          <ReplaceFileModal template={replacingFileTemplate} onClose={() => setReplacingFileTemplate(null)} onReplaced={fetchData} />
        )}

        {versionHistoryTemplate && (
          <TemplateVersionHistoryModal
            template={versionHistoryTemplate}
            canWrite={canWrite}
            onClose={() => setVersionHistoryTemplate(null)}
            onRestored={fetchData}
          />
        )}

        {editingMappingTemplate && (
          <EditPlaceholderMappingModal
            template={editingMappingTemplate}
            onClose={() => setEditingMappingTemplate(null)}
            onSaved={fetchData}
          />
        )}

        {previewFile && previewingTemplate && (
          <TemplatePreviewModal
            file={previewFile}
            mapping={Object.fromEntries(
              (previewingTemplate.placeholders || [])
                .filter((p) => p.key && p.autoFillSource)
                .map((p) => [
                  p.key as string,
                  {
                    source: p.autoFillSource as string,
                    editable: p.autoFillEditable ?? true,
                    grammaticalCase: p.grammaticalCase || undefined,
                    params: parseAutoFillParams(p.autoFillParams),
                  },
                ])
            )}
            onMappingChange={() => {}}
            readOnly
            placeholders={(previewingTemplate.placeholders || []).map((p) => p.key || "").filter(Boolean)}
            onClose={() => {
              setPreviewFile(null);
              setPreviewingTemplate(null);
            }}
          />
        )}
      </div>
    </>
  );
}

export default function DocumentTemplatesPage() {
  const canWrite = useAuthStore((s) => s.canWriteModule("document_templates"));
  const [activeTab, setActiveTab] = useState<string>("templates");

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
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
  }, [activeTab]);

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="mb-4">
        <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-semibold text-tx">Шаблоны документов</h1>
        <div className="text-[13px] leading-[18px] text-tx2 mt-1">
          Файлы-шаблоны для документов, их привязка к видам нарушений и назначение для дела, объяснений и решений комиссии.
          {!canWrite && " У вас доступ только на чтение."}
        </div>
      </div>

      <div
        ref={tabsContainerRef}
        className="relative flex gap-1 border-b border-bd mb-3 overflow-x-auto scrollbar-thin"
      >
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[tab.id] = el; }}
            type="button"
            className={`px-3.5 py-2 text-[14px] leading-[20px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? "text-prt font-medium" : "text-tx2 font-normal hover:text-tx"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
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

      {activeTab === "templates" && <TemplatesTab canWrite={canWrite} />}
      {activeTab === "assignments" && <AssignmentsTab canWrite={canWrite} />}
    </div>
  );
}