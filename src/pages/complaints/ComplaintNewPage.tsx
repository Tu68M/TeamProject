import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { complaintApi } from "@entities/complaint/complaintApi";
import { employeeApi } from "@entities/employee/api/employeeApi";
import { userApi } from "@entities/user/userApi";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import Avatar from "@shared/ui/Avatar";
import { showAlert } from "@shared/ui/dialogs";
import { formatServerDateTime } from "@shared/utils/datetime";
import { getErrorMessage } from "@shared/utils/errorMessage";
import { getFileExtension, getFileTypeStyle } from "@shared/utils/fileType";
import {
  COMPLAINT_ALLOWED_EXTENSIONS,
  COMPLAINT_MAX_FILES,
  COMPLAINT_MAX_FILE_SIZE,
  COMPLAINT_MAX_MESSAGE,
  COMPLAINT_MIN_MESSAGE,
  COMPLAINT_STATUS_LABELS,
  getComplaintStatusBadgeClass,
} from "@shared/utils/complaintStatus";
import type { EmployeeLookupResponse } from "@shared/types/api";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

const inputBase =
  "w-full border border-bd rounded-inp bg-bg px-3 py-2.5 text-[14px] leading-[20px] text-tx outline-none transition-colors focus:border-pr focus:ring-3 focus:ring-pr/10";

