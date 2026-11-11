import type { CommissionMemberRole, CommissionStatus, CommissionVoteType, VotingRule } from "@shared/types/api";

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  ПЕРВЫЙ_ЭТАП: "1-й этап: применять взыскание?",
  ВТОРОЙ_ЭТАП: "2-й этап: выбор вида взыскания",
  ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ: "Закрыта — без взыскания",
  ЗАВЕРШЕНО: "Завершена — решение принято",
  ЗАВЕРШЕНО_БЕЗ_РЕШЕНИЯ: "Завершена без решения",
};

export function getCommissionStatusLabel(status?: CommissionStatus | string | null): string {
  if (!status) return "—";
  return COMMISSION_STATUS_LABELS[status as CommissionStatus] || status;
}

export function getCommissionStatusBadgeClass(status?: CommissionStatus | string | null): string {
  switch (status) {
    case "ПЕРВЫЙ_ЭТАП":
    case "ВТОРОЙ_ЭТАП":
      return "bg-wnbg text-wnt";
    case "ЗАВЕРШЕНО":
      return "bg-okbg text-okt";
    case "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ":
      return "bg-ntbg text-tx";
    case "ЗАВЕРШЕНО_БЕЗ_РЕШЕНИЯ":
      return "bg-dgbg text-dgt";
    default:
      return "bg-ntbg text-tx";
  }
}

export function isCommissionOpen(status?: CommissionStatus | string | null): boolean {
  return status === "ПЕРВЫЙ_ЭТАП" || status === "ВТОРОЙ_ЭТАП";
}

export function getCurrentStageVotingDeadline(commission: {
  status?: CommissionStatus | string | null;
  stage1VotingDeadline?: string | null;
  stage2VotingDeadline?: string | null;
}): string | undefined {
  if (commission.status === "ПЕРВЫЙ_ЭТАП") return commission.stage1VotingDeadline || undefined;
  return commission.stage2VotingDeadline || commission.stage1VotingDeadline || undefined;
}

export function getCommissionMainQuestion(status?: CommissionStatus | string | null): string {
  switch (status) {
    case "ПЕРВЫЙ_ЭТАП":
      return "Применять взыскание?";
    case "ВТОРОЙ_ЭТАП":
      return "Выбор вида взыскания";
    case "ЗАВЕРШЕНО":
      return "Решение принято";
    case "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ":
      return "Взыскание не применено";
    case "ЗАВЕРШЕНО_БЕЗ_РЕШЕНИЯ":
      return "Решение не принято";
    default:
      return "Комиссия";
  }
}

export function getCommissionStatusShortLabel(status?: CommissionStatus | string | null): string {
  switch (status) {
    case "ПЕРВЫЙ_ЭТАП":
    case "ВТОРОЙ_ЭТАП":
      return "На голосовании";
    case "ЗАВЕРШЕНО":
      return "Завершено";
    case "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ":
      return "Без взыскания";
    case "ЗАВЕРШЕНО_БЕЗ_РЕШЕНИЯ":
      return "Решение не принято";
    default:
      return getCommissionStatusLabel(status);
  }
}

export function getCommissionStatusDotClass(status?: CommissionStatus | string | null): string {
  switch (status) {
    case "ПЕРВЫЙ_ЭТАП":
    case "ВТОРОЙ_ЭТАП":
      return "bg-wn";
    case "ЗАВЕРШЕНО":
      return "bg-ok";
    case "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ":
      return "bg-nt";
    case "ЗАВЕРШЕНО_БЕЗ_РЕШЕНИЯ":
      return "bg-dg";
    default:
      return "bg-nt";
  }
}

export function getCommissionStatusTextClass(status?: CommissionStatus | string | null): string {
  switch (status) {
    case "ПЕРВЫЙ_ЭТАП":
    case "ВТОРОЙ_ЭТАП":
      return "text-wnt";
    case "ЗАВЕРШЕНО":
      return "text-okt";
    case "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ":
      return "text-tx2";
    case "ЗАВЕРШЕНО_БЕЗ_РЕШЕНИЯ":
      return "text-dgt";
    default:
      return "text-tx2";
  }
}

export const COMMISSION_VOTE_LABELS: Record<CommissionVoteType, string> = {
  ЗА: "За",
  ПРОТИВ: "Против",
  ВОЗДЕРЖАЛСЯ: "Воздержался",
};

export function getVoteBadgeClass(vote?: CommissionVoteType | string | null): string {
  switch (vote) {
    case "ЗА":
      return "bg-okbg text-okt";
    case "ПРОТИВ":
      return "bg-dgbg text-dgt";
    case "ВОЗДЕРЖАЛСЯ":
      return "bg-ntbg text-tx";
    default:
      return "bg-ntbg text-tx";
  }
}

export function getVoteTextClass(vote?: CommissionVoteType | string | null): string {
  switch (vote) {
    case "ЗА":
      return "text-okt";
    case "ПРОТИВ":
      return "text-dgt";
    case "ВОЗДЕРЖАЛСЯ":
      return "text-tx2";
    default:
      return "text-tx2";
  }
}

export const COMMISSION_MEMBER_ROLE_LABELS: Record<CommissionMemberRole, string> = {
  ЧЛЕН: "Член комиссии",
  ПРЕДСЕДАТЕЛЬ: "Председатель",
  СЕКРЕТАРЬ: "Секретарь",
};

export const VOTING_RULE_LABELS: Record<string, string> = {
  MAJORITY: "простое большинство",
  QUALIFIED_MAJORITY: "квалифицированное большинство (2/3)",
  UNANIMOUS: "единогласно",
  CONSENSUS: "консенсус (без возражений)",
};

export function getVotingRuleLabel(rule?: VotingRule | string | null): string {
  if (!rule) return "—";
  return VOTING_RULE_LABELS[rule] || rule;
}

export const DECISION_TYPE_LABELS: Record<string, string> = {
  REPRIMAND: "Выговор",
  FINE: "Штраф / депремирование",
  DISMISSAL: "Увольнение",
  WARNING: "Предупреждение",
  TRANSFER: "Перевод на другую должность",
};

export function getDecisionTypeLabel(code?: string | null, name?: string | null): string {
  if (name) return name;
  if (!code) return "—";
  return DECISION_TYPE_LABELS[code] || code;
}
