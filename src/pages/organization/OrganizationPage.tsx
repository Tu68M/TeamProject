import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dictionaryApi } from "@entities/dictionary/dictionaryApi";
import { employeeApi } from "@entities/employee/api/employeeApi";
import { userApi } from "@entities/user/userApi";
import Avatar from "@shared/ui/Avatar";
import { ErrorState } from "@shared/ui/ErrorState";
import type {
  DepartmentTreeItem,
  DomainResponse,
  DomainShortResponse,
  EmployeeResponse,
} from "@shared/types/api";

const EMPLOYEES_PAGE_SIZE = 2000;

interface OrgData {
  domains: DomainResponse[];
  employees: EmployeeResponse[];
}

async function loadOrganization(): Promise<OrgData> {
  const shortList = (await dictionaryApi.getDomains()) as DomainShortResponse[];
  const [domains, page] = await Promise.all([
    Promise.all(
      shortList
        .filter((d) => d.code)
        .map((d) => dictionaryApi.getDomains(d.code) as Promise<DomainResponse>)
    ),
    employeeApi.getEmployees({ page: 0, size: EMPLOYEES_PAGE_SIZE, sort: ["fullName,asc"] }),
  ]);
  domains.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return { domains, employees: page.content ?? [] };
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-tx2 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

interface DeptView {
  dept: DepartmentTreeItem;
  employees: EmployeeResponse[];
  children: DeptView[];
  total: number;
}

function matchesEmployee(e: EmployeeResponse, q: string): boolean {
  return [e.fullName, e.position, e.email].some((v) => v?.toLowerCase().includes(q));
}

function buildDeptView(
  dept: DepartmentTreeItem,
  byDept: Map<string, EmployeeResponse[]>,
  q: string,
  forceAll: boolean
): DeptView | null {
  const selfMatch =
    forceAll || !q || Boolean(dept.name?.toLowerCase().includes(q) || dept.code?.toLowerCase().includes(q));
  const all = byDept.get(dept.id ?? "") ?? [];
  const matched = selfMatch ? all : all.filter((e) => matchesEmployee(e, q));
  const employees = dept.headEmployeeUid
    ? [...matched.filter((e) => e.uid === dept.headEmployeeUid), ...matched.filter((e) => e.uid !== dept.headEmployeeUid)]
    : matched;
  const children = (dept.children ?? [])
    .map((c) => buildDeptView(c, byDept, q, selfMatch))
    .filter((v): v is DeptView => v !== null);
  if (!selfMatch && employees.length === 0 && children.length === 0) return null;
  return { dept, employees, children, total: employees.length + children.reduce((n, c) => n + c.total, 0) };
}

function collectDeptIds(dept: DepartmentTreeItem, out: string[]) {
  if (dept.id) out.push(dept.id);
  (dept.children ?? []).forEach((c) => collectDeptIds(c, out));
}

function EmployeeRow({
  employee,
  isHead,
}: {
  employee: EmployeeResponse;
  isHead: boolean;
}) {
  return (
    <li className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)] gap-x-4 gap-y-0.5 items-center px-2 py-1.5 border-t border-line hover:bg-surf transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar
          avatarUrl={employee.uid ? userApi.employeeAvatarUrl(employee.uid) : null}
          name={employee.fullName || "?"}
          size={28}
          className="text-[11px]"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link
              to={`/employees/${employee.uid}`}
              className="text-[14px] leading-[20px] font-medium text-tx hover:text-prl hover:underline truncate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
            >
              {employee.fullName}
            </Link>
            {isHead && <span className="text-[12px] font-medium text-prt">Руководитель</span>}
            {employee.isActive === false && <span className="text-[12px] text-tx2">Неактивен</span>}
          </div>
          <div className="text-[12px] leading-[16px] text-tx2 truncate">
            {employee.position}
          </div>
        </div>
      </div>
      <div className="min-w-0 pl-[38px] md:pl-0 text-[12px] leading-[16px] text-tx2">
        {employee.email && (
          <a href={`mailto:${employee.email}`} className="block truncate hover:text-prl hover:underline">
            {employee.email}
          </a>
        )}
      </div>
    </li>
  );
}

