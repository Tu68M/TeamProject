import { useMemo } from "react";
import { CaseNumberText } from "@shared/ui/CaseNumberText";
import { useNavigate } from "react-router-dom";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { getCaseStatusBadgeClass, getCaseStatusLabel, calculateDeadline, isCaseLocked } from "@shared/utils/caseStatus";
import { formatServerDate, formatServerDateTime, parseServerDateTime } from "@shared/utils/datetime";
import type { CaseShortResponse } from "@shared/types/api";
import { FadeSwap } from "@shared/ui/FadeSwap";
import { getAssigneeRoleLabel } from "@shared/utils/caseAssigneeRole";

export interface RegistryCase extends CaseShortResponse {
  fio: string;
  department: string;
  violationType: string;
  discoveredDate: string;
  stage: string;
  isOverdue: boolean;
  isExpiringSoon: boolean;
  deadlineLabel: string;
  overdueDays: number;
}

export const isViolatorInCase = (c: CaseShortResponse): boolean => Boolean(c.myRoles?.includes("VIOLATOR"));

function MyRoleBadge({ c }: { c: CaseShortResponse }) {
  const roles = c.myRoles || [];
  if (roles.length === 0 || isViolatorInCase(c)) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-ntbg text-tx2 whitespace-nowrap">
      Вы — {roles.map(getAssigneeRoleLabel).join(", ").toLowerCase()}
    </span>
  );
}

function closedCaseDeadline(item: CaseShortResponse, timezone: string) {
  const empty = { isOverdue: false, isExpiringSoon: false, deadlineLabel: "", overdueDays: 0 };
  if (item.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ" && item.overdueSince) {
    return calculateDeadline(true, item.nearestOverdue, timezone, item.overdueSince);
  }
  return empty;
}

export function toRegistryCase(item: CaseShortResponse, timezone: string): RegistryCase {
  return {
    ...item,
    fio: item.snapshotFullName || "Не указан",
    department: item.snapshotDepartment || "Не указано",
    violationType: item.violationTypeName || "Не указан",
    discoveredDate: formatServerDate(item.incidentDate, timezone),
    stage: item.status || "—",
    ...(isCaseLocked(item.status)
      ? closedCaseDeadline(item, timezone)
      : calculateDeadline(item.isOverdue || false, item.nearestOverdue, timezone, item.overdueSince)),
  };
}

function CasesMineSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-5 animate-pulse">
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-bg border border-bd rounded-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-4 bg-skel rounded w-32" />
              <div className="h-5 bg-skel rounded w-28" />
            </div>
            <div className="h-5 bg-skel rounded w-3/4 mb-2" />
            <div className="h-3 bg-skel rounded w-48 mb-4" />
            <div className="h-14 bg-skel rounded-inp w-full" />
          </div>
        ))}
      </div>
      <div className="w-full lg:w-80 shrink-0">
        <div className="p-4 rounded-card bg-skel2 border border-bd h-24" />
      </div>
    </div>
  );
}

interface MyCasesViewProps {
  cases: CaseShortResponse[];
  isLoaded: boolean;
  emptyTitle?: string;
  emptyText?: string;
}

