import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { caseApi } from "@/entities/case/api/caseApi";
import { employeeApi } from "@/shared/api";
import { useEmployeesBase, useViolationTypes } from "@/entities/case/api/useCaseQueries";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { useNavBadgeStore } from "@shared/model/navBadgeStore";
import { useDebounce } from "@shared/hooks/useDebounce";
import { localDateTimeInputToServerString } from "@shared/utils/datetime";
import { generateUuidV4 } from "@shared/utils/uuid";
import { ASSIGNABLE_CASE_ROLES, getAssigneeRoleLabel } from "@shared/utils/caseAssigneeRole";
import { useAuthStore } from "@entities/session/model/authStore";
import { GenerateDocumentModal } from "@entities/document/GenerateDocumentModal";
import Avatar from "@shared/ui/Avatar";
import { getFileTypeStyle } from "@shared/utils/fileType";
import { userApi } from "@entities/user/userApi";
import type { CaseAssigneeRole, EmployeeResponse, ViolationTypeBriefResponse } from "@shared/types/api";
import { showAlert } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dictionaryApi } from "@entities/dictionary/dictionaryApi";
import { complaintApi } from "@entities/complaint/complaintApi";

export interface PendingFile {
  id: string;
  name: string;
  sizeLabel: string;
  addedAt: string;
  file: File;
}

interface DraftParticipant {
  employeeUid: string;
  fullName: string;
  position?: string;
  role: CaseAssigneeRole;
}

interface CaseDraft {
  id: string;
  savedAt: string;
  values: NewCaseFormValues;
  selectedEmployee: EmployeeResponse | null;
  participants: DraftParticipant[];
}

function draftsStorageKey(userId: string): string {
  return `newCaseDrafts:${userId}`;
}

