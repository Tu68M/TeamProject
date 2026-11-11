import { api } from "@shared/api/axiosInstance";
import type {
  CommissionTypeResponse,
  CreateCommissionTypeRequest,
  CreateDecisionTypeRequest,
  CreateViolationTypeRequest,
  DecisionTypeResponse,
  DepartmentBriefResponse,
  DomainResponse,
  DomainShortResponse,
  EditCommissionTypeRequest,
  EditDecisionTypeRequest,
  EditViolationTypeRequest,
  ViolationTypeBriefResponse,
  ViolationTypeResponse,
} from "@shared/types/api";

export const dictionaryApi = {
  getViolationTypeByCode: async (code: string): Promise<ViolationTypeResponse> => {
    const response = await api.get<ViolationTypeResponse>("/api/v1/dictionary/violations", {
      params: { code },
    });
    return response.data;
  },

  getBriefViolationTypes: async (
    code?: string
  ): Promise<ViolationTypeBriefResponse[] | ViolationTypeBriefResponse> => {
    const response = await api.get("/api/v1/dictionary/violations/brief", { params: { code } });
    return response.data;
  },

  createViolationType: async (
    data: CreateViolationTypeRequest,
    idempotencyKey: string
  ): Promise<ViolationTypeResponse> => {
    const response = await api.post<ViolationTypeResponse>(
      "/api/v1/dictionary/violations",
      data,
      { headers: { "X-Idempotency-Key": idempotencyKey } }
    );
    return response.data;
  },

  editViolationType: async (
    violationTypeId: string,
    data: EditViolationTypeRequest
  ): Promise<ViolationTypeResponse> => {
    const response = await api.patch<ViolationTypeResponse>(
      `/api/v1/dictionary/violations/${violationTypeId}`,
      data
    );
    return response.data;
  },

  deleteViolationType: async (violationTypeId: string): Promise<void> => {
    await api.delete(`/api/v1/dictionary/violations/${violationTypeId}`);
  },

  getCommissionTypes: async (): Promise<CommissionTypeResponse[]> => {
    const response = await api.get<CommissionTypeResponse[]>("/api/v1/dictionary/commission");
    return response.data;
  },

  getCommissionTypeById: async (typeId: string): Promise<CommissionTypeResponse> => {
    const response = await api.get<CommissionTypeResponse>(
      `/api/v1/dictionary/commission/${typeId}`
    );
    return response.data;
  },

  createCommissionType: async (
    data: CreateCommissionTypeRequest,
    idempotencyKey: string
  ): Promise<CommissionTypeResponse> => {
    const response = await api.post<CommissionTypeResponse>(
      "/api/v1/dictionary/commission",
      data,
      { headers: { "X-Idempotency-Key": idempotencyKey } }
    );
    return response.data;
  },

  editCommissionType: async (
    commissionTypeId: string,
    data: EditCommissionTypeRequest
  ): Promise<CommissionTypeResponse> => {
    const response = await api.patch<CommissionTypeResponse>(
      `/api/v1/dictionary/commission/${commissionTypeId}`,
      data
    );
    return response.data;
  },

  deleteCommissionType: async (commissionTypeId: string): Promise<void> => {
    await api.delete(`/api/v1/dictionary/commission/${commissionTypeId}`);
  },

  getDecisionTypes: async (): Promise<DecisionTypeResponse[]> => {
    const response = await api.get<DecisionTypeResponse[]>(
      "/api/v1/dictionary/commission/decisions"
    );
    return response.data;
  },

  createDecisionType: async (
    data: CreateDecisionTypeRequest,
    idempotencyKey: string
  ): Promise<DecisionTypeResponse> => {
    const response = await api.post<DecisionTypeResponse>(
      "/api/v1/dictionary/commission/decisions",
      data,
      { headers: { "X-Idempotency-Key": idempotencyKey } }
    );
    return response.data;
  },

  editDecisionType: async (
    decisionTypeId: string,
    data: EditDecisionTypeRequest
  ): Promise<DecisionTypeResponse> => {
    const response = await api.patch<DecisionTypeResponse>(
      `/api/v1/dictionary/commission/decisions/${decisionTypeId}`,
      data
    );
    return response.data;
  },

  deleteDecisionType: async (decisionTypeId: string): Promise<void> => {
    await api.delete(`/api/v1/dictionary/commission/decisions/${decisionTypeId}`);
  },

  getDomains: async (code?: string): Promise<DomainShortResponse[] | DomainResponse> => {
    const response = await api.get("/api/v1/domains", { params: { code } });
    return response.data;
  },

  getDomainById: async (domainId: string): Promise<DomainResponse> => {
    const response = await api.get<DomainResponse>(`/api/v1/domains/${domainId}`);
    return response.data;
  },

  getShortDomainById: async (domainId: string): Promise<DomainShortResponse> => {
    const response = await api.get<DomainShortResponse>(`/api/v1/domains/${domainId}/short`);
    return response.data;
  },

  getShortDomainByCode: async (code: string): Promise<DomainShortResponse> => {
    const response = await api.get<DomainShortResponse>("/api/v1/domains/short", {
      params: { code },
    });
    return response.data;
  },

  getDepartmentBrief: async (departmentId: string): Promise<DepartmentBriefResponse> => {
    const response = await api.get<DepartmentBriefResponse>(
      `/api/v1/departments/${departmentId}/brief`
    );
    return response.data;
  },

  getMyDomain: async (): Promise<DomainShortResponse> => {
    const response = await api.get<DomainShortResponse>("/api/v1/domains/mine");
    return response.data;
  },

  getMyDepartment: async (): Promise<DepartmentBriefResponse> => {
    const response = await api.get<DepartmentBriefResponse>("/api/v1/departments/mine");
    return response.data;
  },
};