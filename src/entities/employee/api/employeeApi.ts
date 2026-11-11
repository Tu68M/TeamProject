import { api } from "@shared/api/axiosInstance";
import type {
  EmployeeLookupResponse,
  EmployeeResponse,
  Page,
  PageEmployeeResponse,
  Pageable,
} from "@shared/types/api";

export const employeeApi = {
  getEmployees: async (params?: Pageable): Promise<PageEmployeeResponse> => {
    const response = await api.get<PageEmployeeResponse>("/api/v1/employees", {
      params: {
        page: params?.page ?? 0,
        size: params?.size ?? 20,
        sort: params?.sort,
      },
    });
    return response.data;
  },

  getEmployeeByTabNumber: async (tabNumber: string): Promise<EmployeeResponse> => {
    const response = await api.get<EmployeeResponse>("/api/v1/employees", {
      params: { tabNumber },
    });
    return response.data;
  },

  getEmployeeByUid: async (employeeUid: string): Promise<EmployeeResponse> => {
    const response = await api.get<EmployeeResponse>(`/api/v1/employees/${employeeUid}`);
    return response.data;
  },

  searchEmployees: async (query: string, params?: Pageable): Promise<PageEmployeeResponse> => {
    const response = await api.get<PageEmployeeResponse>("/api/v1/employees/search", {
      params: { query, ...params },
    });
    return response.data;
  },

  lookupEmployees: async (query: string): Promise<EmployeeLookupResponse[]> => {
    const response = await api.get<Page<EmployeeLookupResponse>>("/api/v1/employees/lookup", {
      params: { query, page: 0, size: 20 },
    });
    return response.data.content ?? [];
  },
};
