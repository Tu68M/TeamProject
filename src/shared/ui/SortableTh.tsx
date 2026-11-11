export type SortDirection = "asc" | "desc";

interface SortableThProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}

export default function SortableTh({ label, active, direction, onClick, className }: SortableThProps) {
  return (
    <th
      className={`group text-left font-medium text-[12px] leading-[16px] py-2 px-3 border-b border-bd whitespace-nowrap cursor-pointer select-none transition-colors ${
        active ? "bg-surf text-tx" : "bg-bg text-tx2 hover:bg-surf/60 hover:text-tx"
      } ${className || ""}`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        <span className="inline-flex flex-col items-center justify-center gap-[1px] shrink-0">
          <svg
            width="9"
            height="6"
            viewBox="0 0 9 6"
            fill="none"
            className={`transition-colors ${active && direction === "asc" ? "text-prl" : "text-bd group-hover:text-tx2"}`}
          >
            <path d="M1.2 5L4.5 1.3L7.8 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg
            width="9"
            height="6"
            viewBox="0 0 9 6"
            fill="none"
            className={`transition-colors ${active && direction === "desc" ? "text-prl" : "text-bd group-hover:text-tx2"}`}
          >
            <path d="M1.2 1L4.5 4.7L7.8 1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </th>
  );
}
