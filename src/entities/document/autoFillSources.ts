import type { AutoFillParams, PlaceholderAutoFillSetting } from "@shared/types/api";

export interface AutoFillSourceOption {
  code: string;
  label: string;
  defaultEditable: boolean;
}

export interface AutoFillSourceGroup {
  label: string;
  options: AutoFillSourceOption[];
}

export type NameForm = "FULL" | "SHORT" | "LAST" | "FIRST" | "MIDDLE";

export const NAME_FORMS: { code: NameForm; label: string }[] = [
  { code: "FULL", label: "ФИО (Иванов Иван Иванович)" },
  { code: "SHORT", label: "ФИО с инициалами (И. И. Иванов)" },
  { code: "LAST", label: "Фамилия" },
  { code: "FIRST", label: "Имя" },
  { code: "MIDDLE", label: "Отчество" },
];

const NAME_FORM_CODE_SUFFIX: Record<NameForm, string> = {
  FULL: "FULL_NAME",
  SHORT: "SHORT_NAME",
  LAST: "LAST_NAME",
  FIRST: "FIRST_NAME",
  MIDDLE: "MIDDLE_NAME",
};

export interface NameSubject {
  pickerCode: string;
  prefix: "VIOLATOR" | "GENERATOR" | null;
  fixedSource?: string;
  label: string;
  defaultEditable: boolean;
}

export const NAME_SUBJECTS: NameSubject[] = [
  { pickerCode: "VIOLATOR_NAME", prefix: "VIOLATOR", label: "Данные имени нарушителя", defaultEditable: true },
  { pickerCode: "GENERATOR_NAME", prefix: "GENERATOR", label: "Данные имени составителя", defaultEditable: false },
  { pickerCode: "COMMISSION_MEMBER", prefix: null, fixedSource: "COMMISSION_MEMBER", label: "Данные имени участника комиссии", defaultEditable: true },
  { pickerCode: "COMMISSION_GUEST", prefix: null, fixedSource: "COMMISSION_GUEST", label: "Данные имени приглашённого на заседание", defaultEditable: true },
];

export function parseNameSource(
  source?: string | null,
  params?: AutoFillParams | null
): { subject: NameSubject; form: NameForm } | null {
  if (!source) return null;
  const fixed = NAME_SUBJECTS.find((s) => !s.prefix && s.fixedSource === source);
  if (fixed) return { subject: fixed, form: params?.nameForm ?? "FULL" };
  for (const subject of NAME_SUBJECTS) {
    if (!subject.prefix) continue;
    for (const form of NAME_FORMS) {
      if (source === `${subject.prefix}_${NAME_FORM_CODE_SUFFIX[form.code]}`) return { subject, form: form.code };
    }
  }
  return null;
}

export function buildNameSource(subject: NameSubject, form: NameForm): { source: string; params?: AutoFillParams } {
  if (!subject.prefix) return { source: subject.fixedSource ?? "COMMISSION_MEMBER", params: { nameForm: form } };
  return { source: `${subject.prefix}_${NAME_FORM_CODE_SUFFIX[form]}` };
}

export function getNameFormLabel(form: NameForm): string {
  return NAME_FORMS.find((f) => f.code === form)?.label ?? form;
}

export type DateFormat = NonNullable<AutoFillParams["dateFormat"]>;

export const DATE_FORMATS: { code: DateFormat; label: string }[] = [
  { code: "FULL", label: "Дата полностью (29 сентября 2026 г.)" },
  { code: "NUMERIC", label: "Дата числами (29.09.2026)" },
  { code: "DAY", label: "Число (29)" },
  { code: "MONTH_NUMBER", label: "Месяц числом (09)" },
  { code: "MONTH_NAME", label: "Месяц словом (сентябрь)" },
  { code: "MONTH_NAME_GENITIVE", label: "Месяц словом в дате (сентября)" },
  { code: "YEAR", label: "Год (2026)" },
  { code: "TIME", label: "Время (14:30)" },
  { code: "TIME_WORDS", label: "Время словами (14 часов 30 минут)" },
  { code: "DATETIME", label: "Дата и время (29 сентября 2026 г., 14:30)" },
];

export interface DateCategory {
  code: string;
  label: string;
  defaultEditable: boolean;
  legacyTimeCode?: string;
}

export const DATE_CATEGORIES: DateCategory[] = [
  { code: "INCIDENT_DATE", label: "Дата и время нарушения", defaultEditable: false, legacyTimeCode: "INCIDENT_TIME" },
  { code: "DISCOVERY_DATE", label: "Дата и время обнаружения", defaultEditable: false },
  { code: "EXPLANATION_DATE", label: "Срок предоставления объяснения (дедлайн)", defaultEditable: false },
  { code: "COMMISSION_MEETING_DATE", label: "Дата и время заседания комиссии", defaultEditable: false, legacyTimeCode: "COMMISSION_MEETING_TIME" },
  { code: "CURRENT_DATE", label: "Текущая дата и время (на момент генерации)", defaultEditable: false },
];

export function parseDateSource(
  source?: string | null,
  params?: AutoFillParams | null
): { category: DateCategory; format: DateFormat } | null {
  if (!source) return null;
  for (const category of DATE_CATEGORIES) {
    if (source === category.code) return { category, format: params?.dateFormat ?? "FULL" };
    if (source === category.legacyTimeCode) return { category, format: "TIME" };
  }
  return null;
}

export function getDateFormatLabel(format: DateFormat): string {
  return DATE_FORMATS.find((f) => f.code === format)?.label ?? format;
}

