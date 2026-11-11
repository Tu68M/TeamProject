import { useState, type ReactNode } from "react";
import type { ViolationTypeOption } from "@entities/document/useViolationTypes";
import type { TemplateFoldersResponse } from "@shared/types/api";

export type TemplateFolder = { kind: "all" } | { kind: "violation"; code: string };

export const ALL_TEMPLATES_FOLDER: TemplateFolder = { kind: "all" };

export function folderKey(folder: TemplateFolder): string {
  return folder.kind === "all" ? "all" : `violation:${folder.code}`;
}

function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1M5 19h13.5a2 2 0 0 0 1.9-1.4l1.5-5A1.5 1.5 0 0 0 20.5 11H8a2 2 0 0 0-1.9 1.4L5 19z" />
      ) : (
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      )}
    </svg>
  );
}

function FolderRow({
  label,
  count,
  active,
  indent,
  onClick,
  leading,
  icon,
}: {
  label: string;
  count?: number;
  active?: boolean;
  indent?: boolean;
  onClick: () => void;
  leading?: ReactNode;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`w-full flex items-center gap-2 rounded-inp px-2 py-1.5 text-left text-[13px] transition-colors cursor-pointer ${
        indent ? "pl-7" : ""
      } ${active ? "bg-pr/10 text-prt font-medium" : "text-tx hover:bg-surf"}`}
    >
      {leading}
      {icon}
      <span className="flex-1 min-w-0 truncate" title={label}>{label}</span>
      {count !== undefined && <span className={`text-[12px] tabular-nums ${active ? "text-prt" : "text-tx2"}`}>{count}</span>}
    </button>
  );
}

export function TemplateFolders({
  folders,
  violationTypes,
  loading = false,
  selected,
  onSelect,
}: {
  folders: TemplateFoldersResponse | null;
  violationTypes: ViolationTypeOption[];
  loading?: boolean;
  selected: TemplateFolder;
  onSelect: (folder: TemplateFolder) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const counts = new Map((folders?.violationFolders || []).map((f) => [f.violationTypeCode || "", f.count || 0]));
  const known = new Set(violationTypes.map((v) => v.code));
  const items: ViolationTypeOption[] = [
    ...violationTypes,
    ...[...counts.keys()].filter((code) => code && !known.has(code)).map((code) => ({ code, name: code })),
  ];
  const groupCount = [...counts.values()].reduce((sum, n) => sum + n, 0);

  return (
    <nav aria-label="Папки шаблонов" className="w-full lg:w-[250px] shrink-0 border border-bd rounded-lg bg-bg p-2 flex flex-col gap-0.5">
      <FolderRow
        label="Все шаблоны"
        count={folders?.total}
        active={selected.kind === "all"}
        onClick={() => onSelect(ALL_TEMPLATES_FOLDER)}
        icon={<FolderIcon open={selected.kind === "all"} />}
      />
      <FolderRow
        label="По видам нарушения"
        count={groupCount}
        onClick={() => setExpanded((v) => !v)}
        leading={
          <svg className={`w-3.5 h-3.5 shrink-0 text-tx2 transition-transform ${expanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        }
        icon={<FolderIcon open={expanded} />}
      />
      {expanded && loading && items.length === 0 ? (
        <div className="flex flex-col gap-0.5 animate-pulse" aria-hidden="true">
          {["w-32", "w-40", "w-28", "w-36"].map((w, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 pl-7 pr-2">
              <div className="h-4 w-4 bg-skel rounded shrink-0" />
              <div className={`h-3.5 ${w} max-w-full bg-skel rounded`} />
            </div>
          ))}
        </div>
      ) : (
        expanded &&
        (items.length === 0 ? (
          <div className="pl-7 pr-2 py-1.5 text-[12px] text-tx2">Виды нарушений не найдены</div>
        ) : (
          items.map((v) => {
            const active = selected.kind === "violation" && selected.code === v.code;
            return (
              <FolderRow
                key={v.code}
                indent
                label={v.name}
                count={counts.get(v.code) || 0}
                active={active}
                onClick={() => onSelect({ kind: "violation", code: v.code })}
                icon={<FolderIcon open={active} />}
              />
            );
          })
        ))
      )}
    </nav>
  );
}
