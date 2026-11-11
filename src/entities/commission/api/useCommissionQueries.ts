import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commissionApi } from "./commissionApi";
import type {
  CommissionResponse,
  CreateCommissionRequest,
  MyCommissionResponse,
  Stage1VoteRequest,
  Stage2VoteRequest,
} from "@shared/types/api";

export const commissionKeys = {
  all: ["commissions"] as const,
  lists: () => [...commissionKeys.all, "list"] as const,
  list: () => [...commissionKeys.lists()] as const,
  details: () => [...commissionKeys.all, "detail"] as const,
  detail: (id: string) => [...commissionKeys.details(), id] as const,
};

const CASE_STATS_KEY = ["caseStats"] as const;
const ACTION_REQUIRED_KEY = ["dashboardActionRequired"] as const;
const MY_COMMISSIONS_KEY = ["myCommissions"] as const;

function invalidateCaseAndDashboard(queryClient: ReturnType<typeof useQueryClient>, caseId?: string) {
  queryClient.invalidateQueries({ queryKey: CASE_STATS_KEY });
  queryClient.invalidateQueries({ queryKey: ACTION_REQUIRED_KEY });
  queryClient.invalidateQueries({ queryKey: MY_COMMISSIONS_KEY });
  if (caseId) {
    queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    queryClient.invalidateQueries({ queryKey: ["caseLogs", caseId] });
  }
}

export function useCommissions() {
  return useQuery<CommissionResponse[]>({
    queryKey: commissionKeys.list(),
    queryFn: () => commissionApi.getCommissions(),
    staleTime: 60 * 1000,
  });
}

export function useMyActiveCommissions() {
  return useQuery<MyCommissionResponse[]>({
    queryKey: MY_COMMISSIONS_KEY,
    queryFn: () => commissionApi.getMyActiveCommissions(),
    staleTime: 60 * 1000,
  });
}

export function useCommissionById(commissionId: string | undefined) {
  return useQuery<CommissionResponse>({
    queryKey: commissionKeys.detail(commissionId ?? ""),
    queryFn: () => commissionApi.getCommissionById(commissionId!),
    enabled: Boolean(commissionId),
  });
}

export function useCreateCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCommissionRequest) => commissionApi.createCommission(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: commissionKeys.lists() });
      invalidateCaseAndDashboard(queryClient, created.caseId);
    },
  });
}

export function useCastStage1Vote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commissionId, data }: { commissionId: string; data: Stage1VoteRequest }) =>
      commissionApi.castStage1Vote(commissionId, data),
    onSuccess: (updated) => {
      if (updated.id) {
        queryClient.setQueryData(commissionKeys.detail(updated.id), updated);
      }
      queryClient.invalidateQueries({ queryKey: commissionKeys.lists() });
      invalidateCaseAndDashboard(queryClient, updated.caseId);
    },
  });
}

export function useCastStage2Vote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commissionId, data }: { commissionId: string; data: Stage2VoteRequest }) =>
      commissionApi.castStage2Vote(commissionId, data),
    onSuccess: (updated) => {
      if (updated.id) {
        queryClient.setQueryData(commissionKeys.detail(updated.id), updated);
      }
      queryClient.invalidateQueries({ queryKey: commissionKeys.lists() });
      invalidateCaseAndDashboard(queryClient, updated.caseId);
    },
  });
}

export function useCloseCurrentStageEarly() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commissionId: string) => commissionApi.closeCurrentStageEarly(commissionId),
    onSuccess: (updated) => {
      if (updated.id) {
        queryClient.setQueryData(commissionKeys.detail(updated.id), updated);
      }
      queryClient.invalidateQueries({ queryKey: commissionKeys.lists() });
      invalidateCaseAndDashboard(queryClient, updated.caseId);
    },
  });
}
