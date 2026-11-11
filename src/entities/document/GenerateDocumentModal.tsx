import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { documentApi } from "@shared/api";
import { DocxViewer } from "@shared/ui/DocumentViewers";
import { highlightPlaceholders, syncPlaceholderValues } from "@entities/document/highlightPlaceholders";
import { getAutoFillLabel, parseAutoFillParams, parseDateSource } from "@entities/document/autoFillSources";
import {
  activeCommissionMembers,
  computeAutoFillValue,
  autoFillFieldKind,
  formatMoment,
  seedMoment,
  type AutoFillContext,
  type Moment,
} from "@entities/document/autoFillValues";
import { useAuthStore } from "@entities/session/model/authStore";
import { useViolationTypes } from "@entities/document/useViolationTypes";
import { TemplateFolders, folderKey, type TemplateFolder } from "@pages/admin/TemplateFolders";
import { generateUuidV4 } from "@shared/utils/uuid";
import { useDecisionTypesStore } from "@shared/model/decisionTypesStore";
import { getDecisionTypeLabel } from "@shared/utils/commissionStatus";
import type {
  CommissionMemberResponse,
  CommissionResponse,
  DocumentTemplateResponse,
  TemplateFoldersResponse,
} from "@shared/types/api";
import { getErrorMessage } from "@shared/utils/errorMessage";

