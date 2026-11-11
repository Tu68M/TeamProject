interface StatusDotProps {
  active?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

export default function StatusDot({ active, activeLabel = "Активно", inactiveLabel = "Неактивно" }: StatusDotProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap ${active ? "text-okt font-medium" : "text-tx2"}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-ok" : "bg-nt"}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
