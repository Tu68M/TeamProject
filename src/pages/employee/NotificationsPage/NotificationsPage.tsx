import { useState, useEffect } from "react";
import { getErrorMessage } from "@shared/utils/errorMessage";
import { ErrorState } from "@shared/ui/ErrorState";

interface Notification {
  id: string;
  isNew: boolean;
  title: string;
  caseId: string;
  datetime: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);
        
        
        setNotifications([]); 
        
      } catch (err: any) {
        setError(getErrorMessage(err, "Не удалось загрузить уведомления"));
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-surf">
        <div className="text-center py-10 text-tx">Загрузка уведомлений...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-surf">
        <ErrorState message={error} title="Не удалось загрузить уведомления" onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-bold text-tx">
            Уведомления
          </h1>
          <p className="text-[14px] leading-[20px] text-tx2 mt-1">
            Все уведомления по вашим делам и изменениям статусов.
          </p>
        </div>
        
        {notifications.some(n => n.isNew) && (
          <button className="w-full sm:w-auto px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors cursor-pointer">
            Прочитать все
          </button>
        )}
      </div>

      <div className="bg-bg border border-bd rounded-card overflow-hidden">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <svg className="w-12 h-12 text-tx2/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div className="text-[16px] font-medium text-tx mb-1">Уведомлений пока нет</div>
            <div className="text-[14px] text-tx2">Когда появятся новые события по вашим делам, они отобразятся здесь.</div>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 transition-colors ${
                  n.isNew ? "bg-surf/70" : "bg-bg"
                } hover:bg-surf cursor-pointer`}
              >
                {n.isNew && (
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-dgbg text-dgt whitespace-nowrap">
                    Новое
                  </span>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className={`text-[14px] leading-[20px] break-words ${
                    n.isNew ? "font-medium text-tx" : "text-tx2"
                  }`}>
                    {n.title}
                  </div>
                  <div className="text-[12px] leading-[16px] text-tx2 mt-1 flex flex-wrap gap-x-2">
                    <span className="font-medium text-prl">{n.caseId}</span>
                    <span>·</span>
                    <span>{n.datetime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}