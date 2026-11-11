import { useMemo, useState, useEffect } from "react";
import { caseApi } from "@/entities/case/api/caseApi";
import { employeeApi } from "@/entities/employee/api/employeeApi";
import { userApi } from "@/entities/user/userApi";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import Avatar from "@shared/ui/Avatar";
import { useDebounce } from "@shared/hooks/useDebounce";
import { getFileTypeStyle } from "@shared/utils/fileType";
import { formatServerDate } from "@shared/utils/datetime";
import type { CaseAssigneeResponse, CaseAssigneeRole, CaseDocumentResponse, EmployeeResponse } from "@shared/types/api";
import { ASSIGNABLE_CASE_ROLES, ASSIGNEE_ROLE_LABELS } from "@shared/utils/caseAssigneeRole";
import { showAlert, showConfirm } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";
import { EmployeeLink } from "@shared/ui/EmployeeLink";

interface ExtendedAssignee extends CaseAssigneeResponse {
  position?: string;
  department?: string;
}

interface ParticipantsTabProps {
  caseId: string;
  assignees: ExtendedAssignee[];
  documents: CaseDocumentResponse[];
  onRefetch: () => void;
}

const ROLE_LABELS = ASSIGNEE_ROLE_LABELS;

const ROLE_VARIANTS: Record<string, string> = {
  VIOLATOR: "bg-dgbg text-dgt",
  INITIATOR: "bg-ntbg text-tx",
  MEMBER: "bg-ntbg text-tx",
  COMMISSION_SECRETARY: "bg-pr/10 text-prl",
  LAWYER: "bg-pr/10 text-prl",
  DEPARTMENT_HEAD: "bg-ntbg text-tx",
};

const ASSIGNABLE_ROLES: CaseAssigneeRole[] = ASSIGNABLE_CASE_ROLES;