export function MyCasesView({
  cases,
  isLoaded,
  emptyTitle = "Список дел пуст",
  emptyText = "На данный момент у вас нет активных или завершённых дел.",
}: MyCasesViewProps) {
  const navigate = useNavigate();
  const { timezone } = useTimezoneStore();

  const myCases: RegistryCase[] = useMemo(
    () => cases.map((item) => toRegistryCase(item, timezone)),
    [cases, timezone]
  );

  const sortByNewest = (a: RegistryCase, b: RegistryCase): number => {
    const aTime = parseServerDateTime(a.createdAt || a.incidentDate)?.getTime() ?? 0;
    const bTime = parseServerDateTime(b.createdAt || b.incidentDate)?.getTime() ?? 0;
    return bTime - aTime;
  };

  const { activeCases, completedCases } = useMemo(() => {
    const active: RegistryCase[] = [];
    const completed: RegistryCase[] = [];
    myCases.forEach((c) => {
      if (isCaseLocked(c.status)) {
        completed.push(c);
      } else {
        active.push(c);
      }
    });

    const actionRequiredRank = (c: RegistryCase) =>
      c.status === "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ" && isViolatorInCase(c) ? 0 : 1;

    active.sort((a, b) => {
      const rankDiff = actionRequiredRank(a) - actionRequiredRank(b);
      if (rankDiff !== 0) return rankDiff;

      return sortByNewest(a, b);
    });

    completed.sort(sortByNewest);

    return { activeCases: active, completedCases: completed };
  }, [myCases]);

  return (
  <FadeSwap
    showSkeleton={!isLoaded}
    skeleton={<CasesMineSkeleton />}
  >
    <div className="flex flex-col lg:flex-row gap-5">
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {myCases.length === 0 ? (
          <div className="bg-bg border border-bd rounded-card p-8 text-center text-tx2">
            <div className="text-[16px] font-medium mb-1">{emptyTitle}</div>
            <div className="text-[14px]">{emptyText}</div>
          </div>
        ) : (
          <>
            {activeCases.map((c) => (
              <div key={c.id} className="bg-bg border border-wn/50 rounded-card p-4 sm:p-5 transition-shadow hover:shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="flex min-w-0 font-medium text-[14px] text-prl hover:cursor-pointer hover:underline" onClick={() => navigate(`/cases/${c.id}`)}><CaseNumberText value={c.caseNumber || `Дело #${c.id?.slice(0, 8)}`} /></span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium whitespace-nowrap ${getCaseStatusBadgeClass(c.status)}`}>{getCaseStatusLabel(c.status)}</span>
                  <MyRoleBadge c={c} />
                  {c.nearestOverdue && <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-wnbg text-wnt whitespace-nowrap ml-auto sm:ml-0">До {formatServerDate(c.nearestOverdue, timezone)}</span>}
                </div>
                <h3 className="text-[16px] font-medium text-tx mb-2">{c.violationType || "Дисциплинарный проступок"}</h3>
                <div className="text-[12px] text-tx2 mb-4">Дата совершения: {formatServerDateTime(c.incidentDate || c.createdAt, timezone)}</div>
                {c.status === "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ" && !isViolatorInCase(c) ? (
                  <div className="p-3 rounded-inp bg-surf border border-bd">
                    <div className="font-medium text-[14px] text-tx">Вы участник дела, а не нарушитель</div>
                    <div className="text-[13px] text-tx2">Письменное объяснение по этому делу должен предоставить нарушитель — ваших действий не требуется.</div>
                  </div>
                ) : c.status === "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ" ? (
                  <div className="p-3 rounded-inp flex flex-col sm:flex-row sm:items-center gap-3 bg-wnbg border border-wn/20">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[14px] mb-1 text-wnt">Требуется ваше действие</div>
                      <div className="text-[13px] text-wnt/90">Необходимо предоставить письменное объяснение в установленный срок.</div>
                    </div>
                    <button onClick={() => navigate(`/cases/${c.id}/explanation`)} className="w-full sm:w-auto px-4 py-2 rounded-inp text-[14px] font-medium whitespace-nowrap transition-colors shrink-0 bg-pr text-white hover:bg-prh">
                      Дать объяснение
                    </button>
                  </div>
                ) : c.status === "ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО" ? (
                  <div className="p-3 rounded-inp bg-dgbg border border-dg/20">
                    <div className="font-medium text-[14px] text-dgt">Срок предоставления объяснения истёк</div>
                    <div className="text-[13px] text-dgt/90">Объяснение не было предоставлено в установленный срок. Дело передано в обработку.</div>
                  </div>
                ) : (
                  <div className="p-3 rounded-inp bg-surf border border-bd">
                    <div className="font-medium text-[14px] text-tx">Действие не требуется</div>
                    <div className="text-[13px] text-tx2">Дело находится в обработке: {getCaseStatusLabel(c.status).toLowerCase()}.</div>
                  </div>
                )}
              </div>
            ))}

            {completedCases.length > 0 && activeCases.length > 0 && <h2 className="text-[18px] font-bold text-tx mt-4 mb-2">Завершённые дела</h2>}

            {completedCases.map((c) => (
              <div key={c.id} className="bg-bg border border-bd rounded-card p-4 sm:p-5 transition-shadow hover:shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="flex min-w-0 font-medium text-[14px] text-prl hover:cursor-pointer hover:underline" onClick={() => navigate(`/cases/${c.id}`)}><CaseNumberText value={c.caseNumber || `Дело #${c.id?.slice(0, 8)}`} /></span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium whitespace-nowrap ${getCaseStatusBadgeClass(c.status)}`}>{getCaseStatusLabel(c.status)}</span>
                  <MyRoleBadge c={c} />
                </div>
                <h3 className="text-[16px] font-medium text-tx mb-2">{c.violationType || "Дисциплинарный проступок"}</h3>
                <div className="text-[12px] text-tx2 mb-4">Дата совершения: {formatServerDateTime(c.incidentDate || c.createdAt, timezone)}</div>
                <div className="p-3 rounded-inp flex flex-col sm:flex-row sm:items-center gap-3 bg-surf border border-bd">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[14px] mb-1 text-tx">Дело завершено</div>
                    {(c.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ" || c.decisionTypeName) && (
                      <div className="text-[14px] leading-[20px] text-tx mb-1">
                        Решение:{" "}
                        <span className={`font-semibold ${c.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ" ? "text-okt" : ""}`}>
                          {c.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ" ? "Взыскание не применено" : c.decisionTypeName}
                        </span>
                      </div>
                    )}
                    <div className="text-[13px] text-tx2">Материалы дела и итоговое решение доступны для ознакомления.</div>
                  </div>
                  <button onClick={() => navigate(`/cases/${c.id}?tab=documents`)} className="w-full sm:w-auto px-4 py-2 rounded-inp text-[14px] font-medium whitespace-nowrap transition-colors shrink-0 bg-bg text-prl border border-pr hover:bg-pr/5">
                    Материалы и решение
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
        <div className="p-4 rounded-card bg-acl border border-acb text-prt flex gap-3 items-start">
          <span className="shrink-0 mt-0.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></svg>
          </span>
          <div>
            <div className="font-medium text-[14px] leading-[20px] mb-1">Как считается срок</div>
            <div className="text-[13px] leading-[18px] opacity-90">На подачу объяснения даётся 2 рабочих дня с момента вручения требования. Выходные и праздничные дни в срок не входят.</div>
          </div>
        </div>
      </div>
    </div>
  </FadeSwap>
  );
}
