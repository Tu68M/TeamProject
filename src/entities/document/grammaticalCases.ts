export interface GrammaticalCaseOption {
  code: string;
  label: string;
}

export const GRAMMATICAL_CASES: GrammaticalCaseOption[] = [
  { code: "NOMINATIVE", label: "Именительный (кто? что?)" },
  { code: "GENITIVE", label: "Родительный (кого? чего?)" },
  { code: "DATIVE", label: "Дательный (кому? чему?)" },
  { code: "ACCUSATIVE", label: "Винительный (кого? что?)" },
  { code: "INSTRUMENTAL", label: "Творительный (кем? чем?)" },
  { code: "PREPOSITIONAL", label: "Предложный (о ком? о чём?)" },
];

const DECLINABLE_SOURCE_PATTERN = /^(VIOLATOR|GENERATOR)_(FULL|SHORT|LAST|FIRST|MIDDLE)_NAME$/;
const DECLINABLE_SOURCES = new Set(["COMMISSION_MEMBER", "COMMISSION_MEMBERS_LIST", "COMMISSION_GUEST"]);

export function isDeclinableSource(source?: string | null): boolean {
  return Boolean(source && (DECLINABLE_SOURCES.has(source) || DECLINABLE_SOURCE_PATTERN.test(source)));
}