function TemplatePicker({
  violationTypeCode,
  onSelect,
}: {
  violationTypeCode: string;
  onSelect: (template: DocumentTemplateResponse) => void;
}) {
  const { violationTypes, loading: violationTypesLoading } = useViolationTypes();
  const [folder, setFolder] = useState<TemplateFolder>({ kind: "violation", code: violationTypeCode });
  const [folders, setFolders] = useState<TemplateFoldersResponse | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    documentApi.getTemplateFolders().then(setFolders).catch((err) => console.error("Ошибка загрузки папок шаблонов:", err));
  }, []);

  const currentFolderKey = folderKey(folder);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    documentApi
      .getTemplates({
        page: 0,
        size: 100,
        violationTypeCode: folder.kind === "violation" ? folder.code : undefined,
      })
      .then((page) => {
        if (cancelled) return;
        setTemplates((page.content || []).filter((t) => t.isActive));
      })
      .catch((err) => console.error("Ошибка загрузки шаблонов:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderKey]);

  return (
    <div className="flex flex-col gap-3">
      <TemplateFolders
        folders={folders}
        violationTypes={violationTypes}
        loading={violationTypesLoading}
        selected={folder}
        onSelect={setFolder}
      />
      <div className="flex flex-col gap-1">
        {loading ? (
          <div className="text-[13px] text-tx2 px-1 py-2">Загрузка...</div>
        ) : templates.length === 0 ? (
          <div className="text-[13px] text-tx2 px-1 py-2">В этой папке активных шаблонов нет</div>
        ) : (
          templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => t.id && onSelect(t)}
              className="w-full text-left px-2.5 py-2 rounded-inp hover:bg-surf transition-colors cursor-pointer"
            >
              <div className="text-[13px] font-medium text-tx truncate">{t.name}</div>
              <div className="text-[11px] text-tx2 truncate">{t.originalFilename}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const MEMBER_ROLE_SHORT: Record<string, string> = { ПРЕДСЕДАТЕЛЬ: "председатель", СЕКРЕТАРЬ: "секретарь", ЧЛЕН: "член" };

function memberOptionLabel(m: CommissionMemberResponse): string {
  const roles = (m.roles || []).filter((r) => !(r === "ЧЛЕН" && (m.roles || []).includes("ПРЕДСЕДАТЕЛЬ")));
  const suffix = roles.map((r) => MEMBER_ROLE_SHORT[r] ?? r.toLowerCase()).join(", ");
  return `${m.fullName || "Без имени"}${suffix ? ` — ${suffix}` : ""}`;
}

function MembersCheckboxDropdown({
  members,
  selected,
  onChange,
}: {
  members: CommissionMemberResponse[];
  selected: string[];
  onChange: (uids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const uids = members.map((m) => m.employeeUid).filter((u): u is string => Boolean(u));
  const allSelected = uids.length > 0 && uids.every((u) => selected.includes(u));
  const summary =
    selected.length === 0 ? "Никто не выбран" : allSelected ? `Все участники (${uids.length})` : `Выбрано: ${selected.length} из ${uids.length}`;
  const toggle = (uid: string) =>
    onChange(selected.includes(uid) ? selected.filter((u) => u !== uid) : uids.filter((u) => u === uid || selected.includes(u)));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full min-h-[34px] border border-bd rounded-inp px-2 py-1 text-[12px] bg-bg text-left flex items-center justify-between gap-2 outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
      >
        <span className="truncate">{summary}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-bg border border-bd rounded-inp shadow-dropdown max-h-[220px] overflow-y-auto scrollbar-thin py-1">
          <label className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-tx hover:bg-surf cursor-pointer select-none border-b border-bd">
            <input type="checkbox" className="accent-pr" checked={allSelected} onChange={() => onChange(allSelected ? [] : uids)} />
            Все участники
          </label>
          {members.map((m) =>
            m.employeeUid ? (
              <label key={m.employeeUid} className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-tx hover:bg-surf cursor-pointer select-none">
                <input type="checkbox" className="accent-pr" checked={selected.includes(m.employeeUid)} onChange={() => toggle(m.employeeUid as string)} />
                <span className="min-w-0 truncate">{memberOptionLabel(m)}</span>
              </label>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

export function GenerateDocumentModal({
  caseId,
  caseNumber,
  violationTypeCode,
  violationTypeName,
  violatorFullName,
  violatorPosition,
  generatorFullName,
  generatorPosition,
  domainName,
  departmentName,
  employeeUid,
  incidentDateIso,
  discoveryDateIso,
  explanationDeadlineIso,
  timezone,
  purposeCode,
  explanationMode = false,
  decisionActMode = false,
  lawyerConclusionMode = false,
  lawyerDecisionTypeCode,
  protocolNumber,
  commission,
  onGenerated,
  title = "Формирование документа по делу",
  cancelLabel = "Отмена",
  onClose,
}: {
  caseId: string;
  caseNumber?: string;
  violationTypeCode: string;
  violationTypeName?: string;
  violatorFullName?: string;
  violatorPosition?: string;
  generatorFullName?: string;
  generatorPosition?: string;
  domainName?: string;
  departmentName?: string;
  employeeUid?: string;
  incidentDateIso?: string | null;
  discoveryDateIso?: string | null;
  explanationDeadlineIso?: string | null;
  timezone: string;
  purposeCode?: string;
  explanationMode?: boolean;
  decisionActMode?: boolean;
  lawyerConclusionMode?: boolean;
  lawyerDecisionTypeCode?: string;
  protocolNumber?: string;
  commission?: CommissionResponse | null;
  onGenerated?: () => void;
  title?: string;
  cancelLabel?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const restrictedMode = explanationMode || decisionActMode || lawyerConclusionMode;
  const [resolving, setResolving] = useState(Boolean(purposeCode) || restrictedMode);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplateResponse | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [momentRaw, setMomentRaw] = useState<Record<string, Moment>>({});
  const [missingRequired, setMissingRequired] = useState<Set<string>>(new Set());
  const [unresolvedAutoFillKeys, setUnresolvedAutoFillKeys] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(!purposeCode && !restrictedMode);
  const [memberSelections, setMemberSelections] = useState<Record<string, string[]>>({});
  const generatorEmployeeUid = useAuthStore((st) => st.context?.employeeUid);

  const previewContainerRef = useRef<HTMLElement | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const ctx: AutoFillContext = useMemo(
    () => ({
      caseNumber,
      violationTypeName,
      incidentDateIso,
      discoveryDateIso,
      explanationDeadlineIso,
      violatorFullName,
      violatorPosition,
      generatorFullName,
      generatorPosition,
      domainName,
      departmentName,
      protocolNumber,
      commission,
      generatorEmployeeUid,
      lawyerDecisionName: lawyerConclusionMode
        ? lawyerDecisionTypeCode
          ? getDecisionTypeLabel(
              lawyerDecisionTypeCode,
              useDecisionTypesStore.getState().decisionTypes.find((t) => t.code === lawyerDecisionTypeCode)?.name
            )
          : "Без взыскания"
        : undefined,
      timezone,
    }),
    [
      caseNumber,
      violationTypeName,
      incidentDateIso,
      discoveryDateIso,
      explanationDeadlineIso,
      violatorFullName,
      violatorPosition,
      generatorFullName,
      generatorPosition,
      domainName,
      departmentName,
      protocolNumber,
      commission,
      generatorEmployeeUid,
      lawyerConclusionMode,
      lawyerDecisionTypeCode,
      timezone,
    ]
  );

  const selectTemplate = (template: { id?: string }) => {
    if (!template.id) return;
    setPickerOpen(false);
    setTemplateLoading(true);
    setTemplateError(null);
    setMissingRequired(new Set());
    Promise.all(
      explanationMode
        ? [documentApi.getExplanationTemplate(caseId), documentApi.getExplanationTemplateFileBlob(caseId)]
        : decisionActMode
          ? [documentApi.getDecisionActTemplate(caseId), documentApi.getDecisionActTemplateFileBlob(caseId)]
          : lawyerConclusionMode
            ? [documentApi.getLawyerConclusionTemplate(caseId), documentApi.getLawyerConclusionTemplateFileBlob(caseId)]
            : [documentApi.getTemplateById(template.id), documentApi.getTemplateFileBlob(template.id)]
    )
      .then(([full, blob]) => {
        setSelectedTemplate(full);
        setPreviewBlob(blob);
        const initial: Record<string, string> = {};
        const initialMoments: Record<string, Moment> = {};
        const unresolved = new Set<string>();
        const initialSelections: Record<string, string[]> = {};
        const commissionUids = activeCommissionMembers(ctx.commission)
          .map((m) => m.employeeUid)
          .filter((u): u is string => Boolean(u));
        (full.placeholders || []).forEach((p) => {
          if (!p.key) return;
          if (p.autoFillSource) {
            if (p.autoFillSource === "COMMISSION_MEMBERS_LIST") initialSelections[p.key] = commissionUids;
            if (p.autoFillSource === "COMMISSION_MEMBER") initialSelections[p.key] = commissionUids.slice(0, 1);
            const computed = computeAutoFillValue(
              p.autoFillSource,
              ctx,
              p.grammaticalCase,
              parseAutoFillParams(p.autoFillParams),
              { memberUids: initialSelections[p.key] }
            );
            initial[p.key] = computed;
            if (!computed) unresolved.add(p.key);
            if (autoFillFieldKind(p.autoFillSource, parseAutoFillParams(p.autoFillParams)) !== "text") {
              initialMoments[p.key] = seedMoment(p.autoFillSource, ctx) ?? { date: "", time: "" };
            }
          } else {
            initial[p.key] = "";
          }
        });
        setFieldValues(initial);
        setMemberSelections(initialSelections);
        setMomentRaw(initialMoments);
        setUnresolvedAutoFillKeys(unresolved);
      })
      .catch((err) => {
        console.error("Ошибка загрузки шаблона:", err);
        setTemplateError(getErrorMessage(err, "Не удалось загрузить выбранный шаблон"));
      })
      .finally(() => setTemplateLoading(false));
  };

  useEffect(() => {
    if (restrictedMode) {
      let cancelled = false;
      (explanationMode
        ? documentApi.getExplanationTemplate(caseId)
        : lawyerConclusionMode
          ? documentApi.getLawyerConclusionTemplate(caseId)
          : documentApi.getDecisionActTemplate(caseId)
      )
        .then((t) => {
          if (!cancelled) selectTemplate(t);
        })
        .catch((err) => {
          console.error("Ошибка загрузки шаблона документа:", err);
          if (!cancelled) setResolveError(getErrorMessage(err, "Не удалось загрузить шаблон документа"));
        })
        .finally(() => {
          if (!cancelled) setResolving(false);
        });
      return () => {
        cancelled = true;
      };
    }
    if (!purposeCode) return;
    let cancelled = false;
    documentApi
      .getPurposes()
      .then((purposes) => {
        if (cancelled) return;
        const found = purposes.find((p) => p.code === purposeCode) || null;
        const override = found?.violationTemplates?.find((vt) => vt.violationTypeCode === violationTypeCode)?.template;
        const resolved = override || found?.template || null;
        if (resolved && resolved.isActive !== false && resolved.id) {
          selectTemplate(resolved);
        } else {
          setPickerOpen(true);
        }
      })
      .catch((err) => {
        console.error("Ошибка загрузки назначений шаблонов:", err);
        if (!cancelled) {
          setResolveError(getErrorMessage(err, "Не удалось определить назначенный шаблон — выберите его вручную"));
          setPickerOpen(true);
        }
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    if (missingRequired.has(key)) {
      setMissingRequired((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleMemberSelection = (placeholder: { key?: string; autoFillSource?: string; grammaticalCase?: string | null; autoFillParams?: string | null }, uids: string[]) => {
    const key = placeholder.key;
    if (!key) return;
    setMemberSelections((prev) => ({ ...prev, [key]: uids }));
    handleFieldChange(
      key,
      computeAutoFillValue(
        placeholder.autoFillSource,
        ctx,
        placeholder.grammaticalCase,
        parseAutoFillParams(placeholder.autoFillParams),
        { memberUids: uids }
      )
    );
  };

  const handleMomentChange = (
    placeholder: { key?: string; autoFillSource?: string; autoFillParams?: string | null },
    patch: Partial<Moment>
  ) => {
    const key = placeholder.key;
    const dateSource = parseDateSource(placeholder.autoFillSource, parseAutoFillParams(placeholder.autoFillParams));
    if (!key || !dateSource) return;
    const next: Moment = { date: "", time: "", ...momentRaw[key], ...patch };
    setMomentRaw((prev) => ({ ...prev, [key]: next }));
    handleFieldChange(key, formatMoment(next, dateSource.format));
  };

  useEffect(() => {
    if (!previewContainerRef.current) return;
    syncPlaceholderValues(previewContainerRef.current, (key) => fieldValues[key] || "");
  }, [fieldValues]);

  const focusField = (key: string) => {
    const el = document.getElementById(`field-${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
  };

  const handleGenerate = async () => {
    if (!selectedTemplate?.id) return;
    const placeholders = selectedTemplate.placeholders || [];
    const missing = new Set(
      placeholders.filter((p) => p.key && p.isRequired && !(fieldValues[p.key] || "").trim()).map((p) => p.key as string)
    );
    if (missing.size > 0) {
      setMissingRequired(missing);
      setGenerateError("Заполните обязательные поля, отмеченные ниже");
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    try {
      if (explanationMode) {
        await documentApi.generateExplanationDocument(caseId, fieldValues);
      } else if (decisionActMode) {
        await documentApi.generateDecisionAct(caseId, fieldValues);
      } else if (lawyerConclusionMode) {
        await documentApi.generateLawyerConclusion(caseId, fieldValues, lawyerDecisionTypeCode);
      } else {
        await documentApi.generateDocument(
          {
            templateId: selectedTemplate.id,
            fieldValues,
            caseId,
            employeeUid,
            purposeCode,
          },
          generateUuidV4()
        );
      }
      setGenerated(true);
      queryClient.invalidateQueries({ queryKey: ["caseDocuments", caseId] });
      queryClient.invalidateQueries({ queryKey: ["explanation", caseId] });
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["caseLogs", caseId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardActionRequired"] });
      queryClient.invalidateQueries({ queryKey: ["casesList"] });
      onGenerated?.();
    } catch (err) {
      console.error("Ошибка формирования документа:", err);
      setGenerateError(getErrorMessage(err, "Не удалось сформировать документ"));
    } finally {
      setIsGenerating(false);
    }
  };

  const placeholders = selectedTemplate?.placeholders || [];

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg rounded-lg border border-bd w-full h-full max-w-[1600px] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-bd shrink-0">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold text-tx">{title}</h3>
            <span className="text-[12px] text-tx2 truncate block">
              Дело {caseNumber || ""}{violatorFullName ? ` · ${violatorFullName}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {generated ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors cursor-pointer"
              >
                Готово
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors cursor-pointer"
              >
                {cancelLabel}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          {previewBlob && !pickerOpen ? (
            <DocxViewer
              data={previewBlob}
              onRendered={(container) => {
                previewContainerRef.current = container;
                highlightPlaceholders(container, {
                  getValue: (key) => fieldValues[key] || "",
                  onPlaceholderClick: focusField,
                });
              }}
            />
          ) : (
            <div className="flex-1 min-w-0 flex items-center justify-center text-[14px] text-tx2 p-6 text-center">
              {resolving || templateLoading
                ? "Загрузка шаблона..."
                : pickerOpen
                  ? "Выберите шаблон в панели справа"
                  : "Шаблон не выбран"}
            </div>
          )}

          <div className="w-[380px] shrink-0 border-l border-bd overflow-y-auto p-4 flex flex-col gap-3 bg-bg">
            {resolveError && <div className="text-[13px] text-dgl">{resolveError}</div>}

            {generated ? (
              <div className="flex flex-col items-center text-center gap-2 py-8">
                <span className="text-prl">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" /></svg>
                </span>
                <div className="text-[14px] font-medium text-tx">Документ сформирован</div>
                <div className="text-[13px] text-tx2">
                  {explanationMode
                    ? "Он прикреплён к объяснению. Закройте окно и проверьте всё, что будет отправлено, перед подписанием."
                    : decisionActMode
                      ? "Акт прикреплён к делу, дело переведено в статус «Решение принято»."
                      : lawyerConclusionMode
                        ? lawyerDecisionTypeCode
                          ? "Заключение прикреплено к делу, взыскание назначено, дело переведено в статус «Решение принято»."
                          : "Заключение прикреплено к делу, дело закрыто без взыскания."
                        : "Он уже прикреплён к делу — найдёте его на странице дела, во вкладке «Документы»."}
                </div>
              </div>
            ) : pickerOpen ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium text-tx">Выбор шаблона</div>
                  {selectedTemplate && (
                    <button type="button" onClick={() => setPickerOpen(false)} className="text-[12px] font-medium text-prl hover:text-prt cursor-pointer">
                      Отмена
                    </button>
                  )}
                </div>
                <TemplatePicker violationTypeCode={violationTypeCode} onSelect={selectTemplate} />
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-tx truncate">{selectedTemplate?.name}</div>
                    <div className="text-[11px] text-tx2 truncate">{selectedTemplate?.originalFilename}</div>
                  </div>
                  {!restrictedMode && (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="shrink-0 text-[12px] font-medium text-prl hover:text-prt cursor-pointer"
                    >
                      Выбрать другой
                    </button>
                  )}
                </div>

                {templateError && <div className="text-[13px] text-dgl">{templateError}</div>}

                {templateLoading ? (
                  <div className="text-[13px] text-tx2">Загрузка полей...</div>
                ) : placeholders.length === 0 ? (
                  <div className="text-[13px] text-tx2">В этом шаблоне нет полей для заполнения.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {placeholders.map((p) => {
                      if (!p.key) return null;
                      const key = p.key;
                      const value = fieldValues[key] || "";
                      const isEditable = !p.autoFillSource || p.autoFillEditable || unresolvedAutoFillKeys.has(key);
                      const isMissing = missingRequired.has(key);
                      const label = p.autoFillSource ? getAutoFillLabel(p.autoFillSource, parseAutoFillParams(p.autoFillParams)) : key;
                      const commissionMembers = activeCommissionMembers(commission);
                      const isMemberList = p.autoFillSource === "COMMISSION_MEMBERS_LIST";
                      const isMemberPick = p.autoFillSource === "COMMISSION_MEMBER";
                      const kind = p.autoFillSource ? autoFillFieldKind(p.autoFillSource, parseAutoFillParams(p.autoFillParams)) : "text";
                      const inputClass = `w-full min-h-[36px] border rounded-inp px-2 py-1.5 text-[13px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10 ${isMissing ? "border-dg" : "border-bd"}`;
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <label htmlFor={`field-${key}`} className="text-[12px] text-tx2 flex items-center gap-1">
                            {label}
                            {p.isRequired && <span className="text-dgl">*</span>}
                          </label>
                          {(isMemberList || isMemberPick) && commissionMembers.length > 0 && (
                            isMemberList ? (
                              <MembersCheckboxDropdown
                                members={commissionMembers}
                                selected={memberSelections[key] ?? []}
                                onChange={(uids) => handleMemberSelection(p, uids)}
                              />
                            ) : (
                              <select
                                aria-label="Участник комиссии"
                                className="w-full min-h-[34px] border border-bd rounded-inp px-2 py-1 text-[12px] bg-bg outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
                                value={(memberSelections[key] ?? [])[0] ?? ""}
                                onChange={(e) => handleMemberSelection(p, e.target.value ? [e.target.value] : [])}
                              >
                                <option value="">— Выберите участника —</option>
                                {commissionMembers.map((m) =>
                                  m.employeeUid ? (
                                    <option key={m.employeeUid} value={m.employeeUid}>
                                      {memberOptionLabel(m)}
                                    </option>
                                  ) : null
                                )}
                              </select>
                            )
                          )}
                          {(isMemberList || isMemberPick) && commissionMembers.length === 0 && (
                            <span className="text-[11px] text-tx2">
                              Данные комиссии доступны после её окончания — заполните поле вручную.
                            </span>
                          )}
                          {isEditable ? (
                            kind === "date" ? (
                              <>
                                <input
                                  id={`field-${key}`}
                                  type="date"
                                  className={inputClass}
                                  value={momentRaw[key]?.date || ""}
                                  onChange={(e) => handleMomentChange(p, { date: e.target.value })}
                                />
                                <span className="text-[11px] text-tx2">В документе: {value || "—"}</span>
                              </>
                            ) : kind === "time" ? (
                              <>
                                <input
                                  id={`field-${key}`}
                                  type="time"
                                  className={inputClass}
                                  value={momentRaw[key]?.time || ""}
                                  onChange={(e) => handleMomentChange(p, { time: e.target.value })}
                                />
                                <span className="text-[11px] text-tx2">В документе: {value || "—"}</span>
                              </>
                            ) : (
                              <input
                                id={`field-${key}`}
                                type="text"
                                className={inputClass}
                                value={value}
                                onChange={(e) => handleFieldChange(key, e.target.value)}
                              />
                            )
                          ) : (
                            <div
                              id={`field-${key}`}
                              tabIndex={-1}
                              className="w-full min-h-[36px] border border-bd bg-ntbg rounded-inp px-2 py-1.5 text-[13px] text-tx2 flex items-center outline-none focus:ring-3 focus:ring-pr/30"
                            >
                              {value || "—"}
                            </div>
                          )}
                          {isMissing && <span className="text-[11px] text-dgl">Обязательное поле</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {generateError && <div className="text-[13px] text-dgl">{generateError}</div>}

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || templateLoading || !selectedTemplate}
                  className="mt-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? "Формирование..." : "Сформировать документ"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
