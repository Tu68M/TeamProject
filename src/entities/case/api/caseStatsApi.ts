import { api } from "@shared/api/axiosInstance";
import type { ReactionSpeedGroupBy, StatResponse, StatsDateFormat } from "@shared/types/api";

export interface DateRangeParams {
  from: string;
  to: string;
}

export interface HeatmapScopeParams extends DateRangeParams {
  domainId?: string;
  departmentId?: string;
}

export const caseStatsApi = {
  getMyDepartmentStats: async (params: DateRangeParams & { format: StatsDateFormat }): Promise<StatResponse> => {
    const response = await api.get<StatResponse>("/api/v1/cases/stats/department", { params });
    return response.data;
  },

  getMyDomainStats: async (params: DateRangeParams & { format: StatsDateFormat }): Promise<StatResponse> => {
    const response = await api.get<StatResponse>("/api/v1/cases/stats/domain", { params });
    return response.data;
  },

  getAllDomainsStats: async (
    params: DateRangeParams & { format: StatsDateFormat }
  ): Promise<StatResponse[]> => {
    const response = await api.get<StatResponse[]>("/api/v1/cases/stats/domain/all", { params });
    return response.data;
  },

  getDepartmentsStatsForDomain: async (
    domainId: string,
    params: DateRangeParams & { format: StatsDateFormat }
  ): Promise<StatResponse[]> => {
    const response = await api.get<StatResponse[]>(
      `/api/v1/cases/stats/domain/${domainId}/departments`,
      { params }
    );
    return response.data;
  },

  getViolationDepartmentHeatmap: async (params: HeatmapScopeParams): Promise<StatResponse[]> => {
    const response = await api.get<StatResponse[]>("/api/v1/cases/stats/heatmap/violation-department", {
      params,
    });
    return response.data;
  },

  getReactionSpeedHeatmap: async (
    params: HeatmapScopeParams & { groupBy: ReactionSpeedGroupBy }
  ): Promise<StatResponse[]> => {
    const response = await api.get<StatResponse[]>("/api/v1/cases/stats/heatmap/reaction-speed", { params });
    return response.data;
  },

  getWeeklyPatternHeatmap: async (params: HeatmapScopeParams): Promise<StatResponse[]> => {
    const response = await api.get<StatResponse[]>("/api/v1/cases/stats/heatmap/weekly-pattern", { params });
    return response.data;
  },
};
