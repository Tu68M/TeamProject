import { bumpSessionVersion } from "./sessionVersion";
import { useActionRequiredCasesStore } from "./actionRequiredCasesStore";
import { useAllCommissionsStore } from "./allCommissionsStore";
import { useAllPermissionsStore } from "./allPermissionsStore";
import { useCaseRegistryStore } from "./caseRegistryStore";
import { useCaseStatsStore } from "./caseStatsStore";
import { useCommissionTypesStore } from "./commissionTypesStore";
import { useDecisionTypesStore } from "./decisionTypesStore";
import { useModulesStore } from "./modulesStore";
import { useMyCommissionsStore } from "./myCommissionsStore";
import { useRolesStore } from "./rolesStore";
import { useViolationTypesStore } from "./violationTypesStore";

function resetStore<T>(store: { setState: (state: T, replace: true) => void; getInitialState: () => T }) {
  store.setState(store.getInitialState(), true);
}

export function resetUserData() {
  bumpSessionVersion();
  resetStore(useActionRequiredCasesStore);
  resetStore(useAllCommissionsStore);
  resetStore(useAllPermissionsStore);
  resetStore(useCaseRegistryStore);
  resetStore(useCaseStatsStore);
  resetStore(useCommissionTypesStore);
  resetStore(useDecisionTypesStore);
  resetStore(useModulesStore);
  resetStore(useMyCommissionsStore);
  resetStore(useRolesStore);
  resetStore(useViolationTypesStore);
}
