import { useState } from "react";
import { CaseNumberText } from "@shared/ui/CaseNumberText";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { caseApi } from "@/entities/case/api/caseApi";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import { getCaseStatusBadgeClass, getCaseStatusLabel } from "@shared/utils/caseStatus";
import { formatServerDate } from "@shared/utils/datetime";
import { showAlert, showConfirm } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

const ARCHIVE_PAGE_SIZE = 8;

function pluralCases(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "дело";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дела";
  return "дел";
}

export function CasesArchiveModal({ canRestore, onClose }: { canRestore: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { timezone } = useTimezoneStore();
  const [page, setPage] = useState(0);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["cases", "archive", page],
    queryFn: () => caseApi.getCases({ page, size: ARCHIVE_PAGE_SIZE, archived: true }),
    placeholderData: keepPreviousData,
  });
  const cases = query.data?.content ?? [];
  const totalElements = query.data?.totalElements ?? 0;
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);

  const handleRestore = async (id?: string, caseNumber?: string) => {
    if (!id) return;
    const ok = await showConfirm(`Вернуть дело ${caseNumber || ""} из архива в основной реестр?`.replace("  ", " "), {
      title: "Вернуть из архива",
      confirmLabel: "Вернуть",
    });
    if (!ok) return;
    setRestoringId(id);
    try {
      await caseApi.unarchiveCase(id);
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    } catch (err) {
      console.error("Ошибка возврата дела из архива:", err);
      showAlert(getErrorMessage(err, "Не удалось вернуть дело из архива"));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Архив дел"
        className="bg-bg rounded-lg border border-bd w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-bd shrink-0">
          <div>
            <h3 className="text-[18px] font-bold text-tx">Архив дел</h3>
            <div className="text-[13px] text-tx2">Закрытые дела, убранные из основного реестра{totalElements > 0 ? ` · ${totalElements} ${pluralCases(totalElements)}` : ""}</div>
          </div>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors" type="button" aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="overflow-auto min-h-0">
          {query.isError ? (
            <div className="p-8 text-center text-[14px] text-dgl">Не удалось загрузить архив</div>
          ) : (
            <table className="w-full table-fixed border-collapse min-w-[720px]">
              <colgroup>
                <col className="w-[16%]" /><col className="w-[22%]" /><col className="w-[18%]" />
                <col className="w-[18%]" /><col className="w-[12%]" /><col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr>
                  {["Номер дела", "ФИО сотрудника", "Вид нарушения", "Итог", "В архиве с", ""].map((h, i) => (
                    <th key={i} className="text-left font-medium text-[12px] leading-[16px] text-tx2 py-2 px-3 bg-bg border-b border-bd whitespace-nowrap sticky top-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`transition-opacity ${query.isFetching ? "opacity-50" : ""}`}>
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 px-3 text-center">
                      {query.isLoading ? (
                        <span className="text-[14px] text-tx2">Загрузка...</span>
                      ) : (
                        <>
                          <div className="text-[14px] font-medium text-tx">Архив пуст</div>
                          <div className="text-[13px] text-tx2 mt-0.5">Закрытые дела можно отправить в архив из реестра.</div>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-surf transition-colors">
                      <td className="py-2 px-3 border-b border-line align-middle overflow-hidden">
                        <a
                          href={`/cases/${c.id}`}
                          className="flex min-w-0 font-medium text-[14px] leading-[20px] text-prl hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                            e.preventDefault();
                            navigate(`/cases/${c.id}`);
                          }}
                        >
                          <CaseNumberText value={c.caseNumber || `Дело #${c.id?.slice(0, 8)}`} />
                        </a>
                      </td>
                      <td className="py-2 px-3 border-b border-line align-middle overflow-hidden break-words text-[14px] leading-[20px] font-medium text-tx">{c.snapshotFullName || "Не указан"}</td>
                      <td className="py-2 px-3 border-b border-line align-middle overflow-hidden break-words text-[14px] leading-[20px] text-tx">{c.violationTypeName || "Не указан"}</td>
                      <td className="py-2 px-3 border-b border-line align-middle overflow-hidden">
                        <span
                          className={`inline-flex items-center gap-1.5 max-w-full text-[13px] leading-[18px] before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current before:shrink-0 ${getCaseStatusBadgeClass(c.status).split(" ").find((t) => t.startsWith("text-")) ?? "text-tx"}`}
                          title={getCaseStatusLabel(c.status)}
                        >
                          <span className="truncate">{getCaseStatusLabel(c.status)}</span>
                        </span>
                      </td>
                      <td className="py-2 px-3 border-b border-line align-middle whitespace-nowrap text-[13px] leading-[18px] text-tx2 tabular-nums">
                        {formatServerDate(c.archivedAt, timezone)}
                      </td>
                      <td className="py-2 px-3 border-b border-line align-middle text-right whitespace-nowrap">
                        {canRestore && (
                          <button
                            type="button"
                            disabled={restoringId === c.id}
                            className="text-[13px] font-medium text-prl hover:text-prt disabled:opacity-50 transition-colors"
                            onClick={() => handleRestore(c.id, c.caseNumber)}
                          >
                            {restoringId === c.id ? "Возврат..." : "Вернуть"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 p-3 border-t border-bd shrink-0 text-[13px] text-tx2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-inp border border-bd text-tx hover:bg-surf disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Назад
            </button>
            <span>Страница {page + 1} из {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-inp border border-bd text-tx hover:bg-surf disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Вперёд →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
