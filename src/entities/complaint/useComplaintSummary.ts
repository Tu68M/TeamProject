import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@entities/session/model/authStore";
import { complaintApi } from "./complaintApi";

export function useComplaintSummary() {
  const isLoggedIn = useAuthStore((s) => Boolean(s.context?.employeeUid));
  return useQuery({
    queryKey: ["complaintSummary"],
    queryFn: complaintApi.summary,
    enabled: isLoggedIn,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    retry: false,
  });
}
