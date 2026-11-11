import { THEME_OPTIONS, useThemeStore, type ThemePreference } from "@shared/model/themeStore";

type Scheme = "light" | "dark";

const PREVIEW: Record<
  Scheme,
  {
    page: string; side: string; card: string; line: string; tx: string; tx2: string; accent: string;
    ok: { bg: string; fg: string }; wn: { bg: string; fg: string }; dg: { bg: string; fg: string };
  }
> = {
  light: {
    page: "#DDE7F0", side: "#F2F7FC", card: "#FFFFFF", line: "#D6E4F0", tx: "#111827", tx2: "#9AA3B2", accent: "#0071CE",
    ok: { bg: "#DCFCE7", fg: "#15803D" }, wn: { bg: "#FEF3C7", fg: "#B45309" }, dg: { bg: "#FEE2E2", fg: "#B91C1C" },
  },
  dark: {
    page: "#1B1B1E", side: "#17171A", card: "#26262A", line: "#3F3F46", tx: "#ECECEF", tx2: "#6E6E78", accent: "#3A76B8",
    ok: { bg: "#21342B", fg: "#96CEAE" }, wn: { bg: "#3A3122", fg: "#E2C48C" }, dg: { bg: "#3E2527", fg: "#EAA0A0" },
  },
};

function MiniWindow({ scheme }: { scheme: Scheme }) {
  const c = PREVIEW[scheme];
  return (
    <div className="absolute inset-0 flex" style={{ background: c.page }} aria-hidden="true">
      <div className="flex flex-col gap-1.5 px-1.5 py-2" style={{ width: 30, background: c.side, borderRight: `1px solid ${c.line}` }}>
        <div className="h-2 rounded-sm" style={{ background: c.accent }} />
        <div className="h-1.5 rounded-sm" style={{ background: c.tx2 }} />
        <div className="h-1.5 rounded-sm" style={{ background: c.tx2 }} />
        <div className="h-1.5 rounded-sm" style={{ background: c.tx2 }} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2">
        <div className="h-1.5 w-1/2 rounded-sm" style={{ background: c.tx }} />
        <div className="flex flex-1 flex-col gap-1.5 rounded px-2 py-1.5" style={{ background: c.card, border: `1px solid ${c.line}` }}>
          <div className="h-1 w-4/5 rounded-sm" style={{ background: c.tx2 }} />
          <div className="flex gap-1">
            {([c.ok, c.wn, c.dg] as const).map((chip, i) => (
              <div key={i} className="flex h-3 w-5 items-center justify-center rounded-sm" style={{ background: chip.bg }}>
                <div className="h-1 w-3 rounded-full" style={{ background: chip.fg }} />
              </div>
            ))}
          </div>
          <div className="mt-auto h-3 w-2/5 rounded-sm" style={{ background: c.accent }} />
        </div>
      </div>
    </div>
  );
}

function ThemePreview({ preference }: { preference: ThemePreference }) {
  return (
    <div className="relative h-[84px] w-full overflow-hidden rounded-md border border-bd">
      {preference === "light" && <MiniWindow scheme="light" />}
      {preference === "dark" && <MiniWindow scheme="dark" />}
      {preference === "system" && (
        <>
          <MiniWindow scheme="light" />
          <div className="absolute inset-0" style={{ clipPath: "inset(0 0 0 50%)" }}>
            <MiniWindow scheme="dark" />
          </div>
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-black/20" aria-hidden="true" />
        </>
      )}
    </div>
  );
}

export default function ThemeSelector() {
  const preference = useThemeStore((s) => s.preference);
  const resolved = useThemeStore((s) => s.resolved);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <div>
      <div role="radiogroup" aria-label="Тема оформления" className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.description}
              onClick={() => setPreference(option.value)}
              className={`flex flex-col gap-2 p-1.5 rounded-inp border text-[13px] leading-[16px] font-medium cursor-pointer transition-colors ${
                active
                  ? "border-pr bg-pr/10 text-prt ring-1 ring-pr"
                  : "border-bd bg-bg text-tx hover:border-tx2/50 hover:bg-surf"
              }`}
            >
              <ThemePreview preference={option.value} />
              <span className="pb-0.5 text-center">{option.label}</span>
            </button>
          );
        })}
      </div>
      {preference === "system" && (
        <div className="text-[12px] leading-[16px] text-tx2 mt-2">
          Сейчас в системе выбрана {resolved === "dark" ? "тёмная" : "светлая"} тема — оформление меняется вместе с ней.
        </div>
      )}
    </div>
  );
}
