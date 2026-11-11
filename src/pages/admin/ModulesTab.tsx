import { useEffect, useState } from "react";
import { userApi } from "@/shared/api";
import { useAllPermissionsStore } from "@shared/model/allPermissionsStore";
import { useModulesStore } from "@shared/model/modulesStore";
import type { ModuleAccessLevel, ModuleResponse, PermissionResponse } from "@shared/types/api";
import { showAlert } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

function ModuleEditPanel({
  moduleItem,
  allPermissions,
  canWrite,
  onClose,
}: {
  moduleItem: ModuleResponse;
  allPermissions: PermissionResponse[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const [levels, setLevels] = useState<Map<string, ModuleAccessLevel>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchEntries = async () => {
      if (!moduleItem.code) return;
      setLoading(true);
      try {
        const entries = await userApi.getModulePermissions(moduleItem.code);
        const map = new Map<string, ModuleAccessLevel>();
        for (const entry of entries) {
          if (entry.permission?.code && entry.accessLevel) {
            map.set(entry.permission.code, entry.accessLevel);
          }
        }
        setLevels(map);
      } catch (err) {
        console.error("Ошибка загрузки прав модуля:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [moduleItem.code]);

  const toggle = (code: string) => {
    setLevels((prev) => {
      const next = new Map(prev);
      if (next.has(code)) next.delete(code);
      else next.set(code, "READ");
      return next;
    });
  };

  const setLevel = (code: string, level: ModuleAccessLevel) => {
    setLevels((prev) => new Map(prev).set(code, level));
  };

  const handleSave = async () => {
    if (!moduleItem.code) return;
    setIsSaving(true);
    try {
      const entries = Array.from(levels.entries()).map(([permissionCode, accessLevel]) => ({
        permissionCode,
        accessLevel,
      }));
      await userApi.setModulePermissions(moduleItem.code, entries);
      onClose();
    } catch (err) {
      console.error("Ошибка сохранения прав модуля:", err);
      showAlert(getErrorMessage(err, "Не удалось сохранить права модуля"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <div>
            <h3 className="text-[18px] font-bold text-tx">{moduleItem.name}</h3>
            <span className="font-mono text-[12px] text-tx2">{moduleItem.code}</span>
          </div>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-4">
          <div className="text-[13px] text-tx2 mb-2">
            Пользователь получает доступ к модулю, если хотя бы одно из его прав входит в этот список.
            Уровень доступа к модулю — максимальный (WRITE) среди совпавших прав.
          </div>
          {loading ? (
            <div className="text-center py-6 text-tx2">Загрузка...</div>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-bd rounded-inp p-3 flex flex-col gap-1.5">
              {allPermissions.map((perm) => {
                const level = perm.code ? levels.get(perm.code) : undefined;
                const checked = level !== undefined;
                return (
                  <div key={perm.id} className="flex items-center gap-2 text-[13px] text-tx">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-bd text-prl focus:ring-pr/20"
                      checked={checked}
                      onChange={() => perm.code && toggle(perm.code)}
                      disabled={!canWrite}
                    />
                    <span className="font-mono text-[12px] text-tx2 flex-1 min-w-0 truncate">{perm.code}</span>
                    <select
                      className="border border-bd rounded-inp px-2 py-1 text-[12px] bg-bg outline-none disabled:opacity-50"
                      value={level || "READ"}
                      disabled={!checked || !canWrite}
                      onChange={(e) => perm.code && setLevel(perm.code, e.target.value as ModuleAccessLevel)}
                    >
                      <option value="READ">READ</option>
                      <option value="WRITE">WRITE</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 pt-0">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors">
            {canWrite ? "Отмена" : "Закрыть"}
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || loading}
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

export function ModulesTab({ canWrite }: { canWrite: boolean }) {
  const [editingModule, setEditingModule] = useState<ModuleResponse | null>(null);

  const modules = useModulesStore((s) => s.modules);
  const isModulesLoading = useModulesStore((s) => s.isLoading);
  const isModulesLoaded = useModulesStore((s) => s.isLoaded);
  const modulesError = useModulesStore((s) => s.error);
  const ensureModulesLoaded = useModulesStore((s) => s.ensureLoaded);

  const allPermissions = useAllPermissionsStore((s) => s.permissions);
  const isPermissionsLoading = useAllPermissionsStore((s) => s.isLoading);
  const isPermissionsLoaded = useAllPermissionsStore((s) => s.isLoaded);
  const permissionsError = useAllPermissionsStore((s) => s.error);
  const ensurePermissionsLoaded = useAllPermissionsStore((s) => s.ensureLoaded);

  const loading = (isModulesLoading && !isModulesLoaded) || (isPermissionsLoading && !isPermissionsLoaded);
  const error = modulesError || permissionsError;

  useEffect(() => {
    ensureModulesLoaded().catch(() => {});
    ensurePermissionsLoaded().catch(() => {});
  }, [ensureModulesLoaded, ensurePermissionsLoaded]);

  if (loading) return <div className="w-full border border-bd rounded-lg bg-bg p-8 text-center text-tx2 text-[14px]">Загрузка...</div>;
  if (error) return <div className="w-full border border-bd rounded-lg bg-bg p-8 text-center text-dgl text-[14px]">{error}</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full border border-bd rounded-lg bg-bg overflow-hidden">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd">Название</th>
              <th className="text-right font-medium text-[12px] text-tx2 py-2 px-3 bg-bg border-b border-bd w-[120px]">Действия</th>
            </tr>
          </thead>
          <tbody>
            {modules.length === 0 ? (
              <tr><td colSpan={2} className="text-center py-8 text-tx2">Модули не найдены</td></tr>
            ) : (
              modules.map((moduleItem) => (
                <tr key={moduleItem.id} className="hover:bg-surf transition-colors">
                  <td className={`py-2 px-3 border-b border-bd/70 align-middle text-[14px] text-tx font-medium ${moduleItem.isActive ? "" : "opacity-60"}`}>
                    {moduleItem.name}
                    {!moduleItem.isActive && <span className="ml-2 text-[11px] font-normal text-tx2">Неактивен</span>}
                  </td>
                  <td className="py-2 px-3 border-b border-bd/70 align-middle text-right whitespace-nowrap">
                    <button type="button" onClick={() => setEditingModule(moduleItem)} className="text-[13px] font-medium text-prl hover:text-prt cursor-pointer transition-colors">
                      {canWrite ? "Права модуля" : "Просмотр"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingModule && (
        <ModuleEditPanel
          moduleItem={editingModule}
          allPermissions={allPermissions}
          canWrite={canWrite}
          onClose={() => setEditingModule(null)}
        />
      )}
    </div>
  );
}