export function isTimeFormat(format: DateFormat): boolean {
  return format === "TIME" || format === "TIME_WORDS";
}

export type SourceKind = "plain" | "name" | "date" | "memberList" | "votes";

export function sourceKind(source?: string | null, params?: AutoFillParams | null): SourceKind {
  if (source === "COMMISSION_MEMBERS_LIST") return "memberList";
  if (source && source.startsWith("COMMISSION_VOTES_")) return "votes";
  if (parseDateSource(source, params)) return "date";
  return parseNameSource(source, params) ? "name" : "plain";
}

export function pickerValueOf(setting?: PlaceholderAutoFillSetting): string {
  if (!setting?.source) return "";
  const parsedName = parseNameSource(setting.source, setting.params);
  if (parsedName) return parsedName.subject.pickerCode;
  const parsedDate = parseDateSource(setting.source, setting.params);
  return parsedDate ? parsedDate.category.code : setting.source;
}

export const AUTO_FILL_SOURCE_GROUPS: AutoFillSourceGroup[] = [
  {
    label: "Дело и нарушение",
    options: [
      { code: "CASE_NUMBER", label: "Номер дела", defaultEditable: false },
      { code: "VIOLATION_TYPE", label: "Вид нарушения", defaultEditable: true },
      { code: "INCIDENT_DATE", label: "Дата и время нарушения", defaultEditable: false },
      { code: "DISCOVERY_DATE", label: "Дата и время обнаружения", defaultEditable: false },
      { code: "EXPLANATION_DATE", label: "Срок предоставления объяснения (дедлайн)", defaultEditable: false },
      { code: "DOMAIN_NAME", label: "Название домена", defaultEditable: true },
      { code: "DEPARTMENT_NAME", label: "Название подразделения", defaultEditable: true },
    ],
  },
  {
    label: "Нарушитель",
    options: [
      { code: "VIOLATOR_NAME", label: "Данные имени нарушителя", defaultEditable: true },
      { code: "VIOLATOR_POSITION", label: "Должность нарушителя", defaultEditable: true },
    ],
  },
  {
    label: "Составитель документа",
    options: [
      { code: "GENERATOR_NAME", label: "Данные имени составителя", defaultEditable: false },
      { code: "GENERATOR_POSITION", label: "Должность составителя", defaultEditable: false },
    ],
  },
  {
    label: "Комиссия (после её окончания)",
    options: [
      { code: "COMMISSION_MEMBERS_LIST", label: "Список имён участников", defaultEditable: true },
      { code: "COMMISSION_MEMBER", label: "Данные имени участника комиссии", defaultEditable: true },
      { code: "COMMISSION_VOTES_FOR", label: "Количество голосов «за»", defaultEditable: false },
      { code: "COMMISSION_VOTES_AGAINST", label: "Количество голосов «против»", defaultEditable: false },
      { code: "COMMISSION_VOTES_ABSTAINED", label: "Количество воздержавшихся", defaultEditable: false },
      { code: "COMMISSION_GENERATOR_ROLE", label: "Роль составителя в комиссии", defaultEditable: false },
      { code: "COMMISSION_DECISION_TYPE", label: "Вид решения", defaultEditable: true },
      { code: "COMMISSION_MEETING_DATE", label: "Дата и время заседания", defaultEditable: false },
      { code: "PROTOCOL_NUMBER", label: "Номер протокола заседания", defaultEditable: false },
      { code: "COMMISSION_GUEST", label: "Данные имени приглашённого на заседание", defaultEditable: true },
      { code: "COMMISSION_GUEST_POSITION", label: "Должность приглашённого на заседание", defaultEditable: true },
      { code: "COMMISSION_MEETING_LOCATION", label: "Место проведения заседания", defaultEditable: true },
      { code: "COMMISSION_MEMBERS_COUNT", label: "Общее число членов комиссии на данный момент", defaultEditable: false },
    ],
  },
  {
    label: "Системные",
    options: [{ code: "CURRENT_DATE", label: "Текущая дата и время (на момент генерации)", defaultEditable: false }],
  },
];

const ALL_OPTIONS = AUTO_FILL_SOURCE_GROUPS.flatMap((g) => g.options);

export function getAutoFillSource(code?: string | null): AutoFillSourceOption | undefined {
  const direct = ALL_OPTIONS.find((o) => o.code === code);
  if (direct) return direct;
  const parsed = parseNameSource(code);
  if (parsed) {
    return { code: code as string, label: parsed.subject.label, defaultEditable: parsed.subject.defaultEditable };
  }
  const date = parseDateSource(code);
  if (date) return { code: code as string, label: date.category.label, defaultEditable: date.category.defaultEditable };
  return undefined;
}

export function getAutoFillLabel(code?: string | null, params?: AutoFillParams | null): string {
  const parsed = parseNameSource(code, params);
  if (parsed) return `${parsed.subject.label}: ${getNameFormLabel(parsed.form)}`;
  const date = parseDateSource(code, params);
  if (date) return `${date.category.label}: ${getDateFormatLabel(date.format)}`;
  return getAutoFillSource(code)?.label ?? code ?? "";
}

export const VOTING_STAGES: { code: 1 | 2; label: string }[] = [
  { code: 1, label: "1 этап — применять ли взыскание" },
  { code: 2, label: "2 этап — выбор вида взыскания" },
];

export function parseAutoFillParams(json?: string | null): AutoFillParams | undefined {
  if (!json) return undefined;
  try {
    const raw = JSON.parse(json) as AutoFillParams;
    return raw && typeof raw === "object" ? raw : undefined;
  } catch {
    return undefined;
  }
}
