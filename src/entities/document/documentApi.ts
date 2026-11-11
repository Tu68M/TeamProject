import { api } from "@shared/api/axiosInstance";
import type {
  DocumentPurposeResponse,
  DocumentTemplatePreviewResponse,
  DocumentTemplateResponse,
  DocumentTemplateVersionResponse,
  GenerateDocumentRequest,
  GeneratedDocumentResponse,
  Page,
  Pageable,
  PlaceholderAutoFillSetting,
  TemplateFoldersResponse,
} from "@shared/types/api";

export const documentApi = {
  getTemplates: async (
    params?: Pageable & { violationTypeCode?: string }
  ): Promise<Page<DocumentTemplateResponse>> => {
    const response = await api.get<Page<DocumentTemplateResponse>>("/api/v1/documents/templates", { params });
    return response.data;
  },

  getTemplateFolders: async (): Promise<TemplateFoldersResponse> => {
    const response = await api.get<TemplateFoldersResponse>("/api/v1/documents/templates/folders");
    return response.data;
  },

  previewTemplate: async (file: File): Promise<DocumentTemplatePreviewResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<DocumentTemplatePreviewResponse>(
      "/api/v1/documents/templates/preview",
      formData,
      { headers: { "Content-Type": undefined } }
    );
    return response.data;
  },

  uploadTemplate: async (
    data: {
      file: File;
      name: string;
      description?: string;
      violationTypeCode?: string;
      placeholderAutoFill?: Record<string, PlaceholderAutoFillSetting>;
    },
    idempotencyKey: string
  ): Promise<DocumentTemplateResponse> => {
    const formData = new FormData();
    formData.append("file", data.file);
    formData.append("name", data.name);
    if (data.description) formData.append("description", data.description);
    if (data.violationTypeCode) formData.append("violationTypeCode", data.violationTypeCode);
    if (data.placeholderAutoFill && Object.keys(data.placeholderAutoFill).length > 0) {
      formData.append("placeholderAutoFill", JSON.stringify(data.placeholderAutoFill));
    }

    const response = await api.post<DocumentTemplateResponse>("/api/v1/documents/templates", formData, {
      headers: { "Content-Type": undefined, "Idempotency-Key": idempotencyKey },
    });
    return response.data;
  },

  deactivateTemplate: async (id: string): Promise<DocumentTemplateResponse> => {
    const response = await api.patch<DocumentTemplateResponse>(`/api/v1/documents/templates/${id}/deactivate`);
    return response.data;
  },

  activateTemplate: async (id: string): Promise<DocumentTemplateResponse> => {
    const response = await api.patch<DocumentTemplateResponse>(`/api/v1/documents/templates/${id}/activate`);
    return response.data;
  },

  updateTemplateMetadata: async (
    id: string,
    data: { name: string; description?: string; violationTypeCode?: string | null }
  ): Promise<DocumentTemplateResponse> => {
    const response = await api.patch<DocumentTemplateResponse>(`/api/v1/documents/templates/${id}`, data);
    return response.data;
  },

  replaceTemplateFile: async (
    id: string,
    file: File,
    idempotencyKey: string,
    placeholderAutoFill?: Record<string, PlaceholderAutoFillSetting>
  ): Promise<DocumentTemplateResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    if (placeholderAutoFill && Object.keys(placeholderAutoFill).length > 0) {
      formData.append("placeholderAutoFill", JSON.stringify(placeholderAutoFill));
    }

    const response = await api.post<DocumentTemplateResponse>(`/api/v1/documents/templates/${id}/file`, formData, {
      headers: { "Content-Type": undefined, "Idempotency-Key": idempotencyKey },
    });
    return response.data;
  },

  deleteTemplate: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/documents/templates/${id}`);
  },

  updateTemplatePlaceholderMapping: async (
    id: string,
    placeholderAutoFill: Record<string, PlaceholderAutoFillSetting>
  ): Promise<DocumentTemplateResponse> => {
    const response = await api.patch<DocumentTemplateResponse>(`/api/v1/documents/templates/${id}/placeholders`, {
      placeholderAutoFill: JSON.stringify(placeholderAutoFill),
    });
    return response.data;
  },

  templateDownloadUrl: (id: string): string => `/api/v1/documents/templates/${id}/download`,

  getTemplateById: async (id: string): Promise<DocumentTemplateResponse> => {
    const response = await api.get<DocumentTemplateResponse>(`/api/v1/documents/templates/${id}`);
    return response.data;
  },

  generateDocument: async (
    data: GenerateDocumentRequest,
    idempotencyKey: string
  ): Promise<GeneratedDocumentResponse> => {
    const response = await api.post<GeneratedDocumentResponse>("/api/v1/documents/generate", data, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return response.data;
  },

  getTemplateFileBlob: async (id: string): Promise<Blob> => {
    const response = await api.get(`/api/v1/documents/templates/${id}/download`, { responseType: "blob" });
    return response.data;
  },

  getExplanationTemplate: async (caseId: string): Promise<DocumentTemplateResponse> => {
    const response = await api.get<DocumentTemplateResponse>(`/api/v1/documents/explanation/cases/${caseId}/template`);
    return response.data;
  },

  getExplanationTemplateFileBlob: async (caseId: string): Promise<Blob> => {
    const response = await api.get(`/api/v1/documents/explanation/cases/${caseId}/template/file`, {
      responseType: "blob",
    });
    return response.data;
  },

  generateExplanationDocument: async (
    caseId: string,
    fieldValues: Record<string, string>
  ): Promise<GeneratedDocumentResponse> => {
    const response = await api.post<GeneratedDocumentResponse>(
      `/api/v1/documents/explanation/cases/${caseId}/generate`,
      { fieldValues }
    );
    return response.data;
  },

  getDecisionActTemplate: async (caseId: string): Promise<DocumentTemplateResponse> => {
    const response = await api.get<DocumentTemplateResponse>(`/api/v1/documents/decision-act/cases/${caseId}/template`);
    return response.data;
  },

  getDecisionActTemplateFileBlob: async (caseId: string): Promise<Blob> => {
    const response = await api.get(`/api/v1/documents/decision-act/cases/${caseId}/template/file`, {
      responseType: "blob",
    });
    return response.data;
  },

  generateDecisionAct: async (caseId: string, fieldValues: Record<string, string>): Promise<GeneratedDocumentResponse> => {
    const response = await api.post<GeneratedDocumentResponse>(
      `/api/v1/documents/decision-act/cases/${caseId}/generate`,
      { fieldValues }
    );
    return response.data;
  },

  getLawyerConclusionTemplate: async (caseId: string): Promise<DocumentTemplateResponse> => {
    const response = await api.get<DocumentTemplateResponse>(`/api/v1/documents/lawyer-conclusion/cases/${caseId}/template`);
    return response.data;
  },

  getLawyerConclusionTemplateFileBlob: async (caseId: string): Promise<Blob> => {
    const response = await api.get(`/api/v1/documents/lawyer-conclusion/cases/${caseId}/template/file`, {
      responseType: "blob",
    });
    return response.data;
  },

  generateLawyerConclusion: async (
    caseId: string,
    fieldValues: Record<string, string>,
    decisionTypeCode?: string
  ): Promise<GeneratedDocumentResponse> => {
    const response = await api.post<GeneratedDocumentResponse>(
      `/api/v1/documents/lawyer-conclusion/cases/${caseId}/generate`,
      { fieldValues, decisionTypeCode: decisionTypeCode || undefined }
    );
    return response.data;
  },

  getPurposes: async (): Promise<DocumentPurposeResponse[]> => {
    const response = await api.get<DocumentPurposeResponse[]>("/api/v1/documents/purposes");
    return response.data;
  },

  setPurposeViolationTemplate: async (
    purposeCode: string,
    violationTypeCode: string,
    templateId: string | null
  ): Promise<DocumentPurposeResponse> => {
    const response = await api.put<DocumentPurposeResponse>(
      `/api/v1/documents/purposes/${purposeCode}/violation-types/${encodeURIComponent(violationTypeCode)}/template`,
      { templateId }
    );
    return response.data;
  },

  setPurposeTemplate: async (code: string, templateId: string | null): Promise<DocumentPurposeResponse> => {
    const response = await api.put<DocumentPurposeResponse>(`/api/v1/documents/purposes/${code}/template`, {
      templateId,
    });
    return response.data;
  },

  getTemplateVersions: async (templateId: string): Promise<DocumentTemplateVersionResponse[]> => {
    const response = await api.get<DocumentTemplateVersionResponse[]>(
      `/api/v1/documents/templates/${templateId}/versions`
    );
    return response.data;
  },

  getTemplateVersionFileBlob: async (templateId: string, versionId: string): Promise<Blob> => {
    const response = await api.get(`/api/v1/documents/templates/${templateId}/versions/${versionId}/download`, {
      responseType: "blob",
    });
    return response.data;
  },

  restoreTemplateVersion: async (templateId: string, versionId: string): Promise<DocumentTemplateResponse> => {
    const response = await api.post<DocumentTemplateResponse>(
      `/api/v1/documents/templates/${templateId}/versions/${versionId}/restore`
    );
    return response.data;
  },

  deleteTemplateVersion: async (templateId: string, versionId: string): Promise<void> => {
    await api.delete(`/api/v1/documents/templates/${templateId}/versions/${versionId}`);
  },
};