function loadCaseDrafts(userId: string): CaseDraft[] {
  try {
    const raw = localStorage.getItem(draftsStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCaseDrafts(userId: string, drafts: CaseDraft[]) {
  try {
    localStorage.setItem(draftsStorageKey(userId), JSON.stringify(drafts));
  } catch {
  }
}

function datePartOf(dateTimeLocal: string): string {
  return dateTimeLocal.split("T")[0] || "";
}

function isDateTooOld(dateTimeLocal: string, maxMonths: number): boolean {
  if (!dateTimeLocal) return false;
  const [y, m, d] = datePartOf(dateTimeLocal).split("-").map(Number);
  const inputDate = new Date(y, m - 1, d);
  const now = new Date();
  let limitYear = now.getFullYear();
  let limitMonth = now.getMonth() - maxMonths;
  while (limitMonth < 0) {
    limitMonth += 12;
    limitYear -= 1;
  }
  const daysInLimitMonth = new Date(limitYear, limitMonth + 1, 0).getDate();
  const limitDay = Math.min(now.getDate(), daysInLimitMonth);
  const limitDate = new Date(limitYear, limitMonth, limitDay);
  inputDate.setHours(0, 0, 0, 0);
  limitDate.setHours(0, 0, 0, 0);
  return inputDate < limitDate;
}

const todayStart = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

const newCaseSchema = z
  .object({
    employeeId: z
      .string()
      .min(1, "Выберите сотрудника из списка"),

    violationDate: z
      .string()
      .min(1, "Укажите дату и время совершения нарушения")
      .refine(
        (val) => {
          if (!val) return true;
          const [y, m, d] = datePartOf(val).split("-").map(Number);
          return new Date(y, m - 1, d) <= todayStart();
        },
        { message: "Дата совершения нарушения не может быть в будущем" }
      )
      .refine((val) => !val || !isDateTooOld(val, 6), {
        message: "Дата совершения нарушения не может быть старше 6 месяцев",
      }),

    discoveryDate: z
      .string()
      .min(1, "Укажите дату и время обнаружения нарушения")
      .refine(
        (val) => {
          if (!val) return true;
          const [y, m, d] = datePartOf(val).split("-").map(Number);
          return new Date(y, m - 1, d) <= todayStart();
        },
        { message: "Дата обнаружения нарушения не может быть в будущем" }
      )
      .refine((val) => !val || !isDateTooOld(val, 1), {
        message: "Дата обнаружения нарушения не может быть старше 1 месяца",
      }),

    violationTypeCode: z.string().min(1, "Выберите вид нарушения"),

    description: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      !data.violationDate ||
      !data.discoveryDate ||
      new Date(data.discoveryDate) >= new Date(data.violationDate),
    {
      message: "Дата обнаружения не может быть раньше даты совершения",
      path: ["discoveryDate"],
    }
  );

type NewCaseFormValues = z.infer<typeof newCaseSchema>;

function addMonths(dateTimeLocal: string, months: number): string {
  if (!dateTimeLocal) return "—";
  const [y, m, d] = datePartOf(dateTimeLocal).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + months);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = date.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 0.1 ? `${mb.toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function formatLocalDateTime(value?: string): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]} ${match[4]}` : value || "—";
}

function formatDraftTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} в ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const inputBase = "w-full min-h-[40px] border border-bd rounded-inp bg-bg px-3 py-2.5 text-[14px] leading-[20px] text-tx outline-none transition-colors placeholder:text-txm focus:border-pr focus:ring-3 focus:ring-pr/10 disabled:bg-ntbg disabled:text-tx2";
const inputError = "border-dg focus:border-dg focus:ring-dg/10";

function DraftsModal({
  drafts,
  violationTypes,
  onRestore,
  onDelete,
  onClose,
}: {
  drafts: CaseDraft[];
  violationTypes: ViolationTypeBriefResponse[];
  onRestore: (draft: CaseDraft) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const violationName = (code: string) => violationTypes.find((v) => v.code === code)?.name || code;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-card border border-bd w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd sticky top-0 bg-bg">
          <h3 className="text-[18px] font-bold text-tx">Черновики</h3>
          <button type="button" onClick={onClose} className="text-tx2 hover:text-tx transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {drafts.length === 0 ? (
          <div className="p-6 text-center text-[14px] text-tx2">Черновиков пока нет</div>
        ) : (
          <div className="flex flex-col divide-y divide-bd">
            {drafts.map((draft) => (
              <div key={draft.id} className="flex items-start gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[14px] leading-[20px] text-tx truncate">
                    {draft.selectedEmployee?.fullName || "Сотрудник не выбран"}
                  </div>
                  <div className="text-[13px] leading-[18px] text-tx2 truncate">
                    {draft.values.violationTypeCode ? violationName(draft.values.violationTypeCode) : "Вид нарушения не выбран"}
                  </div>
                  <div className="text-[12px] leading-[16px] text-tx2 mt-1">
                    Сохранён {formatDraftTimestamp(draft.savedAt)}
                    {draft.participants.length > 0 && ` · участников: ${draft.participants.length}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-inp font-medium text-[13px] text-prl hover:text-prt cursor-pointer transition-colors"
                    onClick={() => onRestore(draft)}
                  >
                    Восстановить
                  </button>
                  <button
                    type="button"
                    aria-label="Удалить черновик"
                    className="p-1.5 text-tx2 hover:text-dgl transition-colors cursor-pointer"
                    onClick={() => onDelete(draft.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewCasePage() {
  const navigate = useNavigate();
  const { timezone } = useTimezoneStore();
  const requestNavBadgeRefresh = useNavBadgeStore((s) => s.requestRefresh);
  const userId = useAuthStore((s) => s.context?.id);
  const generatorFullName = useAuthStore((s) => s.context?.fullName);
  const generatorPosition = useAuthStore((s) => s.context?.position);

  const employeesQuery = useEmployeesBase({ size: 8 });
  const violationTypesQuery = useViolationTypes();

  const baseEmployees: EmployeeResponse[] = employeesQuery.data?.content || [];

  const violationTypes: ViolationTypeBriefResponse[] = Array.isArray(violationTypesQuery.data)
    ? violationTypesQuery.data
    : violationTypesQuery.data
      ? [violationTypesQuery.data]
      : [];

  const loadingDicts = employeesQuery.isLoading || violationTypesQuery.isLoading;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    setValue,
    watch,
  } = useForm<NewCaseFormValues>({
    resolver: zodResolver(newCaseSchema),
    mode: "onChange",
    defaultValues: {
      employeeId: "",
      violationDate: "",
      discoveryDate: "",
      violationTypeCode: "",
      description: "",
    },
  });

  const form = watch();

  const [formFiles, setFormFiles] = useState<PendingFile[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [isEmployeeListOpen, setEmployeeListOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeResponse | null>(null);

  const queryClient = useQueryClient();
  const initiatorEmployeeUid = useAuthStore((s) => s.context?.employeeUid);
  const canUnblockUsers = useAuthStore((s) => s.hasPermission("user:lock"));
  const [searchParams] = useSearchParams();
  const complaintId = searchParams.get("complaintId");
  const complaintEmployeeUid = searchParams.get("employeeUid");
  const [searchResults, setSearchResults] = useState<EmployeeResponse[]>([]);
  const [isSearchingEmployees, setIsSearchingEmployees] = useState(false);
  const [isDraggingOver, setDraggingOver] = useState(false);

  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [confirmedData, setConfirmedData] = useState(false);
  const [confirmedIrreversible, setConfirmedIrreversible] = useState(false);
  const [generateModalData, setGenerateModalData] = useState<{
    caseId: string;
    caseNumber?: string;
    violationTypeCode: string;
    violationTypeName?: string;
    violatorFullName?: string;
    violatorPosition?: string;
    domainName?: string;
    departmentName?: string;
    employeeUid?: string;
    incidentDateIso: string;
    discoveryDateIso: string;
    explanationDeadlineIso?: string | null;
  } | null>(null);

  const [drafts, setDrafts] = useState<CaseDraft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const visibleDrafts = useMemo(
    () => drafts.filter((d) => d.id !== currentDraftId),
    [drafts, currentDraftId]
  );
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [isDraftsPanelOpen, setDraftsPanelOpen] = useState(false);

  const [draftParticipants, setDraftParticipants] = useState<DraftParticipant[]>([]);
  const [participantQuery, setParticipantQuery] = useState("");
  const [participantResults, setParticipantResults] = useState<EmployeeResponse[]>([]);
  const [isSearchingParticipants, setIsSearchingParticipants] = useState(false);
  const violatorDepartmentId = selectedEmployee?.departmentId;
  const departmentHeadQuery = useQuery({
    queryKey: ["departmentHead", violatorDepartmentId],
    enabled: Boolean(violatorDepartmentId),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const department = await dictionaryApi.getDepartmentBrief(violatorDepartmentId!);
      if (!department.headEmployeeUid) return { departmentName: department.name, head: null };
      const head = await employeeApi.getEmployeeByUid(department.headEmployeeUid);
      return { departmentName: department.name, head };
    },
  });
  const departmentHead = departmentHeadQuery.data?.head ?? null;
  const departmentHeadNote: string | null = !selectedEmployee
    ? null
    : departmentHeadQuery.isLoading
      ? "Определяем руководителя подразделения…"
      : departmentHeadQuery.isError
        ? "Не удалось определить руководителя подразделения. Он будет добавлен в дело автоматически при создании, если назначен."
        : !departmentHead
          ? "У подразделения нарушителя не назначен руководитель — автоматически никто не добавится."
          : departmentHead.uid === selectedEmployee.uid
            ? "Нарушитель сам возглавляет подразделение — отдельно руководитель не добавляется."
            : departmentHead.uid === initiatorEmployeeUid
              ? "Вы руководитель подразделения нарушителя — вы уже добавлены в дело как инициатор."
              : null;
  const [selectedParticipant, setSelectedParticipant] = useState<EmployeeResponse | null>(null);
  const [participantRole, setParticipantRole] = useState<CaseAssigneeRole>("MEMBER");
  const [isParticipantListOpen, setParticipantListOpen] = useState(false);

  const debouncedEmployeeQuery = useDebounce(employeeQuery, 300);
  const debouncedParticipantQuery = useDebounce(participantQuery, 300);

  useEffect(() => {
    setIsSearchingEmployees(Boolean(employeeQuery.trim()));
  }, [employeeQuery]);

  useEffect(() => {
    const trimmed = debouncedEmployeeQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearchingEmployees(false);
      return;
    }
    let cancelled = false;
    setIsSearchingEmployees(true);
    employeeApi
      .searchEmployees(trimmed)
      .then((page) => {
        if (cancelled) return;
        setSearchResults(page?.content || []);
      })
      .catch((error) => {
        console.error("Ошибка поиска сотрудников:", error);
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearchingEmployees(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedEmployeeQuery]);

  const filteredEmployees = employeeQuery.trim() ? searchResults : baseEmployees;

  useEffect(() => {
    if (!userId) return;
    setDrafts(loadCaseDrafts(userId));
  }, [userId]);

  function removeDraftFromList(id: string) {
    if (!userId) return;
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveCaseDrafts(userId, next);
      return next;
    });
  }

  const hasDraftableContent = Boolean(
    selectedEmployee ||
    form.violationDate ||
    form.discoveryDate ||
    form.violationTypeCode ||
    form.description?.trim() ||
    draftParticipants.length > 0
  );

  function handleSaveDraft() {
    if (!hasDraftableContent || !userId) return;
    const savedAt = new Date().toISOString();
    const id = currentDraftId ?? generateUuidV4();
    const draft: CaseDraft = { id, savedAt, values: form, selectedEmployee, participants: draftParticipants };
    setDrafts((prev) => {
      const next = [draft, ...prev.filter((d) => d.id !== id)];
      saveCaseDrafts(userId, next);
      return next;
    });
    setCurrentDraftId(id);
    setDraftSavedAt(savedAt);
  }

  function handleRestoreDraft(draft: CaseDraft) {
    (Object.keys(draft.values) as (keyof NewCaseFormValues)[]).forEach((key) => {
      setValue(key, draft.values[key], { shouldValidate: true });
    });
    setSelectedEmployee(draft.selectedEmployee);
    setEmployeeQuery(draft.selectedEmployee?.fullName || "");
    setDraftParticipants(draft.participants || []);
    removeDraftFromList(draft.id);
    setCurrentDraftId(draft.id);
    setDraftSavedAt(draft.savedAt);
    setDraftsPanelOpen(false);
  }

  function handleDeleteDraft(id: string) {
    removeDraftFromList(id);
    if (id === currentDraftId) {
      setCurrentDraftId(null);
      setDraftSavedAt(null);
    }
  }

  const debouncedDraftSnapshot = useDebounce(
    hasDraftableContent ? JSON.stringify({ form, selectedEmployee, draftParticipants }) : null,
    1500
  );

  useEffect(() => {
    if (!debouncedDraftSnapshot) return;
    handleSaveDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraftSnapshot]);

  useEffect(() => {
    setIsSearchingParticipants(Boolean(participantQuery.trim()));
  }, [participantQuery]);

  useEffect(() => {
    const trimmed = debouncedParticipantQuery.trim();
    if (!trimmed) {
      setParticipantResults([]);
      setIsSearchingParticipants(false);
      return;
    }
    let cancelled = false;
    setIsSearchingParticipants(true);
    employeeApi
      .searchEmployees(trimmed)
      .then((page) => {
        if (cancelled) return;
        setParticipantResults(page?.content || []);
      })
      .catch((error) => {
        console.error("Ошибка поиска сотрудников:", error);
        if (!cancelled) setParticipantResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearchingParticipants(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedParticipantQuery]);

  function addDraftParticipant() {
    if (!selectedParticipant?.uid) return;
    if (selectedParticipant.uid === selectedEmployee?.uid) {
      showAlert("Этот сотрудник уже указан как нарушитель по делу");
      return;
    }
    if (departmentHead?.uid && selectedParticipant.uid === departmentHead.uid) {
      showAlert("Руководитель подразделения нарушителя добавляется в дело автоматически");
      return;
    }
    if (draftParticipants.some((p) => p.employeeUid === selectedParticipant.uid)) {
      showAlert("Этот сотрудник уже добавлен в участники дела");
      return;
    }
    setDraftParticipants((prev) => [
      ...prev,
      {
        employeeUid: selectedParticipant.uid!,
        fullName: selectedParticipant.fullName || selectedParticipant.uid!,
        position: selectedParticipant.position,
        role: participantRole,
      },
    ]);
    setSelectedParticipant(null);
    setParticipantQuery("");
    setParticipantRole("MEMBER");
  }

  function removeDraftParticipant(employeeUid: string) {
    setDraftParticipants((prev) => prev.filter((p) => p.employeeUid !== employeeUid));
  }

  const explanationDeadlineHint = "2 рабочих дня";
  const decisionDeadline = addMonths(form.discoveryDate, 1);
  const sanctionDeadline = addMonths(form.violationDate, 6);

  useEffect(() => {
    if (!complaintId || !complaintEmployeeUid) return;
    let cancelled = false;
    employeeApi
      .getEmployeeByUid(complaintEmployeeUid)
      .then((employee) => {
        if (!cancelled) handleSelectEmployee(employee);
      })
      .catch((err) => {
        console.error("Не удалось подставить сотрудника из жалобы:", err);
        if (!cancelled) showAlert(getErrorMessage(err, "Не удалось подставить сотрудника из жалобы — выберите его вручную"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintId, complaintEmployeeUid]);

  function handleSelectEmployee(employee: EmployeeResponse) {
    setValue("employeeId", employee.uid || "", { shouldValidate: true });
    setSelectedEmployee(employee);
    setEmployeeQuery(employee.fullName || "");
    setEmployeeListOpen(false);
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const today = new Date();
    const addedAt = `${String(today.getDate()).padStart(2, "0")}.${String(
      today.getMonth() + 1
    ).padStart(2, "0")}.${today.getFullYear()}`;

    const newFiles: PendingFile[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      sizeLabel: formatFileSize(file.size),
      addedAt,
      file,
    }));
    setFormFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(id: string) {
    setFormFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDraggingOver(false);
    addFiles(e.dataTransfer.files);
  }

  const onValid = async (data: NewCaseFormValues) => {
    await submitCase(data);
  };

  const onInvalid = () => {
  };

  async function submitCase(data: NewCaseFormValues) {
    try {
      const idempotencyKey = generateUuidV4();
      const incidentDateIso = data.violationDate
        ? localDateTimeInputToServerString(data.violationDate, timezone)
        : "";
      const discoveryDateIso = data.discoveryDate
        ? localDateTimeInputToServerString(data.discoveryDate, timezone)
        : "";
      const createdCase = await caseApi.createCase(
        {
          employeeUid: selectedEmployee?.uid || "",
          violationTypeCode: data.violationTypeCode,
          departmentId: selectedEmployee?.departmentId || "",
          domainId: selectedEmployee?.domainId || "",
          incidentDate: incidentDateIso,
          discoveryDate: discoveryDateIso,
        },
        idempotencyKey
      );

      if (formFiles.length > 0 && createdCase?.id) {
        for (const pendingFile of formFiles) {
          await caseApi.uploadDocument(createdCase.id, {
            file: pendingFile.file,
            isVisibleToEmployee: false,
          });
        }
      }

      if (draftParticipants.length > 0 && createdCase?.id) {
        const failedNames: string[] = [];
        for (const participant of draftParticipants) {
          try {
            await caseApi.addCaseAssignee(createdCase.id, {
              employeeUid: participant.employeeUid,
              role: participant.role,
            });
          } catch (error) {
            console.error("Ошибка добавления участника дела:", error);
            failedNames.push(participant.fullName);
          }
        }
        if (failedNames.length > 0) {
          showAlert(
            `Дело создано, но не удалось добавить участников: ${failedNames.join(", ")}. Добавьте их вручную на странице дела.`
          );
        }
      }

      if (currentDraftId) handleDeleteDraft(currentDraftId);
      requestNavBadgeRefresh();

      if (complaintId && createdCase?.id) {
        try {
          await complaintApi.decide(complaintId, { decision: "CASE_CREATED", caseId: createdCase.id });
          queryClient.invalidateQueries({ queryKey: ["complaintsInbox"] });
          queryClient.invalidateQueries({ queryKey: ["complaintSummary"] });
          queryClient.invalidateQueries({ queryKey: ["complaint", complaintId] });
        } catch (err) {
          console.error("Не удалось связать дело с жалобой:", err);
          showAlert(
            getErrorMessage(err, "Дело создано, но не удалось отметить решение по жалобе. Откройте жалобу и повторите")
          );
        }
      }

      if (createdCase?.id) {
        const explanationPreview = await caseApi.getExplanationRequestPreview(createdCase.id).catch(() => null);
        if (explanationPreview?.violatorBlocked) {
          showAlert(
            canUnblockUsers
              ? "Дело создано, но учётная запись сотрудника заблокирована. Разблокируйте её, затем сформируйте требование об объяснении на странице дела."
              : "Дело создано, но учётная запись сотрудника заблокирована. Обратитесь к администратору для разблокировки учётной записи сотрудника, затем сформируйте требование об объяснении на странице дела."
          );
          navigate(`/cases/${createdCase.id}`);
          return;
        }
        const explanationDeadlineIso = explanationPreview?.deadlineAt;
        setGenerateModalData({
          caseId: createdCase.id,
          caseNumber: createdCase.caseNumber,
          violationTypeCode: data.violationTypeCode,
          violationTypeName: violationTypes.find((v) => v.code === data.violationTypeCode)?.name,
          violatorFullName: selectedEmployee?.fullName,
          violatorPosition: selectedEmployee?.position,
          domainName: createdCase.snapshotDomain,
          departmentName: createdCase.snapshotDepartment,
          employeeUid: selectedEmployee?.uid,
          incidentDateIso,
          discoveryDateIso,
          explanationDeadlineIso,
        });
      } else {
        navigate("/cases");
      }
    } catch (error: any) {
      console.error("Ошибка создания дела:", error);
      showAlert(getErrorMessage(error, "Произошла ошибка при создании дела"));
    }
  }

  if (loadingDicts) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <div className="text-center py-10 text-tx">Загрузка справочников...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="flex items-start gap-6 mb-5">
        <div>
          <div className="text-[12px] leading-[16px] text-tx2 mb-2">Реестр дел / Новое дело</div>
          <h1 className="text-[28px] leading-[36px] font-bold text-tx">Создание дела</h1>
          {complaintId && (
            <div className="mt-2 text-[13px] text-tx2">
              Дело создаётся по жалобе.{" "}
              <Link to={`/complaints/${complaintId}`} className="text-prl hover:text-prt hover:underline">
                Открыть жалобу
              </Link>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {visibleDrafts.length > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-inp font-medium text-[14px] leading-[20px] text-tx border border-bd bg-bg hover:bg-surf transition-colors cursor-pointer"
              onClick={() => setDraftsPanelOpen(true)}
            >
              Черновики
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-ntbg text-tx2 text-[11px] font-bold">
                {visibleDrafts.length}
              </span>
            </button>
          )}
          <span
            className="text-[14px] leading-[20px] font-medium text-prl cursor-pointer hover:underline"
            onClick={() => navigate("/cases")}
          >
            Отмена
          </span>
        </div>
      </div>

      {isDraftsPanelOpen && (
        <DraftsModal
          drafts={visibleDrafts}
          violationTypes={violationTypes}
          onRestore={handleRestoreDraft}
          onDelete={handleDeleteDraft}
          onClose={() => setDraftsPanelOpen(false)}
        />
      )}

      <form
        className="flex flex-wrap gap-5 items-start w-full"
        onSubmit={handleSubmit(onValid, onInvalid)}
      >
        <div className="flex-[1.7] min-w-[280px] bg-bg border border-bd rounded-card p-5 w-full">
          <div className="flex flex-col mb-4 w-full">
            <label className="text-[14px] leading-[20px] font-medium text-tx mb-2">
              Сотрудник <span className="text-dgl">*</span>
            </label>
            <div className="relative">
              <div className={`flex items-center gap-2 border rounded-inp bg-bg px-3 py-2.5 transition-colors focus-within:border-pr focus-within:ring-3 focus-within:ring-pr/10 ${errors.employeeId ? "border-dg focus-within:border-dg focus-within:ring-dg/10" : "border-bd"}`}>
                <svg className="shrink-0 text-tx2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  className="flex-1 border-none outline-none bg-transparent text-[14px] leading-[20px] text-tx placeholder:text-txm"
                  placeholder="Начните вводить ФИО или должность сотрудника"
                  value={employeeQuery}
                  onChange={(e) => {
                    setEmployeeQuery(e.target.value);
                    setValue("employeeId", "", { shouldValidate: true });
                    setSelectedEmployee(null);
                    setEmployeeListOpen(true);
                  }}
                  onFocus={() => setEmployeeListOpen(true)}
                  onBlur={() => setTimeout(() => setEmployeeListOpen(false), 150)}
                />
              </div>

              {isEmployeeListOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg border border-bd rounded-inp shadow-dropdown max-h-[260px] overflow-y-auto z-50 scrollbar-thin">
                  {isSearchingEmployees ? (
                    <div className="px-3 py-2.5 text-[13px] text-tx2">Поиск...</div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="px-3 py-2.5 text-[13px] text-tx2">
                      {employeeQuery.trim() ? `Ничего не найдено по запросу «${employeeQuery.trim()}»` : "Сотрудники не найдены"}
                    </div>
                  ) : (
                    filteredEmployees.map((u) => (
                      <div
                        key={u.uid}
                        className="px-3 py-2.5 cursor-pointer hover:bg-surf flex items-center gap-2.5"
                        onMouseDown={() => handleSelectEmployee(u)}
                      >
                        <Avatar
                          avatarUrl={u.uid ? userApi.employeeAvatarUrl(u.uid) : null}
                          name={u.fullName || "?"}
                          size={32}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-[14px] leading-[20px] text-tx">{u.fullName}</div>
                          <div className="text-[12px] leading-[16px] text-tx2">{u.position}, таб. № {u.tabNumber}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {errors.employeeId && <div className="text-[12px] leading-[16px] text-dgl mt-1.5">{errors.employeeId.message}</div>}
            {selectedEmployee && !errors.employeeId && (
              <div className="text-[12px] leading-[16px] text-tx2 mt-1.5">Справочник синхронизирован с 1С:ЗУП, обновлён 27.07.2026 в 06:00</div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-[14px] leading-[20px] font-medium text-tx mb-2">
                Дата и время совершения нарушения <span className="text-dgl">*</span>
              </label>
              <input
                type="datetime-local"
                className={`${inputBase} ${errors.violationDate ? inputError : ""}`}
                {...register("violationDate")}
              />
              {errors.violationDate ? (
                <div className="text-[12px] leading-[16px] text-dgl mt-1.5">{errors.violationDate.message}</div>
              ) : (
                <div className="text-[12px] leading-[16px] text-tx2 mt-1.5">
                  Предельный срок применения взыскания — 6 месяцев: до <span className="font-medium text-tx">{sanctionDeadline}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-[14px] leading-[20px] font-medium text-tx mb-2">
                Дата и время обнаружения нарушения <span className="text-dgl">*</span>
              </label>
              <input
                type="datetime-local"
                className={`${inputBase} ${errors.discoveryDate ? inputError : ""}`}
                {...register("discoveryDate")}
              />
              {errors.discoveryDate ? (
                <div className="text-[12px] leading-[16px] text-dgl mt-1.5">{errors.discoveryDate.message}</div>
              ) : (
                <div className="text-[12px] leading-[16px] text-tx2 mt-1.5">
                  От этой даты отсчитывается 1 месяц на вынесение решения: до <span className="font-medium text-tx">{decisionDeadline}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col mb-4 w-full">
            <label className="text-[14px] leading-[20px] font-medium text-tx mb-2">
              Вид нарушения <span className="text-dgl">*</span>
            </label>
            <div className="relative">
              <select
                className={`${inputBase} appearance-none pr-10 ${errors.violationTypeCode ? inputError : ""}`}
                {...register("violationTypeCode")}
              >
                <option value="">Выберите значение…</option>
                {violationTypes.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-tx2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {errors.violationTypeCode ? (
              <div className="text-[12px] leading-[16px] text-dgl mt-1.5">{errors.violationTypeCode.message}</div>
            ) : (
              <div className="text-[12px] leading-[16px] text-tx2 mt-1.5">Значения берутся из справочника «Виды нарушений»</div>
            )}
          </div>

          <div className="flex flex-col mb-4 w-full">
            <label className="text-[14px] leading-[20px] font-medium text-tx mb-2">Участники дела</label>
            <div className="text-[12px] leading-[16px] text-tx2 -mt-1 mb-2">
              Нарушитель и инициатор (вы) добавляются автоматически. Здесь можно сразу указать участников и секретаря комиссии — это необязательно, добавить их можно и позже на странице дела.
            </div>

            {selectedEmployee && (
              <div className="flex items-center gap-3 p-3 mb-3 border border-bd rounded-inp bg-surf">
                {departmentHead && !departmentHeadNote ? (
                  <>
                    <Avatar avatarUrl={departmentHead.uid ? userApi.employeeAvatarUrl(departmentHead.uid) : null} name={departmentHead.fullName || "?"} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[14px] leading-[20px] text-tx truncate">{departmentHead.fullName}</div>
                      <div className="text-[12px] leading-[16px] text-tx2">
                        Руководитель подразделения{departmentHead.position ? ` · ${departmentHead.position}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-pr/10 px-2 py-0.5 text-[12px] leading-[16px] font-medium text-prl">
                      Добавится автоматически
                    </span>
                  </>
                ) : (
                  <div className="text-[13px] leading-[18px] text-tx2">{departmentHeadNote}</div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <div className="relative w-full min-w-0 xl:flex-1 xl:w-auto xl:min-w-[260px]">
                <div className="flex items-center gap-2 border border-bd rounded-inp bg-bg px-3 py-2.5 transition-colors focus-within:border-pr focus-within:ring-3 focus-within:ring-pr/10">
                  <svg className="shrink-0 text-tx2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                  <input
                    className="flex-1 min-w-0 border-none outline-none bg-transparent text-[14px] leading-[20px] text-tx placeholder:text-txm"
                    placeholder={selectedParticipant ? selectedParticipant.fullName : "ФИО или должность сотрудника"}
                    value={participantQuery}
                    onChange={(e) => {
                      setParticipantQuery(e.target.value);
                      setSelectedParticipant(null);
                      setParticipantListOpen(true);
                    }}
                    onFocus={() => setParticipantListOpen(true)}
                    onBlur={() => setTimeout(() => setParticipantListOpen(false), 150)}
                  />
                </div>

                {isParticipantListOpen && (() => {
                  const list = participantQuery.trim() ? participantResults : baseEmployees;
                  return (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-bg border border-bd rounded-inp shadow-dropdown max-h-[220px] overflow-y-auto z-50 scrollbar-thin">
                      {isSearchingParticipants ? (
                        <div className="px-3 py-2.5 text-[13px] text-tx2">Поиск...</div>
                      ) : list.length === 0 ? (
                        <div className="px-3 py-2.5 text-[13px] text-tx2">
                          {participantQuery.trim() ? `Ничего не найдено по запросу «${participantQuery.trim()}»` : "Сотрудники не найдены"}
                        </div>
                      ) : (
                        list.map((emp) => (
                          <div
                            key={emp.uid}
                            className="px-3 py-2.5 cursor-pointer hover:bg-surf flex items-center gap-2.5"
                            onMouseDown={() => {
                              setSelectedParticipant(emp);
                              setParticipantQuery(emp.fullName || "");
                              setParticipantListOpen(false);
                            }}
                          >
                            <Avatar
                              avatarUrl={emp.uid ? userApi.employeeAvatarUrl(emp.uid) : null}
                              name={emp.fullName || "?"}
                              size={32}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-[14px] leading-[20px] text-tx">{emp.fullName}</div>
                              <div className="text-[12px] leading-[16px] text-tx2">{emp.position}, таб. № {emp.tabNumber}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="relative flex-1 min-w-[160px] xl:flex-none">
                <select
                  className="w-full min-h-[40px] appearance-none border border-bd rounded-inp bg-bg pl-3 pr-10 py-2 text-[14px] text-tx outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
                  value={participantRole}
                  onChange={(e) => setParticipantRole(e.target.value as CaseAssigneeRole)}
                >
                  {ASSIGNABLE_CASE_ROLES.map((r) => (
                    <option key={r} value={r}>{getAssigneeRoleLabel(r)}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-tx2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <button
                type="button"
                className="shrink-0 flex-1 xl:flex-none px-4 py-2.5 rounded-inp font-medium text-[14px] leading-[20px] bg-bg text-prl border border-pr hover:bg-pr/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!selectedParticipant}
                onClick={addDraftParticipant}
              >
                Добавить
              </button>
            </div>

            {draftParticipants.length > 0 && (
              <div className="flex flex-col gap-2 mt-3">
                {draftParticipants.map((p) => (
                  <div key={p.employeeUid} className="flex items-center gap-3 p-3 border border-bd rounded-inp bg-bg">
                    <Avatar avatarUrl={userApi.employeeAvatarUrl(p.employeeUid)} name={p.fullName || "?"} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[14px] leading-[20px] text-tx truncate">{p.fullName}</div>
                      <div className="text-[12px] leading-[16px] text-tx2">
                        {getAssigneeRoleLabel(p.role)}
                        {p.position && ` · ${p.position}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-[14px] leading-[20px] font-medium text-prl hover:text-prt cursor-pointer px-2 py-1 shrink-0"
                      onClick={() => removeDraftParticipant(p.employeeUid)}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col mb-4 w-full">
            <label className="text-[14px] leading-[20px] font-medium text-tx mb-2">
              Описание нарушения <span className="text-xs text-tx2">(опционально)</span>
            </label>
            <textarea
              className={`${inputBase} resize-y min-h-[88px] ${errors.description ? inputError : ""}`}
              placeholder="Опишите обстоятельства нарушения…"
              {...register("description")}
            />
            {errors.description && <div className="text-[12px] leading-[16px] text-dgl mt-1.5">{errors.description.message}</div>}
          </div>

          <div className="flex flex-col w-full">
            <label className="text-[14px] leading-[20px] font-medium text-tx mb-2">Прикреплённые файлы</label>
            <div
              className={`border-2 border-dashed rounded-card p-5 flex flex-col items-center gap-3 text-tx2 transition-colors ${isDraggingOver ? "border-pr bg-acl text-prl" : "border-bd bg-surf hover:border-pr/50"}`}
              onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
              onDragLeave={() => setDraggingOver(false)}
              onDrop={handleDrop}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 17v3h16v-3" />
              </svg>
              <div className="text-center text-[14px] leading-[20px]">
                Перетащите служебные записки, акты, фото <br />
                <span className="text-txm">PDF, DOCX, JPG, PNG до 25 МБ</span>
              </div>
              <label className="px-4 py-2 rounded-inp font-medium text-[14px] leading-[20px] bg-bg text-prl border border-pr hover:bg-pr/5 cursor-pointer transition-colors">
                Выбрать файлы
                <input type="file" multiple className="hidden" onChange={handleFileInputChange} />
              </label>
            </div>
          </div>

          {formFiles.length > 0 && (
            <div className="mt-3 border border-bd rounded-md bg-bg overflow-hidden" role="table" aria-label="Прикреплённые файлы">
              <div
                role="row"
                className="hidden md:grid md:grid-cols-[minmax(0,1fr)_72px_96px_88px] md:items-center md:gap-x-4 px-3 py-2 bg-surf border-b border-bd text-[12px] leading-[16px] font-medium text-tx2"
              >
                <div role="columnheader">Файл</div>
                <div role="columnheader">Размер</div>
                <div role="columnheader">Добавлен</div>
                <div role="columnheader" className="text-right">Действия</div>
              </div>
              {formFiles.map((f) => {
                const style = getFileTypeStyle(f.name);
                return (
                  <div
                    key={f.id}
                    role="row"
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 border-b border-line last:border-b-0 transition-colors hover:bg-surf md:grid md:grid-cols-[minmax(0,1fr)_72px_96px_88px] md:items-center md:gap-x-4"
                  >
                    <div role="cell" className="flex items-center gap-3 min-w-[160px] flex-1 md:flex-none md:min-w-0">
                      <div
                        aria-hidden="true"
                        className={`w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${style.badgeClass}`}
                      >
                        {style.label}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] leading-[20px] font-medium text-tx truncate" title={f.name}>{f.name}</div>
                        <div className="md:hidden text-[12px] leading-[16px] text-tx2">
                          {style.label} · {f.sizeLabel} · добавлен {f.addedAt}
                        </div>
                      </div>
                    </div>
                    <div role="cell" className="hidden md:block text-[13px] leading-[18px] text-tx2 tabular-nums">{f.sizeLabel}</div>
                    <div role="cell" className="hidden md:block text-[13px] leading-[18px] text-tx2 tabular-nums">{f.addedAt}</div>
                    <div role="cell" className="flex items-center justify-end ml-auto md:ml-0">
                      <button
                        type="button"
                        className="text-[13px] leading-[18px] font-medium text-dgt hover:underline underline-offset-2 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                        onClick={() => removeFile(f.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[220px] flex flex-col gap-4 w-full">
          <div className="p-4 rounded-card bg-acl border border-acb text-prt flex gap-3 items-start">
            <span className="shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </span>
            <div>
              <div className="font-medium text-[14px] leading-[20px] mb-1">Номер и статус присваиваются автоматически</div>
              <div className="text-[13px] leading-[18px] opacity-90">
                После сохранения дело получит уникальный номер вида ДП-2026-XXXX и статус «Новое». Изменить номер вручную нельзя.
              </div>
            </div>
          </div>

          <div className="bg-bg border border-bd rounded-card p-4">
            <h3 className="text-[16px] leading-[24px] font-medium text-tx mb-3">Сроки, которые запустит система</h3>

            <div className="flex flex-wrap py-2.5 border-b border-line gap-x-4 gap-y-1">
              <span className="w-[180px] max-w-full shrink-0 text-[12px] leading-[16px] text-tx2 pt-0.5">Объяснение сотрудника</span>
              <div className="flex-1 min-w-[160px] break-words">
                <div className="text-[14px] leading-[20px] font-medium text-tx">{explanationDeadlineHint}</div>
                <div className="text-[12px] leading-[16px] text-tx2 mt-0.5">с учётом производственного календаря</div>
              </div>
            </div>

            <div className="flex flex-wrap py-2.5 border-b border-line gap-x-4 gap-y-1">
              <span className="w-[180px] max-w-full shrink-0 text-[12px] leading-[16px] text-tx2 pt-0.5">Вынесение решения</span>
              <div className="flex-1 min-w-[160px] break-words">
                <div className="text-[14px] leading-[20px] font-medium text-tx">1 месяц с даты обнаружения</div>
                <div className="text-[12px] leading-[16px] text-tx2 mt-0.5">за вычетом больничных и отпусков по данным 1С</div>
              </div>
            </div>

            <div className="flex flex-wrap py-2.5 gap-x-4 gap-y-1">
              <span className="w-[180px] max-w-full shrink-0 text-[12px] leading-[16px] text-tx2 pt-0.5">Предельный срок</span>
              <div className="flex-1 min-w-[160px] break-words">
                <div className="text-[14px] leading-[20px] font-medium text-tx">6 месяцев с даты совершения</div>
                <div className="text-[12px] leading-[16px] text-tx2 mt-0.5">взыскание после этой даты не применяется</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] leading-[20px] bg-bg text-prl border border-pr hover:bg-pr/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isSubmitting || !hasDraftableContent}
                onClick={() => {
                  handleSaveDraft();
                  navigate(-1);
                }}
              >
                Сохранить черновик
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] leading-[20px] bg-pr text-white border border-transparent hover:bg-prh disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isSubmitting || !isValid}
                onClick={() => {
                  setConfirmedData(false);
                  setConfirmedIrreversible(false);
                  setConfirmOpen(true);
                }}
              >
                {isSubmitting ? "Создаём…" : "Создать дело и сформировать требование"}
              </button>
            </div>
            <div className="text-[12px] leading-[16px] text-tx2">
              {draftSavedAt
                && `Черновик сохранён ${formatDraftTimestamp(draftSavedAt)}`}
            </div>
          </div>
        </div>
      </form>

      {isConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Подтверждение создания дела"
            className="bg-bg rounded-lg border border-bd w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-bd">
              <h3 className="text-[18px] font-bold text-tx">Проверьте данные перед созданием дела</h3>
              <div className="mt-1 text-[13px] text-tx2">Будет создано дело и сформировано требование о предоставлении объяснения.</div>
            </div>
            <dl className="p-4 flex flex-col gap-2 text-[14px]">
              {[
                ["Сотрудник", selectedEmployee ? `${selectedEmployee.fullName || "—"}${selectedEmployee.position ? `, ${selectedEmployee.position}` : ""}` : "—"],
                ["Вид нарушения", violationTypes.find((t) => t.code === form.violationTypeCode)?.name || form.violationTypeCode || "—"],
                ["Дата совершения", formatLocalDateTime(form.violationDate)],
                ["Дата обнаружения", formatLocalDateTime(form.discoveryDate)],
                ["Описание", form.description?.trim() || "—"],
                ["Руководитель подразделения", departmentHead && !departmentHeadNote ? `${departmentHead.fullName} (добавится автоматически)` : departmentHeadNote || "—"],
                ["Участники", draftParticipants.length > 0 ? draftParticipants.map((p) => `${p.fullName} (${getAssigneeRoleLabel(p.role)})`).join(", ") : "не добавлены"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <dt className="w-[140px] max-w-full shrink-0 text-[12px] leading-[20px] text-tx2">{label}</dt>
                  <dd className="flex-1 min-w-[160px] break-words text-tx">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="px-4 pb-3">
              <div className="text-[12px] leading-[20px] text-tx2 mb-1.5">
                Документы{formFiles.length > 0 ? ` (${formFiles.length})` : ""}
              </div>
              {formFiles.length === 0 ? (
                <div className="text-[14px] text-tx">не приложены</div>
              ) : (
                <div className="border border-bd rounded-md overflow-hidden max-h-[200px] overflow-y-auto">
                  {formFiles.map((f) => {
                    const style = getFileTypeStyle(f.name);
                    return (
                      <div key={f.id} className="flex items-center gap-2.5 px-2.5 py-1.5 border-b border-line last:border-b-0">
                        <div
                          aria-hidden="true"
                          className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold shrink-0 ${style.badgeClass}`}
                        >
                          {style.label}
                        </div>
                        <div className="flex-1 min-w-0 text-[13px] leading-[18px] text-tx truncate" title={f.name}>{f.name}</div>
                        <div className="shrink-0 text-[12px] leading-[16px] text-tx2 tabular-nums">{f.sizeLabel}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-4 pb-2 flex flex-col gap-2.5">
              <label className="flex items-start gap-2 text-[14px] text-tx cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded border-bd text-prl focus:ring-pr/20"
                  checked={confirmedData}
                  onChange={(e) => setConfirmedData(e.target.checked)}
                />
                Я проверил(а) данные, всё указано верно
              </label>
              <label className="flex items-start gap-2 text-[14px] text-tx cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded border-bd text-prl focus:ring-pr/20"
                  checked={confirmedIrreversible}
                  onChange={(e) => setConfirmedIrreversible(e.target.checked)}
                />
                Я понимаю, что после запроса требования дело нельзя закрыть без процесса
              </label>
            </div>
            <div className="flex gap-3 p-4">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors"
              >
                Вернуться к редактированию
              </button>
              <button
                type="button"
                disabled={!confirmedData || !confirmedIrreversible || isSubmitting}
                onClick={() => {
                  setConfirmOpen(false);
                  void handleSubmit(onValid, onInvalid)();
                }}
                className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Создать дело
              </button>
            </div>
          </div>
        </div>
      )}

      {generateModalData && (
        <GenerateDocumentModal
          caseId={generateModalData.caseId}
          caseNumber={generateModalData.caseNumber}
          violationTypeCode={generateModalData.violationTypeCode}
          violationTypeName={generateModalData.violationTypeName}
          violatorFullName={generateModalData.violatorFullName}
          violatorPosition={generateModalData.violatorPosition}
          generatorFullName={generatorFullName}
          generatorPosition={generatorPosition}
          domainName={generateModalData.domainName}
          departmentName={generateModalData.departmentName}
          employeeUid={generateModalData.employeeUid}
          incidentDateIso={generateModalData.incidentDateIso}
          discoveryDateIso={generateModalData.discoveryDateIso}
          explanationDeadlineIso={generateModalData.explanationDeadlineIso}
          timezone={timezone}
          purposeCode="EXPLANATION_REQUEST"
          title="Формирование требования о предоставлении объяснения"
          cancelLabel="Пропустить"
          onClose={() => {
            const caseId = generateModalData.caseId;
            setGenerateModalData(null);
            navigate(`/cases/${caseId}`);
          }}
        />
      )}
    </div>
  );
}