import { api } from "@shared/api/axiosInstance";
import { generateUuidV4 } from "@shared/utils/uuid";
import type {
  Case1cExportResponse,
  CaseAssigneeResponse,
  CaseDocumentResponse,
  CaseFilterOptionsResponse,
  CaseLogResponse,
  CaseShortResponse,
  CaseStatsResponse,
  CasesQueryParams,
  CreateCaseRequest,
  CreateDocumentRequest,
  ExplanationStatusResponse,
  FullCaseResponse,
  GiveExplanationRequest,
  MemberAssignmentRequest,
  Page,
  PageCaseAssigneeResponse,
  PageCaseShortResponse,
  Pageable,
  UpdateDocumentVisibilityRequest,
  VisibilityLogResponse,
} from "@shared/types/api";

export const caseApi = {
  createCase: async (payload: CreateCaseRequest, idempotencyKey: string): Promise<FullCaseResponse> => {
    const response = await api.post("/api/v1/cases", payload, {
      headers: {
        "X-Idempotency-Key": idempotencyKey,
      },
    });
    return response.data;
  },

  getDashboardStats: async (): Promise<CaseStatsResponse> => {
    const response = await api.get<CaseStatsResponse>("/api/v1/cases/stats");
    return response.data;
  },

  getActionRequiredCases: async (): Promise<CaseShortResponse[]> => {
    const response = await api.get<CaseShortResponse[]>("/api/v1/cases/stats/action-required");
    return response.data;
  },

  getCases: async (params?: CasesQueryParams): Promise<PageCaseShortResponse> => {
    const response = await api.get<PageCaseShortResponse>("/api/v1/cases", { params });
    return response.data;
  },

  getMyViolations: async (): Promise<CaseShortResponse[]> => {
    const response = await api.get<PageCaseShortResponse>("/api/v1/cases", {
      params: { onlyMyViolations: true, page: 0, size: 100 },
    });
    return response.data.content ?? [];
  },

  getCaseFilterOptions: async (): Promise<CaseFilterOptionsResponse> => {
    const response = await api.get<CaseFilterOptionsResponse>("/api/v1/cases/filter-options");
    return response.data;
  },

  getCaseById: async (caseId: string): Promise<FullCaseResponse> => {
    const response = await api.get<FullCaseResponse>(`/api/v1/cases/${caseId}`);
    return response.data;
  },

  archiveCase: async (caseId: string): Promise<void> => {
    await api.post(`/api/v1/cases/${caseId}/archive`);
  },

  unarchiveCase: async (caseId: string): Promise<void> => {
    await api.post(`/api/v1/cases/${caseId}/unarchive`);
  },

  reopenCase: async (caseId: string): Promise<void> => {
    await api.post(`/api/v1/cases/${caseId}/reopen`);
  },

  getExports1c: async (caseId: string): Promise<Case1cExportResponse[]> => {
    const response = await api.get<Case1cExportResponse[]>(`/api/v1/cases/${caseId}/exports-1c`);
    return response.data;
  },

  sendTo1c: async (caseId: string): Promise<void> => {
    await api.post(`/api/v1/cases/${caseId}/send-to-1c`);
  },

  closeByExplanation: async (caseId: string): Promise<void> => {
    await api.post(`/api/v1/cases/${caseId}/close-by-explanation`);
  },

  closeNewCase: async (caseId: string): Promise<void> => {
    await api.post(`/api/v1/cases/${caseId}/close`);
  },

  getCaseLogs: async (caseId: string): Promise<CaseLogResponse[]> => {
    const response = await api.get<CaseLogResponse[]>(`/api/v1/cases/${caseId}/logs`);
    return response.data;
  },

  getMyCases: async (page = 0, size = 20) => {
    const response = await api.get("/api/v1/cases", {
      params: { page, size, sort: "id,desc" },
    });
    return response.data.content ?? response.data ?? [];
  },

  getMyStats: async () => {
    try {
      const cases = await caseApi.getMyCases();
      const activeCount = Array.isArray(cases)
        ? cases.filter((c: any) => c.active || c.status === "IN_PROGRESS").length
        : 0;
      return { activeCount, unreadCount: 0 };
    } catch {
      return { activeCount: 0, unreadCount: 0 };
    }
  },

  getCaseAssignees: async (
    caseId: string,
    params?: Pageable
  ): Promise<PageCaseAssigneeResponse> => {
    const response = await api.get<PageCaseAssigneeResponse>(
      `/api/v1/cases/${caseId}/assignees`,
      { params }
    );
    return response.data;
  },

  addCaseAssignee: async (
    caseId: string,
    data: MemberAssignmentRequest
  ): Promise<CaseAssigneeResponse> => {
    const response = await api.post<CaseAssigneeResponse>(
      `/api/v1/cases/${caseId}/assignees`,
      data
    );
    return response.data;
  },

  removeCaseAssignee: async (caseId: string, assigneeId: string): Promise<void> => {
    await api.delete(`/api/v1/cases/${caseId}/assignees/${assigneeId}`);
  },

  getCaseDocuments: async (caseId: string): Promise<CaseDocumentResponse[]> => {
    const response = await api.get<CaseDocumentResponse[]>(`/api/v1/cases/${caseId}/documents`);
    return response.data;
  },

  uploadDocument: async (
    caseId: string,
    payload: CreateDocumentRequest
  ): Promise<CaseDocumentResponse> => {
    const formData = new FormData();
    formData.append("file", payload.file);
    if (payload.isVisibleToEmployee !== undefined) {
      formData.append("isVisibleToEmployee", String(payload.isVisibleToEmployee));
    }
    if (payload.documentTypeCode) {
      formData.append("documentTypeCode", payload.documentTypeCode);
    }

    const response = await api.post<CaseDocumentResponse>(
      `/api/v1/cases/${caseId}/documents`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          "Idempotency-Key": generateUuidV4(),
        },
      }
    );
    return response.data;
  },

  updateDocumentVisibility: async (
    caseId: string,
    documentId: string,
    data: UpdateDocumentVisibilityRequest
  ): Promise<CaseDocumentResponse> => {
    const response = await api.patch<CaseDocumentResponse>(
      `/api/v1/cases/${caseId}/documents/${documentId}/visibility`,
      data
    );
    return response.data;
  },

  deleteDocument: async (caseId: string, documentId: string): Promise<CaseDocumentResponse> => {
    const response = await api.delete<CaseDocumentResponse>(`/api/v1/cases/${caseId}/documents/${documentId}`);
    return response.data;
  },

  restoreDocument: async (caseId: string, documentId: string): Promise<CaseDocumentResponse> => {
    const response = await api.patch<CaseDocumentResponse>(
      `/api/v1/cases/${caseId}/documents/${documentId}/restore`
    );
    return response.data;
  },

  getDocumentVisibilityLogs: async (
    caseId: string,
    documentId: string,
    params?: Pageable
  ): Promise<Page<VisibilityLogResponse>> => {
    const response = await api.get<Page<VisibilityLogResponse>>(
      `/api/v1/cases/${caseId}/documents/${documentId}/visibility`,
      { params }
    );
    return response.data;
  },

  downloadDocumentFile: async (downloadUrl: string, filename: string): Promise<void> => {
    const response = await api.get(downloadUrl, { responseType: "blob" });
    const blobUrl = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  },

  downloadDocumentsZip: async (
    files: { downloadUrl: string; filename: string }[],
    zipName: string
  ): Promise<{ added: number; failed: number }> => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const used = new Set<string>();
    let added = 0;
    let failed = 0;
    for (const file of files) {
      try {
        const response = await api.get(file.downloadUrl, { responseType: "blob" });
        const dot = file.filename.lastIndexOf(".");
        const base = dot > 0 ? file.filename.slice(0, dot) : file.filename;
        const ext = dot > 0 ? file.filename.slice(dot) : "";
        let name = file.filename;
        for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})${ext}`;
        used.add(name.toLowerCase());
        zip.file(name, response.data);
        added++;
      } catch (err) {
        console.error(`Ошибка скачивания файла ${file.filename}:`, err);
        failed++;
      }
    }
    if (added === 0) return { added, failed };
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    return { added, failed };
  },

  fetchDocumentBlob: async (downloadUrl: string): Promise<Blob> => {
    const response = await api.get(downloadUrl, { responseType: "blob" });
    return response.data;
  },

  getExplanationStatus: async (caseId: string): Promise<ExplanationStatusResponse> => {
    const response = await api.get<ExplanationStatusResponse>(`/api/v1/cases/${caseId}/explanation`);
    return response.data;
  },

  getExplanationRequestPreview: async (
    caseId: string
  ): Promise<{ deadlineAt?: string; violatorBlocked: boolean }> => {
    const response = await api.get<{ deadlineAt?: string; violatorBlocked?: boolean }>(
      `/api/v1/cases/${caseId}/explanation-deadline-preview`
    );
    return { deadlineAt: response.data.deadlineAt, violatorBlocked: Boolean(response.data.violatorBlocked) };
  },

  giveExplanation: async (
    caseId: string,
    data: GiveExplanationRequest
  ): Promise<ExplanationStatusResponse> => {
    const response = await api.post<ExplanationStatusResponse>(
      `/api/v1/cases/${caseId}/explanation`,
      data
    );
    return response.data;
  },
};