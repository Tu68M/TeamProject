import { useEffect, useState } from "react";
import { useAuthStore } from "@entities/session/model/authStore";
import { useAllCommissionsStore } from "@shared/model/allCommissionsStore";

interface CommissionTabAccess {
  loading: boolean;
  canSee: boolean;
}

export function useCommissionTabAccess(caseId: string | undefined): CommissionTabAccess {
  const { hasPermission } = useAuthStore();
  const canReadBroad =
    hasPermission("commission:read:department") ||
    hasPermission("commission:read:domain") ||
    hasPermission("commission:read:all");
  const canCreate = hasPermission("commission:create");
  const canReadOwn = hasPermission("commission:read:own");

  const staticCanSee = canReadBroad || canCreate;
  const needsOwnCheck = !staticCanSee && canReadOwn && Boolean(caseId);

  const ensureAllCommissionsLoaded = useAllCommissionsStore((s) => s.ensureLoaded);

  const [state, setState] = useState<CommissionTabAccess>(() => ({
    loading: needsOwnCheck,
    canSee: staticCanSee,
  }));

  useEffect(() => {
    if (staticCanSee || !canReadOwn || !caseId) {
      setState({ loading: false, canSee: staticCanSee });
      return;
    }

    let cancelled = false;
    setState({ loading: true, canSee: false });

    ensureAllCommissionsLoaded()
      .then((all) => {
        if (cancelled) return;
        const isMember = (all || []).some((c) => c.caseId === caseId);
        setState({ loading: false, canSee: isMember });
      })
      .catch((err) => {
        console.error("Ошибка проверки доступа к вкладке комиссии:", err);
        if (cancelled) return;
        setState({ loading: false, canSee: false });
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, staticCanSee, canReadOwn, ensureAllCommissionsLoaded]);

  return state;
}
