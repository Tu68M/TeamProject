import { Navigate } from "react-router-dom";
import { useAuthStore } from "@entities/session/model/authStore";
import { ReactNode } from "react"; 

interface ProtectedRouteProps {
  requiredModule?: string;
  requiredPermission?: string;
  redirectTo?: string;
  children?: ReactNode;
}

export function ProtectedRoute({
  requiredModule,
  requiredPermission,
  redirectTo = "/login",
  children,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasModule, hasPermission } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surf text-tx">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-prl" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-[14px] font-medium">Загрузка сессии...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  
  if (requiredModule && !hasModule(requiredModule)) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}