import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { userApi } from "@/shared/api";
import { useRolesStore } from "@shared/model/rolesStore";
import Avatar from "@shared/ui/Avatar";
import { getPageNumbers } from "@shared/utils/pagination";
import type { RoleShortResponse, UserResponse } from "@shared/types/api";
import { COMPANY_SCOPE, formatRoleAssignments, scopeKey, useOrgScopes } from "@entities/dictionary/useOrgScopes";
import { showAlert } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активен",
  BLOCKED: "Заблокирован",
};

const PAGE_SIZE = 6;

export function BlockUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserResponse;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [until, setUntil] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleBlock = async () => {
    if (!user.id) return;
    setIsSaving(true);
    try {
      await userApi.updateUserStatus(user.id, "BLOCKED", until ? `${until}:00` : undefined);
      onSaved();
      onClose();
    } catch (err) {
      console.error("Ошибка блокировки пользователя:", err);
      showAlert(getErrorMessage(err, "Не удалось заблокировать пользователя"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[16px] font-bold text-tx">Блокировка пользователя</h3>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="text-[13px] text-tx2">
            {user.fullName || user.username} будет лишён доступа к системе.
          </div>
          <label className="flex flex-col gap-1 text-[13px] text-tx">
            Заблокировать до (необязательно)
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="px-3 py-2 rounded-inp border border-bd text-[14px] text-tx"
            />
          </label>
          <div className="text-[12px] text-tx2">Если не указано — блокировка бессрочная.</div>
        </div>
        <div className="flex gap-3 p-4 pt-0">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors">
            Отмена
          </button>
          <button
            type="button"
            onClick={handleBlock}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-dg text-white hover:bg-dgh transition-colors disabled:opacity-50"
          >
            {isSaving ? "Блокировка..." : "Заблокировать"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserRolesPanel({
  user,
  allRoles,
  canWrite,
  onClose,
  onSaved,
}: {
  user: UserResponse;
  allRoles: RoleShortResponse[];
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { options, scopeLabel } = useOrgScopes();
  const roleNameByCode = new Map(allRoles.map((r) => [r.code, r.name]));

  interface Assignment { role: string; domainId?: string; departmentId?: string }
  const keyOf = (a: Assignment) => `${a.role}|${scopeKey(a.domainId, a.departmentId)}`;
  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    (user.activeRoles || []).flatMap((g) =>
      (g.roles || []).map((role) => ({ role, domainId: g.scopeDomainId, departmentId: g.scopeDepartmentId }))
    )
  );
  const [newRole, setNewRole] = useState("");
  const [newScope, setNewScope] = useState(COMPANY_SCOPE.key);
  const [isSaving, setIsSaving] = useState(false);

  const addAssignment = () => {
    const scope = options.find((o) => o.key === newScope) ?? COMPANY_SCOPE;
    if (!newRole) return;
    const next: Assignment = { role: newRole, domainId: scope.domainId, departmentId: scope.departmentId };
    setAssignments((prev) => (prev.some((a) => keyOf(a) === keyOf(next)) ? prev : [...prev, next]));
  };

  const handleSave = async () => {
    if (!user.id) return;
    setIsSaving(true);
    try {
      const groups = new Map<string, { roles: string[]; scopeDomainId?: string; scopeDepartmentId?: string }>();
      for (const a of assignments) {
        const key = scopeKey(a.domainId, a.departmentId);
        const group = groups.get(key) ?? { roles: [], scopeDomainId: a.domainId, scopeDepartmentId: a.departmentId };
        group.roles.push(a.role);
        groups.set(key, group);
      }
      await userApi.updateUserRoles(user.id, {
        assignments: Array.from(groups.values()),
        reason: "Изменено через панель администрирования",
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Ошибка обновления ролей пользователя:", err);
      showAlert(getErrorMessage(err, "Не удалось обновить роли пользователя"));
    } finally {
      setIsSaving(false);
    }
  };

  const selectClass = "min-w-0 border border-bd rounded-inp px-2.5 py-2 text-[13px] bg-bg text-tx outline-none focus:border-pr";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd shrink-0">
          <div>
            <h3 className="text-[18px] font-bold text-tx">{user.fullName || user.username}</h3>
            <span className="text-[12px] text-tx2">{user.username}</span>
          </div>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors" aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto min-h-0 flex flex-col gap-3">
          <div className="text-[13px] text-tx2">
            Роль действует в выбранной области: «Вся компания», домен или подразделение. Если сотрудник
            перейдёт в другой домен или подразделение, роль перестанет действовать.
          </div>

          {assignments.length === 0 ? (
            <div className="text-[13px] text-tx2 py-2">Ролей нет</div>
          ) : (
            <ul className="border border-bd rounded-inp divide-y divide-line">
              {assignments.map((a) => (
                <li key={keyOf(a)} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-tx truncate">{roleNameByCode.get(a.role) || a.role}</div>
                    <div className="text-[12px] text-tx2 break-words">{scopeLabel(a.domainId, a.departmentId)}</div>
                  </div>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setAssignments((prev) => prev.filter((x) => keyOf(x) !== keyOf(a)))}
                      className="shrink-0 text-[12px] text-dgt hover:underline"
                    >
                      Снять
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canWrite && (
            <div className="flex flex-col sm:flex-row gap-2">
              <select className={`${selectClass} sm:flex-1`} value={newRole} onChange={(e) => setNewRole(e.target.value)} aria-label="Роль">
                <option value="">Роль...</option>
                {allRoles.map((role) => (
                  <option key={role.id} value={role.code}>{role.name}</option>
                ))}
              </select>
              <select className={`${selectClass} sm:flex-1`} value={newScope} onChange={(e) => setNewScope(e.target.value)} aria-label="Область действия">
                {options.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addAssignment}
                disabled={!newRole}
                className="px-3 py-2 rounded-inp text-[13px] font-medium border border-bd text-tx hover:bg-surf transition-colors disabled:opacity-50"
              >
                Добавить
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 pt-3 shrink-0 border-t border-bd">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors">
            {canWrite ? "Отмена" : "Закрыть"}
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50"
            >
              {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function UsersTab({ canWrite }: { canWrite: boolean }) {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [blockingUser, setBlockingUser] = useState<UserResponse | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const handleUnblock = async (user: UserResponse) => {
    if (!user.id) return;
    setStatusUpdatingId(user.id);
    try {
      await userApi.updateUserStatus(user.id, "ACTIVE");
      fetchData();
    } catch (err) {
      console.error("Ошибка разблокировки пользователя:", err);
      showAlert(getErrorMessage(err, "Не удалось разблокировать пользователя"));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const allRoles = useRolesStore((s) => s.roles);
  const ensureRolesLoaded = useRolesStore((s) => s.ensureLoaded);

  useEffect(() => {
    ensureRolesLoaded().catch(() => {});
  }, [ensureRolesLoaded]);

  const roleNameByCode = new Map(allRoles.map((r) => [r.code, r.name]));
  const { scopeLabel } = useOrgScopes();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const inFlightRef = useRef<{ key: string; promise: Promise<void> } | null>(null);

  const fetchData = () => {
    const key = `${page}:${search}`;
    if (inFlightRef.current?.key === key) return inFlightRef.current.promise;

    setLoading(true);
    setError(null);
    const request = search
      ? userApi.searchUsers(search, { page, size: PAGE_SIZE })
      : userApi.getUsers({ page, size: PAGE_SIZE });
    const promise = request
      .then((usersPage) => {
        setUsers(usersPage.content || []);
        setTotalPages(usersPage.totalPages || 0);
        setTotalElements(usersPage.totalElements || 0);
      })
      .catch((err) => {
        console.error("Ошибка загрузки пользователей:", err);
        setError(getErrorMessage(err, "Не удалось загрузить список пользователей"));
      })
      .finally(() => {
        setLoading(false);
        inFlightRef.current = null;
      });
    inFlightRef.current = { key, promise };
    return promise;
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  if (error) return <div className="w-full border border-bd rounded-lg bg-bg p-8 text-center text-dgl text-[14px]">{error}</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-tx2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по ФИО, должности или логину"
            className="w-full pl-9 pr-3 py-2 rounded-inp border border-bd text-[14px] text-tx focus:outline-none focus:ring-2 focus:ring-pr/20"
          />
        </div>
        {totalElements > 0 && (
          <span className="text-[13px] text-tx2">
            {totalElements} {totalElements === 1 ? "пользователь" : "пользователей"}
          </span>
        )}
      </div>

      <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd">Пользователь</th>
              <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd">Роли</th>
              <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd w-[110px]">Статус</th>
              <th className="text-right font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd w-[130px]">Действия</th>
            </tr>
          </thead>
          <tbody className={`transition-opacity ${loading && users.length > 0 ? "opacity-50" : "opacity-100"}`}>
            {loading && users.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-tx2">Загрузка...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-tx2">Пользователи не найдены</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-surf transition-colors">
                  <td className="py-2 px-3 border-b border-bd/70 align-middle">
                    <div className="flex items-center gap-2.5">
                      <Avatar avatarUrl={user.avatarUrl} name={user.fullName || user.username || "?"} size={32} />
                      <div className="min-w-0">
                        {user.employeeUid ? (
                          <Link
                            to={`/employees/${user.employeeUid}`}
                            className="block font-medium text-[14px] text-tx truncate hover:text-prl hover:underline"
                            title="Открыть страницу пользователя"
                          >
                            {user.fullName || user.username}
                          </Link>
                        ) : (
                          <div className="font-medium text-[14px] text-tx truncate">{user.fullName || user.username}</div>
                        )}
                        <div className="text-[12px] text-tx2 truncate">{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3 border-b border-bd/70 align-middle text-[13px] text-tx break-words">
                    {(() => {
                      const lines = formatRoleAssignments(user.activeRoles, (code) => roleNameByCode.get(code) || code, scopeLabel);
                      return lines.length === 0 ? "—" : lines.map((l) => <div key={l}>{l}</div>);
                    })()}
                  </td>
                  <td className="py-2 px-3 border-b border-bd/70 align-middle">
                    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap ${user.status === "ACTIVE" ? "text-okt" : "text-dgt"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${user.status === "ACTIVE" ? "bg-ok" : "bg-dg"}`} />
                      {STATUS_LABELS[user.status || ""] || user.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-b border-bd/70 align-middle text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {user.employeeUid && (
                        <Link
                          to={`/employees/${user.employeeUid}`}
                          title="Страница пользователя"
                          aria-label="Страница пользователя"
                          className="w-8 h-8 inline-flex items-center justify-center rounded-inp text-tx2 hover:text-tx hover:bg-surf transition-colors"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
                          </svg>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingUser(user)}
                        title={canWrite ? "Роли пользователя" : "Просмотр ролей"}
                        aria-label={canWrite ? "Роли пользователя" : "Просмотр ролей"}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-inp text-prl hover:bg-pr/10 cursor-pointer transition-colors"
                      >
                        {canWrite ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" />
                            <path d="m9 12 2 2 4-4" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                      {canWrite && (
                        user.status === "BLOCKED" ? (
                          <button
                            type="button"
                            onClick={() => handleUnblock(user)}
                            disabled={statusUpdatingId === user.id}
                            title="Разблокировать"
                            aria-label="Разблокировать"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-inp text-okt hover:bg-okbg cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="4" y="11" width="16" height="10" rx="2" />
                              <path d="M8 11V7a4 4 0 0 1 7.5-2" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setBlockingUser(user)}
                            disabled={statusUpdatingId === user.id}
                            title="Заблокировать"
                            aria-label="Заблокировать"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-inp text-dgt hover:bg-dgbg cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="4" y="11" width="16" height="10" rx="2" />
                              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                            </svg>
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <button
            className="px-3 py-1.5 rounded-inp text-[13px] font-medium bg-bg border border-bd hover:bg-surf disabled:opacity-40 transition-colors"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Назад
          </button>

          {getPageNumbers(page, totalPages).map((p, i) =>
            p === "ellipsis" ? (
              <span key={`ellipsis-${i}`} className="px-1.5 text-[13px] text-tx2">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`min-w-[34px] px-2 py-1.5 rounded-inp text-[13px] font-medium transition-colors ${
                  p === page ? "bg-pr text-white" : "bg-bg border border-bd text-tx hover:bg-surf"
                }`}
              >
                {p + 1}
              </button>
            )
          )}

          <button
            className="px-3 py-1.5 rounded-inp text-[13px] font-medium bg-bg border border-bd hover:bg-surf disabled:opacity-40 transition-colors"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Далее
          </button>
        </div>
      )}

      {editingUser && (
        <UserRolesPanel
          user={editingUser}
          allRoles={allRoles}
          canWrite={canWrite}
          onClose={() => setEditingUser(null)}
          onSaved={fetchData}
        />
      )}

      {blockingUser && (
        <BlockUserModal
          user={blockingUser}
          onClose={() => setBlockingUser(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
