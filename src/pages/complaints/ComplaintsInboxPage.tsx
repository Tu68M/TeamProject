import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { complaintApi } from "@entities/complaint/complaintApi";
import { userApi } from "@entities/user/userApi";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import Avatar from "@shared/ui/Avatar";
import { ErrorState } from "@shared/ui/ErrorState";
import { formatServerDateTime } from "@shared/utils/datetime";
import { COMPLAINT_STATUS_LABELS, getComplaintStatusBadgeClass } from "@shared/utils/complaintStatus";

type Filter = "new" | "decided" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "new", label: "Новые" },
  { id: "decided", label: "Рассмотренные" },
  { id: "all", label: "Все" },
];

export default function ComplaintsInboxPage() {
  const navigate = useNavigate();
  const timezone = useTimezoneStore((s) => s.timezone);
  const [filter, setFilter] = useState<Filter>("new");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["complaintsInbox"],
    queryFn: () => complaintApi.inbox(),
  });

  const visible = useMemo(() => {
    const list = data ?? [];
    if (filter === "new") return list.filter((c) => c.status === "НОВАЯ");
    if (filter === "decided") return list.filter((c) => c.status !== "НОВАЯ");
    return list;
  }, [data, filter]);

  const newCount = (data ?? []).filter((c) => c.status === "НОВАЯ").length;

  if (isError) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <ErrorState error={error} title="Не удалось загрузить жалобы" onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="max-w-[900px] mx-auto">
        <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-bold text-tx">Жалобы</h1>
        <p className="mt-1 mb-5 text-[14px] text-tx2">
          Жалобы на ваших сотрудников. По каждой нужно решить: создавать дело или нет.
        </p>

        <div className="flex gap-1 mb-4" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-inp text-[13px] font-medium transition-colors ${
                filter === f.id ? "bg-acl text-prt" : "text-tx2 hover:text-tx hover:bg-bg"
              }`}
            >
              {f.label}
              {f.id === "new" && newCount > 0 && <span className="ml-1.5 text-[11px] font-bold">{newCount}</span>}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-bg border border-bd rounded-card h-[88px]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-bg border border-bd rounded-card p-8 text-center text-[14px] text-tx2">
            {filter === "new" ? "Новых жалоб нет" : "Жалоб пока нет"}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((c) => (
              <Link
                key={c.id}
                to={`/complaints/${c.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/complaints/${c.id}`);
                }}
                className="block bg-bg border border-bd rounded-card px-4 py-3.5 hover:border-pr/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar avatarUrl={userApi.employeeAvatarUrl(c.accusedUid)} name={c.accusedName || "?"} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-tx">На: {c.accusedName || "сотрудника"}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getComplaintStatusBadgeClass(c.status)}`}>
                        {COMPLAINT_STATUS_LABELS[c.status]}
                      </span>
                    </div>
                    <div className="text-[12px] leading-[16px] text-tx2">
                      От: {c.anonymous ? "анонимного сотрудника" : c.complainantName || "сотрудника"} · {formatServerDateTime(c.createdAt, timezone)}
                      {c.attachments.length > 0 ? ` · вложений: ${c.attachments.length}` : ""}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[13px] leading-[18px] text-tx line-clamp-2 whitespace-pre-wrap">{c.message}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
