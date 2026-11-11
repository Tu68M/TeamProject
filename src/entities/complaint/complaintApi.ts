import { api } from "@shared/api/axiosInstance";
import type { ComplaintResponse, ComplaintStatus, ComplaintSummaryResponse } from "@shared/types/api";

export const complaintApi = {
  submit: async (
    accusedEmployeeUid: string,
    message: string,
    files: File[],
    anonymous = false
  ): Promise<ComplaintResponse> => {
    const formData = new FormData();
    formData.append("accusedEmployeeUid", accusedEmployeeUid);
    formData.append("message", message);
    formData.append("anonymous", String(anonymous));
    files.forEach((file) => formData.append("files", file));
    const response = await api.post<ComplaintResponse>("/api/v1/complaints", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  mine: async (): Promise<ComplaintResponse[]> => {
    const response = await api.get<ComplaintResponse[]>("/api/v1/complaints/mine");
    return response.data;
  },

  inbox: async (status?: ComplaintStatus): Promise<ComplaintResponse[]> => {
    const response = await api.get<ComplaintResponse[]>("/api/v1/complaints/inbox", {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  summary: async (): Promise<ComplaintSummaryResponse> => {
    const response = await api.get<ComplaintSummaryResponse>("/api/v1/complaints/summary");
    return response.data;
  },

  get: async (id: string): Promise<ComplaintResponse> => {
    const response = await api.get<ComplaintResponse>(`/api/v1/complaints/${id}`);
    return response.data;
  },

  decide: async (
    id: string,
    body: { decision: "REJECT" | "CASE_CREATED"; comment?: string; caseId?: string }
  ): Promise<ComplaintResponse> => {
    const response = await api.post<ComplaintResponse>(`/api/v1/complaints/${id}/decision`, body);
    return response.data;
  },
};
