export const ASSIGNEE_ROLE_LABELS: Record<string, string> = {
  VIOLATOR: "Нарушитель",
  INITIATOR: "Инициатор",
  MEMBER: "Участник",
  COMMISSION_SECRETARY: "Секретарь комиссии",
  LAWYER: "Юрист",
  DEPARTMENT_HEAD: "Руководитель подразделения",
};

export function getAssigneeRoleLabel(role?: string): string {
  return (role && ASSIGNEE_ROLE_LABELS[role]) || role || "";
}

export const ASSIGNABLE_CASE_ROLES: ("MEMBER" | "COMMISSION_SECRETARY" | "LAWYER")[] = ["MEMBER", "COMMISSION_SECRETARY", "LAWYER"];
