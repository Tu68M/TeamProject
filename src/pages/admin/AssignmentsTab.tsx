import { Fragment, useEffect, useState } from "react";
import { documentApi } from "@shared/api";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { formatServerDate } from "@shared/utils/datetime";
import { FadeSwap } from "@shared/ui/FadeSwap";
import { useViolationTypes } from "@entities/document/useViolationTypes";
import type { DocumentPurposeResponse, DocumentTemplateResponse } from "@shared/types/api";
import { showAlert } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

export function AssignmentsTabSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-4 w-96 bg-skel rounded" />

      <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup><col className="w-[36%]" /><col className="w-[42%]" /><col className="w-[22%]" /></colgroup>
          <thead>
            <tr>
              {Array.from({ length: 3 }).map((_, i) => (
                <th key={i} className="text-left py-2 px-3 bg-bg border-b border-bd">
                  <div className="h-3.5 w-24 bg-skel rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="py-2 px-3 border-b border-bd/70 align-middle">
                  <div className="h-4 w-40 bg-skel rounded" />
                  <div className="h-3 w-56 bg-skel rounded mt-1" />
                </td>
                <td className="py-2 px-3 border-b border-bd/70 align-middle">
                  <div className="h-9 w-full bg-skel rounded-inp" />
                </td>
                <td className="py-2 px-3 border-b border-bd/70 align-middle text-right">
                  <div className="h-4 w-20 bg-skel rounded ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SELECT_CLASS =
  "w-full min-h-[36px] border border-bd rounded-inp px-2 py-1.5 text-[13px] bg-bg outline-none disabled:opacity-60 disabled:bg-ntbg";

export function AssignmentsTab({ canWrite }: { canWrite: boolean }) {
  const [purposes, setPurposes] = useState<DocumentPurposeResponse[]>([]);
  const [allTemplates, setAllTemplates] = useState<DocumentTemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [expandedPurposes, setExpandedPurposes] = useState<Set<string>>(new Set());

  const { timezone } = useTimezoneStore();
  const { violationTypes } = useViolationTypes();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [purposesData, templatesPage] = await Promise.all([
        documentApi.getPurposes(),
        documentApi.getTemplates({ page: 0, size: 100 }),
      ]);
      setPurposes(purposesData);
      setAllTemplates(templatesPage.content || []);
    } catch (err) {
      console.error("Ошибка загрузки назначений шаблонов:", err);
      setError(getErrorMessage(err, "Не удалось загрузить назначения шаблонов"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveAssignment = async (key: string, request: () => Promise<DocumentPurposeResponse>) => {
    setSavingKey(key);
    try {
      const updated = await request();
      setPurposes((prev) => prev.map((p) => (p.code === updated.code ? updated : p)));
    } catch (err) {
      console.error("Ошибка назначения шаблона:", err);
      showAlert(getErrorMessage(err, "Не удалось сохранить назначение шаблона"));
    } finally {
      setSavingKey(null);
    }
  };

  const handleAssignDefault = (code: string, templateId: string | null) =>
    saveAssignment(code, () => documentApi.setPurposeTemplate(code, templateId));

  const handleAssignViolation = (code: string, violationTypeCode: string, templateId: string | null) =>
    saveAssignment(`${code}:${violationTypeCode}`, () =>
      documentApi.setPurposeViolationTemplate(code, violationTypeCode, templateId)
    );

  const toggleExpanded = (code: string) =>
    setExpandedPurposes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const activeTemplates = allTemplates.filter((t) => t.isActive);
  const generalTemplates = activeTemplates.filter((t) => !t.violationTypeCode);

  if (error) return <div className="w-full border border-bd rounded-lg bg-bg p-8 text-center text-dgl text-[14px]">{error}</div>;

  return (
    <FadeSwap
      showSkeleton={loading && purposes.length === 0}
      skeleton={<AssignmentsTabSkeleton />}
    >
      <div className="flex flex-col gap-4">
        <div className="text-[13px] text-tx2">
          Шаблон по умолчанию используется для всех видов нарушений. Для конкретного вида нарушения можно назначить
          свой шаблон — он будет использован вместо шаблона по умолчанию.
        </div>

        <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup><col className="w-[36%]" /><col className="w-[42%]" /><col className="w-[22%]" /></colgroup>
            <thead>
              <tr>
                <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd whitespace-nowrap">Назначение</th>
                <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd whitespace-nowrap">Шаблон</th>
                <th className="text-right font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd whitespace-nowrap">Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {purposes.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-8 text-tx2">Назначения не найдены</td></tr>
              ) : (
                purposes.map((p) => {
                  const code = p.code || "";
                  const currentId = p.template?.id || "";
                  const currentInactive = Boolean(p.template && !activeTemplates.some((t) => t.id === p.template!.id));
                  const overrides = new Map((p.violationTemplates || []).map((v) => [v.violationTypeCode || "", v.template]));
                  const isExpanded = expandedPurposes.has(code);
                  const defaultLabel = p.template ? p.template.name : "не назначен";

                  return (
                    <Fragment key={code}>
                      <tr className="hover:bg-surf transition-colors">
                        <td className="py-2 px-3 border-b border-bd/70 align-middle min-w-0">
                          <div className="font-medium text-[14px] text-tx break-words">{p.name}</div>
                          {p.description && <div className="text-[12px] text-tx2 mt-0.5 break-words">{p.description}</div>}
                          {violationTypes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(code)}
                              aria-expanded={isExpanded}
                              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-prl hover:text-prt cursor-pointer"
                            >
                              <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="9 6 15 12 9 18" />
                              </svg>
                              По видам нарушений{overrides.size > 0 ? ` (настроено: ${overrides.size})` : ""}
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-3 border-b border-bd/70 align-middle min-w-0">
                          <select
                            disabled={!canWrite || savingKey === code}
                            value={currentId}
                            onChange={(e) => code && handleAssignDefault(code, e.target.value || null)}
                            className={SELECT_CLASS}
                          >
                            <option value="">— Не назначено —</option>
                            {currentInactive && p.template && (
                              <option value={p.template.id}>{p.template.name} (деактивирован)</option>
                            )}
                            {generalTemplates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name} · {t.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 border-b border-bd/70 align-middle text-right whitespace-nowrap text-[12px] text-tx2">
                          {savingKey === code ? "Сохранение…" : p.updatedAt ? formatServerDate(p.updatedAt, timezone) : "—"}
                        </td>
                      </tr>

                      {isExpanded &&
                        violationTypes.map((v) => {
                          const assigned = overrides.get(v.code);
                          const key = `${code}:${v.code}`;
                          const assignedInactive = Boolean(assigned && !activeTemplates.some((t) => t.id === assigned.id));
                          const candidates = activeTemplates.filter((t) => !t.violationTypeCode || t.violationTypeCode === v.code);
                          return (
                            <tr key={v.code} className="bg-surf/60">
                              <td className="py-1.5 pl-8 pr-3 border-b border-bd/70 align-middle min-w-0 text-[13px] text-tx break-words">{v.name}</td>
                              <td className="py-1.5 px-3 border-b border-bd/70 align-middle min-w-0">
                                <select
                                  disabled={!canWrite || savingKey === key}
                                  value={assigned?.id || ""}
                                  onChange={(e) => code && handleAssignViolation(code, v.code, e.target.value || null)}
                                  className={SELECT_CLASS}
                                >
                                  <option value="">— По умолчанию ({defaultLabel}) —</option>
                                  {assignedInactive && assigned && (
                                    <option value={assigned.id}>{assigned.name} (деактивирован)</option>
                                  )}
                                  {candidates.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name} · {t.code}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1.5 px-3 border-b border-bd/70 align-middle text-right whitespace-nowrap text-[12px] text-tx2">
                                {savingKey === key ? "Сохранение…" : assigned ? "свой шаблон" : ""}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </FadeSwap>
  );
}
