import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@entities/session/model/authStore";
import { RolesTab } from "./RolesTab";
import { UsersTab } from "./UsersTab";
import { ModulesTab } from "./ModulesTab";
import { FadeSwap } from "@shared/ui/FadeSwap";

const ADMIN_TABS = [
  { id: "roles", label: "Роли", readPermission: "role:permission:read", writePermissions: ["role:permission:edit", "role:create"] },
  { id: "users", label: "Пользователи", readPermission: "user:read", writePermissions: ["user:role:write"] },
  { id: "modules", label: "Модули", readPermission: "permission:read", writePermissions: ["role:permission:edit"] },
] as const;

function AdminContentSkeleton() {
  return (
    <div className="w-full border border-bd rounded-card bg-bg overflow-hidden animate-pulse">
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            {Array.from({ length: 4 }).map((_, i) => (
              <th key={i} className="text-left py-2.5 px-3 bg-bg border-b border-bd">
                <div className="h-3.5 w-20 bg-skel rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="py-2.5 px-3 border-b border-line align-middle">
                <div className="h-4 w-24 bg-skel rounded" />
              </td>
              <td className="py-2.5 px-3 border-b border-line align-middle">
                <div className="h-4 w-40 bg-skel rounded" />
              </td>
              <td className="py-2.5 px-3 border-b border-line align-middle">
                <div className="h-5 w-32 bg-skel rounded" />
              </td>
              <td className="py-2.5 px-3 border-b border-line align-middle text-right">
                <div className="h-4 w-16 bg-skel rounded ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const visibleTabs = useMemo(
    () => ADMIN_TABS.filter((tab) => hasPermission(tab.readPermission)),
    [hasPermission]
  );

  const [activeTab, setActiveTab] = useState<string>(() => visibleTabs[0]?.id ?? "roles");

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs]);

  const canWrite = Boolean(
    visibleTabs.find((tab) => tab.id === activeTab)?.writePermissions.some(hasPermission)
  );
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const updateIndicator = () => {
      const btn = tabRefs.current[activeTab];
      const container = tabsContainerRef.current;
      if (!btn || !container) return;
      setIndicator({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeTab, visibleTabs.length]);

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-semibold text-tx">Администрирование</h1>
          <div className="text-[13px] leading-[18px] text-tx2 mt-1">
            Роли, права доступа, пользователи и модули системы.
            {visibleTabs.length > 0 && !canWrite && " У вас доступ только на чтение."}
          </div>
        </div>
        {activeTab === "roles" && canWrite && (
          <button
            className="w-full sm:w-auto px-4 py-2.5 rounded-inp font-medium text-[14px] leading-[20px] bg-pr text-white border border-transparent hover:bg-prh transition-colors cursor-pointer"
            onClick={() => setIsCreatingRole(true)}
          >
            Создать роль
          </button>
        )}
      </div>

      <div
        ref={tabsContainerRef}
        className="relative flex gap-1 border-b border-bd mb-3 overflow-x-auto scrollbar-thin"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[tab.id] = el; }}
            type="button"
            className={`px-3.5 py-2 text-[14px] leading-[20px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? "text-prt font-medium" : "text-tx2 font-normal hover:text-tx"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}

        {indicator.width > 0 && (
          <span
            aria-hidden="true"
            className="absolute bottom-0 h-0.5 bg-pr transition-all duration-200 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}
      </div>

      {visibleTabs.length === 0 ? (
        <div className="w-full border border-bd rounded-card bg-bg p-8 text-center text-tx2">
          У вас нет доступа ни к одному разделу администрирования.
        </div>
      ) : (
        <FadeSwap
          key={activeTab}
          showSkeleton={false}
          skeleton={<AdminContentSkeleton />}
        >
          {activeTab === "roles" && (
            <RolesTab canWrite={canWrite} isCreating={isCreatingRole} onCloseCreating={() => setIsCreatingRole(false)} />
          )}
          {activeTab === "users" && <UsersTab canWrite={canWrite} />}
          {activeTab === "modules" && <ModulesTab canWrite={canWrite} />}
        </FadeSwap>
      )}
    </div>
  );
}