export default function ComplaintNewPage() {
  const [searchParams] = useSearchParams();
  const timezone = useTimezoneStore((s) => s.timezone);
  const queryClient = useQueryClient();

  const [accused, setAccused] = useState<EmployeeLookupResponse | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmployeeLookupResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [myOpen, setMyOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const uid = searchParams.get("accused");
    const name = searchParams.get("name");
    if (uid && name) {
      setAccused({ uid, fullName: name, position: searchParams.get("position") ?? undefined });
      setQuery(name);
    }
  }, [searchParams]);

  useEffect(() => {
    const q = query.trim();
    if (accused && q === accused.fullName) return;
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      employeeApi
        .lookupEmployees(q)
        .then((list) => !cancelled && setResults(list))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, accused]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setListOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const mine = useQuery({ queryKey: ["myComplaints"], queryFn: complaintApi.mine });

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      const ext = getFileExtension(file.name).toLowerCase().replace(/^\./, "");
      if (!COMPLAINT_ALLOWED_EXTENSIONS.includes(ext)) {
        showAlert(`Файл «${file.name}» не подходит: допустимы PDF, DOCX и изображения (JPG, PNG, WebP).`);
        continue;
      }
      if (file.size > COMPLAINT_MAX_FILE_SIZE) {
        showAlert(`Файл «${file.name}» больше 10 МБ.`);
        continue;
      }
      accepted.push(file);
    }
    setFiles((prev) => {
      const next = [...prev, ...accepted];
      if (next.length > COMPLAINT_MAX_FILES) {
        showAlert(`Можно приложить не более ${COMPLAINT_MAX_FILES} файлов.`);
        return next.slice(0, COMPLAINT_MAX_FILES);
      }
      return next;
    });
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  const trimmed = message.trim();
  const messageTooShort = trimmed.length < COMPLAINT_MIN_MESSAGE;
  const canSubmit = Boolean(accused) && !messageTooShort && !submitting;

  async function handleSubmit() {
    if (!accused || !canSubmit) return;
    setSubmitting(true);
    try {
      await complaintApi.submit(accused.uid, trimmed, files, anonymous);
      setAccused(null);
      setQuery("");
      setMessage("");
      setFiles([]);
      setAnonymous(false);
      queryClient.invalidateQueries({ queryKey: ["myComplaints"] });
      showAlert("Жалоба отправлена HR BP и руководителю подразделения сотрудника. Решение примет один из них.", { title: "Жалоба отправлена" });
    } catch (err) {
      console.error("Ошибка отправки жалобы:", err);
      showAlert(getErrorMessage(err, "Не удалось отправить жалобу"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="max-w-[760px] mx-auto">
        <h1 className="text-[24px] sm:text-[28px] leading-[32px] sm:leading-[36px] font-bold text-tx">Подать жалобу</h1>
        <p className="mt-1 mb-5 text-[14px] text-tx2">
          Жалоба уходит HR BP и руководителю подразделения выбранного сотрудника. Один из них ознакомится с ней и решит, нужно ли заводить дело; после решения жалоба закрывается для обоих.
        </p>

        <div className="bg-bg border border-bd rounded-card p-4 sm:p-5 flex flex-col gap-5">
          <div ref={wrapRef} className="relative">
            <label className="block text-[13px] font-medium text-tx2 mb-1.5">Сотрудник, на которого подаётся жалоба</label>
            <input
              className={inputBase}
              placeholder="Начните вводить ФИО или должность"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (accused) setAccused(null);
                setListOpen(true);
              }}
              onFocus={() => setListOpen(true)}
            />
            {listOpen && !accused && query.trim().length >= 2 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-bg border border-bd rounded-inp shadow-dropdown max-h-[280px] overflow-y-auto">
                {searching ? (
                  <div className="px-3 py-3 text-[13px] text-tx2">Поиск...</div>
                ) : results.length === 0 ? (
                  <div className="px-3 py-3 text-[13px] text-tx2">Никого не найдено</div>
                ) : (
                  results.map((emp) => (
                    <button
                      key={emp.uid}
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surf transition-colors"
                      onClick={() => {
                        setAccused(emp);
                        setQuery(emp.fullName);
                        setListOpen(false);
                      }}
                    >
                      <Avatar avatarUrl={userApi.employeeAvatarUrl(emp.uid)} name={emp.fullName} size={28} />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-tx truncate">{emp.fullName}</span>
                        {emp.position && <span className="block text-[12px] text-tx2 truncate">{emp.position}</span>}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            {accused && (
              <div className="mt-2 flex items-center gap-2.5 text-[13px] text-tx2">
                <Avatar avatarUrl={userApi.employeeAvatarUrl(accused.uid)} name={accused.fullName} size={24} />
                <span>
                  Выбран: <span className="font-medium text-tx">{accused.fullName}</span>
                  {accused.position ? ` · ${accused.position}` : ""}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-tx2 mb-1.5">Сообщение</label>
            <textarea
              className={`${inputBase} resize-y min-h-[140px]`}
              placeholder="Опишите, что произошло: когда, где, при каких обстоятельствах"
              maxLength={COMPLAINT_MAX_MESSAGE}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="mt-1 flex justify-between text-[12px] text-tx2">
              <span className={messageTooShort && message.length > 0 ? "text-dgl" : ""}>
                {messageTooShort && message.length > 0 ? `Не менее ${COMPLAINT_MIN_MESSAGE} символов` : ""}
              </span>
              <span>
                {message.length} / {COMPLAINT_MAX_MESSAGE}
              </span>
            </div>
          </div>

          <div>
            <div className="block text-[13px] font-medium text-tx2 mb-1.5">Документы (необязательно)</div>
            <div
              className={`rounded-inp border border-dashed px-4 py-5 text-center transition-colors ${
                dragging ? "border-pr bg-acl/40" : "border-bd bg-surf/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              <div className="text-[14px] text-tx">Перетащите файлы сюда или</div>
              <button
                type="button"
                className="mt-2 px-3 py-1.5 rounded-inp font-medium text-[13px] bg-bg text-prl border border-pr hover:bg-pr/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                Выбрать файлы
              </button>
              <div className="mt-2 text-[12px] text-tx2">
                PDF, DOCX, JPG, PNG, WebP · до {COMPLAINT_MAX_FILES} файлов, каждый до 10 МБ
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
            {files.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {files.map((file, i) => {
                  const style = getFileTypeStyle(file.name);
                  return (
                    <li key={`${file.name}-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded-inp border border-bd bg-bg">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${style.badgeClass ?? ""}`}>
                        {getFileExtension(file.name).replace(/^\./, "") || "файл"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-tx">{file.name}</span>
                      <span className="text-[12px] text-tx2 shrink-0">{formatSize(file.size)}</span>
                      <button
                        type="button"
                        aria-label={`Убрать ${file.name}`}
                        className="text-tx2 hover:text-dgl transition-colors shrink-0"
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 accent-pr"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            <span>
              <span className="block text-[14px] leading-[20px] font-medium text-tx">Отправить анонимно</span>
              <span className="block text-[12px] leading-[17px] text-tx2">
                HR BP, руководитель и сотрудник не увидят, кто подал жалобу. Автор остаётся известен системе (лимит жалоб, список
                «Мои жалобы»). Не называйте себя в тексте и именах файлов — в самих документах (автор, метаданные
                фото) тоже могут быть ваши данные.
              </span>
            </span>
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Отправка..." : "Отправить жалобу"}
            </button>
          </div>
        </div>

        {(mine.data?.length ?? 0) > 0 && (
          <div className="mt-8">
            <button
              type="button"
              aria-expanded={myOpen}
              onClick={() => setMyOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-1 py-1.5 text-left group"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`shrink-0 text-tx2 transition-transform duration-200 ${myOpen ? "rotate-90" : ""}`}
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span className="text-[12px] font-semibold text-tx2 uppercase tracking-wider group-hover:text-tx transition-colors">
                Мои жалобы
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-ntbg text-tx2 text-[11px] font-bold">{mine.data!.length}</span>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                myOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden min-h-0">
                <div className={`flex flex-col gap-2 pt-2 ${myOpen ? "" : "invisible"}`}>
                  {mine.data!.map((c) => (
                    <div key={c.id} className="bg-bg border border-bd rounded-card px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-medium text-tx">На: {c.accusedName || "сотрудника"}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getComplaintStatusBadgeClass(c.status)}`}>
                          {COMPLAINT_STATUS_LABELS[c.status]}
                        </span>
                        {c.anonymous && (
                          <span className="px-2 py-0.5 rounded-full bg-ntbg text-tx2 text-[11px] font-medium">Анонимно</span>
                        )}
                        <span className="ml-auto text-[12px] text-tx2">{formatServerDateTime(c.createdAt, timezone)}</span>
                      </div>
                      <div className="mt-1 text-[13px] text-tx2 line-clamp-2 whitespace-pre-wrap">{c.message}</div>
                      {c.status === "ОТКЛОНЕНА" && c.decisionComment && (
                        <div className="mt-1.5 text-[13px] text-tx">Причина отклонения: {c.decisionComment}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
