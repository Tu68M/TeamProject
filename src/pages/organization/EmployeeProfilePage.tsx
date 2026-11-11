import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dictionaryApi } from "@entities/dictionary/dictionaryApi";
import { employeeApi } from "@entities/employee/api/employeeApi";
import { userApi } from "@entities/user/userApi";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import Avatar from "@shared/ui/Avatar";
import { ErrorState } from "@shared/ui/ErrorState";
import { formatServerDateTime } from "@shared/utils/datetime";
import { useAuthStore } from "@entities/session/model/authStore";
import { useRolesStore } from "@shared/model/rolesStore";
import { formatRoleAssignments, useOrgScopes } from "@entities/dictionary/useOrgScopes";
import { BlockUserModal, UserRolesPanel } from "@pages/admin/UsersTab";
import { showAlert } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-[12px] font-semibold text-tx2 uppercase tracking-wider mb-3">{children}</h2>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 border-b border-bd last:border-b-0">
      <span className="text-[13px] leading-[18px] text-tx2 shrink-0">{label}</span>
      <span className="text-[14px] leading-[20px] text-right text-tx font-medium min-w-0 max-w-full ml-auto break-words [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

export default function EmployeeProfilePage() {
  const { employeeUid } = useParams<{ employeeUid: string }>();
  const navigate = useNavigate();
  const timezone = useTimezoneStore((s) => s.timezone);

  const employeeQuery = useQuery({
    queryKey: ["employeeProfile", employeeUid],
    queryFn: () => employeeApi.getEmployeeByUid(employeeUid!),
    enabled: Boolean(employeeUid),
  });
  const employee = employeeQuery.data;
  const myEmployeeUid = useAuthStore((s) => s.context?.employeeUid);
  const canSeeHrBp = useAuthStore((s) => s.hasPermission("case:create"));
  const canSeeDetails = useAuthStore(
    (s) =>
      s.hasPermission("employee:read:department") ||
      s.hasPermission("employee:read:domain") ||
      s.hasPermission("employee:read:all") ||
      (Boolean(employeeUid) && s.context?.employeeUid === employeeUid)
  );

  const domainQuery = useQuery({
    queryKey: ["domainShort", employee?.domainId],
    queryFn: () => dictionaryApi.getShortDomainById(employee!.domainId!),
    enabled: Boolean(employee?.domainId),
    retry: false,
  });
  const departmentQuery = useQuery({
    queryKey: ["departmentBrief", employee?.departmentId],
    queryFn: () => dictionaryApi.getDepartmentBrief(employee!.departmentId!),
    enabled: Boolean(employee?.departmentId),
    retry: false,
  });
  const hrBpQuery = useQuery({
    queryKey: ["employeeProfile", employee?.hrBpUid],
    queryFn: () => employeeApi.getEmployeeByUid(employee!.hrBpUid!),
    enabled: canSeeHrBp && Boolean(employee?.hrBpUid),
    retry: false,
  });

  const canReadUser = useAuthStore((s) => s.hasPermission("user:read"));
  const canWriteUser = useAuthStore((s) => s.hasPermission("user:role:write"));
  const queryClient = useQueryClient();
  const accountQuery = useQuery({
    queryKey: ["userByEmployee", employeeUid],
    queryFn: () => userApi.getUserByEmployeeUid(employeeUid!),
    enabled: canReadUser && Boolean(employeeUid),
    retry: false,
  });
  const account = accountQuery.data;
  const allRoles = useRolesStore((s) => s.roles);
  const ensureRolesLoaded = useRolesStore((s) => s.ensureLoaded);
  useEffect(() => {
    if (canReadUser) ensureRolesLoaded().catch(() => {});
  }, [canReadUser, ensureRolesLoaded]);
  const roleNameByCode = new Map(allRoles.map((r) => [r.code, r.name]));
  const { scopeLabel } = useOrgScopes(canReadUser);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const refreshAccount = () => queryClient.invalidateQueries({ queryKey: ["userByEmployee", employeeUid] });
  const handleUnblock = async () => {
    if (!account?.id) return;
    setStatusBusy(true);
    try {
      await userApi.updateUserStatus(account.id, "ACTIVE");
      await refreshAccount();
    } catch (err) {
      console.error("Ошибка разблокировки пользователя:", err);
      showAlert(getErrorMessage(err, "Не удалось разблокировать пользователя"));
    } finally {
      setStatusBusy(false);
    }
  };

  const backButton = (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-1.5 text-[14px] font-medium text-tx2 hover:text-tx transition-colors mb-4"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Назад
    </button>
  );

  if (employeeQuery.isError) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        {backButton}
        <ErrorState
          error={employeeQuery.error}
          title="Не удалось загрузить профиль сотрудника"
          onRetry={() => employeeQuery.refetch()}
        />
      </div>
    );
  }

  if (employeeQuery.isLoading || !employee) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        {backButton}
        <div className="max-w-[720px] mx-auto bg-bg border border-bd rounded-lg h-[320px] animate-pulse" />
      </div>
    );
  }

  const cardClass = "bg-bg border border-bd rounded-lg shadow-sm";
  const showAccount = canReadUser;
  const hrBp = hrBpQuery.data;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className={`mx-auto px-4 sm:px-6 py-6 sm:py-8 ${showAccount && account ? "max-w-[1100px]" : "max-w-[720px]"}`}>
        {backButton}
        <div className={showAccount && account ? "grid grid-cols-1 xl:grid-cols-[minmax(0,720px)_minmax(300px,1fr)] gap-4 xl:gap-6 items-start" : ""}>
        <div className={cardClass}>
          <div className="flex flex-col items-center text-center px-5 sm:px-7 py-6 sm:py-7 border-b border-bd">
            <Avatar
              avatarUrl={employee.uid ? userApi.employeeAvatarUrl(employee.uid) : null}
              name={employee.fullName || "?"}
              size={104}
              className="text-[22px] sm:text-[24px]"
            />
            <h1 className="text-[20px] sm:text-[22px] leading-[26px] sm:leading-[30px] font-semibold text-tx mt-4 max-w-full break-words">
              {employee.fullName}
            </h1>
            {employee.position && <div className="text-[14px] leading-[20px] text-tx2 mt-1">{employee.position}</div>}
            {employee.uid !== myEmployeeUid && employee.isActive !== false && (
              <Link
                to={`/complaints/new?accused=${employee.uid}&name=${encodeURIComponent(employee.fullName ?? "")}${
                  employee.position ? `&position=${encodeURIComponent(employee.position)}` : ""
                }`}
                className="mt-3 px-3 py-1.5 rounded-inp font-medium text-[13px] text-tx2 border border-bd hover:text-dgl hover:border-dg/40 transition-colors"
              >
                Пожаловаться
              </Link>
            )}
            {canSeeDetails && employee.isActive === false && (
              <span className="mt-2 px-2 py-0.5 rounded-full bg-ntbg text-tx2 text-[12px] font-medium">Неактивен</span>
            )}
          </div>

          <div className="px-5 sm:px-7 py-6 sm:py-7">
            <SectionTitle>Основная информация</SectionTitle>
            <Field label="ФИО">{employee.fullName || "—"}</Field>
            <Field label="Должность">{employee.position || "—"}</Field>
            {canSeeDetails && <Field label="Табельный номер">{employee.tabNumber || "—"}</Field>}
            <Field label="E-mail">
              {employee.email ? (
                <a href={`mailto:${employee.email}`} className="text-prl hover:text-prt hover:underline">
                  {employee.email}
                </a>
              ) : (
                "—"
              )}
            </Field>
            {!domainQuery.isError && (
              <Field label="Домен">{domainQuery.data?.nameShort || domainQuery.data?.nameFull || "—"}</Field>
            )}
            {!departmentQuery.isError && <Field label="Подразделение">{departmentQuery.data?.name || "—"}</Field>}
            {canSeeHrBp && (
            <Field label="HR BP">
              {employee.hrBpUid ? (
                hrBp ? (
                  <Link
                    to={`/employees/${employee.hrBpUid}`}
                    className="inline-flex items-center gap-2 text-prl hover:text-prt hover:underline"
                  >
                    <Avatar
                      avatarUrl={userApi.employeeAvatarUrl(employee.hrBpUid)}
                      name={hrBp.fullName || "?"}
                      size={28}
                      className="text-[11px]"
                    />
                    {hrBp.fullName}
                  </Link>
                ) : hrBpQuery.isLoading ? (
                  "…"
                ) : (
                  "—"
                )
              ) : (
                "Не назначен"
              )}
            </Field>
            )}
            {canSeeDetails && employee.syncedAt && (
              <Field label="Данные обновлены">{formatServerDateTime(employee.syncedAt, timezone)}</Field>
            )}
          </div>
        </div>
        {showAccount && account && (
          <aside className={`${cardClass} px-5 sm:px-7 py-6 sm:py-7`}>
            <SectionTitle>Учётная запись в системе</SectionTitle>
            <Field label="Логин">{account.username || "—"}</Field>
            <Field label="Статус">
              <span className={`inline-flex items-center gap-1.5 font-medium ${account.status === "ACTIVE" ? "text-okt" : "text-dgt"}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${account.status === "ACTIVE" ? "bg-ok" : "bg-dg"}`} />
                {account.status === "ACTIVE" ? "Активен" : account.status === "BLOCKED" ? "Заблокирован" : account.status}
              </span>
            </Field>
            <Field label="Роли в системе">
              {(() => {
                const lines = formatRoleAssignments(account.activeRoles, (code) => roleNameByCode.get(code) || code, scopeLabel);
                return lines.length === 0 ? "Нет ролей" : lines.map((l) => <span key={l} className="block">{l}</span>);
              })()}
            </Field>
            {account.lastLoginAt && <Field label="Последний вход">{formatServerDateTime(account.lastLoginAt, timezone)}</Field>}
            {canWriteUser && (
              <div className="flex flex-wrap gap-2 mt-4 [&>button]:max-w-full">
                <button
                  type="button"
                  onClick={() => setRolesOpen(true)}
                  className="px-3.5 py-2 rounded-inp font-medium text-[13px] bg-bg text-tx border border-bd hover:bg-surf transition-colors"
                >
                  Изменить роли
                </button>
                {account.employeeUid !== myEmployeeUid &&
                  (account.status === "BLOCKED" ? (
                    <button
                      type="button"
                      disabled={statusBusy}
                      onClick={handleUnblock}
                      className="px-3.5 py-2 rounded-inp font-medium text-[13px] bg-bg text-okt border border-bd hover:bg-okbg transition-colors disabled:opacity-50"
                    >
                      {statusBusy ? "Разблокировка..." : "Разблокировать"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBlockOpen(true)}
                      className="px-3.5 py-2 rounded-inp font-medium text-[13px] bg-bg text-dgt border border-bd hover:bg-dgbg transition-colors"
                    >
                      Заблокировать
                    </button>
                  ))}
              </div>
            )}
          </aside>
        )}

        </div>

        {rolesOpen && account && (
          <UserRolesPanel
            user={account}
            allRoles={allRoles}
            canWrite={canWriteUser}
            onClose={() => setRolesOpen(false)}
            onSaved={refreshAccount}
          />
        )}
        {blockOpen && account && (
          <BlockUserModal user={account} onClose={() => setBlockOpen(false)} onSaved={refreshAccount} />
        )}
      </div>
    </div>
  );
}
