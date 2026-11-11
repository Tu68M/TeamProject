import { useEffect, useRef, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { commissionApi } from "@/entities/commission/api/commissionApi";
import { employeeApi } from "@/entities/employee/api/employeeApi";
import { useCommissionTypesStore } from "@shared/model/commissionTypesStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { useDebounce } from "@shared/hooks/useDebounce";
import { localDateTimeInputToServerString, parseServerDateTime } from "@shared/utils/datetime";
import type { CaseAssigneeResponse, CommissionMemberRole, CommissionResponse, EmployeeResponse } from "@shared/types/api";
import { getAssigneeRoleLabel } from "@shared/utils/caseAssigneeRole";
import Avatar from "@shared/ui/Avatar";
import { userApi } from "@entities/user/userApi";
import { COMMISSION_MEMBER_ROLE_LABELS, getVotingRuleLabel } from "@shared/utils/commissionStatus";
import { getErrorMessage } from "@shared/utils/errorMessage";

interface DraftMember {
  employeeUid: string;
  fullName: string;
  roles: Set<CommissionMemberRole>;
}

interface CreateCommissionModalProps {
  caseId: string;
  violationTypeCode?: string;
  caseAssignees: CaseAssigneeResponse[];
  onClose: () => void;
  onCreated: (commission: CommissionResponse) => void;
}

const commissionSchema = z.object({
  commissionTypeId: z.string().min(1, "Выберите тип комиссии"),
  stage1VotingDeadline: z.string().min(1, "Укажите срок 1-го этапа"),
  stage2VotingDeadline: z.string().min(1, "Укажите срок 2-го этапа"),
  reason: z.string().optional(),
});

type CommissionFormValues = z.infer<typeof commissionSchema>;

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 5000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="fixed top-4 right-4 z-[100] max-w-sm">
      <div className="flex items-start gap-3 p-4 rounded-card bg-dgbg border border-dg/30 shadow-lg">
        <span className="shrink-0 mt-0.5 text-dgt">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
        <div className="flex-1 min-w-0 text-[13px] leading-[18px] text-dgt">
          {message}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-dgt hover:text-dgl transition-colors"
          aria-label="Закрыть"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function MemberPicker({
  onPick,
  excludedUids,
}: {
  onPick: (employee: EmployeeResponse) => void;
  excludedUids: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const [hasFocused, setHasFocused] = useState(false);
  const [baseEmployees, setBaseEmployees] = useState<EmployeeResponse[]>([]);
  const [isLoadingBase, setIsLoadingBase] = useState(false);

  const [searchResults, setSearchResults] = useState<EmployeeResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const handleFocus = () => {
    setIsOpen(true);
    if (hasFocused) return;
    setHasFocused(true);
    setIsLoadingBase(true);
    employeeApi
      .getEmployees({ size: 8 })
      .then((page) => setBaseEmployees(page?.content || []))
      .catch((err) => {
        console.error("Ошибка загрузки списка сотрудников:", err);
        setBaseEmployees([]);
      })
      .finally(() => setIsLoadingBase(false));
  };

  useEffect(() => {
    setIsSearching(Boolean(query.trim()));
  }, [query]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    employeeApi
      .searchEmployees(trimmed)
      .then((page) => {
        if (cancelled) return;
        setSearchResults(page?.content || []);
      })
      .catch((err) => {
        console.error("Ошибка поиска сотрудников:", err);
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const handlePick = (emp: EmployeeResponse) => {
    if (!emp.uid) return;
    onPick(emp);
    setQuery("");
    setSearchResults([]);
    setIsOpen(false);
  };

  const filteredEmployees = query.trim() ? searchResults : baseEmployees;
  const isLoading = query.trim() ? isSearching : isLoadingBase;

  return (
    <div className="relative flex flex-col gap-2">
      <input
        className="w-full border border-bd rounded-inp px-3 py-2 text-[14px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
        placeholder="Начните вводить ФИО или должность сотрудника"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
      />

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg border border-bd rounded-inp shadow-lg max-h-60 overflow-y-auto z-10">
          {isLoading ? (
            <div className="px-3 py-2 text-[13px] text-tx2">Поиск...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="px-3 py-2 text-[13px] text-tx2">
              {query.trim() ? `Ничего не найдено по запросу «${query.trim()}»` : "Сотрудники не найдены"}
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const already = Boolean(emp.uid && excludedUids.has(emp.uid));
              return (
                <button
                  key={emp.uid}
                  type="button"
                  disabled={already}
                  className="w-full text-left px-3 py-2 hover:bg-surf border-b border-line last:border-b-0 transition-colors text-[14px] text-tx disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2.5"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!already) handlePick(emp);
                  }}
                >
                  <Avatar
                    avatarUrl={emp.uid ? userApi.employeeAvatarUrl(emp.uid) : null}
                    name={emp.fullName || "?"}
                    size={24}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{emp.fullName}</span>
                    {emp.position && <span className="text-tx2"> · {emp.position}</span>}
                    {emp.tabNumber && <span className="text-tx2"> · таб. № {emp.tabNumber}</span>}
                    {already && <span className="text-tx2"> (уже добавлен)</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function CreateCommissionModal({ caseId, violationTypeCode, caseAssignees, onClose, onCreated }: CreateCommissionModalProps) {
  const { timezone } = useTimezoneStore();
  const existingAssigneeUids = useMemo(
    () => new Set(caseAssignees.map((a) => a.employeeUid).filter((uid): uid is string => Boolean(uid))),
    [caseAssignees]
  );

  const allCommissionTypes = useCommissionTypesStore((s) => s.commissionTypes);
  const isCommissionTypesLoading = useCommissionTypesStore((s) => s.isLoading);
  const isCommissionTypesLoaded = useCommissionTypesStore((s) => s.isLoaded);
  const commissionTypesStoreError = useCommissionTypesStore((s) => s.error);
  const ensureCommissionTypesLoaded = useCommissionTypesStore((s) => s.ensureLoaded);

  const commissionTypes = useMemo(
    () => allCommissionTypes.filter((t) => t.isActive !== false),
    [allCommissionTypes]
  );
  const loadingTypes = isCommissionTypesLoading && !isCommissionTypesLoaded;
  const typesError = commissionTypesStoreError;

  useEffect(() => {
    ensureCommissionTypesLoaded().catch(() => { });
  }, [ensureCommissionTypesLoaded]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    watch,
    setValue,
  } = useForm<CommissionFormValues>({
    resolver: zodResolver(commissionSchema),
    mode: "onChange",
    defaultValues: {
      commissionTypeId: "",
      stage1VotingDeadline: "",
      stage2VotingDeadline: "",
      reason: "",
    },
  });

  const [members, setMembers] = useState<DraftMember[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const excludedUids = useMemo(() => {
    const uids = new Set(members.map((m) => m.employeeUid));
    caseAssignees.forEach((a) => {
      if (a.role === "VIOLATOR" && a.employeeUid) uids.add(a.employeeUid);
    });
    return uids;
  }, [members, caseAssignees]);
  const chairCount = useMemo(() => members.filter((m) => m.roles.has("ПРЕДСЕДАТЕЛЬ")).length, [members]);

  const commissionTypeId = watch("commissionTypeId");
  const selectedType = commissionTypes.find((t) => t.id === commissionTypeId);

  const suggestedTypes = useMemo(
    () =>
      violationTypeCode
        ? commissionTypes.filter((t) => t.triggerOnViolationCodes?.includes(violationTypeCode))
        : [],
    [commissionTypes, violationTypeCode]
  );
  const suggestedTypeIds = useMemo(() => new Set(suggestedTypes.map((t) => t.id)), [suggestedTypes]);
  const orderedCommissionTypes = useMemo(
    () => [
      ...commissionTypes.filter((t) => suggestedTypeIds.has(t.id)),
      ...commissionTypes.filter((t) => !suggestedTypeIds.has(t.id)),
    ],
    [commissionTypes, suggestedTypeIds]
  );

  const quickCandidates = useMemo(() => {
    const seen = new Set<string>();
    const result: CaseAssigneeResponse[] = [];
    for (const a of caseAssignees) {
      if (!a.employeeUid || seen.has(a.employeeUid)) continue;
      if (a.role === "VIOLATOR" || a.role === "COMMISSION_SECRETARY") continue;
      seen.add(a.employeeUid);
      if (!excludedUids.has(a.employeeUid)) result.push(a);
    }
    return result;
  }, [caseAssignees, excludedUids]);

  const addAssignee = (a: CaseAssigneeResponse) => {
    if (!a.employeeUid) return;
    setMembers((prev) =>
      prev.some((m) => m.employeeUid === a.employeeUid)
        ? prev
        : [...prev, { employeeUid: a.employeeUid!, fullName: a.fullName || a.employeeUid!, roles: new Set(["ЧЛЕН"]) }]
    );
  };

  const addAllAssignees = () => quickCandidates.forEach(addAssignee);

  const addMember = (employee: EmployeeResponse) => {
    if (!employee.uid) return;
    setMembers((prev) => [
      ...prev,
      { employeeUid: employee.uid!, fullName: employee.fullName || employee.uid!, roles: new Set(["ЧЛЕН"]) },
    ]);
  };

  const removeMember = (employeeUid: string) => {
    setMembers((prev) => prev.filter((m) => m.employeeUid !== employeeUid));
  };

  const toggleRole = (employeeUid: string, role: CommissionMemberRole) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.employeeUid !== employeeUid) return m;
        const roles = new Set(m.roles);
        if (roles.has(role)) {
          if (role === "ЧЛЕН" && roles.size === 1) return m;
          roles.delete(role);
        } else {
          roles.add(role);
        }
        return { ...m, roles };
      })
    );
  };

  const onSubmit = async (data: CommissionFormValues) => {
    setSubmitError(null);

    const stage1ServerString = localDateTimeInputToServerString(data.stage1VotingDeadline, timezone);
    const stage2ServerString = localDateTimeInputToServerString(data.stage2VotingDeadline, timezone);
    const stage1Ms = parseServerDateTime(stage1ServerString)?.getTime() ?? 0;
    const stage2Ms = parseServerDateTime(stage2ServerString)?.getTime() ?? 0;
    if (stage1Ms <= Date.now() || stage2Ms <= Date.now()) {
      setSubmitError("Оба срока голосования должны быть в будущем");
      return;
    }
    if (stage1Ms >= stage2Ms) {
      setSubmitError("Срок 2-го этапа должен быть строго позже срока 1-го этапа");
      return;
    }
    if (members.length === 0) {
      setSubmitError("Добавьте хотя бы одного участника комиссии");
      return;
    }
    if (chairCount !== 1) {
      setSubmitError("В составе комиссии должен быть ровно один председатель");
      return;
    }

    try {
      const created = await commissionApi.createCommission({
        caseId,
        commissionTypeId: data.commissionTypeId,
        stage1VotingDeadline: stage1ServerString,
        stage2VotingDeadline: stage2ServerString,
        reason: data.reason?.trim() || undefined,
        members: members.map((m) => ({ employeeUid: m.employeeUid, roles: Array.from(m.roles) })),
      });
      onCreated(created);
    } catch (err: any) {
      console.error("Ошибка создания комиссии:", err);
      setSubmitError(
        getErrorMessage(
          err,
          "Не удалось назначить комиссию. Проверьте, что вы назначены секретарём комиссии на этом деле."
        )
      );
    }
  };

  const isFormReady = isValid && members.length > 0 && chairCount === 1;

  return (
    <>
      {submitError && (
        <Toast message={submitError} onClose={() => setSubmitError(null)} />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-bg rounded-card border border-bd w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-bd sticky top-0 bg-bg">
            <h3 className="text-[18px] font-bold text-tx">Назначить комиссию</h3>
            <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors" type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-4 flex flex-col gap-4">
            <div>
              <label className="block text-[14px] font-medium text-tx mb-1">Тип комиссии</label>
              {loadingTypes ? (
                <div className="text-[13px] text-tx2">Загрузка справочника...</div>
              ) : typesError ? (
                <div className="text-[13px] text-dgt">{String(typesError)}</div>
              ) : (
                <Controller
                  name="commissionTypeId"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className={`w-full min-h-[40px] border rounded-inp px-3 py-2 text-[14px] focus:ring-3 outline-none bg-bg ${errors.commissionTypeId
                          ? "border-dg focus:border-dg focus:ring-dg/10"
                          : "border-bd focus:border-pr focus:ring-pr/10"
                        }`}
                    >
                      <option value="">Выберите тип...</option>
                      {orderedCommissionTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {suggestedTypeIds.has(t.id) ? `★ ${t.name} (рекомендуется)` : t.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
              )}
              {errors.commissionTypeId && (
                <div className="text-[12px] text-dgl mt-1">{errors.commissionTypeId.message}</div>
              )}
              {!loadingTypes && !typesError && suggestedTypes.length > 0 && (
                <div className="text-[12px] text-tx2 mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span>Рекомендуется по типу нарушения:</span>
                  {suggestedTypes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`px-2 py-0.5 rounded-full border text-[12px] transition-colors ${t.id === commissionTypeId
                          ? "bg-pr text-white border-pr"
                          : "bg-pr/5 text-prl border-pr/30 hover:bg-pr/10"
                        }`}
                      onClick={() => t.id && setValue("commissionTypeId", t.id, { shouldValidate: true })}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              {selectedType && !errors.commissionTypeId && (
                <div className="text-[12px] text-tx2 mt-1">
                  Кворум: {selectedType.quorumMin ?? "—"} чел. · Правило голосования: {getVotingRuleLabel(selectedType.votingRule)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[14px] font-medium text-tx mb-1">Срок 1-го этапа</label>
                <Controller
                  name="stage1VotingDeadline"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="datetime-local"
                      className={`w-full min-h-[40px] border rounded-inp px-3 py-2 text-[14px] focus:ring-3 outline-none ${errors.stage1VotingDeadline
                          ? "border-dg focus:border-dg focus:ring-dg/10"
                          : "border-bd focus:border-pr focus:ring-pr/10"
                        }`}
                    />
                  )}
                />
                {errors.stage1VotingDeadline && (
                  <div className="text-[12px] text-dgl mt-1">{errors.stage1VotingDeadline.message}</div>
                )}
              </div>
              <div>
                <label className="block text-[14px] font-medium text-tx mb-1">Срок 2-го этапа</label>
                <Controller
                  name="stage2VotingDeadline"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="datetime-local"
                      className={`w-full min-h-[40px] border rounded-inp px-3 py-2 text-[14px] focus:ring-3 outline-none ${errors.stage2VotingDeadline
                          ? "border-dg focus:border-dg focus:ring-dg/10"
                          : "border-bd focus:border-pr focus:ring-pr/10"
                        }`}
                    />
                  )}
                />
                {errors.stage2VotingDeadline && (
                  <div className="text-[12px] text-dgl mt-1">{errors.stage2VotingDeadline.message}</div>
                )}
              </div>
              {!errors.stage1VotingDeadline && !errors.stage2VotingDeadline && (
                <div className="text-[12px] text-tx2 sm:col-span-2">
                  Время указывается в часовом поясе {timezone}. Срок 2-го этапа должен быть позже срока 1-го.
                </div>
              )}
            </div>

            <div>
              <label className="block text-[14px] font-medium text-tx mb-2">
                Состав комиссии — ровно один председатель, остальные роли можно комбинировать
              </label>

              {members.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {members.map((m) => {
                    const notYetOnCase = !existingAssigneeUids.has(m.employeeUid);
                    return (
                      <div key={m.employeeUid} className="flex flex-col gap-1.5 p-2.5 border border-bd rounded-inp bg-surf">
                        <div className="flex items-center gap-3">
                          <Avatar avatarUrl={userApi.employeeAvatarUrl(m.employeeUid)} name={m.fullName || "?"} size={32} />
                          <div className="flex-1 min-w-0 text-[14px] text-tx truncate">{m.fullName}</div>
                          <div className="flex items-center gap-3 shrink-0">
                            {(["ПРЕДСЕДАТЕЛЬ", "ЧЛЕН"] as CommissionMemberRole[]).map((role) => (
                              <label key={role} className="flex items-center gap-1.5 text-[12px] text-tx2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={m.roles.has(role)}
                                  onChange={() => toggleRole(m.employeeUid, role)}
                                />
                                {COMMISSION_MEMBER_ROLE_LABELS[role]}
                              </label>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="shrink-0 text-dgt hover:text-dgl transition-colors text-[13px] font-medium"
                            onClick={() => removeMember(m.employeeUid)}
                          >
                            Убрать
                          </button>
                        </div>
                        {notYetOnCase && (
                          <div className="flex items-center gap-1.5 text-[12px] text-wnt">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            Сотрудник не в составе дела — будет автоматически назначен на дело как участник
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <MemberPicker onPick={addMember} excludedUids={excludedUids} />

              {quickCandidates.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[12px] font-medium text-tx2">Участники дела</div>
                    {quickCandidates.length > 1 && (
                      <button
                        type="button"
                        onClick={addAllAssignees}
                        className="text-[12px] font-medium text-prl hover:text-prt transition-colors"
                      >
                        Добавить всех
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col border border-bd rounded-inp divide-y divide-line max-h-60 overflow-y-auto">
                    {quickCandidates.map((a) => (
                      <div key={a.employeeUid} className="flex items-center gap-3 px-3 py-2 hover:bg-surf transition-colors">
                        <Avatar
                          avatarUrl={a.employeeUid ? userApi.employeeAvatarUrl(a.employeeUid) : null}
                          name={a.fullName || "?"}
                          size={36}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] leading-[20px] font-medium text-tx truncate">{a.fullName || a.employeeUid}</div>
                          <div className="text-[12px] leading-[16px] text-tx2 truncate">
                            {[a.position, a.role ? getAssigneeRoleLabel(a.role) : null].filter(Boolean).join(" · ") || "Должность не указана"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addAssignee(a)}
                          className="shrink-0 px-3 py-1.5 rounded-inp text-[13px] font-medium text-prl border border-pr/40 hover:bg-pr/5 transition-colors"
                        >
                          Добавить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[12px] text-tx2 mt-2">
                Секретарь (вы) добавляется в комиссию автоматически и не голосует.
                {members.length > 0 && (
                  <> Сейчас председателей: <strong>{chairCount}</strong> (нужно ровно 1).</>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-tx mb-1">Основание / комментарий (необязательно)</label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    className="w-full border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none resize-none"
                    rows={2}
                  />
                )}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-bd">
              <button
                type="button"
                className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || loadingTypes || !isFormReady}
              >
                {isSubmitting ? "Назначение..." : "Назначить комиссию"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
