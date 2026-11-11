import { useEffect, useMemo, useState } from "react";
import { useDecisionTypesStore } from "@shared/model/decisionTypesStore";
import { getDecisionTypeLabel } from "@shared/utils/commissionStatus";

type Outcome = "none" | "penalty";

export function LawyerDecisionModal({
  caseNumber,
  onContinue,
  onClose,
}: {
  caseNumber?: string;
  onContinue: (decisionTypeCode: string | null) => void;
  onClose: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome>("none");
  const [decisionTypeCode, setDecisionTypeCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const allDecisionTypes = useDecisionTypesStore((s) => s.decisionTypes);
  const isLoading = useDecisionTypesStore((s) => s.isLoading);
  const isLoaded = useDecisionTypesStore((s) => s.isLoaded);
  const ensureLoaded = useDecisionTypesStore((s) => s.ensureLoaded);
  const decisionTypes = useMemo(() => allDecisionTypes.filter((t) => t.isActive !== false), [allDecisionTypes]);

  useEffect(() => {
    ensureLoaded().catch(() => {});
  }, [ensureLoaded]);

  const handleContinue = () => {
    if (outcome === "penalty" && !decisionTypeCode) {
      setError("Выберите вид взыскания");
      return;
    }
    onContinue(outcome === "penalty" ? decisionTypeCode : null);
  };

  const optionClass = (active: boolean) =>
    `flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
      active ? "border-pr bg-pr/5" : "border-bd hover:bg-surf"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Решение юриста"
        className="bg-bg rounded-lg border border-bd w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-bd shrink-0">
          <div>
            <h3 className="text-[18px] font-bold text-tx">Решение юриста</h3>
            <div className="text-[13px] text-tx2">
              {caseNumber ? `Дело ${caseNumber} · ` : ""}закрытие без заседания комиссии
            </div>
          </div>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors" type="button" aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-auto min-h-0">
          <label className={optionClass(outcome === "none")}>
            <input
              type="radio"
              name="lawyer-outcome"
              className="mt-1 accent-pr"
              checked={outcome === "none"}
              onChange={() => { setOutcome("none"); setError(null); }}
            />
            <span>
              <span className="block text-[14px] font-medium text-tx">Закрыть дело без взыскания</span>
              <span className="block text-[13px] text-tx2">Нарушение не подтверждено или взыскание не требуется.</span>
            </span>
          </label>

          <label className={optionClass(outcome === "penalty")}>
            <input
              type="radio"
              name="lawyer-outcome"
              className="mt-1 accent-pr"
              checked={outcome === "penalty"}
              onChange={() => { setOutcome("penalty"); setError(null); }}
            />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium text-tx">Применить взыскание</span>
              <span className="block text-[13px] text-tx2">Выберите вид взыскания — комиссия не потребуется.</span>
            </span>
          </label>

          {outcome === "penalty" &&
            (isLoading && !isLoaded ? (
              <div className="text-[13px] text-tx2">Загрузка справочника...</div>
            ) : (
              <select
                aria-label="Вид взыскания"
                className="border border-bd rounded-inp px-3 py-2 text-[14px] bg-bg outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
                value={decisionTypeCode}
                onChange={(e) => { setDecisionTypeCode(e.target.value); setError(null); }}
              >
                <option value="">Выберите вид взыскания...</option>
                {decisionTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {getDecisionTypeLabel(t.code, t.name)}
                  </option>
                ))}
              </select>
            ))}

          <div className="text-[13px] text-tx2">
            Дальше нужно сформировать «Заключение юриста». Дело будет закрыто, когда документ сформирован и прикреплён. Если по делу идёт комиссия, она будет остановлена.
          </div>

          {error && <div className="text-[13px] text-dgt">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-bd shrink-0">
          <button
            type="button"
            className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors"
            onClick={handleContinue}
          >
            Сформировать заключение
          </button>
        </div>
      </div>
    </div>
  );
}
