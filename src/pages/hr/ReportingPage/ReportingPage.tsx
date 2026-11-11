import { useMemo, useState, type ReactNode } from "react";
import { useAuthStore } from "@entities/session/model/authStore";
import { useMyOrgScope } from "@entities/session/model/useMyOrgScope";
import {
  useAllDomainsStats,
  useDepartmentsStatsForDomain,
  useMyDepartmentStats,
  useMyDomainStats,
  useReactionSpeedHeatmap,
  useViolationDepartmentHeatmap,
  useWeeklyPatternHeatmap,
} from "@/entities/case/api/useCaseStatsQueries";
import { HeatmapGrid } from "@shared/ui/HeatmapGrid";
import { StatsLineChart } from "@shared/ui/StatsLineChart";
import { StatsPieChart } from "@shared/ui/StatsPieChart";
import type { ReactionSpeedGroupBy, StatResponse, StatsDateFormat } from "@shared/types/api";

type StatsTier = "department" | "domain" | "all" | "none";

function resolveTier(hasPermission: (code: string) => boolean): StatsTier {
  if (hasPermission("stats:read:all")) return "all";
  if (hasPermission("stats:read:domain")) return "domain";
  if (hasPermission("stats:read:department")) return "department";
  return "none";
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

const FORMAT_OPTIONS: { value: StatsDateFormat; label: string }[] = [
  { value: "ДЕНЬ", label: "По дням" },
  { value: "НЕДЕЛЯ", label: "По неделям" },
  { value: "МЕСЯЦ", label: "По месяцам" },
  { value: "ГОД", label: "По годам" },
];

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="bg-bg border border-bd rounded-card p-5">
      <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-[16px] font-medium text-tx m-0">{title}</h3>
        {hint && <span className="text-[12px] text-tx2">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function QueryState({ isLoading, isError, children }: { isLoading: boolean; isError: boolean; children: ReactNode }) {
  if (isLoading) return <div className="text-[13px] text-tx2 py-4">Загрузка...</div>;
  if (isError) return <div className="text-[13px] text-dgt py-4">Не удалось загрузить данные</div>;
  return <>{children}</>;
}

function DepartmentTierSections({
  from,
  to,
  format,
  departmentId,
}: {
  from: string;
  to: string;
  format: StatsDateFormat;
  departmentId?: string;
}) {
  const timeSeries = useMyDepartmentStats({ from, to, format });
  const violationHeatmap = useViolationDepartmentHeatmap(
    { from, to, departmentId },
    Boolean(departmentId)
  );
  const reactionHeatmap = useReactionSpeedHeatmap(
    { from, to, departmentId, groupBy: "VIOLATION_TYPE" },
    Boolean(departmentId)
  );
  const weeklyHeatmap = useWeeklyPatternHeatmap({ from, to, departmentId }, Boolean(departmentId));

  const seriesData: StatResponse[] = timeSeries.data ? [timeSeries.data] : [];

  return (
    <>
      <Card title={`Дела по департаменту${timeSeries.data?.rowName ? ` «${timeSeries.data.rowName}»` : ""}`}>
        <QueryState isLoading={timeSeries.isLoading} isError={timeSeries.isError}>
          <StatsLineChart data={seriesData} />
        </QueryState>
      </Card>

      <Card title="Тип нарушения" hint="количество дел по видам нарушений">
        <QueryState isLoading={violationHeatmap.isLoading} isError={violationHeatmap.isError}>
          <HeatmapGrid data={violationHeatmap.data || []} />
        </QueryState>
      </Card>

      <Card title="Скорость реакции" hint="дата обнаружения → внесение в систему">
        <QueryState isLoading={reactionHeatmap.isLoading} isError={reactionHeatmap.isError}>
          <HeatmapGrid data={reactionHeatmap.data || []} />
        </QueryState>
      </Card>

      <Card title="Недельная динамика" hint="час совершения × день недели, строго дата нарушения">
        <QueryState isLoading={weeklyHeatmap.isLoading} isError={weeklyHeatmap.isError}>
          <HeatmapGrid data={weeklyHeatmap.data || []} />
        </QueryState>
      </Card>
    </>
  );
}

function DomainTierSections({
  from,
  to,
  format,
  domainId,
  reactionGroupBy,
  onReactionGroupByChange,
}: {
  from: string;
  to: string;
  format: StatsDateFormat;
  domainId?: string;
  reactionGroupBy: ReactionSpeedGroupBy;
  onReactionGroupByChange: (v: ReactionSpeedGroupBy) => void;
}) {
  const domainSeries = useMyDomainStats({ from, to, format });
  const departmentsSeries = useDepartmentsStatsForDomain(domainId, { from, to, format });
  const violationHeatmap = useViolationDepartmentHeatmap({ from, to, domainId }, Boolean(domainId));
  const reactionHeatmap = useReactionSpeedHeatmap(
    { from, to, domainId, groupBy: reactionGroupBy },
    Boolean(domainId)
  );
  const weeklyHeatmap = useWeeklyPatternHeatmap({ from, to, domainId }, Boolean(domainId));

  const domainSeriesData: StatResponse[] = domainSeries.data ? [domainSeries.data] : [];

  const allDeptRows = violationHeatmap.data || [];
  const departmentNames = allDeptRows.map((r) => r.rowName).filter(Boolean) as string[];

  const [selectedDept, setSelectedDept] = useState<string>("");
  const effectiveDept = selectedDept || departmentNames[0] || "";
  const selectedRow = allDeptRows.find((r) => r.rowName === effectiveDept);

  return (
    <>
      <Card title={`Дела по домену${domainSeries.data?.rowName ? ` «${domainSeries.data.rowName}»` : ""}`}>
        <QueryState isLoading={domainSeries.isLoading} isError={domainSeries.isError}>
          <StatsLineChart data={domainSeriesData} />
        </QueryState>
      </Card>

      <Card title="Дела по департаментам домена" hint="разбивка внутри домена">
        <QueryState isLoading={departmentsSeries.isLoading} isError={departmentsSeries.isError}>
          <StatsLineChart data={departmentsSeries.data || []} type="bar" />
        </QueryState>
      </Card>

      <Card title="Скорость реакции" hint="дата обнаружения → внесение в систему; красный = бюрократия/замалчивание">
        <div className="mb-3 flex gap-2">
          {(["VIOLATION_TYPE", "DEPARTMENT"] as ReactionSpeedGroupBy[]).map((g) => (
            <button
              key={g}
              type="button"
              className={`px-3 py-1.5 rounded-inp text-[12px] font-medium border transition-colors ${
                reactionGroupBy === g ? "bg-pr text-white border-pr" : "bg-bg text-tx2 border-bd hover:bg-surf"
              }`}
              onClick={() => onReactionGroupByChange(g)}
            >
              {g === "VIOLATION_TYPE" ? "По типу нарушения" : "По департаменту"}
            </button>
          ))}
        </div>
        <QueryState isLoading={reactionHeatmap.isLoading} isError={reactionHeatmap.isError}>
          <HeatmapGrid data={reactionHeatmap.data || []} />
        </QueryState>
      </Card>

      <Card title="Тип нарушения × Департамент" hint="где чаще всего какие нарушения">
        <QueryState isLoading={violationHeatmap.isLoading} isError={violationHeatmap.isError}>
          {departmentNames.length === 0 ? (
            <div className="text-[13px] text-tx2 py-4">Нет данных за выбранный период</div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[13px] text-tx2 whitespace-nowrap">Департамент</label>
                <select
                  className="border border-bd rounded-inp px-2.5 py-1.5 text-[13px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10 bg-bg"
                  value={effectiveDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  {departmentNames.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <StatsPieChart data={selectedRow} />
            </div>
          )}
        </QueryState>
      </Card>

      <Card title="Недельная динамика" hint="час совершения × день недели, строго дата нарушения">
        <QueryState isLoading={weeklyHeatmap.isLoading} isError={weeklyHeatmap.isError}>
          <HeatmapGrid data={weeklyHeatmap.data || []} />
        </QueryState>
      </Card>
    </>
  );
}

function AllTierSections({
  from,
  to,
  format,
  reactionGroupBy,
  onReactionGroupByChange,
}: {
  from: string;
  to: string;
  format: StatsDateFormat;
  reactionGroupBy: ReactionSpeedGroupBy;
  onReactionGroupByChange: (v: ReactionSpeedGroupBy) => void;
}) {
  const domainsSeries = useAllDomainsStats({ from, to, format });
  const violationHeatmap = useViolationDepartmentHeatmap({ from, to });
  const reactionHeatmap = useReactionSpeedHeatmap({ from, to, groupBy: reactionGroupBy });
  const weeklyHeatmap = useWeeklyPatternHeatmap({ from, to });

  return (
    <>
      <Card title="Дела по доменам" hint="вся компания">
        <QueryState isLoading={domainsSeries.isLoading} isError={domainsSeries.isError}>
          <StatsLineChart data={domainsSeries.data || []} type="bar" />
        </QueryState>
      </Card>

      <Card title="Тип нарушения × Департамент" hint="где чаще всего какие нарушения, по всей компании">
        <QueryState isLoading={violationHeatmap.isLoading} isError={violationHeatmap.isError}>
          <HeatmapGrid data={violationHeatmap.data || []} rowLabel="Департамент" />
        </QueryState>
      </Card>

      <Card title="Скорость реакции" hint="дата обнаружения → внесение в систему; красный = бюрократия/замалчивание">
        <div className="mb-3 flex gap-2">
          {(["VIOLATION_TYPE", "DEPARTMENT"] as ReactionSpeedGroupBy[]).map((g) => (
            <button
              key={g}
              type="button"
              className={`px-3 py-1.5 rounded-inp text-[12px] font-medium border transition-colors ${
                reactionGroupBy === g ? "bg-pr text-white border-pr" : "bg-bg text-tx2 border-bd hover:bg-surf"
              }`}
              onClick={() => onReactionGroupByChange(g)}
            >
              {g === "VIOLATION_TYPE" ? "По типу нарушения" : "По департаменту"}
            </button>
          ))}
        </div>
        <QueryState isLoading={reactionHeatmap.isLoading} isError={reactionHeatmap.isError}>
          <HeatmapGrid data={reactionHeatmap.data || []} />
        </QueryState>
      </Card>

      <Card title="Недельная динамика" hint="час совершения × день недели, строго дата нарушения, по всей компании">
        <QueryState isLoading={weeklyHeatmap.isLoading} isError={weeklyHeatmap.isError}>
          <HeatmapGrid data={weeklyHeatmap.data || []} />
        </QueryState>
      </Card>
    </>
  );
}

export default function ReportingPage() {
  const { hasPermission } = useAuthStore();
  const tier = resolveTier(hasPermission);
  const { departmentId, domainId, isLoading: isScopeLoading } = useMyOrgScope();

  const [{ from, to }, setRange] = useState(defaultRange);
  const [format, setFormat] = useState<StatsDateFormat>("НЕДЕЛЯ");
  const [reactionGroupBy, setReactionGroupBy] = useState<ReactionSpeedGroupBy>("DEPARTMENT");

  const scopeLabel = useMemo(() => {
    switch (tier) {
      case "all":
        return "Вся компания";
      case "domain":
        return "Ваш домен";
      case "department":
        return "Ваш департамент";
      default:
        return "";
    }
  }, [tier]);

  if (tier === "none") {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <div className="text-center py-10 text-tx2">
          У вас нет прав на просмотр статистики дел.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="mb-4">
        <div className="text-[12px] leading-[16px] text-tx2 mb-1">{scopeLabel}</div>
        <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-bold text-tx">
          Статистика
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-[13px] text-tx2">С</label>
          <input
            type="date"
            className="border border-bd rounded-inp px-2.5 py-1.5 text-[13px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
            value={from}
            max={to}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[13px] text-tx2">По</label>
          <input
            type="date"
            className="border border-bd rounded-inp px-2.5 py-1.5 text-[13px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
            value={to}
            min={from}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[13px] text-tx2 whitespace-nowrap">Шаг графика</label>
          <select
            className="border border-bd rounded-inp px-2.5 py-1.5 text-[13px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10 bg-bg"
            value={format}
            onChange={(e) => setFormat(e.target.value as StatsDateFormat)}
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(tier === "department" || tier === "domain") && isScopeLoading && (
        <div className="text-[13px] text-tx2 mb-4">Определяю область видимости...</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {tier === "domain" && (
          <DomainTierSections
            from={from}
            to={to}
            format={format}
            domainId={domainId}
            reactionGroupBy={reactionGroupBy}
            onReactionGroupByChange={setReactionGroupBy}
          />
        )}
        {tier === "department" && (
          <DepartmentTierSections from={from} to={to} format={format} departmentId={departmentId} />
        )}
        {tier === "all" && (
          <AllTierSections
            from={from}
            to={to}
            format={format}
            reactionGroupBy={reactionGroupBy}
            onReactionGroupByChange={setReactionGroupBy}
          />
        )}
      </div>
    </div>
  );
}