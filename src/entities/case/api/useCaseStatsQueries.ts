import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { caseStatsApi, type DateRangeParams, type HeatmapScopeParams } from "./caseStatsApi";
import type { ReactionSpeedGroupBy, StatsDateFormat } from "@shared/types/api";

export function useMyDepartmentStats(params: DateRangeParams & { format: StatsDateFormat }, enabled = true) {
  return useQuery({
    queryKey: ["stats", "department", params],
    queryFn: () => caseStatsApi.getMyDepartmentStats(params),
    enabled,
  });
}

export function useMyDomainStats(params: DateRangeParams & { format: StatsDateFormat }, enabled = true) {
  return useQuery({
    queryKey: ["stats", "domain", params],
    queryFn: () => caseStatsApi.getMyDomainStats(params),
    enabled,
  });
}

export function useAllDomainsStats(params: DateRangeParams & { format: StatsDateFormat }, enabled = true) {
  return useQuery({
    queryKey: ["stats", "domainAll", params],
    queryFn: () => caseStatsApi.getAllDomainsStats(params),
    enabled,
  });
}

export function useDepartmentsStatsForDomain(
  domainId: string | undefined,
  params: DateRangeParams & { format: StatsDateFormat },
  enabled = true
) {
  return useQuery({
    queryKey: ["stats", "domainDepartments", domainId, params],
    queryFn: () => caseStatsApi.getDepartmentsStatsForDomain(domainId!, params),
    enabled: Boolean(domainId) && enabled,
  });
}

export function useViolationDepartmentHeatmap(params: HeatmapScopeParams, enabled = true) {
  return useQuery({
    queryKey: ["stats", "heatmapViolationDepartment", params],
    queryFn: () => caseStatsApi.getViolationDepartmentHeatmap(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useReactionSpeedHeatmap(
  params: HeatmapScopeParams & { groupBy: ReactionSpeedGroupBy },
  enabled = true
) {
  return useQuery({
    queryKey: ["stats", "heatmapReactionSpeed", params],
    queryFn: () => caseStatsApi.getReactionSpeedHeatmap(params),
    enabled,
  });
}

export function useWeeklyPatternHeatmap(params: HeatmapScopeParams, enabled = true) {
  return useQuery({
    queryKey: ["stats", "heatmapWeeklyPattern", params],
    queryFn: () => caseStatsApi.getWeeklyPatternHeatmap(params),
    enabled,
  });
}
