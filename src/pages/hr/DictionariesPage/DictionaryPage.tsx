import { useCallback, useState, useEffect, useRef, type FormEvent } from "react";
import { dictionaryApi } from "@entities/dictionary/dictionaryApi";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { useViolationTypesStore } from "@shared/model/violationTypesStore";
import { useCommissionTypesStore } from "@shared/model/commissionTypesStore";
import { useDecisionTypesStore } from "@shared/model/decisionTypesStore";
import { useRolesStore } from "@shared/model/rolesStore";
import { FadeSwap } from "@shared/ui/FadeSwap";
import { formatServerDate } from "@shared/utils/datetime";
import { generateUuidV4 } from "@shared/utils/uuid";
import type {
  ViolationTypeBriefResponse,
  CommissionTypeResponse,
  DecisionTypeResponse,
  VotingRule,
  DecisionCategory,
  EditViolationTypeRequest,
  EditCommissionTypeRequest,
  EditDecisionTypeRequest,
  CreateViolationTypeRequest,
  CreateCommissionTypeRequest,
  CreateDecisionTypeRequest
} from "@shared/types/api";
import { showAlert } from "@shared/ui/dialogs";
import { ErrorState } from "@shared/ui/ErrorState";
import { getErrorMessage } from "@shared/utils/errorMessage";

const REFERENCE_TABS = [
  { id: "violations", label: "Виды нарушений" },
  { id: "commissions", label: "Типы комиссий" },
  { id: "decisions", label: "Виды решений" },
];

const TAB_WRITE_PERMISSIONS: Record<string, string> = {
  violations: "dictionary:violations:write",
  commissions: "dictionary:commission:write",
  decisions: "dictionary:decision:write",
};

const TAB_READ_PERMISSIONS: Record<string, string> = {
  violations: "dictionary:violations:read",
  commissions: "dictionary:commission:read",
  decisions: "dictionary:decision:read",
};

const VOTING_RULE_LABELS: Record<VotingRule | string, string> = {
  MAJORITY: "Простое большинство",
  QUALIFIED_MAJORITY: "Квалифицированное большинство",
  UNANIMOUS: "Единогласно",
  CONSENSUS: "Консенсус",
};

const DECISION_CATEGORY_LABELS: Record<DecisionCategory | string, string> = {
  DISCIPLINARY: "Дисциплинарное",
  MONETARY: "Материальное",
  TERMINATION: "Увольнение",
  PREVENTIVE: "Профилактическое",
  PERSONNEL: "Кадровое",
  DEVELOPMENT: "Развитие",
};

const SEVERITY_LEVEL_LABELS: Record<string, string> = {
  LOW: "Низкая",
  MEDIUM: "Средняя",
  HIGH: "Высокая",
  CRITICAL: "Критическая",
};

type EditableItem = ViolationTypeBriefResponse | CommissionTypeResponse | DecisionTypeResponse;

interface RequiredRoleFormItem {
  roleCode: string;
  minCount: number;
  isMandatory: boolean;
}

const NEW_ITEM_DEFAULTS: Record<string, any> = {
  violations: { name: "", article: "", severityLevelCode: "LOW", isActive: true },
  commissions: { name: "", description: "", quorumMin: null, votingRule: "MAJORITY", isActive: true, requiredRoles: [] as RequiredRoleFormItem[] },
  decisions: { name: "", category: "DISCIPLINARY", requiredComment: false, isActive: true },
};

function getInitialFormData(activeTab: string, item: any, isCreate: boolean): any {
  if (isCreate) return { ...item };
  if (activeTab === "violations") {
    return { ...item, severityLevelCode: item.severity?.code || "" };
  }
  if (activeTab === "commissions") {
    return { ...item, requiredRoles: item.requiredRoles ? Array.from(item.requiredRoles as RequiredRoleFormItem[]) : [] };
  }
  return { ...item };
}

