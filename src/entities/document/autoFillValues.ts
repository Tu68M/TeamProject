import petrovich, { type PetrovichCase } from "petrovich";
import { parseServerDateTime, formatInstant } from "@shared/utils/datetime";
import { isTimeFormat, parseDateSource, parseNameSource, type DateFormat, type NameForm } from "@entities/document/autoFillSources";
import { getDecisionTypeLabel } from "@shared/utils/commissionStatus";
import type { AutoFillParams, CommissionMemberResponse, CommissionResponse } from "@shared/types/api";

export interface AutoFillContext {
  caseNumber?: string;
  violationTypeName?: string;
  incidentDateIso?: string | null;
  discoveryDateIso?: string | null;
  explanationDeadlineIso?: string | null;
  violatorFullName?: string;
  violatorPosition?: string;
  generatorFullName?: string;
  generatorPosition?: string;
  domainName?: string;
  departmentName?: string;
  protocolNumber?: string;
  commission?: CommissionResponse | null;
  generatorEmployeeUid?: string;
  lawyerDecisionName?: string;
  timezone: string;
}

export interface AutoFillSelection {
  memberUids?: string[];
}

function formatTimeOnly(iso?: string | null, timezone?: string): string {
  const date = parseServerDateTime(iso);
  if (!date || !timezone) return "";
  return formatInstant(date, timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export function isoInstantToDateOnly(iso?: string | null, timezone?: string): string {
  const date = parseServerDateTime(iso);
  if (!date || !timezone) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export interface Moment {
  date: string;
  time: string;
}

export type AutoFillFieldKind = "date" | "time" | "text";

export function autoFillFieldKind(source?: string | null, params?: AutoFillParams | null): AutoFillFieldKind {
  const dateSource = parseDateSource(source, params);
  if (!dateSource) return "text";
  return isTimeFormat(dateSource.format) ? "time" : "date";
}

export function seedMoment(source: string, ctx: AutoFillContext): Moment | null {
  let iso: string | null | undefined;
  switch (parseDateSource(source)?.category.code) {
    case "INCIDENT_DATE":
      iso = ctx.incidentDateIso;
      break;
    case "DISCOVERY_DATE":
      iso = ctx.discoveryDateIso;
      break;
    case "EXPLANATION_DATE":
      iso = ctx.explanationDeadlineIso;
      break;
    case "COMMISSION_MEETING_DATE":
      iso = ctx.commission?.meetingAt;
      break;
    case "CURRENT_DATE":
      iso = new Date().toISOString();
      break;
    default:
      return null;
  }
  const date = isoInstantToDateOnly(iso, ctx.timezone);
  if (!date) return null;
  return { date, time: formatTimeOnly(iso, ctx.timezone) };
}

const MONTHS_NOMINATIVE = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function pluralRu(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function formatMoment(moment: Moment | null | undefined, format: DateFormat): string {
  if (!moment) return "";
  const [y, m, d] = (moment.date || "").split("-").map(Number);
  const hasDate = Boolean(y && m && d);
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(moment.time || "");
  const hours = timeMatch ? Number(timeMatch[1]) : null;
  const minutes = timeMatch ? Number(timeMatch[2]) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = hours !== null && minutes !== null ? `${pad(hours)}:${pad(minutes)}` : "";
  const full = hasDate ? `${d} ${MONTHS_GENITIVE[m - 1]} ${y} г.` : "";

  switch (format) {
    case "FULL":
      return full;
    case "NUMERIC":
      return hasDate ? `${pad(d)}.${pad(m)}.${y}` : "";
    case "DAY":
      return hasDate ? pad(d) : "";
    case "MONTH_NUMBER":
      return hasDate ? pad(m) : "";
    case "MONTH_NAME":
      return hasDate ? MONTHS_NOMINATIVE[m - 1] : "";
    case "MONTH_NAME_GENITIVE":
      return hasDate ? MONTHS_GENITIVE[m - 1] : "";
    case "YEAR":
      return hasDate ? String(y) : "";
    case "TIME":
      return time;
    case "TIME_WORDS":
      return hours !== null && minutes !== null
        ? `${hours} ${pluralRu(hours, ["час", "часа", "часов"])} ${minutes} ${pluralRu(minutes, ["минута", "минуты", "минут"])}`
        : "";
    case "DATETIME":
      return full && time ? `${full}, ${time}` : full || time;
    default:
      return "";
  }
}

export function splitFullName(fullName?: string | null): { lastName: string; firstName: string; middleName: string } {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    lastName: parts[0] || "",
    firstName: parts[1] || "",
    middleName: parts[2] || "",
  };
}

export function formatShortName(fullName?: string | null): string {
  const { lastName, firstName, middleName } = splitFullName(fullName);
  if (!lastName) return "";
  const firstInitial = firstName ? `${firstName[0]}.` : "";
  const middleInitial = middleName ? `${middleName[0]}.` : "";
  return [firstInitial, middleInitial, lastName].filter(Boolean).join(" ");
}

const GRAMMATICAL_CASE_TO_PETROVICH: Record<string, PetrovichCase> = {
  NOMINATIVE: "nominative",
  GENITIVE: "genitive",
  DATIVE: "dative",
  ACCUSATIVE: "accusative",
  INSTRUMENTAL: "instrumental",
  PREPOSITIONAL: "prepositional",
};

export function declineFullName(fullName?: string | null, grammaticalCase?: string | null): string {
  if (!fullName) return "";
  const petrovichCase = grammaticalCase && grammaticalCase !== "NOMINATIVE" ? GRAMMATICAL_CASE_TO_PETROVICH[grammaticalCase] : null;
  if (!petrovichCase) return fullName;
  const { lastName, firstName, middleName } = splitFullName(fullName);
  if (!lastName && !firstName) return fullName;
  try {
    const gender = middleName ? petrovich.detect_gender(middleName) : "androgynous";
    const declined = petrovich(
      { last: lastName || undefined, first: firstName || undefined, middle: middleName || undefined, gender },
      petrovichCase
    );
    return [declined.last, declined.first, declined.middle].filter(Boolean).join(" ");
  } catch (err) {
    console.error("Ошибка склонения ФИО:", err);
    return fullName;
  }
}

export function declineNameParts(
  fullName?: string | null,
  grammaticalCase?: string | null
): { lastName: string; firstName: string; middleName: string } {
  const parts = splitFullName(fullName);
  const petrovichCase = grammaticalCase && grammaticalCase !== "NOMINATIVE" ? GRAMMATICAL_CASE_TO_PETROVICH[grammaticalCase] : null;
  if (!petrovichCase || (!parts.lastName && !parts.firstName)) return parts;
  try {
    const gender = parts.middleName ? petrovich.detect_gender(parts.middleName) : "androgynous";
    const declined = petrovich(
      {
        last: parts.lastName || undefined,
        first: parts.firstName || undefined,
        middle: parts.middleName || undefined,
        gender,
      },
      petrovichCase
    );
    return {
      lastName: declined.last || "",
      firstName: declined.first || "",
      middleName: declined.middle || "",
    };
  } catch (err) {
    console.error("Ошибка склонения частей имени:", err);
    return parts;
  }
}

export function formatNameForm(fullName: string | null | undefined, form: NameForm, grammaticalCase?: string | null): string {
  switch (form) {
    case "SHORT":
      return declineShortName(fullName, grammaticalCase);
    case "LAST":
      return declineNameParts(fullName, grammaticalCase).lastName;
    case "FIRST":
      return declineNameParts(fullName, grammaticalCase).firstName;
    case "MIDDLE":
      return declineNameParts(fullName, grammaticalCase).middleName;
    case "FULL":
    default:
      return declineFullName(fullName, grammaticalCase);
  }
}

export function declineShortName(fullName?: string | null, grammaticalCase?: string | null): string {
  const petrovichCase = grammaticalCase && grammaticalCase !== "NOMINATIVE" ? GRAMMATICAL_CASE_TO_PETROVICH[grammaticalCase] : null;
  if (!petrovichCase) return formatShortName(fullName);
  const { lastName, firstName, middleName } = splitFullName(fullName);
  if (!lastName) return formatShortName(fullName);
  const firstInitial = firstName ? `${firstName[0]}.` : "";
  const middleInitial = middleName ? `${middleName[0]}.` : "";
  try {
    const gender = middleName ? petrovich.detect_gender(middleName) : "androgynous";
    const declined = petrovich({ last: lastName, gender }, petrovichCase);
    return [firstInitial, middleInitial, declined.last].filter(Boolean).join(" ");
  } catch (err) {
    console.error("Ошибка склонения фамилии:", err);
    return formatShortName(fullName);
  }
}

const MEMBER_ROLE_LABELS: Record<string, string> = {
  ПРЕДСЕДАТЕЛЬ: "председатель комиссии",
  СЕКРЕТАРЬ: "секретарь комиссии",
  ЧЛЕН: "член комиссии",
};

export function activeCommissionMembers(commission?: CommissionResponse | null): CommissionMemberResponse[] {
  return (commission?.members ?? []).filter((m) => m.isActive !== false);
}

function commissionMembers(ctx: AutoFillContext): CommissionMemberResponse[] {
  return activeCommissionMembers(ctx.commission);
}

export function selectedMembers(ctx: AutoFillContext, memberUids?: string[]): CommissionMemberResponse[] {
  const members = commissionMembers(ctx);
  if (!memberUids || memberUids.length === 0) return members;
  const wanted = new Set(memberUids);
  return members.filter((m) => m.employeeUid && wanted.has(m.employeeUid));
}

function formatMembersList(
  members: CommissionMemberResponse[],
  params: AutoFillParams | undefined,
  grammaticalCase?: string | null
): string {
  const form: NameForm = params?.nameForm === "SHORT" ? "SHORT" : "FULL";
  return members
    .map((m) => {
      const name = formatNameForm(m.fullName, form, grammaticalCase);
      if (!name) return "";
      return params?.includePosition && m.position ? `${name} (${m.position})` : name;
    })
    .filter(Boolean)
    .join(", ");
}

function stageVotes(ctx: AutoFillContext, stage: number) {
  const fromCommission = ctx.commission?.votes ?? [];
  const all = fromCommission.length > 0 ? fromCommission : commissionMembers(ctx).flatMap((m) => m.votes ?? []);
  return all.filter((v) => !v.superseded && v.stage === stage);
}

function countVotes(ctx: AutoFillContext, kind: "ЗА" | "ПРОТИВ" | "ВОЗДЕРЖАЛСЯ", stage: number): number {
  const votes = stageVotes(ctx, stage);
  if (kind === "ЗА" && stage === 2) {
    const byDecision = new Map<string, number>();
    votes
      .filter((v) => v.vote === "ЗА")
      .forEach((v) => byDecision.set(v.decisionTypeCode ?? "", (byDecision.get(v.decisionTypeCode ?? "") ?? 0) + 1));
    const finalCode = ctx.commission?.decision?.finalDecisionCode;
    if (finalCode && byDecision.has(finalCode)) return byDecision.get(finalCode) ?? 0;
    return Math.max(0, ...byDecision.values());
  }
  return votes.filter((v) => v.vote === kind).length;
}

function decisionTypeName(code?: string | null, serverName?: string | null): string {
  if (serverName) return serverName;
  return code ? getDecisionTypeLabel(code) : "";
}

function generatorRoleLabel(ctx: AutoFillContext): string {
  const me = commissionMembers(ctx).find((m) => m.employeeUid && m.employeeUid === ctx.generatorEmployeeUid);
  if (!me?.roles?.length) return "";
  const roles = me.roles.includes("ПРЕДСЕДАТЕЛЬ") ? me.roles.filter((r) => r !== "ЧЛЕН") : me.roles;
  return roles.map((r) => MEMBER_ROLE_LABELS[r] ?? r.toLowerCase()).join(", ");
}

export function computeAutoFillValue(
  source: string | undefined | null,
  ctx: AutoFillContext,
  grammaticalCase?: string | null,
  params?: AutoFillParams,
  selection?: AutoFillSelection
): string {
  const dateSource = parseDateSource(source, params);
  if (dateSource) return formatMoment(seedMoment(dateSource.category.code, ctx), dateSource.format);

  const nameSource = parseNameSource(source, params);
  if (nameSource) {
    const prefix = nameSource.subject.prefix;
    if (source === "COMMISSION_GUEST") {
      return (ctx.commission?.meetingGuests || [])
        .map((g) => formatNameForm(g.fullName, nameSource.form, grammaticalCase))
        .filter(Boolean)
        .join(", ");
    }
    const fullName =
      prefix === "VIOLATOR"
        ? ctx.violatorFullName
        : prefix === "GENERATOR"
          ? ctx.generatorFullName
          : selectedMembers(ctx, selection?.memberUids)[0]?.fullName;
    return formatNameForm(fullName, nameSource.form, grammaticalCase);
  }

  switch (source) {
    case "CASE_NUMBER":
      return ctx.caseNumber || "";
    case "VIOLATION_TYPE":
      return ctx.violationTypeName || "";
    case "PROTOCOL_NUMBER":
      return ctx.protocolNumber || ctx.commission?.decision?.protocolNumber || "";
    case "VIOLATOR_POSITION":
      return ctx.violatorPosition || "";
    case "GENERATOR_POSITION":
      return ctx.generatorPosition || "";
    case "DOMAIN_NAME":
      return ctx.domainName || "";
    case "DEPARTMENT_NAME":
      return ctx.departmentName || "";
    case "COMMISSION_MEMBERS_LIST":
      return formatMembersList(selectedMembers(ctx, selection?.memberUids), params, grammaticalCase);
    case "COMMISSION_VOTES_FOR":
      return ctx.commission ? String(countVotes(ctx, "ЗА", params?.stage ?? 1)) : "";
    case "COMMISSION_VOTES_AGAINST":
      return ctx.commission ? String(countVotes(ctx, "ПРОТИВ", params?.stage ?? 1)) : "";
    case "COMMISSION_VOTES_ABSTAINED":
      return ctx.commission ? String(countVotes(ctx, "ВОЗДЕРЖАЛСЯ", params?.stage ?? 1)) : "";
    case "COMMISSION_GENERATOR_ROLE":
      return generatorRoleLabel(ctx);
    case "COMMISSION_DECISION_TYPE":
      return (
        decisionTypeName(ctx.commission?.decision?.finalDecisionCode, ctx.commission?.decision?.finalDecisionName) ||
        ctx.lawyerDecisionName ||
        ""
      );
    case "COMMISSION_GUEST_POSITION":
      return (ctx.commission?.meetingGuests || []).map((g) => g.position).filter(Boolean).join(", ");
    case "COMMISSION_MEETING_LOCATION":
      return ctx.commission?.meetingLocation || ctx.commission?.meetingLink || "";
    case "COMMISSION_MEMBERS_COUNT":
      return ctx.commission ? String(commissionMembers(ctx).length) : "";
    default:
      return "";
  }
}
