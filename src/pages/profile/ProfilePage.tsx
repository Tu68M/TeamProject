import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { dictionaryApi, employeeApi, userApi } from "@/shared/api";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import Avatar, { invalidateAvatarCache } from "@shared/ui/Avatar";
import AvatarCropModal from "@shared/ui/AvatarCropModal";
import TimezoneSelector from "@shared/ui/TimezoneSelector";
import ThemeSelector from "@shared/ui/ThemeSelector";
import { formatServerDateTime } from "@shared/utils/datetime";
import type {
  DepartmentBriefResponse,
  DomainShortResponse,
  EmployeeResponse,
  UserFullResponse,
} from "@shared/types/api";
import { showAlert } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const AUTH_PROVIDER_LABELS: Record<string, string> = {
  LOCAL: "Локальная учётная запись",
  SSO: "SSO",
  LDAP: "LDAP",
  OAUTH: "OAuth",
};

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-[12px] font-semibold text-tx2 uppercase tracking-wider mb-3">
      {children}
    </h2>
  );
}

function Field({
  label,
  value,
  loading,
  muted,
}: {
  label: string;
  value: string;
  loading?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-bd last:border-b-0">
      <span className="text-[13px] leading-[18px] text-tx2 shrink-0">{label}</span>
      <span
        className={`text-[14px] leading-[18px] text-right truncate ${
          muted ? "text-tx2 font-normal" : "text-tx font-medium"
        }`}
      >
        {loading ? "…" : value}
      </span>
    </div>
  );
}

