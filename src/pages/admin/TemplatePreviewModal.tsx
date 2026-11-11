import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DocxViewer } from "@shared/ui/DocumentViewers";
import { documentApi } from "@shared/api";
import {
  AUTO_FILL_SOURCE_GROUPS,
  DATE_CATEGORIES,
  DATE_FORMATS,
  NAME_FORMS,
  NAME_SUBJECTS,
  VOTING_STAGES,
  buildNameSource,
  getAutoFillLabel,
  getAutoFillSource,
  getDateFormatLabel,
  parseDateSource,
  parseNameSource,
  pickerValueOf,
  sourceKind,
  type DateFormat,
  type NameForm,
} from "@entities/document/autoFillSources";
import { GRAMMATICAL_CASES, isDeclinableSource } from "@entities/document/grammaticalCases";
import { highlightPlaceholders, syncPlaceholderMapping } from "@entities/document/highlightPlaceholders";
import type { AutoFillParams, PlaceholderAutoFillSetting } from "@shared/types/api";
import { getErrorMessage } from "@shared/utils/errorMessage";

const SELECT_SMALL =
  "w-full min-h-[32px] border border-bd rounded-inp px-2 py-1 text-[12px] bg-bg outline-none focus:border-pr focus:ring-3 focus:ring-pr/10";

function describeParams(setting: PlaceholderAutoFillSetting): string {
  const kind = sourceKind(setting.source, setting.params);
  if (kind === "date") {
    const parsed = parseDateSource(setting.source, setting.params);
    return parsed ? getDateFormatLabel(parsed.format) : "";
  }
  if (kind === "votes") {
    return VOTING_STAGES.find((st) => st.code === (setting.params?.stage ?? 1))?.label ?? "";
  }
  if (kind === "memberList") {
    const form = setting.params?.nameForm === "SHORT" ? "ФИО с инициалами" : "ФИО";
    return `${form}${setting.params?.includePosition ? ", с должностью" : ""} — через запятую`;
  }
  return "";
}

