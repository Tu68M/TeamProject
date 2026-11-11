import { useRef, useState, useEffect } from "react";
import { getSystemTimezone, useTimezoneStore } from "@shared/model/timezoneStore";
import { RU_BY_TIMEZONES, describeTimezone } from "@shared/utils/datetime";

export default function TimezoneSelector() {
  const { timezone, manualTimezone, setTimezone, resetToSystemTimezone } = useTimezoneStore();
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

  const isSystem = manualTimezone === null;
  const current = describeTimezone(timezone);
  const system = describeTimezone(getSystemTimezone());

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full min-h-[44px] bg-bg border border-bd rounded-inp flex items-center gap-2 px-3 py-2.5 text-[14px] leading-[20px] cursor-pointer transition-colors hover:border-tx2/50"
      >
        <div className="flex-1 min-w-0 text-left">
          <div className="font-medium text-tx truncate">
            {isSystem && <span className="text-tx2 font-normal">Как в системе · </span>}
            {current.title} ({current.code})
          </div>
        </div>
        <svg width="10" height="10" viewBox="0 0 8 8" fill="none" className={`shrink-0 transition-transform text-tx2 ${isOpen ? "rotate-180" : ""}`}>
          <path d="M1 3L4 6L7 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg border border-bd rounded-inp shadow-dropdown z-50 max-h-80 overflow-y-auto py-1 scrollbar-thin">
          <div
            className={`flex items-center justify-between gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-surf border-b border-bd/70 ${
              isSystem ? "bg-surf" : ""
            }`}
            onClick={() => {
              resetToSystemTimezone();
              setIsOpen(false);
            }}
          >
            <div className="min-w-0">
              <div className={`font-medium truncate ${isSystem ? "text-prl" : "text-tx"}`}>Как в системе</div>
              <div className="text-[12px] text-tx2 truncate">{system.title}</div>
            </div>
            <span className={`shrink-0 text-[12px] font-medium ${isSystem ? "text-prl" : "text-tx2"}`}>{system.code}</span>
          </div>
          {RU_BY_TIMEZONES.map((tz) => (
            <div
              key={tz.value}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-surf ${
                !isSystem && tz.value === timezone ? "bg-surf" : ""
              }`}
              onClick={() => {
                setTimezone(tz.value);
                setIsOpen(false);
              }}
            >
              <div className="min-w-0">
                <div className={`font-medium truncate ${!isSystem && tz.value === timezone ? "text-prl" : "text-tx"}`}>{tz.cities}</div>
              </div>
              <span className={`shrink-0 text-[12px] font-medium ${!isSystem && tz.value === timezone ? "text-prl" : "text-tx2"}`}>{tz.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