function AvatarField({
  label,
  loading,
  person,
  emptyText,
}: {
  label: string;
  loading?: boolean;
  person: EmployeeResponse | null;
  emptyText: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-bd last:border-b-0">
      <span className="text-[13px] leading-[18px] text-tx2 shrink-0">{label}</span>
      {loading ? (
        <span className="text-[14px] leading-[18px] text-tx2">…</span>
      ) : person ? (
        <Link
          to={person.uid ? `/employees/${person.uid}` : "#"}
          className="flex items-center gap-2 min-w-0 group"
        >
          <Avatar
            avatarUrl={person.uid ? userApi.employeeAvatarUrl(person.uid) : null}
            name={person.fullName || "?"}
            size={24}
          />
          <span className="text-[14px] leading-[18px] font-medium text-prl group-hover:text-prt group-hover:underline truncate">
            {person.fullName || "—"}
          </span>
        </Link>
      ) : (
        <span className="text-[14px] leading-[18px] text-tx2 font-normal">{emptyText}</span>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { timezone } = useTimezoneStore();
  const updateAvatarUrl = useAuthStore((s) => s.updateAvatarUrl);
  const [user, setUser] = useState<UserFullResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [domain, setDomain] = useState<DomainShortResponse | null>(null);
  const [department, setDepartment] = useState<DepartmentBriefResponse | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  const [email, setEmail] = useState<string | null>(null);
  const [hrBp, setHrBp] = useState<EmployeeResponse | null>(null);
  const [hrBpLoading, setHrBpLoading] = useState(true);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (inFlightRef.current) return;

    setLoading(true);
    setError(null);
    const promise = userApi
      .getMe()
      .then((data) => setUser(data))
      .catch((err) => {
        console.error("Ошибка загрузки профиля:", err);
        setError(getErrorMessage(err, "Не удалось загрузить данные профиля"));
      })
      .finally(() => {
        setLoading(false);
        inFlightRef.current = null;
      });
    inFlightRef.current = promise;

    setOrgLoading(true);
    Promise.allSettled([dictionaryApi.getMyDomain(), dictionaryApi.getMyDepartment()])
      .then(([domainResult, departmentResult]) => {
        setDomain(domainResult.status === "fulfilled" ? domainResult.value : null);
        setDepartment(departmentResult.status === "fulfilled" ? departmentResult.value : null);
      })
      .finally(() => setOrgLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.employeeUid) {
      setHrBpLoading(false);
      return;
    }
    let cancelled = false;
    setHrBpLoading(true);
    employeeApi
      .getEmployeeByUid(user.employeeUid)
      .then((me) => {
        if (!cancelled) setEmail(me.email || null);
        return me.hrBpUid ? employeeApi.getEmployeeByUid(me.hrBpUid) : null;
      })
      .then((bp) => {
        if (!cancelled) setHrBp(bp);
      })
      .catch((err) => {
        console.error("Ошибка загрузки HR BP:", err);
        if (!cancelled) setHrBp(null);
      })
      .finally(() => {
        if (!cancelled) setHrBpLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.employeeUid]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      showAlert("Поддерживаются только фотографии в форматах PNG, JPEG или WebP");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      showAlert("Файл слишком большой (максимум 5 МБ)");
      return;
    }

    setPendingAvatarFile(file);
  };

  const handleCropConfirm = async (croppedFile: File) => {
    setPendingAvatarFile(null);
    setAvatarBusy(true);
    try {
      const avatarUrl = await userApi.uploadMyAvatar(croppedFile);
      invalidateAvatarCache();
      const versionedUrl = `${avatarUrl}?v=${Date.now()}`;
      setUser((prev) => (prev ? { ...prev, avatarUrl: versionedUrl } : prev));
      updateAvatarUrl(versionedUrl);
    } catch (err) {
      console.error("Ошибка загрузки аватарки:", err);
      showAlert(getErrorMessage(err, "Не удалось загрузить фото"));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarDelete = async () => {
    setAvatarBusy(true);
    try {
      await userApi.deleteMyAvatar();
      invalidateAvatarCache();
      setUser((prev) => (prev ? { ...prev, avatarUrl: undefined } : prev));
      updateAvatarUrl(undefined);
    } catch (err) {
      console.error("Ошибка удаления аватарки:", err);
      showAlert(getErrorMessage(err, "Не удалось удалить фото"));
    } finally {
      setAvatarBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <div className="text-center py-10 text-tx">Загрузка профиля...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <div className="text-center py-10 text-dgl">{error || "Профиль не найден"}</div>
      </div>
    );
  }

  
  const displayName = user.fullName || user.username || "Пользователь";

  const domainLabel = domain?.nameShort || domain?.nameFull || "—";
  const departmentLabel = department?.name || "—";

  const cardClass = "bg-bg border border-bd rounded-lg shadow-sm";

  return (
   <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 flex flex-col gap-5">
            <div className={cardClass}>

<div className="flex flex-col items-center text-center px-5 sm:px-7 py-6 sm:py-7 border-b border-bd">
  <div className="relative shrink-0 group">
    <Avatar
      avatarUrl={user.avatarUrl}
      name={displayName}
      size={104}
      className="text-[22px] sm:text-[24px]"
    />
    <button
      type="button"
      title="Изменить фото"
      disabled={avatarBusy}
      onClick={() => avatarInputRef.current?.click()}
      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-bg border border-bd flex items-center justify-center text-tx2 hover:text-prl hover:border-pr transition-colors disabled:opacity-50"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5Z" />
      </svg>
    </button>
    <input
      ref={avatarInputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="hidden"
      onChange={handleAvatarSelect}
    />
  </div>

  <h1 className="text-[20px] sm:text-[22px] leading-[26px] sm:leading-[30px] font-semibold text-tx mt-4 truncate max-w-full">
    {displayName}
  </h1>
  <div className="text-[13px] leading-[18px] text-tx2 mt-1 truncate max-w-full">
    @{user.username}
  </div>

  {user.avatarUrl && (
    <button
      type="button"
      disabled={avatarBusy}
      onClick={handleAvatarDelete}
      className="text-[12px] font-medium text-tx2 hover:text-dgl hover:underline disabled:opacity-50 mt-3"
    >
      Удалить фото
    </button>
  )}
</div>

              <div className="px-5 sm:px-7 py-6 sm:py-7">
                <SectionTitle>Основная информация</SectionTitle>
                <Field label="ФИО" value={user.fullName || "—"} />
                <Field label="Логин" value={user.username || "—"} />
                <Field label="Должность" value={user.position || "—"} />
                <Field label="Почта" value={email || "—"} loading={hrBpLoading} />
                <Field label="Домен" value={domainLabel} loading={orgLoading} />
                <Field label="Подразделение" value={departmentLabel} loading={orgLoading} />
                <AvatarField label="Мой HR BP" person={hrBp} loading={hrBpLoading} emptyText="Не назначен" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className={cardClass}>
              <div className="px-5 sm:px-6 py-5 sm:py-6">
                <SectionTitle>Учётная запись</SectionTitle>
                <Field
                  muted
                  label="Способ входа"
                  value={(user.authProvider && AUTH_PROVIDER_LABELS[user.authProvider]) || user.authProvider || "—"}
                />
                <Field muted label="Последний вход" value={formatServerDateTime(user.lastLoginAt, timezone)} />
                <Field muted label="Учётная запись создана" value={formatServerDateTime(user.createdAt, timezone)} />
              </div>
            </div>

            <div className={cardClass}>
              <div className="px-5 sm:px-6 py-5 sm:py-6">
                <SectionTitle>Настройки</SectionTitle>
                <div className="text-[13px] leading-[18px] text-tx2 mb-2">Тема оформления</div>
                <ThemeSelector />

                <div className="text-[13px] leading-[18px] text-tx2 mt-5 mb-2">Часовой пояс отображения</div>
                <TimezoneSelector />
                <div className="text-[12px] leading-[16px] text-tx2 mt-2">
                  Настройки сохраняются только в этом браузере.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingAvatarFile && (
        <AvatarCropModal
          file={pendingAvatarFile}
          onCancel={() => setPendingAvatarFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
