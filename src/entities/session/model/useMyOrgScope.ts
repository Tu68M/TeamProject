import { useQuery } from "@tanstack/react-query";
import { userApi } from "@/shared/api";

export function useMyOrgScope() {
  const query = useQuery({
    queryKey: ["myProfile"],
    queryFn: () => userApi.getMe(),
    staleTime: 5 * 60 * 1000,
  });

  const activeRoles = query.data?.activeRoles || [];
  const departmentId = activeRoles.find((r) => r.scopeDepartmentId)?.scopeDepartmentId;
  const domainId = activeRoles.find((r) => r.scopeDomainId)?.scopeDomainId;

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    departmentId,
    domainId,
  };
}