function RequiredRolesEditor({ roles, onChange }: { roles: RequiredRoleFormItem[]; onChange: (roles: RequiredRoleFormItem[]) => void }) {
  const allRoles = useRolesStore((s) => s.roles);
  const ensureRolesLoaded = useRolesStore((s) => s.ensureLoaded);

  useEffect(() => {
    ensureRolesLoaded().catch(() => {});
  }, [ensureRolesLoaded]);

  const updateRow = (idx: number, patch: Partial<RequiredRoleFormItem>) => {
    onChange(roles.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRow = (idx: number) => onChange(roles.filter((_, i) => i !== idx));
  const addRow = () => onChange([...roles, { roleCode: "", minCount: 1, isMandatory: true }]);

  return (
    <div>
      <label className="block text-[14px] font-medium text-tx mb-1">Обязательные роли в составе комиссии</label>
      <div className="flex flex-col gap-2">
        {roles.map((r, idx) => {
          const hasUnknownCode = r.roleCode && !allRoles.some((role) => role.code === r.roleCode);
          return (
            <div key={idx} className="flex items-center gap-2">
              <select
                required
                className="flex-1 min-w-0 min-h-[36px] border border-bd rounded-inp px-2 py-1.5 text-[13px] bg-bg focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
                value={r.roleCode}
                onChange={(e) => updateRow(idx, { roleCode: e.target.value })}
              >
                <option value="" disabled>Выберите роль...</option>
                {hasUnknownCode && <option value={r.roleCode}>{r.roleCode}</option>}
                {allRoles.map((role) => (
                  <option key={role.id} value={role.code}>{role.name}</option>
                ))}
              </select>
              <input required type="number" min={1} placeholder="Кол-во" className="w-[70px] shrink-0 min-h-[36px] border border-bd rounded-inp px-2 py-1.5 text-[13px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
                value={r.minCount} onChange={(e) => updateRow(idx, { minCount: Number(e.target.value) || 1 })} />
              <label className="flex items-center gap-1 shrink-0 text-[12px] text-tx2">
                <input type="checkbox" className="w-4 h-4 text-prl rounded border-bd focus:ring-pr/10"
                  checked={r.isMandatory} onChange={(e) => updateRow(idx, { isMandatory: e.target.checked })} />
                Обязательна
              </label>
              <button type="button" onClick={() => removeRow(idx)} className="shrink-0 text-dgl hover:text-dgt text-[13px] font-medium">Удалить</button>
            </div>
          );
        })}
        {roles.length === 0 && <div className="text-[12px] text-tx2">Добавьте хотя бы одну роль — без этого комиссию сохранить нельзя.</div>}
        <button type="button" onClick={addRow} className="self-start px-3 py-1.5 rounded-inp font-medium text-[13px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors">
          + Добавить роль
        </button>
      </div>
    </div>
  );
}

function EditModal({
  activeTab,
  item,
  isCreate = false,
  onClose,
  onSave,
  onCreate,
}: {
  activeTab: string;
  item: EditableItem;
  isCreate?: boolean;
  onClose: () => void;
  onSave: (id: string, data: any) => Promise<void>;
  onCreate: (data: any) => Promise<void>;
}) {
  const [formData, setFormData] = useState<any>(() => getInitialFormData(activeTab, item, isCreate));
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isCreate && activeTab === "commissions" && (!formData.requiredRoles || formData.requiredRoles.length === 0)) {
      showAlert("Добавьте хотя бы одну обязательную роль в составе комиссии");
      return;
    }

    setIsSaving(true);
    try {
      if (isCreate) {
        await onCreate(formData);
      } else {
        const itemId = (item as any).id || (item as any).code;
        await onSave(itemId, formData);
      }
      onClose();
    } catch (err) {
      console.error("Ошибка сохранения:", err);
      showAlert(getErrorMessage(err, "Не удалось сохранить изменения"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[18px] font-bold text-tx">{isCreate ? "Новая запись" : "Редактирование записи"}</h3>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {activeTab === "violations" && (
            <>
              <div>
                <label className="block text-[14px] font-medium text-tx mb-1">Наименование</label>
                <input required className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
                  value={formData.name || ""} onChange={(e) => handleChange("name", e.target.value)} />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-tx mb-1">Статья ТК РФ</label>
                <input className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
                  value={formData.article || ""} onChange={(e) => handleChange("article", e.target.value)} />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-tx mb-1">Тяжесть</label>
                <select required className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none bg-bg"
                  value={formData.severityLevelCode || ""} onChange={(e) => handleChange("severityLevelCode", e.target.value)}>
                  {Object.entries(SEVERITY_LEVEL_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" className="w-4 h-4 text-prl rounded border-bd focus:ring-pr/10"
                  checked={formData.isActive} onChange={(e) => handleChange("isActive", e.target.checked)} />
                <label htmlFor="isActive" className="text-[14px] text-tx">Активно</label>
              </div>
            </>
          )}

          {activeTab === "commissions" && (
            <>
              <div>
                <label className="block text-[14px] font-medium text-tx mb-1">Наименование</label>
                <input required className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
                  value={formData.name || ""} onChange={(e) => handleChange("name", e.target.value)} />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-tx mb-1">Описание</label>
                <textarea className="w-full min-h-[80px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none resize-y"
                  value={formData.description || ""} onChange={(e) => handleChange("description", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[14px] font-medium text-tx mb-1">Кворум (чел.)</label>
                  <input type="number" className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
                    value={formData.quorumMin || ""} onChange={(e) => handleChange("quorumMin", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div>
                  <label className="block text-[14px] font-medium text-tx mb-1">Правило голосования</label>
                  <select className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none bg-bg"
                    value={formData.votingRule || "MAJORITY"} onChange={(e) => handleChange("votingRule", e.target.value)}>
                    {Object.entries(VOTING_RULE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <RequiredRolesEditor roles={formData.requiredRoles || []} onChange={(roles) => handleChange("requiredRoles", roles)} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActiveComm" className="w-4 h-4 text-prl rounded border-bd focus:ring-pr/10"
                  checked={formData.isActive} onChange={(e) => handleChange("isActive", e.target.checked)} />
                <label htmlFor="isActiveComm" className="text-[14px] text-tx">Активно</label>
              </div>
            </>
          )}

          {activeTab === "decisions" && (
            <>
              <div>
                <label className="block text-[14px] font-medium text-tx mb-1">Название</label>
                <input required maxLength={255} placeholder="Например: Выговор"
                  className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
                  value={formData.name || ""} onChange={(e) => handleChange("name", e.target.value)} />
                <div className="mt-1 text-[12px] text-tx2">Показывается в интерфейсе и подставляется в документы (например, в акт о решении).</div>
              </div>
              <div>
                <label className="block text-[14px] font-medium text-tx mb-1">Категория</label>
                <select className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none bg-bg"
                  value={formData.category || ""} onChange={(e) => handleChange("category", e.target.value)}>
                  {Object.entries(DECISION_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="reqComment" className="w-4 h-4 text-prl rounded border-bd focus:ring-pr/10"
                    checked={formData.requiredComment} onChange={(e) => handleChange("requiredComment", e.target.checked)} />
                  <label htmlFor="reqComment" className="text-[14px] text-tx">Обязательный комментарий</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActiveDec" className="w-4 h-4 text-prl rounded border-bd focus:ring-pr/10"
                    checked={formData.isActive} onChange={(e) => handleChange("isActive", e.target.checked)} />
                  <label htmlFor="isActiveDec" className="text-[14px] text-tx">Активно</label>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 mt-4 pt-4 border-t border-bd">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors" disabled={isSaving}>
              Отмена
            </button>
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled={isSaving}>
              {isSaving ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Сохранение...</>
              ) : isCreate ? "Создать" : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DictionaryTableSkeleton() {
  return (
    <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden animate-pulse">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[44%]" /><col className="w-[23%]" />
          <col className="w-[20%]" /><col className="w-[13%]" />
        </colgroup>
        <thead>
          <tr>
            {Array.from({ length: 4 }).map((_, i) => (
              <th key={i} className="text-left py-2 px-2 sm:px-3 bg-bg border-b border-bd">
                <div className="h-3.5 w-20 bg-skel rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td className="py-2 px-2 sm:px-3 border-b border-bd/70 align-middle">
                <div className="h-4 w-48 bg-skel rounded" />
              </td>
              <td className="py-2 px-2 sm:px-3 border-b border-bd/70 align-middle">
                <div className="h-4 w-28 bg-skel rounded" />
              </td>
              <td className="py-2 px-2 sm:px-3 border-b border-bd/70 align-middle">
                <div className="h-4 w-24 bg-skel rounded" />
              </td>
              <td className="py-2 px-2 sm:px-3 border-b border-bd/70 align-middle text-right">
                <div className="h-4 w-16 bg-skel rounded ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableState({ loading, error, onRetry, children }: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (loading) return <div className="w-full border border-bd rounded-lg bg-bg p-8 text-center text-tx2 text-[14px]">Загрузка данных...</div>;
  if (error) return (
    <div className="w-full border border-bd rounded-lg bg-bg">
      <ErrorState compact message={error} onRetry={onRetry} />
    </div>
  );
  return <>{children}</>;
}

function ViolationsTable({ violationTypes, onEdit, canEdit }: { violationTypes: ViolationTypeBriefResponse[], onEdit: (item: ViolationTypeBriefResponse) => void, canEdit: boolean }) {
  return (
    <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup><col className="w-[44%]" /><col className="w-[23%]" /><col className="w-[20%]" /><col className="w-[13%]" /></colgroup>
        <thead>
          <tr>
            <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap">Наименование</th>
            <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap">Статья ТК</th>
            <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap">Тяжесть</th>
            <th className="text-right font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap"><span className="sr-only">Действия</span></th>
          </tr>
        </thead>
        <tbody>
          {violationTypes.length === 0 ? (<tr><td colSpan={4} className="text-center py-8 text-tx2">Виды нарушений не найдены</td></tr>) : (
            violationTypes.map((v) => (
              <tr key={v.code} className="hover:bg-surf transition-colors">
                <td className={`py-2 px-2 sm:px-3 border-b border-bd/70 align-middle min-w-0 ${v.isActive ? "" : "opacity-60"}`}>
                  <span className="text-[13px] sm:text-[14px] leading-[20px] text-tx font-medium break-words">
                    {v.name}
                    {!v.isActive && <span className="ml-2 text-[11px] font-normal text-tx2">Неактивно</span>}
                  </span>
                </td>
                <td className={`py-2 px-2 sm:px-3 border-b border-bd/70 align-middle min-w-0 ${v.isActive ? "" : "opacity-60"}`}><span className="text-[13px] sm:text-[14px] leading-[20px] text-tx2 break-words">{v.article || "—"}</span></td>
                <td className={`py-2 px-2 sm:px-3 border-b border-bd/70 align-middle min-w-0 ${v.isActive ? "" : "opacity-60"}`}><span className="text-[13px] sm:text-[14px] leading-[20px] text-tx break-words">{v.severity?.name || "—"}</span></td>
                <td className="py-2 px-2 sm:px-3 border-b border-bd/70 align-middle text-right min-w-0 whitespace-nowrap">
                  {canEdit && <button type="button" onClick={() => onEdit(v)} className="text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors">Изменить</button>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CommissionsTable({ commissionTypes, onEdit, canEdit }: { commissionTypes: CommissionTypeResponse[], onEdit: (item: CommissionTypeResponse) => void, canEdit: boolean }) {
  return (
    <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup><col className="w-[41%]" /><col className="w-[25%]" /><col className="w-[22%]" /><col className="w-[12%]" /></colgroup>
        <thead>
          <tr>
            <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap">Наименование</th>
            <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap">Голосование</th>
            <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap">Кворум</th>
            <th className="text-right font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap"><span className="sr-only">Действия</span></th>
          </tr>
        </thead>
        <tbody>
          {commissionTypes.length === 0 ? (<tr><td colSpan={4} className="text-center py-8 text-tx2">Типы комиссий не найдены</td></tr>) : (
            commissionTypes.map((c) => (
              <tr key={c.id} className="hover:bg-surf transition-colors">
                <td className={`py-2 px-2 sm:px-3 border-b border-bd/70 align-middle min-w-0 ${c.isActive ? "" : "opacity-60"}`}>
                  <div className="font-medium text-[13px] sm:text-[14px] leading-[20px] text-tx break-words">
                    {c.name}
                    {!c.isActive && <span className="ml-2 text-[11px] font-normal text-tx2">Неактивно</span>}
                  </div>
                  {c.description && <div className="text-[12px] leading-[16px] text-tx2 mt-0.5 break-words line-clamp-2">{c.description}</div>}
                </td>
                <td className={`py-2 px-2 sm:px-3 border-b border-bd/70 align-middle min-w-0 ${c.isActive ? "" : "opacity-60"}`}><span className="text-[13px] sm:text-[14px] leading-[20px] text-tx break-words">{c.votingRule ? (VOTING_RULE_LABELS[c.votingRule] || c.votingRule) : "—"}</span></td>
                <td className={`py-2 px-2 sm:px-3 border-b border-bd/70 align-middle min-w-0 whitespace-nowrap text-[13px] sm:text-[14px] leading-[20px] text-tx ${c.isActive ? "" : "opacity-60"}`}>{c.quorumMin != null ? `${c.quorumMin} чел.` : "—"}</td>
                <td className="py-2 px-2 sm:px-3 border-b border-bd/70 align-middle text-right min-w-0 whitespace-nowrap">
                  {canEdit && <button type="button" onClick={() => onEdit(c)} className="text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors">Изменить</button>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DecisionsTable({ decisionTypes, onEdit, canEdit }: { decisionTypes: DecisionTypeResponse[], onEdit: (item: DecisionTypeResponse) => void, canEdit: boolean }) {
  const { timezone } = useTimezoneStore();
  const formatDate = (iso?: string) => formatServerDate(iso, timezone);
  return (
    <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup><col className="w-[30%]" /><col className="w-[28%]" /><col className="w-[22%]" /><col className="w-[20%]" /></colgroup>
        <thead>
          <tr>
            <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap">Название</th>
            <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap">Действует с / по</th>
            <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap">Коммент.</th>
            <th className="text-right font-medium text-[12px] leading-[16px] text-tx2 py-2 px-2 sm:px-3 bg-bg border-b border-bd whitespace-nowrap"><span className="sr-only">Действия</span></th>
          </tr>
        </thead>
        <tbody>
          {decisionTypes.length === 0 ? (<tr><td colSpan={4} className="text-center py-8 text-tx2">Виды решений не найдены</td></tr>) : (
            decisionTypes.map((d) => (
              <tr key={d.id} className="hover:bg-surf transition-colors">
                <td className={`py-2 px-2 sm:px-3 border-b border-bd/70 align-middle min-w-0 ${d.isActive ? "" : "opacity-60"}`}>
                  <span className="text-[13px] sm:text-[14px] leading-[20px] text-tx font-medium break-words">
                    {d.name || d.code || "—"}
                    {!d.isActive && <span className="ml-2 text-[11px] font-normal text-tx2">Неактивно</span>}
                  </span>
                  <span className="block text-[12px] leading-[16px] text-tx2 font-normal">
                    {d.category ? (DECISION_CATEGORY_LABELS[d.category] || d.category) : "—"}
                  </span>
                </td>
                <td className={`py-2 px-2 sm:px-3 border-b border-bd/70 align-middle min-w-0 whitespace-nowrap text-[12px] sm:text-[13px] leading-[18px] text-tx ${d.isActive ? "" : "opacity-60"}`}><div>с {formatDate(d.validFrom)}</div><div className="text-tx2">по {formatDate(d.validTo)}</div></td>
                <td className={`py-2 px-2 sm:px-3 border-b border-bd/70 align-middle min-w-0 ${d.isActive ? "" : "opacity-60"}`}>
                  {d.requiredComment ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-wnt whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-wn shrink-0" />
                      Обязателен
                    </span>
                  ) : (
                    <span className="text-[13px] text-tx2 whitespace-nowrap">— Нет</span>
                  )}
                </td>
                <td className="py-2 px-2 sm:px-3 border-b border-bd/70 align-middle text-right min-w-0 whitespace-nowrap">
                  {canEdit && <button type="button" onClick={() => onEdit(d)} className="text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors">Изменить</button>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function DirectoriesPage() {
  const { hasPermission } = useAuthStore();

  const visibleTabs = REFERENCE_TABS.filter((tab) => {
    const writePerm = TAB_WRITE_PERMISSIONS[tab.id];
    const readPerm = TAB_READ_PERMISSIONS[tab.id];
    return hasPermission(writePerm) || hasPermission(readPerm);
  });

  const [activeTab, setActiveTab] = useState<string>(() => visibleTabs[0]?.id ?? "violations");

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

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
  }, [activeTab, visibleTabs.length]);

  const canEditActiveTab = hasPermission(TAB_WRITE_PERMISSIONS[activeTab]);

  const violationTypes = useViolationTypesStore((s) => s.violationTypes);
  const isViolationTypesLoaded = useViolationTypesStore((s) => s.isLoaded);
  const violationTypesError = useViolationTypesStore((s) => s.error);
  const ensureViolationTypesLoaded = useViolationTypesStore((s) => s.ensureLoaded);
  const refreshViolationTypes = useViolationTypesStore((s) => s.refresh);

  const commissionTypes = useCommissionTypesStore((s) => s.commissionTypes);
  const isCommissionTypesLoaded = useCommissionTypesStore((s) => s.isLoaded);
  const commissionTypesError = useCommissionTypesStore((s) => s.error);
  const ensureCommissionTypesLoaded = useCommissionTypesStore((s) => s.ensureLoaded);
  const refreshCommissionTypes = useCommissionTypesStore((s) => s.refresh);

  const decisionTypes = useDecisionTypesStore((s) => s.decisionTypes);
  const isDecisionTypesLoaded = useDecisionTypesStore((s) => s.isLoaded);
  const decisionTypesError = useDecisionTypesStore((s) => s.error);
  const ensureDecisionTypesLoaded = useDecisionTypesStore((s) => s.ensureLoaded);
  const refreshDecisionTypes = useDecisionTypesStore((s) => s.refresh);

  const isFirstLoadActiveTab =
    (activeTab === "violations" && !isViolationTypesLoaded) ||
    (activeTab === "commissions" && !isCommissionTypesLoaded) ||
    (activeTab === "decisions" && !isDecisionTypesLoaded);

  const error =
    (activeTab === "violations" && violationTypesError) ||
    (activeTab === "commissions" && commissionTypesError) ||
    (activeTab === "decisions" && decisionTypesError) ||
    null;

  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchData = useCallback(async () => {
    if (activeTab === "violations") {
      await refreshViolationTypes();
    } else if (activeTab === "commissions") {
      await refreshCommissionTypes();
    } else if (activeTab === "decisions") {
      await refreshDecisionTypes();
    }
  }, [activeTab, refreshViolationTypes, refreshCommissionTypes, refreshDecisionTypes]);

  const handleSaveEdit = async (id: string, data: any) => {
    if (activeTab === "violations") {
      await dictionaryApi.editViolationType(id, data as EditViolationTypeRequest);
    } else if (activeTab === "commissions") {
      await dictionaryApi.editCommissionType(id, data as EditCommissionTypeRequest);
    } else if (activeTab === "decisions") {
      await dictionaryApi.editDecisionType(id, data as EditDecisionTypeRequest);
    }
    await fetchData();
  };

  const handleCreate = async (data: any) => {
    const idempotencyKey = generateUuidV4();

    if (activeTab === "violations") {
      await dictionaryApi.createViolationType(data as CreateViolationTypeRequest, idempotencyKey);
      await refreshViolationTypes();
    } else if (activeTab === "commissions") {
      await dictionaryApi.createCommissionType(data as CreateCommissionTypeRequest, idempotencyKey);
      await refreshCommissionTypes();
    } else if (activeTab === "decisions") {
      await dictionaryApi.createDecisionType(data as CreateDecisionTypeRequest, idempotencyKey);
      await refreshDecisionTypes();
    }
  };

  useEffect(() => {
    if (activeTab === "violations") {
      ensureViolationTypesLoaded().catch(() => {});
    } else if (activeTab === "commissions") {
      ensureCommissionTypesLoaded().catch(() => {});
    } else if (activeTab === "decisions") {
      ensureDecisionTypesLoaded().catch(() => {});
    }
  }, [activeTab, ensureViolationTypesLoaded, ensureCommissionTypesLoaded, ensureDecisionTypesLoaded]);

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-semibold text-tx">Справочники системных настроек</h1>
          <div className="text-[13px] leading-[18px] text-tx2 mt-1">Управление типами нарушений, правилами комиссий и видами принимаемых решений.</div>
        </div>
        {canEditActiveTab && (
          <button
            className="w-full sm:w-auto px-4 py-2.5 rounded-inp font-medium text-[14px] leading-[20px] bg-pr text-white border border-transparent hover:bg-prh transition-colors cursor-pointer"
            onClick={() => setIsCreating(true)}
          >
            Добавить запись
          </button>
        )}
      </div>

      {visibleTabs.length > 0 && (
        <div
          ref={tabsContainerRef}
          className="relative flex gap-1 border-b border-bd mb-3 overflow-x-auto scrollbar-thin"
        >
          {visibleTabs.map((tab) => (
            <button key={tab.id} type="button"
              ref={(el) => { tabRefs.current[tab.id] = el; }}
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
      )}

      {visibleTabs.length === 0 ? (
        <div className="w-full border border-bd rounded-lg bg-bg p-8 text-center text-tx2">
          У вас нет доступа к справочникам системных настроек.
        </div>
      ) : error ? (
        <TableState loading={false} error={error} onRetry={fetchData}>
          <></>
        </TableState>
      ) : (
        <FadeSwap
          showSkeleton={isFirstLoadActiveTab}
          skeleton={<DictionaryTableSkeleton />}
        >
          <div className="w-full">
            {activeTab === "violations" && <ViolationsTable violationTypes={violationTypes} onEdit={setEditingItem} canEdit={canEditActiveTab} />}
            {activeTab === "commissions" && <CommissionsTable commissionTypes={commissionTypes} onEdit={setEditingItem} canEdit={canEditActiveTab} />}
            {activeTab === "decisions" && <DecisionsTable decisionTypes={decisionTypes} onEdit={setEditingItem} canEdit={canEditActiveTab} />}
          </div>
        </FadeSwap>
      )}

      {editingItem && (
        <EditModal
          activeTab={activeTab}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEdit}
          onCreate={handleCreate}
        />
      )}

      {isCreating && (
        <EditModal
          activeTab={activeTab}
          item={NEW_ITEM_DEFAULTS[activeTab] as EditableItem}
          onCreate={handleCreate}
          onSave={handleSaveEdit}
          isCreate
          onClose={() => setIsCreating(false)}
        />
      )}
    </div>
  );
}