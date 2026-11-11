import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import FilterSelect from "../../../shared/ui/FilterSelect";
import SortableTh, { type SortDirection } from "@/shared/ui/SortableTh";
import { FadeSwap } from "@shared/ui/FadeSwap";
import {
  useDashboardStats,
  useActionRequiredCases,
} from "@/entities/case/api/useCaseQueries";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { useNavBadgeStore } from "@shared/model/navBadgeStore";
import { formatNowDate, formatServerDate, parseServerDateTime } from "@shared/utils/datetime";
import {
  getCaseStatusBadgeClass,
  getCaseStatusLabel,
  getNextActionLabel,
  calculateDeadline,
} from "@shared/utils/caseStatus";
import type { CaseShortResponse } from "@shared/types/api";
import { ErrorState } from "@shared/ui/ErrorState";

function statusTextClass(status?: string): string {
  return getCaseStatusBadgeClass(status).split(" ").find((c) => c.startsWith("text-")) ?? "text-tx";
}

function pluralDays(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} дней`;
  if (mod10 === 1) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} дней`;
}

function pluralCases(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} дел`;
  if (mod10 === 1) return `${n} дело`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дела`;
  return `${n} дел`;
}

interface ActionRequiredRow {
  id: string;
  caseNumber: string;
  employee: string;
  department: string;
  status?: string;
  isOverdue: boolean;
  isExpiringSoon: boolean;
  deadlineLabel: string;
  overdueDays: number;
  nearestOverdue?: string | null;
  daysLeft: number | null;
  action: string;
}

function daysUntil(nearestOverdue: string | null | undefined, isOverdue: boolean): number | null {
  const ms = parseServerDateTime(nearestOverdue)?.getTime();
  if (isOverdue || ms === undefined) return null;
  return Math.max(0, Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24)));
}

function mapToRow(c: CaseShortResponse, timeZone: string): ActionRequiredRow {
  const deadline = calculateDeadline(c.isOverdue || false, c.nearestOverdue, timeZone, c.overdueSince);
  return {
    id: c.id || "",
    caseNumber: c.caseNumber || c.id || "—",
    employee: c.snapshotFullName || "Не указан",
    department: c.snapshotDepartment || "Не указано",
    status: c.status,
    nearestOverdue: c.nearestOverdue,
    daysLeft: daysUntil(c.nearestOverdue, deadline.isOverdue),
    action: getNextActionLabel(c.status, deadline.isOverdue, c.export1cStatus),
    ...deadline,
  };
}

type SortColumn = "caseNumber" | "deadline";

function deadlineSortValue(c: ActionRequiredRow): number {
  if (c.isOverdue) return -Infinity;
  const ms = parseServerDateTime(c.nearestOverdue)?.getTime();
  return ms ?? Infinity;
}

function compareByColumn(a: ActionRequiredRow, b: ActionRequiredRow, column: SortColumn): number {
  switch (column) {
    case "caseNumber":
      return a.caseNumber.localeCompare(b.caseNumber, "ru", { numeric: true });
    case "deadline":
      return deadlineSortValue(a) - deadlineSortValue(b);
    default:
      return 0;
  }
}

