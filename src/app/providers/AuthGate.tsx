import { ReactNode } from "react";
import { useAuthBootstrap } from "@entities/session/model/useAuthBootstrap";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const isLoading = useAuthBootstrap();

  if (isLoading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh" 
      }}>
        <span>Инициализация сессии...</span>
      </div>
    );
  }

  return <>{children}</>;
}