function AddParticipantForm({
  caseId,
  onClose,
  onAdded,
}: {
  caseId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmployeeResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<EmployeeResponse | null>(null);
  const [role, setRole] = useState<CaseAssigneeRole>("MEMBER");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const page = await employeeApi.searchEmployees(debouncedQuery.trim());
        setResults(page.content || []);
      } catch (err) {
        console.error("Ошибка поиска сотрудников:", err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  const handleSubmit = async () => {
    if (!selected?.uid) return;
    setIsSubmitting(true);
    try {
      await caseApi.addCaseAssignee(caseId, { employeeUid: selected.uid, role });
      onAdded();
      onClose();
    } catch (err) {
      console.error("Ошибка добавления участника:", err);
      showAlert(getErrorMessage(err, "Не удалось добавить участника"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 p-4 border border-bd rounded-card bg-surf flex flex-col gap-3 self-start !min-h-0 h-fit">
      {!selected ? (
        <>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-bd rounded-inp px-3 py-2 text-[14px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
              placeholder="ФИО или таб. номер сотрудника (начните вводить)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto min-h-[40px]">
            {isSearching && debouncedQuery.trim() && (
              <div className="text-[13px] text-tx2 px-1 py-2">Поиск...</div>
            )}
            {!isSearching && results.length > 0 && (
              results.map((emp) => (
                <button
                  key={emp.uid}
                  type="button"
                  className="text-left px-3 py-2 rounded-inp hover:bg-bg border border-transparent hover:border-bd transition-colors text-[14px] text-tx flex items-center gap-2.5"
                  onClick={() => setSelected(emp)}
                >
                  <Avatar
                    avatarUrl={emp.uid ? userApi.employeeAvatarUrl(emp.uid) : null}
                    name={emp.fullName || "?"}
                    size={28}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{emp.fullName}</span>
                    {emp.position && <span className="text-tx2"> · {emp.position}</span>}
                    {emp.tabNumber && <span className="text-tx2"> · таб. №{emp.tabNumber}</span>}
                  </span>
                </button>
              ))
            )}
            {!isSearching && !results.length && debouncedQuery.trim() && (
              <div className="text-[13px] text-tx2 px-1 py-2">
                Ничего не найдено по запросу «{debouncedQuery}»
              </div>
            )}
            {!isSearching && !debouncedQuery.trim() && (
              <div className="text-[13px] text-tx2 px-1 py-2">
                Начните вводить ФИО или табельный номер
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5 text-[14px] text-tx">
            <Avatar
              avatarUrl={selected.uid ? userApi.employeeAvatarUrl(selected.uid) : null}
              name={selected.fullName || "?"}
              size={36}
            />
            <div className="min-w-0">
              <div>
                Выбран: <span className="font-medium">{selected.fullName}</span>
                {selected.tabNumber && <span className="text-tx2"> · таб. №{selected.tabNumber}</span>}
              </div>
              {selected.position && <div className="text-[12px] text-tx2 truncate">{selected.position}</div>}
            </div>
          </div>
          <select
            className="border border-bd rounded-inp px-3 py-2 text-[14px] bg-bg outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
            value={role}
            onChange={(e) => setRole(e.target.value as CaseAssigneeRole)}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </>
      )}

      <div className="flex gap-2 justify-end mt-2">
        <button
          type="button"
          className="px-3 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors"
          onClick={onClose}
        >
          Отмена
        </button>
        {selected && (
          <button
            type="button"
            className="px-3 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Добавление..." : "Добавить"}
          </button>
        )}
      </div>
    </div>
  );
}

export function ParticipantsTab({ caseId, assignees, documents, onRefetch }: ParticipantsTabProps) {
  const { hasPermission } = useAuthStore();
  const { timezone } = useTimezoneStore();
  const canManageAssignees = hasPermission("case:assign") && hasPermission("case:write");

  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return assignees;
    return assignees.filter(
      (m) =>
        m.fullName?.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.position?.toLowerCase().includes(q)
    );
  }, [assignees, searchQuery]);

  const caseManagers = assignees.filter((a) => a.role === "COMMISSION_SECRETARY");

  const formatDate = (isoString?: string) => formatServerDate(isoString, timezone);

  const handleRemove = async (member: ExtendedAssignee) => {
    if (!member.id) return;
    if (!(await showConfirm(`Исключить ${member.fullName || "участника"} из дела?`, { title: "Исключение участника", confirmLabel: "Исключить", danger: true }))) return;
    setRemovingId(member.id);
    try {
      await caseApi.removeCaseAssignee(caseId, member.id);
      onRefetch();
    } catch (err) {
      console.error("Ошибка исключения участника:", err);
      showAlert(getErrorMessage(err, "Не удалось исключить участника"));
    } finally {
      setRemovingId(null);
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

  return (
    <div className="flex flex-col gap-4 w-full">

      <div className="bg-bg border border-bd rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] leading-[24px] font-medium text-tx m-0">Участники дела</h3>
          <span className="text-[12px] leading-[16px] text-tx2">
            Всего: {assignees.length}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 mb-4 border border-bd rounded-inp bg-surf focus-within:border-pr focus-within:ring-3 focus-within:ring-pr/10 transition-colors">
          <svg className="shrink-0 text-tx2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="flex-1 border-none outline-none bg-transparent text-[14px] leading-[20px] text-tx placeholder:text-txm"
            placeholder="Поиск по ФИО, должности или подразделению"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="w-full border border-bd rounded-card overflow-x-auto">
          <table className="w-full table-auto border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2.5 px-3 bg-bg border-b border-bd whitespace-nowrap">Сотрудник</th>
                <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2.5 px-3 bg-bg border-b border-bd whitespace-nowrap w-[180px]">Роль в деле</th>
                <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2.5 px-3 bg-bg border-b border-bd whitespace-nowrap w-[140px]">Дата назначения</th>
                <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2.5 px-3 bg-bg border-b border-bd whitespace-nowrap w-[100px]">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-tx2">
                    Участники не найдены
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-surf transition-colors">
                    <td className="py-2.5 px-3 border-b border-line align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          avatarUrl={member.employeeUid ? userApi.employeeAvatarUrl(member.employeeUid) : null}
                          name={member.fullName || "?"}
                          size={32}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-[14px] leading-[20px] text-tx truncate">
                            <EmployeeLink employeeUid={member.employeeUid}>
                              {member.fullName || "Сотрудник не указан"}
                            </EmployeeLink>
                          </div>
                          <div className="text-[12px] leading-[16px] text-tx2 truncate">
                            {member.position || "Должность не указана"}
                            {member.department && ` · ${member.department}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-b border-line align-middle">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-[12px] font-medium leading-[16px] whitespace-nowrap ${ROLE_VARIANTS[member.role || ""] || "bg-ntbg text-tx"}`}>
                        {ROLE_LABELS[member.role || ""] || member.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 border-b border-line align-middle whitespace-nowrap text-[14px] leading-[20px] text-tx">
                      {formatDate(member.assignedAt)}
                    </td>
                    <td className="py-2.5 px-3 border-b border-line align-middle">
                      {canManageAssignees && member.role !== "VIOLATOR" && (
                        <button
                          className="text-[14px] leading-[20px] font-medium text-dgl hover:text-dgt cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!member.id || removingId === member.id}
                          onClick={() => handleRemove(member)}
                        >
                          {removingId === member.id ? "Исключение..." : "Исключить"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {canManageAssignees && (
          <>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                className="px-3 py-2 rounded-inp font-medium text-[14px] leading-[20px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors cursor-pointer"
                onClick={() => setIsAdding((v) => !v)}
              >
                Добавить участника
              </button>
            </div>

            {isAdding && (
              <AddParticipantForm
                caseId={caseId}
                onClose={() => setIsAdding(false)}
                onAdded={onRefetch}
              />
            )}
          </>
        )}
      </div>

      {caseManagers.length > 0 && (
        <div className="bg-bg border border-bd rounded-card p-5">
          <h3 className="text-[16px] leading-[24px] font-medium text-tx mb-3">Ответственные за ведение дела</h3>
          <div className="flex flex-col gap-3">
            {caseManagers.map(manager => (
              <div key={manager.id} className="p-4 rounded-card bg-acl border border-acb text-prt flex gap-3 items-start">
                <span className="shrink-0 mt-0.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5M12 8v.5" />
                  </svg>
                </span>
                <div>
                  <div className="font-medium text-[14px] leading-[20px] mb-1">
                    {manager.fullName} — {manager.position || "Должность не указана"}
                  </div>
                  <div className="text-[13px] leading-[18px] opacity-90">
                    Роль: {ROLE_LABELS[manager.role || ""]}. Координирует процесс и несет ответственность за соблюдение сроков.
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-bg border border-bd rounded-card p-5">
        <h3 className="text-[16px] leading-[24px] font-medium text-tx mb-3">Материалы дела</h3>

        {documents.length === 0 ? (
          <div className="p-4 rounded-card bg-ntbg border border-bd text-tx flex gap-3 items-start">
            <span className="shrink-0 text-lg">📎</span>
            <div>
              <div className="font-medium text-[14px] leading-[20px] mb-1">Материалы отсутствуют</div>
              <div className="text-[13px] leading-[18px] opacity-80">Добавьте документы во вкладке "Документы".</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 border border-bd rounded-inp bg-bg hover:border-pr/50 transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${getFileTypeStyle(doc.originalFilename).badgeClass}`}>
                  {getFileTypeStyle(doc.originalFilename).label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[14px] leading-[20px] text-tx truncate" title={doc.originalFilename}>
                    {doc.originalFilename || "Без названия"}
                  </div>
                  <div className="text-[12px] leading-[16px] text-tx2">
                    {formatDate(doc.uploadedAt)}
                  </div>
                </div>
                {doc.downloadUrl && (
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    className="text-[14px] leading-[20px] font-medium text-prl hover:text-prt cursor-pointer transition-colors shrink-0"
                  >
                    Открыть
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}