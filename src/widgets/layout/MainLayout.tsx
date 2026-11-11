import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { matchPath, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { caseApi, userApi } from "@shared/api";
import { useAuthStore } from "@entities/session/model/authStore";
import { useNavBadgeStore } from "@shared/model/navBadgeStore";
import { resetUserData } from "@shared/model/resetUserData";
import Avatar from "@shared/ui/Avatar";
import { useCaseStats, useMyCommissions, useMyViolations } from "@/entities/case/api/useCaseQueries";
import { isCaseLocked } from "@shared/utils/caseStatus";
import { useDebounce } from "@shared/hooks/useDebounce";
import type { CaseShortResponse } from "@shared/types/api";
import { useQueryClient } from "@tanstack/react-query";
import { useComplaintSummary } from "@entities/complaint/useComplaintSummary";
import { NotificationBell } from "@widgets/layout/NotificationBell";

interface NavItem {
    moduleCode: string;
    path: string;
    label: string;
    badge?: number;
    badgeVariant?: "dg" | "wn" | "ok" | "pr";
    icon: ReactNode;
    showFor?: "hr" | "employee";
    requiredPermission?: string;
}

function NavIcon({ children }: { children: ReactNode }) {
    return (
        <svg
            className="shrink-0 text-tx2"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {children}
        </svg>
    );
}

function CaseSearch() {
    const [query, setQuery] = useState("");
    const [isOpen, setOpen] = useState(false);
    const [results, setResults] = useState<CaseShortResponse[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
        const trimmed = debouncedQuery.trim();
        if (!trimmed) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        let cancelled = false;
        setIsSearching(true);
        caseApi.getCases({ search: trimmed, page: 0, size: 8 })
            .then((page) => {
                if (cancelled) return;
                setResults(page?.content || []);
                setHasSearched(true);
            })
            .catch((error) => {
                console.error("Ошибка поиска дел:", error);
                if (cancelled) return;
                setResults([]);
                setHasSearched(true);
            })
            .finally(() => {
                if (!cancelled) setIsSearching(false);
            });

        return () => {
            cancelled = true;
        };
    }, [debouncedQuery]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function goToCase(c: CaseShortResponse) {
        setQuery("");
        setOpen(false);
        navigate(`/cases/${c.id}`);
    }

    return (
        <div className="relative flex-1 max-w-md" ref={wrapRef}>
            <div className="flex items-center gap-2 px-3 py-2 min-h-[36px] border border-bd bg-surf rounded-inp text-tx2 focus-within:border-pr focus-within:ring-3 focus-within:ring-pr/10 transition-colors">
                {isSearching ? (
                    <svg className="animate-spin shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle className="opacity-25" cx="12" cy="12" r="10" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                ) : (
                    <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M20 20l-3.5-3.5" />
                    </svg>
                )}
                <input
                    className="flex-1 border-none outline-none bg-transparent text-[14px] leading-[20px] text-tx placeholder:text-txm"
                    placeholder="Поиск по делам, сотрудникам, подразделениям"
                    value={query}
                    onFocus={() => query && setOpen(true)}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                />
            </div>

            {isOpen && query && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg border border-bd rounded-inp shadow-dropdown max-h-[260px] overflow-y-auto z-50 scrollbar-thin">
                    {!hasSearched ? (
                        <div className="px-3 py-2.5 cursor-default text-tx2 text-[14px]">Поиск...</div>
                    ) : results.length === 0 ? (
                        <div className="px-3 py-2.5 cursor-default text-tx2 text-[14px]">
                            Ничего не найдено по «{query}»
                        </div>
                    ) : (
                        results.map((c) => (
                            <div
                                key={c.id}
                                className="px-3 py-2.5 cursor-pointer hover:bg-surf transition-colors"
                                onMouseDown={() => goToCase(c)}
                            >
                                <div className="font-medium text-[14px] leading-[20px] text-tx">
                                    {c.caseNumber || c.id}
                                </div>
                                <div className="text-[12px] leading-[16px] text-tx2 truncate">
                                    {c.violationTypeName || "Без типа"}
                                    {c.snapshotFullName && ` · ${c.snapshotFullName}`}
                                    {c.snapshotPosition && ` · ${c.snapshotPosition}`}
                                    {c.snapshotDepartment && ` · ${c.snapshotDepartment}`}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function ProfileMenu() {
    const [isOpen, setOpen] = useState(false);
    const [isMounted, setMounted] = useState(false);
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            return;
        }
        const t = setTimeout(() => setMounted(false), 120);
        return () => clearTimeout(t);
    }, [isOpen]);
    const wrapRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { context, logout } = useAuthStore();
    const queryClient = useQueryClient();

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const displayName = context?.fullName || context?.username || "Пользователь";

    async function handleLogout() {
        setOpen(false);
        try {
            if ('logout' in userApi && typeof userApi.logout === 'function') {
                await userApi.logout();
            }
        } catch (error) {
            console.error("Ошибка при выходе:", error);
        }
        logout();
        queryClient.clear();
        resetUserData();
        navigate("/login", { replace: true });
    }

    return (
        <div className="relative" ref={wrapRef}>
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setOpen((o) => !o)}>
                <Avatar avatarUrl={context?.avatarUrl} name={displayName} size={32} className="text-[12px]" />
                <div className="hidden sm:block">
                    <div className="font-medium text-[14px] leading-[20px] text-tx">{displayName}</div>
                    <div className="text-[12px] leading-[16px] text-tx2">{context?.position || "Сотрудник"}</div>
                </div>
            </div>

            {(isOpen || isMounted) && (
                <div className={`absolute top-full right-0 mt-1 w-60 bg-bg border border-bd rounded-inp shadow-dropdown z-50 overflow-hidden origin-top-right motion-reduce:animate-none ${isOpen ? "animate-dropdownIn" : "animate-dropdownOut pointer-events-none"}`}>
                    <div className="px-3 py-3 border-b border-bd">
                        <div className="font-medium text-[14px] leading-[20px] text-tx">{displayName}</div>
                        <div className="text-[12px] leading-[16px] text-tx2">{context?.position}</div>
                    </div>
                    <div className="py-1">
                        <div className="flex items-center gap-2.5 px-3 py-2.5 text-[14px] leading-[20px] text-tx cursor-pointer hover:bg-surf transition-colors" onClick={() => { setOpen(false); navigate("/profile"); }}>
                            Мой профиль
                        </div>
                        <div className="h-px bg-bd my-1" />
                        <div className="flex items-center gap-2.5 px-3 py-2.5 text-[14px] leading-[20px] text-dgl cursor-pointer hover:bg-surf transition-colors" onClick={handleLogout}>
                            Выйти
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";
const SIDEBAR_ITEM_WIDTH = "md:w-[207px]";
const SIDEBAR_ITEM_WIDTH_COLLAPSED = "md:w-[41px]";

export default function MainLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
        } catch {
            return false;
        }
    });

    const fadeClass = isCollapsed
        ? "md:opacity-0 md:blur-[6px] md:pointer-events-none md:transition-[opacity,filter] md:duration-150"
        : "md:transition-[opacity,filter] md:duration-200 md:delay-150";

    const toggleCollapsed = () => {
        setIsCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
            } catch {
            }
            return next;
        });
    };

    const { context, hasModule, hasPermission } = useAuthStore();
    const { data: complaintSummary } = useComplaintSummary();
    const isHr = hasModule("dashboard");

    const statsQuery = useCaseStats();
    const activeCasesBadge = statsQuery.data?.active || 0;
    const actionRequiredBadge = statsQuery.data?.actionRequired || 0;

    const myViolationsQuery = useMyViolations(isHr && hasModule("cases"));
    const myViolations = myViolationsQuery.data ?? [];
    const myViolationsBadge = myViolations.filter((c) => !isCaseLocked(c.status)).length;

    const commissionsQuery = useMyCommissions();
    const activeCommissionsBadge = commissionsQuery.data?.length || 0;

    const refreshToken = useNavBadgeStore((s) => s.refreshToken);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (refreshToken === 0) return;
        if (hasModule("cases")) {
            queryClient.invalidateQueries({ queryKey: ["caseStats"] });
            queryClient.invalidateQueries({ queryKey: ["myViolations"] });
        }
        if (hasModule("commissions")) {
            queryClient.invalidateQueries({ queryKey: ["myCommissions"] });
        }
    }, [refreshToken, hasModule, queryClient]);

    const allNavItems: NavItem[] = [
        {
            moduleCode: "dashboard",
            path: "/",
            label: "Дашборд",
            badge: actionRequiredBadge,
            badgeVariant: "dg",
            icon: <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />,
        },
        {
            moduleCode: "cases",
            path: "/cases",
            label: "Реестр дел",
            badge: activeCasesBadge,
            badgeVariant: "pr",
            showFor: "hr",
            icon: (
                <>
                    <path d="M6 3h7l5 5v13H6z" />
                    <path d="M13 3v5h5" />
                </>
            ),
        },
        {
            moduleCode: "cases",
            path: "/my-violations",
            label: "Мои нарушения",
            badge: myViolationsBadge,
            badgeVariant: "wn",
            showFor: "hr",
            icon: (
                <>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
            ),
        },
        {
            moduleCode: "commissions",
            path: "/commissions",
            label: "Комиссии",
            badge: activeCommissionsBadge,
            badgeVariant: "pr",
            icon: (
                <>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </>
            ),
        },
        {
            moduleCode: "cases",
            path: "/cases",
            label: "Мои дела",
            badge: activeCasesBadge,
            badgeVariant: "pr",
            showFor: "employee",
            icon: (
                <>
                    <path d="M6 3h7l5 5v13H6z" />
                    <path d="M13 3v5h5" />
                </>
            ),
        },
        {
            moduleCode: "*",
            path: "/complaints/new",
            label: "Подать жалобу",
            icon: (
                <>
                    <path d="M5 21V4" />
                    <path d="M5 4h11l-2 4 2 4H5" />
                </>
            ),
        },
        {
            moduleCode: "*",
            path: "/complaints",
            label: "Жалобы",
            badge: complaintSummary?.newCount,
            badgeVariant: "wn",
            icon: (
                <>
                    <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4z" />
                    <path d="M12 8v3M12 14h.01" />
                </>
            ),
        },
        {
            moduleCode: "dictionaries",
            path: "/dictionaries",
            label: "Справочники",
            icon: (
                <>
                    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
                    <path d="M8 7h7M8 11h7" />
                </>
            ),
        },
        {
            moduleCode: "organization",
            path: "/organization",
            label: "Организационная структура",
            requiredPermission: "org:read:all",
            icon: (
                <>
                    <rect x="9" y="3" width="6" height="5" rx="1" />
                    <rect x="3" y="16" width="6" height="5" rx="1" />
                    <rect x="15" y="16" width="6" height="5" rx="1" />
                    <path d="M12 8v4M6 16v-4h12v4" />
                </>
            ),
        },
        {
            moduleCode: "reports",
            path: "/reports",
            label: "Отчётность",
            icon: (
                <>
                    <path d="M5 20V9M11 20V4M17 20v-8" />
                    <path d="M3 20h18" />
                </>
            ),
        },
        {
            moduleCode: "notifications",
            path: "/notifications",
            label: "Уведомления",
            icon: (
                <>
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </>
            ),
        },
        {
            moduleCode: "document_templates",
            path: "/document-templates",
            label: "Шаблоны документов",
            icon: (
                <>
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5" />
                    <path d="M9 13h6M9 17h6" />
                </>
            ),
        },
        {
            moduleCode: "admin",
            path: "/admin",
            label: "Администрирование",
            icon: (
                <>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </>
            ),
        },
    ];

    const visibleNavItems = allNavItems.filter(item => {
        if (item.moduleCode !== "*" && !hasModule(item.moduleCode)) return false;
        if (item.path === "/complaints" && !complaintSummary?.hrBp) return false;
        if (item.requiredPermission && !hasPermission(item.requiredPermission)) return false;
        if (item.showFor === "hr" && !isHr) return false;
        if (item.showFor === "employee" && isHr) return false;
        if (item.moduleCode === "commissions" && activeCommissionsBadge === 0) return false;
        if (item.path === "/my-violations" && myViolations.length === 0) return false;
        return true;
    });

    const { pathname } = useLocation();
    const navRef = useRef<HTMLElement>(null);
    const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
    const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
    const [indicatorAnimated, setIndicatorAnimated] = useState(false);
    const navPathname = pathname.startsWith("/employees/") ? "/organization" : pathname;
    const activePath = visibleNavItems.find((item) =>
        matchPath({ path: item.path, end: item.path === "/" }, navPathname)
    )?.path;
    const hasContext = Boolean(context);

    useLayoutEffect(() => {
        const nav = navRef.current;
        if (!nav) return;

        const measure = () => {
            const el = activePath ? itemRefs.current[activePath] : null;
            setIndicator(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
        };
        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(nav);
        return () => observer.disconnect();
    }, [activePath, hasContext, visibleNavItems.length]);

    useEffect(() => {
        if (!indicator || indicatorAnimated) return;
        const id = requestAnimationFrame(() => setIndicatorAnimated(true));
        return () => cancelAnimationFrame(id);
    }, [indicator, indicatorAnimated]);

    if (!context) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-surf text-tx">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-8 w-8 text-prl" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-[14px] font-medium">Загрузка профиля...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen bg-bg overflow-hidden flex">

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside
                className={`
          fixed md:relative inset-y-0 left-0 z-50 w-64 ${isCollapsed ? 'md:w-[74px]' : 'md:w-60'} bg-side border-r border-bd p-4 flex flex-col shrink-0 overflow-hidden
          transform transition-[transform,width] duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
            >
                <button
                    className="md:hidden absolute top-4 right-4 p-2 text-tx2 hover:bg-surf rounded-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin">
                <NavLink to="/">
                    <div
                        className={`mb-2 mt-2 md:mt-0 overflow-hidden transition-[width,margin] duration-300 ease-in-out ${isCollapsed ? "w-[204px] md:w-[35px] md:ml-1" : "w-[204px]"}`}
                        title={isCollapsed ? "Т1 Дисциплина" : undefined}
                    >
                        <img src="/logo-blue-grey.svg" alt="Т1 Дисциплина" className="block h-[35px] w-auto max-w-none dark:hidden" />
                        <img src="/logo-blue-white.svg" alt="Т1 Дисциплина" className="hidden h-[35px] w-auto max-w-none dark:block" />
                    </div>
                </NavLink>
                <nav ref={navRef} className="relative flex flex-col gap-1 mt-6 md:mt-4">
                    <div
                        aria-hidden="true"
                        className={`absolute left-0 right-0 z-0 rounded-lg bg-acl shadow-nav-active pointer-events-none ${
                            indicatorAnimated ? "transition-[top,height,opacity] duration-300 ease-out" : ""
                        } ${indicator ? "opacity-100" : "opacity-0"}`}
                        style={{ top: indicator?.top ?? 0, height: indicator?.height ?? 0 }}
                    />
                    {visibleNavItems.map((item) => (
                        <NavLink
                            key={item.path}
                            ref={(el) => {
                                itemRefs.current[item.path] = el;
                            }}
                            to={item.path}
                            end={item.path === "/"}
                            title={isCollapsed ? item.label : undefined}
                            aria-label={item.label}
                            className={() =>
                                `relative z-10 block h-10 overflow-hidden rounded-lg text-[14px] leading-[20px] text-tx3 whitespace-nowrap transition-[width,background-color] duration-300 ease-in-out ${isCollapsed ? SIDEBAR_ITEM_WIDTH_COLLAPSED : SIDEBAR_ITEM_WIDTH} ${item.path === activePath
                                    ? "text-prt font-medium [&_svg]:text-prt"
                                    : "hover:bg-surf"
                                }`
                            }
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <div className={`flex h-full items-center gap-3 px-3 w-full ${SIDEBAR_ITEM_WIDTH} md:shrink-0`}>
                            <NavIcon>{item.icon}</NavIcon>
                            <span className={`flex-1 min-w-0 whitespace-normal leading-[18px] ${fadeClass}`}>{item.label}</span>
                            {Boolean(item.badge && item.badge > 0) && (
                                <span
                                    className={`ml-auto inline-flex ${fadeClass} items-center justify-center w-[22px] h-[22px] min-w-[22px] rounded-full text-[11px] font-bold leading-none shrink-0
                    ${item.badgeVariant === 'dg' ? 'bg-dgbg text-dgt' :
                                            item.badgeVariant === 'wn' ? 'bg-wnbg text-wnt' :
                                                item.badgeVariant === 'ok' ? 'bg-okbg text-okt' :
                                                    item.badgeVariant === 'pr' ? 'bg-acl text-prt' : 'bg-mut text-tx3'}`}
                                >
                                    {item.badge}
                                </span>
                            )}
                            </div>
                            {Boolean(item.badge && item.badge > 0) && (
                                <span
                                    aria-hidden="true"
                                    className={`hidden md:inline-flex absolute top-0.5 left-6 items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none transition-opacity ${isCollapsed ? 'opacity-100 duration-200 delay-150' : 'opacity-0 duration-100'}
                    ${item.badgeVariant === 'dg' ? 'bg-dgbg text-dgt' :
                                            item.badgeVariant === 'wn' ? 'bg-wnbg text-wnt' :
                                                item.badgeVariant === 'ok' ? 'bg-okbg text-okt' :
                                                    item.badgeVariant === 'pr' ? 'bg-acl text-prt' : 'bg-mut text-tx3'}`}
                                >
                                    {item.badge}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>
                </div>

                <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-label={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
                    title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
                    className={`hidden md:flex shrink-0 mt-2 items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] leading-[20px] text-tx2 whitespace-nowrap hover:bg-surf transition-colors cursor-pointer`}
                >
                    <svg className={`shrink-0 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M11 17l-5-5 5-5" />
                        <path d="M18 17l-5-5 5-5" />
                    </svg>
                    <span className={fadeClass}>{isCollapsed ? "Развернуть" : "Свернуть"}</span>
                </button>
            </aside>

            <div className="flex-1 min-w-0 flex flex-col bg-bg overflow-hidden">
                <header className="h-16 flex-none border-b border-bd flex items-center gap-4 px-4 md:px-8 bg-bg">

                    <button
                        className="md:hidden p-2 -ml-2 text-tx2 hover:bg-surf rounded-lg transition-colors"
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>

                    <CaseSearch />
                    <div className="ml-auto flex items-center gap-2 sm:gap-4">
                        <NotificationBell />
                        <ProfileMenu />
                    </div>
                </header>

                <main className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full box-border">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}