function SourceSettings({
  setting,
  onNameFormChange,
  onDateFormatChange,
  onParamsChange,
  onCaseChange,
}: {
  setting: PlaceholderAutoFillSetting;
  onNameFormChange: (form: NameForm) => void;
  onDateFormatChange: (format: DateFormat) => void;
  onParamsChange: (patch: AutoFillParams) => void;
  onCaseChange: (grammaticalCase: string) => void;
}) {
  const kind = sourceKind(setting.source, setting.params);
  const nameSource = parseNameSource(setting.source, setting.params);
  const caseSelect = isDeclinableSource(setting.source) && (
    <select
      className={SELECT_SMALL}
      aria-label="Падеж"
      value={setting.grammaticalCase || "NOMINATIVE"}
      onChange={(e) => onCaseChange(e.target.value)}
    >
      {GRAMMATICAL_CASES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );

  if (kind === "name" && nameSource) {
    return (
      <>
        <select
          className={SELECT_SMALL}
          aria-label={nameSource.subject.label}
          value={nameSource.form}
          onChange={(e) => onNameFormChange(e.target.value as NameForm)}
        >
          {NAME_FORMS.map((f) => (
            <option key={f.code} value={f.code}>
              {f.label}
            </option>
          ))}
        </select>
        {caseSelect}
        {nameSource.subject.prefix === null && (
          <div className="text-[11px] leading-[15px] text-tx2">Участника комиссии выберет составитель при формировании документа.</div>
        )}
      </>
    );
  }

  const dateSource = parseDateSource(setting.source, setting.params);
  if (kind === "date" && dateSource) {
    return (
      <select
        className={SELECT_SMALL}
        aria-label={dateSource.category.label}
        value={dateSource.format}
        onChange={(e) => onDateFormatChange(e.target.value as DateFormat)}
      >
        {DATE_FORMATS.map((f) => (
          <option key={f.code} value={f.code}>
            {f.label}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "memberList") {
    return (
      <>
        <select
          className={SELECT_SMALL}
          aria-label="Формат имён"
          value={setting.params?.nameForm === "SHORT" ? "SHORT" : "FULL"}
          onChange={(e) => onParamsChange({ nameForm: e.target.value as NameForm })}
        >
          <option value="FULL">ФИО (Иванов Иван Иванович)</option>
          <option value="SHORT">ФИО с инициалами (И. И. Иванов)</option>
        </select>
        {caseSelect}
        <label className="flex items-center gap-2 text-[12px] text-tx2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="accent-pr"
            checked={setting.params?.includePosition ?? false}
            onChange={(e) => onParamsChange({ includePosition: e.target.checked })}
          />
          Добавлять должность
        </label>
        <div className="text-[11px] leading-[15px] text-tx2">
          Имена идут через запятую. Каких участников указать, отметит составитель при формировании документа.
        </div>
      </>
    );
  }

  if (kind === "votes") {
    return (
      <select
        className={SELECT_SMALL}
        aria-label="Этап голосования"
        value={setting.params?.stage ?? 1}
        onChange={(e) => onParamsChange({ stage: Number(e.target.value) as 1 | 2 })}
      >
        {VOTING_STAGES.map((st) => (
          <option key={st.code} value={st.code}>
            {st.label}
          </option>
        ))}
      </select>
    );
  }

  return caseSelect || null;
}

function defaultParamsFor(source: string): AutoFillParams | undefined {
  const kind = sourceKind(source);
  if (kind === "memberList") return { nameForm: "FULL", includePosition: false };
  if (kind === "votes") return { stage: 1 };
  return undefined;
}

export function TemplatePreviewModal({
  file,
  mapping,
  onMappingChange,
  onClose,
  readOnly = false,
  placeholders: knownPlaceholders,
  onSave,
  isSaving = false,
  error: saveError,
}: {
  file: File;
  mapping: Record<string, PlaceholderAutoFillSetting>;
  onMappingChange: (mapping: Record<string, PlaceholderAutoFillSetting>) => void;
  onClose: () => void;
  readOnly?: boolean;
  placeholders?: string[];
  onSave?: () => void;
  isSaving?: boolean;
  error?: string | null;
}) {
  const [placeholders, setPlaceholders] = useState<string[]>(knownPlaceholders || []);
  const [isLoadingPlaceholders, setIsLoadingPlaceholders] = useState(!readOnly);
  const [placeholdersError, setPlaceholdersError] = useState<string | null>(null);

  const previewContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    setIsLoadingPlaceholders(true);
    setPlaceholdersError(null);
    documentApi
      .previewTemplate(file)
      .then((result) => {
        if (cancelled) return;
        const found = result.placeholders || [];
        setPlaceholders(found);
        onMappingChange(Object.fromEntries(Object.entries(mapping).filter(([key]) => found.includes(key))));
      })
      .catch((err) => {
        console.error("Ошибка получения списка плейсхолдеров:", err);
        if (!cancelled) setPlaceholdersError(getErrorMessage(err, "Не удалось получить список плейсхолдеров"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlaceholders(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, readOnly]);

  const mappedCount = Object.values(mapping).filter((m) => m.source).length;

  const handleSourceChange = (key: string, source: string) => {
    if (!source) {
      const isRequired = mapping[key]?.isRequired;
      if (isRequired === false) {
        onMappingChange({ ...mapping, [key]: { isRequired: false } });
      } else {
        const rest = { ...mapping };
        delete rest[key];
        onMappingChange(rest);
      }
      return;
    }
    const subject = NAME_SUBJECTS.find((n) => n.pickerCode === source);
    if (subject) {
      const currentForm = parseNameSource(mapping[key]?.source, mapping[key]?.params)?.form ?? "FULL";
      const built = buildNameSource(subject, currentForm);
      onMappingChange({
        ...mapping,
        [key]: { ...mapping[key], source: built.source, params: built.params, editable: subject.defaultEditable },
      });
      return;
    }
    const dateCategory = DATE_CATEGORIES.find((c) => c.code === source);
    if (dateCategory) {
      const currentFormat = parseDateSource(mapping[key]?.source, mapping[key]?.params)?.format ?? "FULL";
      onMappingChange({
        ...mapping,
        [key]: {
          ...mapping[key],
          source: dateCategory.code,
          params: { dateFormat: currentFormat },
          editable: dateCategory.defaultEditable,
          grammaticalCase: undefined,
        },
      });
      return;
    }
    onMappingChange({
      ...mapping,
      [key]: {
        ...mapping[key],
        source,
        editable: getAutoFillSource(source)?.defaultEditable ?? true,
        params: defaultParamsFor(source),
        grammaticalCase: isDeclinableSource(source) ? mapping[key]?.grammaticalCase : undefined,
      },
    });
  };

  const handleNameFormChange = (key: string, form: NameForm) => {
    const current = mapping[key];
    const parsed = parseNameSource(current?.source, current?.params);
    if (!current || !parsed) return;
    const built = buildNameSource(parsed.subject, form);
    onMappingChange({ ...mapping, [key]: { ...current, source: built.source, params: built.params } });
  };

  const handleDateFormatChange = (key: string, format: DateFormat) => {
    const current = mapping[key];
    const parsed = parseDateSource(current?.source, current?.params);
    if (!current || !parsed) return;
    onMappingChange({ ...mapping, [key]: { ...current, source: parsed.category.code, params: { dateFormat: format } } });
  };

  const handleParamsChange = (key: string, patch: AutoFillParams) => {
    if (!mapping[key]) return;
    onMappingChange({ ...mapping, [key]: { ...mapping[key], params: { ...mapping[key].params, ...patch } } });
  };

  const handleCaseChange = (key: string, grammaticalCase: string) => {
    if (!mapping[key]) return;
    onMappingChange({ ...mapping, [key]: { ...mapping[key], grammaticalCase } });
  };

  const isFieldRequired = (key: string) => mapping[key]?.isRequired !== false;

  const handleRequiredChange = (key: string, isRequired: boolean) => {
    onMappingChange({ ...mapping, [key]: { ...mapping[key], isRequired } });
  };

  useEffect(() => {
    if (!previewContainerRef.current) return;
    syncPlaceholderMapping(previewContainerRef.current, (key) => Boolean(mapping[key]?.source));
  }, [mapping]);

  const focusField = (key: string) => {
    const el = document.getElementById(`mapping-field-${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-bg rounded-lg border border-bd w-full h-full max-w-[1600px] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-bd shrink-0">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold text-tx">Предпросмотр шаблона</h3>
            <span className="text-[12px] text-tx2 truncate block">{file.name}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {onSave ? (
              <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors cursor-pointer disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors cursor-pointer"
              >
                Готово
              </button>
            )}
          </div>
        </div>

        {saveError && <div className="px-4 py-2 text-[13px] text-dgl border-b border-bd bg-dg/5 shrink-0">{saveError}</div>}

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <DocxViewer
            data={file}
            onRendered={(container) => {
              previewContainerRef.current = container;
              highlightPlaceholders(container, {
                isMapped: (key) => Boolean(mapping[key]?.source),
                onPlaceholderClick: focusField,
              });
            }}
          />

          <div className="w-[380px] shrink-0 border-l border-bd overflow-y-auto p-4 flex flex-col gap-3 bg-bg">
            <div className="text-[13px] font-medium text-tx">Автозаполнение плейсхолдеров</div>
            {isLoadingPlaceholders ? (
              <div className="text-[13px] text-tx2">Поиск плейсхолдеров...</div>
            ) : placeholdersError ? (
              <div className="text-[13px] text-dgl">{placeholdersError}</div>
            ) : placeholders.length === 0 ? (
              <div className="text-[13px] text-tx2">Плейсхолдеры вида {"{{ключ}}"} не найдены.</div>
            ) : (
              <>
                <div className="text-[12px] text-tx2">
                  Найдено: {placeholders.length}. Сопоставлено: {mappedCount}.
                </div>
                <div className="flex flex-col gap-3">
                  {placeholders.map((key) =>
                    readOnly ? (
                      <div
                        key={key}
                        id={`mapping-field-${key}`}
                        tabIndex={-1}
                        className="flex items-start justify-between gap-3 rounded-inp outline-none focus:ring-3 focus:ring-pr/30"
                      >
                        <span className="font-mono text-[12px] text-tx2 break-all" title={key}>
                          {key}
                        </span>
                        <span className="text-[12px] text-tx text-right shrink-0 max-w-[55%]">
                          {mapping[key]?.source ? (
                            <>
                              {getAutoFillLabel(mapping[key].source, mapping[key].params)}
                              {describeParams(mapping[key]) && (
                                <span className="block text-tx2">{describeParams(mapping[key])}</span>
                              )}
                              {isDeclinableSource(mapping[key].source) && (
                                <span className="block text-tx2">
                                  {GRAMMATICAL_CASES.find((c) => c.code === mapping[key].grammaticalCase)?.label ||
                                    "Именительный (кто? что?)"}
                                </span>
                              )}
                              <span className="block text-tx2">{mapping[key].editable ? "можно править" : "не редактируется"}</span>
                            </>
                          ) : (
                            "вручную"
                          )}
                          <span className="block text-tx2">{isFieldRequired(key) ? "обязательное" : "необязательное"}</span>
                        </span>
                      </div>
                    ) : (
                      <div key={key} className="flex flex-col gap-1">
                        <span className="font-mono text-[12px] text-tx2 truncate" title={key}>
                          {key}
                        </span>
                        <select
                          id={`mapping-field-${key}`}
                          className="w-full min-h-[36px] border border-bd rounded-inp px-2 py-1.5 text-[13px] bg-bg outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
                          value={pickerValueOf(mapping[key])}
                          onChange={(e) => handleSourceChange(key, e.target.value)}
                        >
                          <option value="">— Заполняется вручную —</option>
                          {AUTO_FILL_SOURCE_GROUPS.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.options.map((o) => (
                                <option key={o.code} value={o.code}>
                                  {o.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {mapping[key]?.source && (
                          <SourceSettings
                            setting={mapping[key]}
                            onNameFormChange={(form) => handleNameFormChange(key, form)}
                            onDateFormatChange={(format) => handleDateFormatChange(key, format)}
                            onParamsChange={(patch) => handleParamsChange(key, patch)}
                            onCaseChange={(c) => handleCaseChange(key, c)}
                          />
                        )}
                        {mapping[key]?.source && (
                          <label className="flex items-center gap-2 text-[12px] text-tx2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="accent-pr"
                              checked={mapping[key].editable ?? true}
                              onChange={(e) => onMappingChange({ ...mapping, [key]: { ...mapping[key], editable: e.target.checked } })}
                            />
                            Можно править при генерации
                          </label>
                        )}
                        <label className="flex items-center gap-2 text-[12px] text-tx2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="accent-pr"
                            checked={isFieldRequired(key)}
                            onChange={(e) => handleRequiredChange(key, e.target.checked)}
                          />
                          Обязательное поле
                        </label>
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
