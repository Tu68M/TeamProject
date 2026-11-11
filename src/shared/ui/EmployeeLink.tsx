import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@entities/session/model/authStore";

export function EmployeeLink({
  employeeUid,
  children,
  className = "",
}: {
  employeeUid?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const canOpen = useAuthStore((s) => s.hasPermission("org:read:all"));
  if (!employeeUid || !canOpen) return <span className={className}>{children}</span>;
  return (
    <Link
      to={`/employees/${employeeUid}`}
      className={`hover:text-prl hover:underline transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}