function DepartmentNode({
  view,
  depth,
  isOpen,
  onToggle,
  employeesByUid,
}: {
  view: DeptView;
  depth: number;
  isOpen: (id: string) => boolean;
  onToggle: (id: string) => void;
  employeesByUid: Map<string, EmployeeResponse>;
}) {
  const { dept, employees, children, total } = view;
  const id = dept.id ?? "";
  const open = isOpen(id);
  const head = dept.headEmployeeUid ? employeesByUid.get(dept.headEmployeeUid) : undefined;

  return (
    <div className={depth > 0 ? "ml-3 sm:ml-5 pl-2 sm:pl-3 border-l border-line" : ""}>
      <div className="flex flex-wrap items-center gap-x-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onToggle(id)}
          className="flex-1 min-w-0 flex items-center gap-2 px-1 py-1.5 text-left hover:bg-surf transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
        >
          <Chevron open={open} />
          <span className="text-[14px] leading-[20px] font-semibold text-tx truncate">{dept.name}</span>
          {dept.isActive === false && <span className="text-[12px] text-tx2 shrink-0">· не действует</span>}
          <span className="ml-auto pl-2 text-[12px] text-tx2 shrink-0">
            {total} {plural(total, "сотрудник", "сотрудника", "сотрудников")}
          </span>
        </button>
        {head && (
          <div className="w-full sm:w-auto pl-7 sm:pl-0 pb-1 sm:pb-0 text-[12px] leading-[16px] text-tx2 min-w-0">
            Руководитель:{" "}
            <Link to={`/employees/${head.uid}`} className="text-tx font-medium hover:text-prl hover:underline">
              {head.fullName}
            </Link>
          </div>
        )}
      </div>
      {open && (
        <div className="pl-5 pb-1.5">
          {employees.length > 0 && (
            <>
              <div className="hidden md:grid grid-cols-[minmax(0,1fr)_minmax(0,260px)] gap-x-4 px-2 pb-1 text-[11px] uppercase tracking-wide text-tx2">
                <span>Сотрудник</span>
                <span>Контакты</span>
              </div>
              <ul>
                {employees.map((e) => (
                  <EmployeeRow
                    key={e.uid}
                    employee={e}
                    isHead={Boolean(dept.headEmployeeUid) && dept.headEmployeeUid === e.uid}
                  />
                ))}
              </ul>
            </>
          )}
          {children.map((c) => (
            <DepartmentNode
              key={c.dept.id}
              view={c}
              depth={depth + 1}
              isOpen={isOpen}
              onToggle={onToggle}
              employeesByUid={employeesByUid}
            />
          ))}
          {employees.length === 0 && children.length === 0 && (
            <div className="px-2 py-1.5 text-[13px] text-tx2">В подразделении пока нет сотрудников</div>
          )}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse max-w-[1100px]" aria-hidden="true">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border-t border-bd pt-3 flex flex-col gap-2">
          <div className="h-5 w-48 bg-skel rounded-inp" />
          {Array.from({ length: 3 }).map((__, j) => (
            <div key={j} className="h-4 bg-skel rounded-inp ml-6" style={{ width: `${70 - j * 12}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function OrganizationPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["organization"],
    queryFn: loadOrganization,
  });
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string> | null>(null);

  const { byDept, employeesByUid } = useMemo(() => {
    const byDept = new Map<string, EmployeeResponse[]>();
    const employeesByUid = new Map<string, EmployeeResponse>();
    for (const e of data?.employees ?? []) {
      if (e.uid) employeesByUid.set(e.uid, e);
      const key = e.departmentId ?? "";
      const list = byDept.get(key);
      if (list) list.push(e);
      else byDept.set(key, [e]);
    }
    return { byDept, employeesByUid };
  }, [data]);

  const domains = useMemo(() => data?.domains ?? [], [data]);
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const views = useMemo(
    () =>
      domains
        .map((domain) => {
          const domainMatch = Boolean(
            q && (domain.nameShort?.toLowerCase().includes(q) || domain.nameFull?.toLowerCase().includes(q))
          );
          const depts = (domain.departments ?? [])
            .map((d) => buildDeptView(d, byDept, q, domainMatch))
            .filter((v): v is DeptView => v !== null);
          const total = depts.reduce((n, d) => n + d.total, 0);
          return { domain, depts, total, show: !q || domainMatch || depts.length > 0 };
        })
        .filter((v) => v.show),
    [domains, byDept, q]
  );

  const allIds = useMemo(() => {
    const ids: string[] = [];
    for (const d of domains) {
      if (d.id) ids.push(d.id);
      (d.departments ?? []).forEach((dep) => collectDeptIds(dep, ids));
    }
    return ids;
  }, [domains]);

  const effectiveOpen = useMemo(
    () => openIds ?? new Set(domains[0]?.id ? [domains[0].id] : []),
    [openIds, domains]
  );
  const isOpen = (id: string) => searching || effectiveOpen.has(id);
  const toggle = (id: string) => {
    if (searching) return;
    const next = new Set(effectiveOpen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };
  const allOpen = allIds.length > 0 && allIds.every((id) => effectiveOpen.has(id));

  if (isError) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-surf">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const totalEmployees = views.reduce((n, v) => n + v.total, 0);

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border bg-surf">
      <div className="max-w-[1100px]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <h1 className="text-[24px] sm:text-[28px] leading-[32px] font-semibold text-tx">Организационная структура</h1>
            <p className="mt-0.5 text-[14px] text-tx2">Домены, подразделения и сотрудники</p>
          </div>
          {!isLoading && (
            <div className="text-[13px] text-tx2" aria-live="polite">
              {totalEmployees} {plural(totalEmployees, "сотрудник", "сотрудника", "сотрудников")}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 py-3 border-y border-bd mb-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск сотрудника, подразделения или домена"
            aria-label="Поиск по организационной структуре"
            className="flex-1 min-w-[220px] max-w-[420px] min-h-[36px] border border-bd rounded-inp bg-bg px-3 py-1.5 text-[14px] text-tx outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
          />
          <button
            type="button"
            disabled={searching || allIds.length === 0}
            onClick={() => setOpenIds(allOpen ? new Set() : new Set(allIds))}
            className="min-h-[36px] px-3 rounded-inp border border-bd bg-bg text-[13px] font-medium text-tx hover:bg-surf transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {allOpen ? "Свернуть всё" : "Развернуть всё"}
          </button>
        </div>

        {isLoading ? (
          <Skeleton />
        ) : views.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-[14px] font-medium text-tx">{searching ? "Ничего не найдено" : "Нет данных об организационной структуре"}</div>
            {searching && <div className="text-[13px] text-tx2 mt-0.5">Измените запрос или очистите поиск.</div>}
          </div>
        ) : (
          <div>
            {views.map(({ domain, depts, total }) => {
              const id = domain.id ?? "";
              const open = isOpen(id);
              return (
                <section key={domain.id} className="border-b border-bd last:border-b-0 py-1">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(id)}
                    className="w-full flex items-center gap-2 px-1 py-2 text-left hover:bg-surf transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pr"
                  >
                    <Chevron open={open} />
                    <span className="min-w-0">
                      <span className="block text-[18px] leading-[24px] font-semibold text-tx truncate">
                        {domain.nameShort || domain.nameFull}
                      </span>
                      {domain.nameFull && domain.nameFull !== domain.nameShort && (
                        <span className="block text-[13px] leading-[18px] text-tx2 truncate">{domain.nameFull}</span>
                      )}
                    </span>
                    <span className="ml-auto pl-3 text-[12px] leading-[16px] text-tx2 text-right shrink-0">
                      {depts.length} {plural(depts.length, "подразделение", "подразделения", "подразделений")} · {total}{" "}
                      {plural(total, "сотрудник", "сотрудника", "сотрудников")}
                    </span>
                  </button>
                  {open && (
                    <div className="pl-4 sm:pl-6 pb-2">
                      {depts.length === 0 ? (
                        <div className="px-2 py-1.5 text-[13px] text-tx2">В домене нет подразделений</div>
                      ) : (
                        depts.map((d) => (
                          <DepartmentNode
                            key={d.dept.id}
                            view={d}
                            depth={0}
                            isOpen={isOpen}
                            onToggle={toggle}
                            employeesByUid={employeesByUid}
                          />
                        ))
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
