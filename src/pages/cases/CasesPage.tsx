import { useEffect, useMemo, useState } from "react";
import { CaseNumberText } from "@shared/ui/CaseNumberText";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import FilterSelect from "@/shared/ui/FilterSelect";
import SortableTh, { type SortDirection } from "@/shared/ui/SortableTh";
import { caseApi } from "@/entities/case/api/caseApi";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { useNavBadgeStore } from "@shared/model/navBadgeStore";
import { useCaseRegistryStore } from "@shared/model/caseRegistryStore";
import { getCaseStatusBadgeClass, getCaseStatusLabel, isCaseLocked } from "@shared/utils/caseStatus";
import { getPageNumbers } from "@shared/utils/pagination";
import type { CaseFilterOptionsResponse, CaseShortResponse } from "@shared/types/api";
import { FadeSwap } from "@shared/ui/FadeSwap";
import { MyCasesView, toRegistryCase, type RegistryCase } from "./MyCasesView";
import { ErrorState } from "@shared/ui/ErrorState";
import { CasesArchiveModal } from "./CasesArchiveModal";
import { showAlert, showConfirm } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

type SortColumn = "caseNumber" | "fio" | "department" | "incidentDate" | "stage" | "deadline";

const PAGE_SIZE = 6;

function pluralCases(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "дело";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дела";
  return "дел";
}

const EMPTY_FILTER_OPTIONS: CaseFilterOptionsResponse = { statuses: [], departments: [], violationTypes: [] };

const dotText = "inline-flex items-center gap-1.5 max-w-full text-[13px] leading-[18px] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current before:shrink-0";

function DeadlineBadge({ c }: { c: RegistryCase }) {
  if (!c.deadlineLabel) return null;
  const tone = c.isOverdue ? "text-dgt font-medium" : c.isExpiringSoon ? "text-wnt font-medium" : "text-tx";
  return <span className={`${dotText} ${tone}`}><span className="truncate">{c.deadlineLabel}</span></span>;
}

