import { api } from "@shared/api/axiosInstance";
import type {
  AddCommissionMemberRequest,
  CommissionResponse,
  CreateCommissionRequest,
  MyCommissionResponse,
  SetCommissionMeetingRequest,
  Stage1VoteRequest,
  Stage2VoteRequest,
  TransferChairmanshipRequest,
  UpdateVotingDeadlineRequest,
} from "@shared/types/api";

export const commissionApi = {
  getCommissions: async (): Promise<CommissionResponse[]> => {
    const response = await api.get<CommissionResponse[]>("/api/v1/commissions");
    return response.data;
  },

  getMyActiveCommissions: async (): Promise<MyCommissionResponse[]> => {
    const response = await api.get<MyCommissionResponse[]>("/api/v1/commissions/mine");
    return response.data;
  },

  getCommissionById: async (commissionId: string): Promise<CommissionResponse> => {
    const response = await api.get<CommissionResponse>(`/api/v1/commissions/${commissionId}`);
    return response.data;
  },

  createCommission: async (data: CreateCommissionRequest): Promise<CommissionResponse> => {
    const response = await api.post<CommissionResponse>("/api/v1/commissions", data);
    return response.data;
  },

  castStage1Vote: async (commissionId: string, data: Stage1VoteRequest): Promise<CommissionResponse> => {
    const response = await api.post<CommissionResponse>(
      `/api/v1/commissions/${commissionId}/votes/stage1`,
      data
    );
    return response.data;
  },

  castStage2Vote: async (commissionId: string, data: Stage2VoteRequest): Promise<CommissionResponse> => {
    const response = await api.post<CommissionResponse>(
      `/api/v1/commissions/${commissionId}/votes/stage2`,
      data
    );
    return response.data;
  },

  closeCurrentStageEarly: async (commissionId: string): Promise<CommissionResponse> => {
    const response = await api.post<CommissionResponse>(`/api/v1/commissions/${commissionId}/close`);
    return response.data;
  },

  closeCommissionEarly: async (commissionId: string): Promise<CommissionResponse> => {
    const response = await api.post<CommissionResponse>(`/api/v1/commissions/${commissionId}/close-commission`);
    return response.data;
  },

  addMember: async (commissionId: string, data: AddCommissionMemberRequest): Promise<CommissionResponse> => {
    const response = await api.post<CommissionResponse>(`/api/v1/commissions/${commissionId}/members`, data);
    return response.data;
  },

  removeMember: async (commissionId: string, memberId: string): Promise<CommissionResponse> => {
    const response = await api.delete<CommissionResponse>(
      `/api/v1/commissions/${commissionId}/members/${memberId}`
    );
    return response.data;
  },

  transferChairmanship: async (
    commissionId: string,
    data: TransferChairmanshipRequest
  ): Promise<CommissionResponse> => {
    const response = await api.post<CommissionResponse>(`/api/v1/commissions/${commissionId}/chairmanship`, data);
    return response.data;
  },

  setMeeting: async (commissionId: string, data: SetCommissionMeetingRequest): Promise<CommissionResponse> => {
    const response = await api.put<CommissionResponse>(`/api/v1/commissions/${commissionId}/meeting`, data);
    return response.data;
  },

  clearMeeting: async (commissionId: string): Promise<CommissionResponse> => {
    const response = await api.delete<CommissionResponse>(`/api/v1/commissions/${commissionId}/meeting`);
    return response.data;
  },

  updateVotingDeadline: async (
    commissionId: string,
    data: UpdateVotingDeadlineRequest
  ): Promise<CommissionResponse> => {
    const response = await api.patch<CommissionResponse>(
      `/api/v1/commissions/${commissionId}/voting-deadline`,
      data
    );
    return response.data;
  },
};
