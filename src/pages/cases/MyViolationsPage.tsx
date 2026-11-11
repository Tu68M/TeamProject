import { useMyViolations } from "@/entities/case/api/useCaseQueries";
import { MyCasesView } from "./MyCasesView";
import { ErrorState } from "@shared/ui/ErrorState";

export default function MyViolationsPage() {
  const { data, isLoading, error } = useMyViolations();

  if (error) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <ErrorState error={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="mb-5">
        <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-bold text-tx">Мои нарушения</h1>
        <p className="text-[14px] leading-[20px] text-tx2 mt-1">Дела, в которых вы указаны как нарушитель.</p>
      </div>

      <MyCasesView
        cases={data ?? []}
        isLoaded={!isLoading}
        emptyTitle="Нарушений нет"
        emptyText="На вас не заведено ни одного дисциплинарного дела."
      />
    </div>
  );
}
