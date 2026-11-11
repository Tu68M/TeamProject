import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dictionaryApi } from "@entities/dictionary/dictionaryApi";
import type { DepartmentTreeItem, DomainResponse, DomainShortResponse, UserRolesResponse } from "@shared/types/api";

export interface ScopeOption {
  key: string;
  label: string;
  domainId?: string;
  departmentId?: string;
}

export const COMPANY_SCOPE: ScopeOption = { key: "company", label: "Вся компания" };

export function scopeKey(domainId?: string | null, departmentId?: string | null): string {
  return departmentId ? `dep:${departmentId}` : domainId ? `dom:${domainId}` : "company";
}

async function loadDomains(): Promise<DomainResponse[]> {
  const shortList = (await dictionaryApi.getDomains()) as DomainShortResponse[];
  const domains = await Promise.all(
    shortList.filter((d) => d.code).map((d) => dictionaryApi.getDomains(d.code) as Promise<DomainResponse>)
  );
  return domains.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function flattenDepartments(items: DepartmentTreeItem[] | undefined, out: DepartmentTreeItem[] = []) {
  for (const d of items ?? []) {
    out.push(d);
    flattenDepartments(d.children, out);
  }
  return out;
}

export function useOrgScopes(enabled = true) {
  const query = useQuery({ queryKey: ["orgScopes"], queryFn: loadDomains, staleTime: 5 * 60_000, retry: false, enabled });

  return useMemo(() => {
    const options: ScopeOption[] = [COMPANY_SCOPE];
    const labels = new Map<string, string>([[COMPANY_SCOPE.key, COMPANY_SCOPE.label]]);
    for (const domain of query.data ?? []) {
      const domainName = domain.nameShort || domain.nameFull || "Домен";
      const domainOption: ScopeOption = { key: scopeKey(domain.id), label: domainName, domainId: domain.id };
      options.push(domainOption);
      labels.set(domainOption.key, domainName);
      for (const dep of flattenDepartments(domain.departments)) {
        const option: ScopeOption = {
          key: scopeKey(domain.id, dep.id),
          label: `${domainName} · ${dep.name}`,
          domainId: domain.id,
          departmentId: dep.id,
        };
        options.push(option);
        labels.set(scopeKey(undefined, dep.id), option.label);
        labels.set(option.key, option.label);
      }
    }
    const scopeLabel = (domainId?: string | null, departmentId?: string | null): string =>
      labels.get(scopeKey(domainId, departmentId)) ??
      (departmentId ? "подразделение" : domainId ? "домен" : COMPANY_SCOPE.label);
    return { options, scopeLabel, isLoaded: query.isSuccess };
  }, [query.data, query.isSuccess]);
}

export function formatRoleAssignments(
  activeRoles: UserRolesResponse[] | undefined,
  roleName: (code: string) => string,
  scopeLabel: (domainId?: string | null, departmentId?: string | null) => string
): string[] {
  return (activeRoles ?? []).flatMap((group) =>
    (group.roles ?? []).map((code) => `${roleName(code)} — ${scopeLabel(group.scopeDomainId, group.scopeDepartmentId)}`)
  );
}
