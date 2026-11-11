import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "./providers/AuthGate";
import { ProtectedRoute } from "./providers/ProtectedRoute";
import { useAuthStore } from "@entities/session/model/authStore";

import MainLayout from "@/widgets/layout/MainLayout";

import { LoginPage } from "@pages/login/LoginPage";

import DashboardPage from "@/pages/hr/DashboardPage/DashboardPage";
import CasesPage from "@/pages/cases/CasesPage";
import MyViolationsPage from "@/pages/cases/MyViolationsPage";
import NewCasePage from "@pages/hr/NewCasePage/NewCasePage";
import DirectoriesPage from "@/pages/hr/DictionariesPage/DictionaryPage";
import ReportingPage from "@pages/hr/ReportingPage/ReportingPage";
import OrganizationPage from "@pages/organization/OrganizationPage";
import EmployeeProfilePage from "@pages/organization/EmployeeProfilePage";
import ComplaintNewPage from "@pages/complaints/ComplaintNewPage";
import ComplaintsInboxPage from "@pages/complaints/ComplaintsInboxPage";
import ComplaintDetailPage from "@pages/complaints/ComplaintDetailPage";
import CaseDetailPage from "@/pages/hr/CaseDetailPage/CaseDetailPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import AdminPage from "@/pages/admin/AdminPage";
import DocumentTemplatesPage from "@/pages/admin/DocumentTemplatesPage";
import CommissionsPage from "@/pages/commissions/CommissionsPage";

import ExplanationPage from "@/pages/employee/ExplanationPage/ExplanationPage";

function HomeRoute() {
  const { hasModule } = useAuthStore();

  if (hasModule("dashboard")) return <DashboardPage />;
  if (hasModule("cases")) return <Navigate to="/cases" replace />;
  if (hasModule("dictionaries")) return <Navigate to="/dictionaries" replace />;
  if (hasModule("admin")) return <Navigate to="/admin" replace />;
  return <Navigate to="/profile" replace />;
}

export function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            
            <Route path="/" element={<HomeRoute />} />

            <Route path="/cases" element={
              <ProtectedRoute requiredModule="cases">
                <CasesPage />
              </ProtectedRoute>
            } />
            
            <Route path="/my-violations" element={
              <ProtectedRoute requiredModule="cases">
                <MyViolationsPage />
              </ProtectedRoute>
            } />

            <Route path="/cases/new" element={
              <ProtectedRoute requiredModule="cases" requiredPermission="case:create">
                <NewCasePage />
              </ProtectedRoute>
            } />
            
            <Route path="/cases/:caseId" element={
              <ProtectedRoute requiredModule="cases">
                <CaseDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/cases/:caseId/explanation" element={
              <ProtectedRoute requiredModule="cases">
                <ExplanationPage />
              </ProtectedRoute>
            } />

            <Route path="/commissions" element={
              <ProtectedRoute requiredModule="commissions">
                <CommissionsPage />
              </ProtectedRoute>
            } />

            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute requiredModule="admin">
                <AdminPage />
              </ProtectedRoute>
            } />

            <Route path="/document-templates" element={
              <ProtectedRoute requiredModule="document_templates">
                <DocumentTemplatesPage />
              </ProtectedRoute>
            } />

            <Route path="/dictionaries" element={
              <ProtectedRoute requiredModule="dictionaries">
                <DirectoriesPage />
              </ProtectedRoute>
            } />

            <Route path="/organization" element={
              <ProtectedRoute requiredModule="organization" requiredPermission="org:read:all">
                <OrganizationPage />
              </ProtectedRoute>
            } />

            <Route path="/employees/:employeeUid" element={
              <ProtectedRoute>
                <EmployeeProfilePage />
              </ProtectedRoute>
            } />

            <Route path="/complaints/new" element={
              <ProtectedRoute>
                <ComplaintNewPage />
              </ProtectedRoute>
            } />

            <Route path="/complaints" element={
              <ProtectedRoute>
                <ComplaintsInboxPage />
              </ProtectedRoute>
            } />

            <Route path="/complaints/:id" element={
              <ProtectedRoute>
                <ComplaintDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/reports" element={
              <ProtectedRoute requiredModule="reports">
                <ReportingPage />
              </ProtectedRoute>
            } />

          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthGate>
  );
}