import { useEffect, useState } from "react";
import { userApi } from "@/shared/api";
import { useRolesStore } from "@shared/model/rolesStore";
import { useAllPermissionsStore } from "@shared/model/allPermissionsStore";
import type { PermissionResponse, RoleResponse } from "@shared/types/api";
import { showAlert } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

function PermissionChecklist({
  permissions,
  selected,
  onToggle,
  disabled,
}: {
  permissions: PermissionResponse[];
  selected: Set<string>;
  onToggle: (code: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="max-h-72 overflow-y-auto border border-bd rounded-inp p-3 flex flex-col gap-1.5">
      {permissions.map((perm) => (
        <label key={perm.id} className={`flex items-start gap-2 text-[13px] text-tx ${disabled ? "opacity-60" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 rounded border-bd text-prl focus:ring-pr/20"
            checked={selected.has(perm.code || "")}
            onChange={() => perm.code && onToggle(perm.code)}
            disabled={disabled}
          />
          <span className="inline-flex items-center gap-1.5">
            {perm.name}
            {perm.code && (
              <span title={perm.code} className="inline-flex shrink-0 text-tx2 cursor-help">
                <svg
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="11" x2="12" y2="16" />
                  <circle cx="12" cy="8" r="0.5" fill="currentColor" />
                </svg>
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

function RoleEditPanel({
  role,
  allPermissions,
  canWrite,
  onClose,
  onSaved,
}: {
  role: RoleResponse;
  allPermissions: PermissionResponse[];
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set((role.permissions || []).map((p) => p.code || ""))
  );
  const [name, setName] = useState(role.name || "");
  const [description, setDescription] = useState(role.description || "");
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSave = async () => {
    if (!role.id || !name.trim()) return;
    setIsSaving(true);
    try {
      if (name.trim() !== (role.name || "") || description.trim() !== (role.description || "")) {
        await userApi.updateRole(role.id, { name: name.trim(), description: description.trim() || null });
      }
      await userApi.updateRolePermissions(role.id, { permissions: Array.from(selected) });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Ошибка сохранения прав роли:", err);
      showAlert(getErrorMessage(err, "Не удалось сохранить права роли"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[18px] font-bold text-tx">{role.name}</h3>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {role.isSystem && (
            <div className="p-3 rounded-inp bg-wnbg text-wnt text-[13px]">
              Это системная роль. Изменение её прав может повлиять на работу системы, включая доступ администратора к этой странице.
            </div>
          )}
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Название</label>
            <input className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none disabled:bg-surf"
              maxLength={255} value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Описание</label>
            <textarea className="w-full min-h-[60px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none resize-y disabled:bg-surf"
              value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canWrite} />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Права</label>
            <PermissionChecklist permissions={allPermissions} selected={selected} onToggle={toggle} disabled={!canWrite} />
          </div>
        </div>

        <div className="flex gap-3 p-4 pt-0">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors">
            Закрыть
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
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

function CreateRolePanel({
  allPermissions,
  onClose,
  onCreated,
}: {
  allPermissions: PermissionResponse[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSystem, setIsSystem] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (permCode: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permCode)) next.delete(permCode);
      else next.add(permCode);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await userApi.createRole({
        name: name.trim(),
        description: description.trim() || undefined,
        isSystem,
        permissions: Array.from(selected),
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error("Ошибка создания роли:", err);
      showAlert(getErrorMessage(err, "Не удалось создать роль"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[18px] font-bold text-tx">Новая роль</h3>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Название</label>
            <input required className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none"
              value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Описание</label>
            <textarea className="w-full min-h-[60px] border border-bd rounded-inp px-3 py-2 text-[14px] focus:border-pr focus:ring-3 focus:ring-pr/10 outline-none resize-y"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isSystemNew" className="w-4 h-4 text-prl rounded border-bd focus:ring-pr/10"
              checked={isSystem} onChange={(e) => setIsSystem(e.target.checked)} />
            <label htmlFor="isSystemNew" className="text-[14px] text-tx">Системная роль</label>
          </div>
          <div>
            <label className="block text-[14px] font-medium text-tx mb-1">Права</label>
            <PermissionChecklist permissions={allPermissions} selected={selected} onToggle={toggle} />
          </div>
        </div>

        <div className="flex gap-3 p-4 pt-0">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors">
            Отмена
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSaving || !name.trim()}
            className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50"
          >
            {isSaving ? "Создание..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RolesTab({
  canWrite,
  isCreating,
  onCloseCreating,
}: {
  canWrite: boolean;
  isCreating: boolean;
  onCloseCreating: () => void;
}) {
  const roles = useRolesStore((s) => s.roles);
  const isRolesLoading = useRolesStore((s) => s.isLoading);
  const isRolesLoaded = useRolesStore((s) => s.isLoaded);
  const rolesError = useRolesStore((s) => s.error);
  const ensureRolesLoaded = useRolesStore((s) => s.ensureLoaded);
  const refreshRoles = useRolesStore((s) => s.refresh);

  const allPermissions = useAllPermissionsStore((s) => s.permissions);
  const isPermissionsLoading = useAllPermissionsStore((s) => s.isLoading);
  const isPermissionsLoaded = useAllPermissionsStore((s) => s.isLoaded);
  const permissionsError = useAllPermissionsStore((s) => s.error);
  const ensurePermissionsLoaded = useAllPermissionsStore((s) => s.ensureLoaded);

  const loading = (isRolesLoading && !isRolesLoaded) || (isPermissionsLoading && !isPermissionsLoaded);
  const error = rolesError || permissionsError;

  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);

  useEffect(() => {
    ensureRolesLoaded().catch(() => {});
    ensurePermissionsLoaded().catch(() => {});
  }, [ensureRolesLoaded, ensurePermissionsLoaded]);

  const fetchData = () => refreshRoles();

  const openRole = async (roleId?: string) => {
    if (!roleId) return;
    try {
      const role = await userApi.getRoleById(roleId);
      setEditingRole(role);
    } catch (err) {
      console.error("Ошибка загрузки роли:", err);
      showAlert(getErrorMessage(err, "Не удалось загрузить роль"));
    }
  };

  if (loading) return <div className="w-full border border-bd rounded-lg bg-bg p-8 text-center text-tx2 text-[14px]">Загрузка...</div>;
  if (error) return <div className="w-full border border-bd rounded-lg bg-bg p-8 text-center text-dgl text-[14px]">{error}</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd">Название</th>
              <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd">Описание</th>
              <th className="text-right font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd w-[100px]">Действия</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-8 text-tx2">Роли не найдены</td></tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id} className="hover:bg-surf transition-colors">
                  <td className={`py-2 px-3 border-b border-bd/70 align-middle text-[14px] text-tx font-medium ${role.isActive ? "" : "opacity-60"}`}>
                    {role.name}
                    {!role.isActive && <span className="ml-2 text-[11px] font-normal text-tx2">Неактивна</span>}
                  </td>
                  <td className={`py-2 px-3 border-b border-bd/70 align-middle text-[13px] text-tx2 ${role.isActive ? "" : "opacity-60"}`}>{role.description}</td>
                  <td className="py-2 px-3 border-b border-bd/70 align-middle text-right whitespace-nowrap">
                    <button type="button" onClick={() => openRole(role.id)} className="text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors">
                      {canWrite ? "Изменить" : "Просмотр"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingRole && (
        <RoleEditPanel
          role={editingRole}
          allPermissions={allPermissions}
          canWrite={canWrite}
          onClose={() => setEditingRole(null)}
          onSaved={fetchData}
        />
      )}

      {isCreating && (
        <CreateRolePanel
          allPermissions={allPermissions}
          onClose={onCloseCreating}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
