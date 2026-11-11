import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { useMyCommissions } from "@/entities/case/api/useCaseQueries";
import { formatServerDateTime, parseServerDateTime } from "@shared/utils/datetime";
import { FadeSwap } from "@shared/ui/FadeSwap";
import {
  COMMISSION_MEMBER_ROLE_LABELS,
  getCommissionStatusBadgeClass,
  getCommissionStatusLabel,
  getVotingRuleLabel,
  getCurrentStageVotingDeadline,
} from "@shared/utils/commissionStatus";
import { getCaseStatusBadgeClass, getCaseStatusLabel } from "@shared/utils/caseStatus";
import { ErrorState } from "@shared/ui/ErrorState";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

type DeadlineUrgency = "overdue" | "urgent" | null;

function getDeadlineUrgency(deadlineIso: string | undefined, now: Date): DeadlineUrgency {
  const target = parseServerDateTime(deadlineIso);
  if (!target) return null;
  const diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) return "overdue";
  if (diffMs <= TWO_DAYS_MS) return "urgent";
  return null;
}

function CommissionsSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-bg border border-bd rounded-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="h-4 w-32 bg-skel rounded" />
            <div className="h-5 w-40 bg-skel rounded" />
            <div className="h-5 w-32 bg-skel rounded" />
            <div className="h-3 w-48 bg-skel rounded ml-auto" />
          </div>
          <div className="h-5 w-64 bg-skel rounded mb-2" />
          <div className="h-3 w-80 bg-skel rounded mb-3" />
          <div className="flex flex-wrap gap-1.5">
            <div className="h-5 w-24 bg-skel rounded" />
            <div className="h-5 w-28 bg-skel rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CommissionsPage() {
  const navigate = useNavigate();
  const { timezone } = useTimezoneStore();
  const [now] = useState(() => new Date());

  const { data: commissions = [], isLoading, isError, error, refetch } = useMyCommissions();

  const isFirstLoad = isLoading && commissions.length === 0;

  if (isError) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="mb-5">
        <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-bold text-tx">Комиссии</h1>
        <p className="text-[14px] leading-[20px] text-tx2 mt-1">
          Активные комиссии, в которых вы участвуете как председатель, секретарь или член.
        </p>
      </div>

      <FadeSwap
        showSkeleton={isFirstLoad}
        skeleton={<CommissionsSkeleton />}
      >
        {commissions.length === 0 ? (
          <div className="bg-bg border border-bd rounded-card p-8 text-center text-tx2">
            <div className="text-[16px] font-medium mb-1">Активных комиссий нет</div>
            <div className="text-[14px]">Сейчас вы не участвуете ни в одной действующей комиссии.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {commissions.map((item) => {
              const c = item.commission;
              const roles = item.myRoles || [];
              const deadline = getCurrentStageVotingDeadline(c);
              const urgency = getDeadlineUrgency(deadline, now);
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.caseId}?tab=commission`)}
                  className={`bg-bg border rounded-card p-4 sm:p-5 cursor-pointer transition-shadow hover:shadow-sm ${
                    urgency === "overdue"
                      ? "border-dg/30 border-l-4 border-l-dg"
                      : urgency === "urgent"
                        ? "border-wn/30 border-l-4 border-l-wn"
                        : "border-bd hover:border-pr/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-medium text-[14px] text-prl">
                      {item.caseNumber || `Дело #${c.caseId?.slice(0, 8)}`}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium whitespace-nowrap ${getCommissionStatusBadgeClass(c.status)}`}>
                      {getCommissionStatusLabel(c.status)}
                    </span>
                    {item.caseStatus && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium whitespace-nowrap ${getCaseStatusBadgeClass(item.caseStatus)}`}>
                        {getCaseStatusLabel(item.caseStatus)}
                      </span>
                    )}
                    <span
                      className={`ml-auto text-[12px] whitespace-nowrap ${
                        urgency === "overdue" ? "font-medium text-dgt" : urgency === "urgent" ? "font-medium text-wnt" : "text-tx2"
                      }`}
                    >
                      Срок голосования: {formatServerDateTime(deadline, timezone)}
                    </span>
                  </div>

                  <h3 className="text-[16px] font-medium text-tx mb-1">
                    {item.caseViolationTypeName || "Дисциплинарный проступок"}
                  </h3>
                  <div className="text-[13px] text-tx2 mb-3">
                    {item.caseEmployeeFullName ? `Сотрудник: ${item.caseEmployeeFullName}` : "Комиссия №" + c.iterationNumber}
                    {" · "}Правило голосования: {getVotingRuleLabel(c.votingRule)}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {roles.length === 0 ? (
                      <span className="text-[12px] text-tx2">Роль не определена</span>
                    ) : (
                      roles.map((role) => (
                        <span key={role} className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-acl text-prt">
                          {COMMISSION_MEMBER_ROLE_LABELS[role] || role}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FadeSwap>
    </div>
  );
}