
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { caseApi } from "./caseApi";
import { commissionApi } from "@/entities/commission/api/commissionApi";
import { employeeApi } from "@/shared/api";
import { dictionaryApi } from "@/entities/dictionary/dictionaryApi"; 

export function useCaseDetail(caseId: string) {
  return useQuery({
    queryKey: ["case", caseId],
    queryFn: () => caseApi.getCaseById(caseId),
    enabled: Boolean(caseId),
  });
}

export function useCaseDocuments(caseId: string, enabled = true) {
  return useQuery({
    queryKey: ["caseDocuments", caseId],
    queryFn: () => caseApi.getCaseDocuments(caseId).catch(() => []),
    enabled: Boolean(caseId) && enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useDocumentVisibilityLogs(caseId: string, documentId: string, enabled = true) {
  return useQuery({
    queryKey: ["documentVisibilityLogs", documentId],
    queryFn: () => caseApi.getDocumentVisibilityLogs(caseId, documentId, { size: 50, sort: ["changedAt,desc"] }),
    enabled: Boolean(caseId) && Boolean(documentId) && enabled,
  });
}

export function useExplanationStatus(caseId: string, enabled = true) {
  return useQuery({
    queryKey: ["explanation", caseId],
    queryFn: () => caseApi.getExplanationStatus(caseId),
    enabled: Boolean(caseId) && enabled,
    retry: false,
  });
}

export function useCaseAssignees(caseId: string) {
  return useQuery({
    queryKey: ["caseAssignees", caseId],
    queryFn: () => caseApi.getCaseAssignees(caseId).then((res) => res.content || []).catch(() => []),
    enabled: Boolean(caseId),
  });
}

export function useCaseLogs(caseId: string) {
  return useQuery({
    queryKey: ["caseLogs", caseId],
    queryFn: () => caseApi.getCaseLogs(caseId).catch(() => []),
    enabled: Boolean(caseId),
  });
}

export function useUploadDocument(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, isVisibleToEmployee }: { file: File; isVisibleToEmployee?: boolean }) =>
      caseApi.uploadDocument(caseId, { file, isVisibleToEmployee }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caseDocuments", caseId] });
      queryClient.invalidateQueries({ queryKey: ["caseLogs", caseId] });
    },
  });
}

export function useUpdateDocumentVisibility(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      data,
    }: {
      documentId: string;
      data: { isVisibleToEmployee?: boolean; reason?: string };
    }) => caseApi.updateDocumentVisibility(caseId, documentId, data),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["caseDocuments", caseId] });
        queryClient.invalidateQueries({ queryKey: ["caseLogs", caseId] });    
    },
  });
}

export function useDeleteDocument(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => caseApi.deleteDocument(caseId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caseDocuments", caseId] });
      queryClient.invalidateQueries({ queryKey: ["caseLogs", caseId] });
    },
  });
}

export function useRestoreDocument(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => caseApi.restoreDocument(caseId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caseDocuments", caseId] });
      queryClient.invalidateQueries({ queryKey: ["caseLogs", caseId] });
    },
  });
}

export function useAddAssignee(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { employeeUid: string; role: string }) => caseApi.addCaseAssignee(caseId, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caseAssignees", caseId] });
    },
  });
}

export function useRemoveAssignee(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assigneeId: string) => caseApi.removeCaseAssignee(caseId, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caseAssignees", caseId] });
    },
  });
}

export function useMyViolations(enabled = true) {
  return useQuery({
    queryKey: ["myViolations"],
    queryFn: () => caseApi.getMyViolations(),
    enabled,
  });
}

export function useCasesList(isHr: boolean) {
  return useQuery({
    queryKey: ["casesList", isHr ? "hr" : "employee"],
    queryFn: () => (isHr ? caseApi.getCases() : caseApi.getMyCases()),
  });
}

export function useDashboardStats(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["dashboardStats"],
    queryFn: () => caseApi.getDashboardStats(),
    ...options,
  });
}

export function useActionRequiredCases(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["dashboardActionRequired"],
    queryFn: () => caseApi.getActionRequiredCases(),
    ...options,
  });
}

export function useMyCommissions() {
  return useQuery({
    queryKey: ["myCommissions"],
    queryFn: () => commissionApi.getMyActiveCommissions(),
  });
}

export function useCaseStats() {
  return useQuery({
    queryKey: ["caseStats"],
    queryFn: () => caseApi.getDashboardStats(),
  });
}

export function useEmployeesBase(params?: { size?: number }) {
  return useQuery({
    queryKey: ["employeesBase", params?.size ?? 8],
    queryFn: () => employeeApi.getEmployees({ size: params?.size ?? 8 }),
  });
}

export function useViolationTypes() {
  return useQuery({
    queryKey: ["violationTypes"],
    queryFn: () => dictionaryApi.getBriefViolationTypes(),
  });
}