function StageBadge({ status }: { status: string }) {
  const label = getCaseStatusLabel(status);
  const tone = getCaseStatusBadgeClass(status).split(" ").find((t) => t.startsWith("text-")) ?? "text-tx";
  return (
    <span className={`${dotText} ${tone}`} title={label}>
      <span className="truncate">{label}</span>
    </span>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);
  const isFirst = currentPage === 0;
  const isLast = currentPage >= totalPages - 1;

  return (
    <nav
      aria-label="Пагинация"
      className="flex items-center justify-center gap-2 select-none"
    >
      <button
        type="button"
        aria-label="Предыдущая страница"
        onClick={() => !isFirst && onPageChange(currentPage - 1)}
        disabled={isFirst}
        className={`flex items-center justify-center w-9 h-9 rounded-inp transition-colors
          ${isFirst
            ? "text-tx2/40 cursor-not-allowed"
            : "text-tx hover:bg-surf border border-transparent hover:border-bd"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span
            key={`ellipsis-${i}`}
            className="flex items-center justify-center w-9 h-9 text-[14px] text-tx2"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Страница ${p + 1}`}
            aria-current={p === currentPage ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className={`flex items-center justify-center w-9 h-9 rounded-inp text-[14px] font-medium transition-colors
              ${p === currentPage
                ? "bg-pr text-white border border-pr"
                : "bg-bg text-tx border border-bd hover:border-pr/40 hover:text-prl"}`}
          >
            {p + 1}
          </button>
        )
      )}

      <button
        type="button"
        aria-label="Следующая страница"
        onClick={() => !isLast && onPageChange(currentPage + 1)}
        disabled={isLast}
        className={`flex items-center justify-center w-9 h-9 rounded-inp transition-colors
          ${isLast
            ? "text-tx2/40 cursor-not-allowed"
            : "text-tx hover:bg-surf border border-transparent hover:border-bd"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </nav>
  );
}

function CasesRegistrySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex flex-wrap gap-3 items-center py-3 border-y border-bd">
        <div className="h-4 w-16 bg-skel rounded" />
        <div className="h-8 w-40 bg-skel rounded-inp" />
        <div className="h-8 w-48 bg-skel rounded-inp" />
        <div className="h-8 w-40 bg-skel rounded-inp" />
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed border-collapse min-w-[1040px]">
          <colgroup>
            <col className="w-[11%]" /><col className="w-[16%]" /><col className="w-[14%]" />
            <col className="w-[14%]" /><col className="w-[8%]" /><col className="w-[16%]" /><col className="w-[14%]" /><col className="w-[7%]" />
          </colgroup>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {[24, 32, 24, 32, 16, 24, 24, 0].map((w, j) => (
                  <td key={j} className="py-2 px-3 border-b border-line align-middle">
                    {w > 0 && <div className="h-4 bg-skel rounded" style={{ width: `${w * 4}px`, maxWidth: "100%" }} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CasesPage() {
  const navigate = useNavigate();
  const { hasPermission, hasModule } = useAuthStore();
  const { timezone } = useTimezoneStore();

  const queryClient = useQueryClient()

  const isHr = hasModule("dashboard");
  const canCreateCase = hasPermission("case:create") && hasPermission("case:write");
  const canArchive = isHr && hasPermission("case:write");
  const [isArchiveOpen, setArchiveOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const handleArchive = async (id?: string, caseNumber?: string) => {
    if (!id) return;
    const ok = await showConfirm(
      `Дело ${caseNumber || ""} будет убрано из реестра в архив. Его можно открыть и вернуть из архива.`.replace("  ", " "),
      { title: "Отправить в архив", confirmLabel: "В архив" }
    );
    if (!ok) return;
    setArchivingId(id);
    try {
      await caseApi.archiveCase(id);
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    } catch (err) {
      console.error("Ошибка отправки дела в архив:", err);
      showAlert(getErrorMessage(err, "Не удалось отправить дело в архив"));
    } finally {
      setArchivingId(null);
    }
  };

  const refreshToken = useNavBadgeStore((s) => s.refreshToken);

  const [status, setStatus] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [violationType, setViolationType] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(0);

  const filterOptionsQuery = useQuery({
    queryKey: ["cases", "filterOptions"],
    queryFn: () => caseApi.getCaseFilterOptions(),
    enabled: isHr,
  });
  const filterOptions = filterOptionsQuery.data ?? EMPTY_FILTER_OPTIONS;

  const registryQuery = useQuery({
    queryKey: [
      "cases",
      "registry",
      {
        page: currentPage,
        size: PAGE_SIZE,
        status,
        department,
        violationType,
        sortBy: sortColumn,
        sortDirection: sortColumn ? sortDirection : null,
      },
    ],
    queryFn: () =>
      caseApi.getCases({
        page: currentPage,
        size: PAGE_SIZE,
        status: status || undefined,
        department: department || undefined,
        violationType: violationType || undefined,
        sortBy: sortColumn || undefined,
        sortDirection: sortColumn ? sortDirection : undefined,
      }),
    enabled: isHr,
    placeholderData: keepPreviousData,
  });

  const registryCases: CaseShortResponse[] = registryQuery.data?.content ?? [];
  const totalElements = registryQuery.data?.totalElements ?? 0;
  const totalPages = Math.max(1, registryQuery.data?.totalPages ?? 1);
  const isRegistryFetching = registryQuery.isFetching;

  useEffect(() => {
    if (refreshToken === 0 || !isHr) return;
    queryClient.invalidateQueries({ queryKey: ["cases", "registry"] });
    queryClient.invalidateQueries({ queryKey: ["cases", "filterOptions"] });
  }, [refreshToken, isHr, queryClient]);

  function toggleSort(column: SortColumn) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
    } else {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    }
    setCurrentPage(0);
  }

  function handleSetStatus(value: string | null) {
    setStatus(value);
    setCurrentPage(0);
  }

  function handleSetDepartment(value: string | null) {
    setDepartment(value);
    setCurrentPage(0);
  }

  function handleSetViolationType(value: string | null) {
    setViolationType(value);
    setCurrentPage(0);
  }

  function resetFilters() {
    setStatus(null);
    setDepartment(null);
    setViolationType(null);
    setCurrentPage(0);
  }

  const hasActiveFilters = status || department || violationType;
  const statusOptionLabels = useMemo(
    () => Object.fromEntries(filterOptions.statuses.map((s) => [s, getCaseStatusLabel(s)])),
    [filterOptions.statuses]
  );

  const pagedRegistryCases: RegistryCase[] = useMemo(
    () => registryCases.map((item) => toRegistryCase(item, timezone)),
    [registryCases, timezone]
  );

  const rawCases = useCaseRegistryStore((s) => s.cases);
  const isMyCasesLoaded = useCaseRegistryStore((s) => s.isLoaded);
  const myCasesError = useCaseRegistryStore((s) => s.error);
  const ensureMyCasesLoaded = useCaseRegistryStore((s) => s.ensureLoaded);
  const refreshMyCases = useCaseRegistryStore((s) => s.refresh);

  useEffect(() => {
    if (isHr) return;
    ensureMyCasesLoaded().catch(() => {});
  }, [isHr, ensureMyCasesLoaded]);

  useEffect(() => {
    if (isHr || refreshToken === 0) return;
    refreshMyCases().catch(() => {});
  }, [isHr, refreshToken, refreshMyCases]);

  const error = isHr ? registryQuery.error : myCasesError;

  if (error) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <ErrorState error={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[34px] font-semibold text-tx">
            {isHr ? "Реестр дисциплинарных дел" : "Мои дела"}
          </h1>
          <p className="text-[14px] leading-[20px] text-tx2 mt-0.5">
            {isHr ? "Управление и контроль процессуальных сроков по всем делам." : "Дела, в которых вы указаны как сотрудник."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {isHr && (
            <button
              type="button"
              aria-label="Архив дел"
              title="Архив дел"
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-3.5 h-[42px] text-[14px] font-medium rounded-inp bg-bg text-tx2 border border-bd hover:bg-surf hover:text-tx transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
              onClick={() => setArchiveOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
                <path d="M10 12h4" />
              </svg>
              Архив
            </button>
          )}
          {canCreateCase && (
            <button
              className="w-full sm:w-auto px-4 py-2.5 rounded-inp font-medium text-[14px] leading-[20px] bg-pr text-white border border-transparent hover:bg-prh transition-colors cursor-pointer"
              onClick={() => navigate("/cases/new")}
            >
              Создать дело
            </button>
          )}
        </div>
      </div>

      {isHr ? (
  <FadeSwap
    showSkeleton={!registryQuery.data}
    skeleton={<CasesRegistrySkeleton />}
  >
    <>
      <div className="flex flex-wrap gap-3 items-center py-3 border-y border-bd">
        <span className="text-[12px] leading-[16px] text-tx2 font-medium uppercase tracking-wide">Фильтры</span>
        <FilterSelect<string> label="Статус" value={status} onChange={handleSetStatus} options={filterOptions.statuses} allLabel="Все статусы" optionLabels={statusOptionLabels} />
        <FilterSelect<string> label="Подразделение" value={department} onChange={handleSetDepartment} options={filterOptions.departments} allLabel="Все подразделения" />
        <FilterSelect<string> label="Вид нарушения" value={violationType} onChange={handleSetViolationType} options={filterOptions.violationTypes} allLabel="Все виды" />
        {hasActiveFilters && (
          <button className="px-3 py-1.5 rounded-inp font-medium text-[14px] leading-[20px] bg-transparent text-prl hover:bg-pr/10 transition-colors cursor-pointer" onClick={resetFilters}>Сбросить</button>
        )}
        <span className="ml-auto text-[13px] text-tx2 whitespace-nowrap" aria-live="polite">
          {totalElements} {pluralCases(totalElements)}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed border-collapse min-w-[1040px]">
          <colgroup>
            <col className="w-[11%]" /><col className="w-[16%]" /><col className="w-[14%]" />
            <col className="w-[14%]" /><col className="w-[8%]" /><col className="w-[16%]" /><col className="w-[14%]" /><col className="w-[7%]" />
          </colgroup>
          <thead>
            <tr>
              <SortableTh label="Номер дела" active={sortColumn === "caseNumber"} direction={sortDirection} onClick={() => toggleSort("caseNumber")} />
              <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-3 bg-transparent border-b border-bd whitespace-nowrap">ФИО сотрудника</th>
              <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-3 bg-transparent border-b border-bd whitespace-nowrap">Подразделение</th>
              <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-3 bg-transparent border-b border-bd whitespace-nowrap">Вид нарушения</th>
              <SortableTh label="Дата" active={sortColumn === "incidentDate"} direction={sortDirection} onClick={() => toggleSort("incidentDate")} />
              <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-3 bg-transparent border-b border-bd whitespace-nowrap">Этап</th>
              <SortableTh label="Срок" active={sortColumn === "deadline"} direction={sortDirection} onClick={() => toggleSort("deadline")} />
              <th className="py-2 px-3 border-b border-bd"><span className="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody className={`transition-opacity ${isRegistryFetching ? "opacity-50" : "opacity-100"}`}>
            {pagedRegistryCases.length === 0 ? (
              <tr><td colSpan={8} className="py-10 px-3 text-center">
                {isRegistryFetching ? (
                  <span className="text-[14px] text-tx2">Загрузка...</span>
                ) : (
                  <>
                    <div className="text-[14px] font-medium text-tx">Дела не найдены</div>
                    <div className="text-[13px] text-tx2 mt-0.5">Дел, подходящих под фильтры, не найдено.</div>
                  </>
                )}
              </td></tr>
            ) : (
              pagedRegistryCases.map((c) => (
                <tr key={c.id} className={`transition-colors ${c.isExpiringSoon ? "bg-wnbg/50 hover:bg-wnbg" : "hover:bg-surf"}`}>
                  <td className="py-2 px-3 border-b border-line align-middle overflow-hidden">
                    <a
                      href={`/cases/${c.id}`}
                      className="flex min-w-0 font-medium text-[14px] leading-[20px] text-prl hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        navigate(`/cases/${c.id}`);
                      }}
                    >
                      <CaseNumberText value={c.caseNumber || `Дело #${c.id?.slice(0, 8)}`} />
                    </a>
                  </td>
                  <td className="py-2 px-3 border-b border-line align-middle overflow-hidden break-words text-[14px] leading-[20px] font-medium text-tx">{c.fio}</td>
                  <td className="py-2 px-3 border-b border-line align-middle overflow-hidden break-words text-[14px] leading-[20px] text-tx2">{c.department}</td>
                  <td className="py-2 px-3 border-b border-line align-middle overflow-hidden break-words text-[14px] leading-[20px] text-tx">{c.violationType}</td>
                  <td className="py-2 px-3 border-b border-line align-middle whitespace-nowrap text-[14px] leading-[20px] text-tx">{c.discoveredDate}</td>
                  <td className="py-2 px-3 border-b border-line align-middle overflow-hidden"><StageBadge status={c.stage} /></td>
                  <td className="py-2 px-3 border-b border-line align-middle overflow-hidden"><DeadlineBadge c={c} /></td>
                  <td className="py-2 px-3 border-b border-line align-middle text-right whitespace-nowrap">
                    {canArchive && isCaseLocked(c.status) && (
                      <button
                        type="button"
                        disabled={archivingId === c.id}
                        className="text-[13px] font-medium text-prl hover:text-prt disabled:opacity-50 transition-colors cursor-pointer"
                        onClick={() => handleArchive(c.id, c.caseNumber)}
                      >
                        {archivingId === c.id ? "…" : "В архив"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalElements > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 mb-4">
          <div className="text-[13px] text-tx2">
            Показано {pagedRegistryCases.length} из {totalElements}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </>
  </FadeSwap>
) : (
  <MyCasesView cases={rawCases} isLoaded={isMyCasesLoaded} />
)}
      {isArchiveOpen && <CasesArchiveModal canRestore={canArchive} onClose={() => setArchiveOpen(false)} />}
    </div>
  );
}