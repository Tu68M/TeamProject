import { useState, useRef, useEffect } from "react";

interface FilterSelectProps<T extends string> {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: T[];
  allLabel: string;
  optionLabels?: Record<T, string>;
  isActiveCheck?: (value: T | null) => boolean;
}

export default function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  allLabel,
  optionLabels,
  isActiveCheck,
}: FilterSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = isActiveCheck ? isActiveCheck(value) : value !== null;

  const getLabel = (opt: T | null) => {
    if (opt === null) return allLabel;
    return optionLabels?.[opt] || opt;
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[36px] bg-bg border rounded-inp flex items-center gap-2 px-3 py-2 text-[14px] leading-[20px] whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer transition-colors
          ${isActive ? "border-pr ring-3 ring-pr/10 text-tx" : "border-bd text-tx2 hover:border-tx2/50"}
        `}
      >
        <span className="text-tx2">{label}:</span>
        <span className="font-medium truncate">{getLabel(value)}</span>
        <svg className={`w-2 h-2 ml-auto shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 8 8" fill="none">
          <path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-bg border border-bd rounded-inp shadow-dropdown z-50 max-h-60 overflow-y-auto py-1">
          <div
            className={`px-3 py-2 text-[14px] cursor-pointer hover:bg-surf ${value === null ? "bg-surf font-medium text-prl" : "text-tx"}`}
            onClick={() => { onChange(null); setIsOpen(false); }}
          >
            {allLabel}
          </div>
          {options.map((opt) => (
            <div
              key={opt}
              className={`px-3 py-2 text-[14px] cursor-pointer hover:bg-surf ${value === opt ? "bg-surf font-medium text-prl" : "text-tx"}`}
              onClick={() => { onChange(opt); setIsOpen(false); }}
            >
              {getLabel(opt)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}