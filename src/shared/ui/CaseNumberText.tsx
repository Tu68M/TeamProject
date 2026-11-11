const TAIL_LENGTH = 3;

export function CaseNumberText({ value }: { value: string }) {
  if (value.length <= TAIL_LENGTH + 1) {
    return <span className="truncate">{value}</span>;
  }
  const head = value.slice(0, -TAIL_LENGTH);
  const tail = value.slice(-TAIL_LENGTH);
  return (
    <span className="flex min-w-0" title={value}>
      <span className="truncate">{head}</span>
      <span className="shrink-0">{tail}</span>
    </span>
  );
}