function DeadlineCell({ c, timeZone }: { c: ActionRequiredRow; timeZone: string }) {
  const targetMs = parseServerDateTime(c.nearestOverdue)?.getTime();
  const hasDate = targetMs !== undefined;
  const date = hasDate ? formatServerDate(c.nearestOverdue, timeZone) : "";

  if (c.isOverdue) {
    return (
      <>
        <div className="text-[14px] leading-[20px] font-medium text-dgt">{c.deadlineLabel}</div>
        {hasDate && <div className="text-[12px] leading-[16px] text-tx2">срок был {date}</div>}
      </>
    );
  }
  if (!hasDate) {
    return <div className="text-[14px] leading-[20px] text-tx2">{c.deadlineLabel}</div>;
  }
  const daysLeft = c.daysLeft ?? 0;
  return (
    <>
      <div className="text-[14px] leading-[20px] text-tx">до {date}</div>
      <div className={`text-[12px] leading-[16px] ${c.isExpiringSoon ? "font-medium text-wnt" : "text-tx2"}`}>
        {daysLeft === 0 ? "сегодня" : pluralDays(daysLeft)}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
  className = "",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "neutral" | "warning" | "danger";
  className?: string;
}) {
  const active = value > 0;
  const valueClass = active && tone === "danger" ? "text-dgt" : active && tone === "warning" ? "text-wnt" : "text-tx";
  return (
    <div className={`px-4 py-3 min-w-0 border-line ${className}`}>
      <div className="text-[12px] leading-[16px] text-tx2">{label}</div>
      <div className={`text-[28px] leading-[34px] font-bold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[12px] leading-[16px] text-tx2">{hint}</div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4">
        <div className="h-8 w-40 bg-skel rounded" />
        <div className="h-4 w-96 max-w-full bg-skel rounded mt-3" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 bg-bg border border-bd rounded-md mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex flex-col gap-2">
            <div className="h-3 w-24 bg-skel rounded" />
            <div className="h-7 w-14 bg-skel rounded" />
            <div className="h-3 w-36 bg-skel rounded" />
          </div>
        ))}
      </div>

      <div className="h-5 w-40 bg-skel rounded mb-3" />
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="h-9 w-40 bg-skel rounded-md" />
        <div className="h-9 w-40 bg-skel rounded-md" />
      </div>

      <div className="border border-bd rounded-md bg-bg overflow-x-auto">
        <table className="w-full min-w-max table-auto border-collapse">
          <thead>
            <tr>
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="text-left py-2 px-3 bg-bg border-b border-bd">
                  <div className="h-3.5 w-24 bg-skel rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="py-2 px-3 border-b border-line align-middle">
                  <div className="h-4 w-28 bg-skel rounded" />
                </td>
                <td className="py-2 px-3 border-b border-line align-middle">
                  <div className="h-4 w-40 bg-skel rounded" />
                  <div className="h-3 w-32 bg-skel rounded mt-1.5" />
                </td>
                <td className="py-2 px-3 border-b border-line align-middle">
                  <div className="h-4 w-28 bg-skel rounded" />
                </td>
                <td className="py-2 px-3 border-b border-line align-middle">
                  <div className="h-4 w-24 bg-skel rounded" />
                  <div className="h-3 w-14 bg-skel rounded mt-1.5" />
                </td>
                <td className="py-2 px-3 border-b border-line align-middle">
                  <div className="h-4 w-44 bg-skel rounded" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const { timezone } = useTimezoneStore();
  const canCreateCase = hasPermission("case:create") && hasPermission("case:write");

const [filterStatus, setFilterStatus] = useState<string | null>(null);
const [filterDepartment, setFilterDepartment] = useState<string | null>(null);
const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function toggleSort(column: SortColumn) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
    } else {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

const {
  data: statsData,
  isLoading: isStatsLoading,
  isFetching: isStatsFetching,
  isError: isStatsError,
  error: statsError,
  refetch: refetchStats,
} = useDashboardStats({ refetchInterval: 60_000 });

const {
  data: actionCasesData = [],
  isLoading: isActionLoading,
  isFetching: isActionFetching,
  isError: isActionError,
  error: actionError,
  refetch: refetchAction,
} = useActionRequiredCases({ refetchInterval: 60_000 });

  const hasAnyData = Boolean(statsData) || actionCasesData.length > 0;
  const isFirstLoad = (isStatsLoading || isActionLoading) && !hasAnyData;
  const isFetching = isStatsFetching || isActionFetching;

  const isError = isStatsError || isActionError;
  const error = statsError || actionError;

  const stats = statsData ?? {
    total: 0,
    expiringSoon: 0,
    awaitingCommission: 0,
    overdue: 0,
    active: 0,
    actionRequired: 0,
  };
  const actionCasesRaw = actionCasesData;

  const refreshToken = useNavBadgeStore((s) => s.refreshToken);

  useEffect(() => {
    if (refreshToken === 0) return;
    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    queryClient.invalidateQueries({ queryKey: ["dashboardActionRequired"] });
  }, [refreshToken, queryClient]);

  const requiringAction = useMemo(
    () => actionCasesRaw.map((c) => mapToRow(c, timezone)),
    [actionCasesRaw, timezone]
  );

const filteredAndSortedCases = useMemo(() => {
  let cases = requiringAction;
  if (filterStatus) cases = cases.filter((c) => c.status === filterStatus);
  if (filterDepartment) cases = cases.filter((c) => c.department === filterDepartment);

  if (!sortColumn) return cases;

  const sorted = [...cases];
  sorted.sort((a, b) => {
    const cmp = compareByColumn(a, b, sortColumn);
    return sortDirection === "asc" ? cmp : -cmp;
  });
  return sorted;
}, [requiringAction, filterStatus, filterDepartment, sortColumn, sortDirection]);

  const uniqueDepartments = useMemo(() => {
    const deps = new Set(requiringAction.map((c) => c.department).filter(Boolean));
    return Array.from(deps);
  }, [requiringAction]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(requiringAction.map((c) => c.status).filter(Boolean) as string[]);
    return Array.from(statuses);
  }, [requiringAction]);

  if (isError) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <ErrorState
          error={error}
          onRetry={() => {
            refetchStats();
            refetchAction();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 px-6 py-5 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <FadeSwap
        showSkeleton={isFirstLoad}
        skeleton={<DashboardSkeleton />}
      >
        <>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3 mb-4">
            <div className="flex-1 min-w-[260px]">
              <h1 className="text-[30px] leading-[36px] font-bold tracking-tight text-tx">Дашборд</h1>
              <div className="text-[14px] leading-[20px] text-tx2 mt-1">Контроль процессуальных сроков по делам, закреплённым за кадровой службой.</div>
            </div>
            {canCreateCase && (
              <button
                type="button"
                className="px-4 py-2 rounded-md font-medium text-[14px] leading-[20px] bg-pr text-white border border-transparent hover:bg-prh transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                onClick={() => navigate("/cases/new")}
              >
                Создать дело
              </button>
            )}
          </div>

          <section aria-label="Сводка по делам" className="grid grid-cols-2 lg:grid-cols-4 bg-bg border border-bd rounded-md mb-5">
            <Metric
              label="Дела на контроле"
              value={stats.total}
              hint={`в работе на ${formatNowDate(timezone)}`}
              className="border-r border-b lg:border-b-0"
            />
            <Metric
              label="Истекают сроки"
              value={stats.expiringSoon}
              tone="warning"
              hint="срок наступает в ближайшие 5 дней"
              className="border-b lg:border-b-0 lg:border-r"
            />
            <Metric
              label="Ждут комиссии"
              value={stats.awaitingCommission}
              hint="объяснение получено, заседание не назначено"
              className="border-r"
            />
            <Metric label="Просроченные дела" value={stats.overdue} tone="danger" hint="решение не вынесено в срок" />
          </section>

          <section aria-labelledby="dashboard-cases-heading">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 id="dashboard-cases-heading" className="text-[18px] leading-[24px] font-semibold text-tx m-0">Дела на контроле</h2>
              <span className="text-[13px] leading-[18px] text-tx2">{pluralCases(filteredAndSortedCases.length)}</span>
            </div>

            <div className="flex flex-wrap gap-2 items-center mb-3">
              <span className="text-[12px] leading-[16px] text-tx2 mr-1">Фильтры</span>

              <FilterSelect<string>
                label="Статус"
                value={filterStatus}
                onChange={setFilterStatus}
                options={uniqueStatuses}
                allLabel="Все статусы"
                optionLabels={Object.fromEntries(uniqueStatuses.map((st) => [st, getCaseStatusLabel(st)]))}
              />

              <FilterSelect<string>
                label="Подразделение"
                value={filterDepartment}
                onChange={setFilterDepartment}
                options={uniqueDepartments}
                allLabel="Все отделы"
              />

              {(filterStatus || filterDepartment) && (
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md font-medium text-[13px] leading-[18px] bg-transparent text-prl hover:bg-pr/10 cursor-pointer ml-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                  onClick={() => {
                    setFilterStatus(null);
                    setFilterDepartment(null);
                  }}
                >
                  Сбросить
                </button>
              )}
            </div>

            <div className="border border-bd rounded-md overflow-x-auto bg-bg w-full max-w-full block mb-6">
              <table className="w-full min-w-max table-auto border-collapse">
                <thead>
                  <tr>
                    <SortableTh label="Номер дела" active={sortColumn === "caseNumber"} direction={sortDirection} onClick={() => toggleSort("caseNumber")} className="w-[150px]" />
                    <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2.5 px-3 bg-bg border-b border-bd whitespace-nowrap w-[230px]">Сотрудник</th>
                    <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2.5 px-3 bg-bg border-b border-bd whitespace-nowrap w-[190px]">Текущий статус</th>
                    <SortableTh label="Оставшийся срок" active={sortColumn === "deadline"} direction={sortDirection} onClick={() => toggleSort("deadline")} className="w-[170px]" />
                    <th className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2.5 px-3 bg-bg border-b border-bd whitespace-nowrap">Требуется действие</th>
                  </tr>
                </thead>
                <tbody className={`transition-opacity ${isFetching ? "opacity-50" : "opacity-100"}`}>
                  {filteredAndSortedCases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-tx2">
                        {requiringAction.length === 0 ? "Нет дел, требующих действия" : "Нет дел, соответствующих фильтрам"}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedCases.map((c) => (
                      <tr key={c.id} className={`border-b border-line last:border-b-0 ${c.isOverdue ? "[&>td]:bg-dgsoft" : "hover:bg-surf transition-colors"}`}>
                        <td className="py-2 px-3 align-middle whitespace-nowrap max-w-[300px]">
                          <Link
                            to={`/cases/${c.id}`}
                            className="block font-medium text-[14px] leading-[20px] whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-prl hover:underline underline-offset-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                          >
                            {c.caseNumber}
                          </Link>
                        </td>
                        <td className="py-2 px-3 align-middle whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis">
                          <div className="font-medium text-[14px] leading-[20px] text-tx whitespace-nowrap overflow-hidden text-ellipsis max-w-full">{c.employee}</div>
                          <div className="text-[12px] leading-[16px] text-tx2 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">{c.department}</div>
                        </td>
                        <td className="py-2 px-3 align-middle whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 text-[14px] leading-[20px] ${statusTextClass(c.status)}`}>
                            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                            {getCaseStatusLabel(c.status)}
                          </span>
                        </td>
                        <td className="py-2 px-3 align-middle whitespace-nowrap">
                          <DeadlineCell c={c} timeZone={timezone} />
                        </td>
                        <td className="py-2 px-3 align-middle whitespace-nowrap max-w-[360px]">
                          <Link
                            to={`/cases/${c.id}`}
                            className="inline-flex items-center gap-1 max-w-full text-[14px] leading-[20px] font-medium text-tx hover:text-prl hover:underline underline-offset-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                          >
                            <span className="truncate">{c.action}</span>
                            <span aria-hidden="true" className="shrink-0">→</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      </FadeSwap>
    </div>
  );
}