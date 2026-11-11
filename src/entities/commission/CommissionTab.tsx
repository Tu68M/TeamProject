import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { commissionApi } from "@/entities/commission/api/commissionApi";
import { userApi } from "@/entities/user/userApi";
import { useAuthStore } from "@entities/session/model/authStore";
import { useTimezoneStore } from "@shared/model/timezoneStore";
import Avatar from "@shared/ui/Avatar";
import { ActionsMenu, ActionsMenuItem } from "@shared/ui/ActionsMenu";
import { useNavBadgeStore } from "@shared/model/navBadgeStore";
import { useAllCommissionsStore } from "@shared/model/allCommissionsStore";
import { useDecisionTypesStore } from "@shared/model/decisionTypesStore";
import {
  formatServerDateTime,
  instantToLocalDateTimeInputValue,
  localDateTimeInputToServerString,
  parseServerDateTime,
} from "@shared/utils/datetime";
import { CreateCommissionModal, MemberPicker } from "@/entities/commission/CreateCommissionModal";
import { GenerateDocumentModal } from "@entities/document/GenerateDocumentModal";
import type {
  CaseAssigneeResponse,
  CaseStatus,
  CommissionMemberResponse,
  CommissionResponse,
  CommissionVoteResponse,
  CommissionVoteType,
  EmployeeResponse,
} from "@shared/types/api";
import {
  COMMISSION_MEMBER_ROLE_LABELS,
  COMMISSION_VOTE_LABELS,
  getCommissionMainQuestion,
  getCommissionStatusDotClass,
  getCommissionStatusShortLabel,
  getCommissionStatusTextClass,
  getDecisionTypeLabel,
  getVoteTextClass,
  getCurrentStageVotingDeadline,
  getVotingRuleLabel,
  isCommissionOpen,
} from "@shared/utils/commissionStatus";
import { isCaseLocked } from "@shared/utils/caseStatus";
import { showAlert, showConfirm } from "@shared/ui/dialogs";
import { getErrorMessage } from "@shared/utils/errorMessage";
import { EmployeeLink } from "@shared/ui/EmployeeLink";

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function voteForStage(member: CommissionMemberResponse, stage: number) {
  return member.votes?.find((v) => v.stage === stage && !v.superseded) || null;
}

function VoteChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIdx = (idx + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextIdx = (idx - 1 + options.length) % options.length;
    if (nextIdx === null) return;
    e.preventDefault();
    const next = options[nextIdx];
    onChange(next.value);
    refs.current[next.value]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt, idx) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[opt.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!value && idx === 0) ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`px-4 py-2 rounded-inp text-[14px] font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pr/40 ${
              selected ? "bg-acl border-pr text-prt" : "bg-bg text-tx border-bd hover:border-tx2/50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function VoteCommentNote({ comment, author, voteLabel }: { comment: string; author: string; voteLabel: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        title="Посмотреть комментарий"
        aria-label="Комментарий к голосу"
        onClick={() => setOpen(true)}
        className="flex items-center text-tx2 hover:text-prl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pr/40 rounded-sm"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3.5h12a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6.5L4 14.5V11.5H2a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" />
        </svg>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            className="bg-bg rounded-lg border border-bd w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl text-left whitespace-normal font-normal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-bd">
              <div className="min-w-0">
                <h3 className="text-[18px] font-bold text-tx">Комментарий к голосу</h3>
                <p className="mt-0.5 text-[13px] text-tx2 break-words">{author} · {voteLabel}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-tx2 hover:text-tx transition-colors shrink-0" type="button" aria-label="Закрыть">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto text-[14px] leading-[22px] text-tx whitespace-pre-wrap break-words">{comment}</div>
            <div className="p-4 border-t border-bd flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors">
                Закрыть
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function getDecisionOutcomeLabel(commission: CommissionResponse): string {
  const isPenalty = commission.status === "ЗАВЕРШЕНО";
  const isNoPenalty = commission.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ";
  if (isPenalty) return `Решение: ${getDecisionTypeLabel(commission.decision?.finalDecisionCode, commission.decision?.finalDecisionName)}`;
  if (isNoPenalty) return "Взыскание не применено";
  return "Решение не принято";
}

function MembersTable({
  commission,
  currentEmployeeUid,
  canManageMembers,
  onRemoveMember,
  removingMemberId,
}: {
  commission: CommissionResponse;
  currentEmployeeUid?: string;
  canManageMembers?: boolean;
  onRemoveMember?: (member: CommissionMemberResponse) => void;
  removingMemberId?: string | null;
}) {
  const members = useMemo(() => commission.members || [], [commission.members]);
  const liveStage = commission.status === "ПЕРВЫЙ_ЭТАП" ? 1 : commission.status === "ВТОРОЙ_ЭТАП" ? 2 : null;
  const isOpen = liveStage !== null;

  const votedStages = useMemo(() => {
    const stages = new Set<number>();
    members.forEach((m) => (m.votes || []).forEach((v) => {
      if (!v.superseded && v.stage) stages.add(v.stage);
    }));
    return Array.from(stages).sort((a, b) => a - b);
  }, [members]);

  const stageTabs = useMemo(() => {
    const set = new Set(votedStages);
    if (liveStage) set.add(liveStage);
    return Array.from(set).sort((a, b) => a - b);
  }, [votedStages, liveStage]);

  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const displayStage = selectedStage ?? liveStage ?? stageTabs[stageTabs.length - 1] ?? null;
  const showStageTabs = stageTabs.length > 1;
  const isViewingClosedStage = displayStage !== null && displayStage !== liveStage;
  const isFinalStage = !isOpen && displayStage === stageTabs[stageTabs.length - 1];

  const stageTally = useMemo(() => {
    if (!isViewingClosedStage || !displayStage) return null;
    let za = 0;
    let protiv = 0;
    let vozderzhalsya = 0;
    members.forEach((m) => {
      if (!m.roles?.includes("ЧЛЕН")) return;
      const v = voteForStage(m, displayStage);
      if (v?.vote === "ЗА") za++;
      else if (v?.vote === "ПРОТИВ") protiv++;
      else if (v?.vote === "ВОЗДЕРЖАЛСЯ") vozderzhalsya++;
    });
    return { za, protiv, vozderzhalsya };
  }, [members, isViewingClosedStage, displayStage]);

  return (
    <div>
      {showStageTabs && (
        <div role="tablist" aria-label="Этап голосования" className="flex items-center gap-1 mb-2">
          {stageTabs.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={displayStage === s}
              onClick={() => setSelectedStage(s)}
              className={`px-2.5 py-1 rounded-inp text-[13px] font-medium transition-colors ${
                displayStage === s ? "bg-acl text-prt" : "text-tx2 hover:text-tx hover:bg-surf"
              }`}
            >
              Этап {s}
              {s === liveStage && <span className="ml-1 text-[11px] font-normal opacity-70">(идёт)</span>}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[480px]">
          <thead>
            <tr className="border-b border-bd">
              <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 whitespace-nowrap">Участник</th>
              <th className="text-left font-medium text-[12px] text-tx2 py-2 px-3 whitespace-nowrap">Роль</th>
              <th className="text-right font-medium text-[12px] text-tx2 py-2 px-3 whitespace-nowrap">Голос</th>
              {canManageMembers && <th className="py-2 px-3 w-px"><span className="sr-only">Действия</span></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const canVote = m.roles?.includes("ЧЛЕН");
              const vote = canVote && displayStage ? voteForStage(m, displayStage) : null;
              const isMe = Boolean(currentEmployeeUid) && m.employeeUid === currentEmployeeUid;
              const roleText = (m.roles || []).map((r) => COMMISSION_MEMBER_ROLE_LABELS[r] || r).join(" · ");
              const isRemovable =
                isOpen && !m.roles?.includes("ПРЕДСЕДАТЕЛЬ") && !m.roles?.includes("СЕКРЕТАРЬ");

              return (
                <tr key={m.id} className={`border-b border-bd/70 last:border-b-0 ${isMe ? "bg-acl/25" : ""}`}>
                  <td className="py-2 px-3 align-middle">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        avatarUrl={m.employeeUid ? userApi.employeeAvatarUrl(m.employeeUid) : null}
                        name={m.fullName || "?"}
                        size={28}
                      />
                      <span className="truncate text-[14px] font-medium text-tx">
                        <EmployeeLink employeeUid={m.employeeUid}>{m.fullName || m.employeeUid}</EmployeeLink>
                      </span>
                      {m.isActive === false && (
                        <span
                          title="Не проголосовал: не учитывается в комиссии и документах"
                          className="shrink-0 rounded-full bg-mut px-2 py-0.5 text-[11px] font-medium text-tx2"
                        >
                          Неактивен
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 align-middle text-[13px] text-tx2 whitespace-nowrap">{roleText || "—"}</td>
                  <td className="py-2 px-3 align-middle text-right text-[13px] whitespace-nowrap">
                    {!canVote ? (
                      <span className="text-tx2">Не голосует</span>
                    ) : vote ? (
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <span className={`font-medium ${getVoteTextClass(vote.vote)}`}>
                          {COMMISSION_VOTE_LABELS[vote.vote as CommissionVoteType] || vote.vote}
                          {vote.decisionTypeCode ? ` · ${getDecisionTypeLabel(vote.decisionTypeCode, vote.decisionTypeName)}` : ""}
                        </span>
                        {vote.comment && <VoteCommentNote
                            comment={vote.comment}
                            author={m.fullName || m.employeeUid || "—"}
                            voteLabel={COMMISSION_VOTE_LABELS[vote.vote as CommissionVoteType] || vote.vote}
                          />}
                      </span>
                    ) : isViewingClosedStage || m.isActive === false ? (
                      <span className="text-tx2">Не голосовал</span>
                    ) : isMe ? (
                      <span className="font-medium text-prl">Ваш голос</span>
                    ) : (
                      <span className="text-tx2">Ожидает голосования</span>
                    )}
                  </td>
                  {canManageMembers && (
                    <td className="py-2 px-3 align-middle text-right whitespace-nowrap">
                      {isRemovable && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember?.(m)}
                          disabled={removingMemberId === m.id}
                          className="text-[12px] font-medium text-dgl hover:text-dgt transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Удалить
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showStageTabs && stageTally && (
        <div className="text-[12px] text-tx2 mt-2">
          За {stageTally.za} · Против {stageTally.protiv} · Воздержались {stageTally.vozderzhalsya}
          {isFinalStage ? ` · ${getDecisionOutcomeLabel(commission)}` : ` · Комиссия перешла к этапу ${(displayStage ?? 1) + 1}`}
        </div>
      )}
    </div>
  );
}

function DecisionSummary({ commission }: { commission: CommissionResponse }) {
  const { timezone } = useTimezoneStore();
  const decision = commission.decision;
  if (!decision) return null;

  const isPenalty = commission.status === "ЗАВЕРШЕНО";
  const isNoPenalty = commission.status === "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ";
  const titleClass = isPenalty ? "text-okt" : isNoPenalty ? "text-tx" : "text-dgt";

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`text-[14px] font-semibold ${titleClass}`}>{getDecisionOutcomeLabel(commission)}</div>
      {decision.noDecisionReason && <div className="text-[13px] text-tx2">{decision.noDecisionReason}</div>}
      <div className="text-[13px] text-tx2">
        За {decision.votesFor ?? 0} · Против {decision.votesAgainst ?? 0} · Воздержались {decision.votesAbstained ?? 0} · Кворум{" "}
        {decision.isQuorumMet ? "соблюдён" : "не соблюдён"}
      </div>
      <div className="text-[12px] text-tx2">
        Протокол № {decision.protocolNumber} от {formatServerDateTime(decision.decidedAt, timezone)}
      </div>
    </div>
  );
}

function VotingSection({
  commissionId,
  stage,
  myVote,
  onVoted,
}: {
  commissionId: string;
  stage: 1 | 2;
  myVote: CommissionVoteResponse | null;
  onVoted: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (myVote && !editing) {
    return (
      <div className="pt-5 border-t border-bd">
        <button
          type="button"
          className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors"
          onClick={() => setEditing(true)}
        >
          Изменить голос
        </button>
      </div>
    );
  }

  const handleVoted = () => {
    setEditing(false);
    onVoted();
  };
  const initial = editing ? myVote : null;
  const onCancel = editing ? () => setEditing(false) : undefined;
  return stage === 1 ? (
    <Stage1VotingForm commissionId={commissionId} onVoted={handleVoted} initial={initial} onCancel={onCancel} />
  ) : (
    <Stage2VotingForm commissionId={commissionId} onVoted={handleVoted} initial={initial} onCancel={onCancel} />
  );
}

const STAGE1_OPTIONS: { value: CommissionVoteType; label: string }[] = [
  { value: "ЗА", label: "За" },
  { value: "ПРОТИВ", label: "Против" },
  { value: "ВОЗДЕРЖАЛСЯ", label: "Воздержался" },
];

function Stage1VotingForm({
  commissionId,
  onVoted,
  initial,
  onCancel,
}: {
  commissionId: string;
  onVoted: () => void;
  initial?: CommissionVoteResponse | null;
  onCancel?: () => void;
}) {
  const [vote, setVote] = useState<CommissionVoteType | null>((initial?.vote as CommissionVoteType) ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!vote) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await commissionApi.castStage1Vote(commissionId, { vote, comment: comment.trim() || undefined });
      onVoted();
    } catch (err: any) {
      console.error("Ошибка голосования:", err);
      setError(getErrorMessage(err, "Не удалось учесть голос"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-5 border-t border-bd">
      <div className="max-w-[640px] flex flex-col gap-3">
        <div>
          <div className="text-[14px] font-semibold text-tx mb-1">{initial ? "Изменение голоса" : "Ваш голос"}</div>
          <div className="text-[14px] text-tx">Применять взыскание?</div>
        </div>

        {error && <div className="text-[13px] text-dgt">{error}</div>}

        <VoteChoiceGroup<CommissionVoteType>
          options={STAGE1_OPTIONS}
          value={vote}
          onChange={setVote}
          ariaLabel="Ваш голос: применять взыскание?"
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="stage1-comment" className="text-[12px] text-tx2">
            Комментарий
          </label>
          <input
            id="stage1-comment"
            className="border border-bd rounded-inp px-3 py-2 text-[14px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
            placeholder="Необязательно"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50"
            disabled={!vote || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Голосование..." : initial ? "Сохранить голос" : "Проголосовать"}
          </button>
          {onCancel && (
            <button
              type="button"
              className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors disabled:opacity-50"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Отмена
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const STAGE2_CHOICE_OPTIONS: { value: CommissionVoteType; label: string }[] = [
  { value: "ЗА", label: "За конкретный вид" },
  { value: "ПРОТИВ", label: "Против" },
  { value: "ВОЗДЕРЖАЛСЯ", label: "Воздержался" },
];

function Stage2VotingForm({
  commissionId,
  onVoted,
  initial,
  onCancel,
}: {
  commissionId: string;
  onVoted: () => void;
  initial?: CommissionVoteResponse | null;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<CommissionVoteType | null>((initial?.vote as CommissionVoteType) ?? null);
  const [decisionTypeCode, setDecisionTypeCode] = useState(initial?.decisionTypeCode ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allDecisionTypes = useDecisionTypesStore((s) => s.decisionTypes);
  const isDecisionTypesLoading = useDecisionTypesStore((s) => s.isLoading);
  const isDecisionTypesLoaded = useDecisionTypesStore((s) => s.isLoaded);
  const ensureDecisionTypesLoaded = useDecisionTypesStore((s) => s.ensureLoaded);

  const decisionTypes = useMemo(
    () => allDecisionTypes.filter((t) => t.isActive !== false),
    [allDecisionTypes]
  );
  const loadingTypes = isDecisionTypesLoading && !isDecisionTypesLoaded;

  useEffect(() => {
    ensureDecisionTypesLoaded().catch(() => {});
  }, [ensureDecisionTypesLoaded]);

  const handleSubmit = async () => {
    if (!mode) return;
    if (mode === "ЗА" && !decisionTypeCode) {
      setError("Выберите вид взыскания");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await commissionApi.castStage2Vote(commissionId, {
        vote: mode,
        decisionTypeCode: mode === "ЗА" ? decisionTypeCode : undefined,
        comment: comment.trim() || undefined,
      });
      onVoted();
    } catch (err: any) {
      console.error("Ошибка голосования:", err);
      setError(getErrorMessage(err, "Не удалось учесть голос"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-5 border-t border-bd">
      <div className="max-w-[640px] flex flex-col gap-3">
        <div>
          <div className="text-[14px] font-semibold text-tx mb-1">{initial ? "Изменение голоса" : "Ваш голос"}</div>
          <div className="text-[14px] text-tx">Выберите вид взыскания или проголосуйте против</div>
        </div>

        {error && <div className="text-[13px] text-dgt">{error}</div>}

        <VoteChoiceGroup<CommissionVoteType>
          options={STAGE2_CHOICE_OPTIONS}
          value={mode}
          onChange={setMode}
          ariaLabel="Ваш голос: вид взыскания"
        />

        {mode === "ЗА" &&
          (loadingTypes ? (
            <div className="text-[13px] text-tx2">Загрузка справочника...</div>
          ) : (
            <select
              className="border border-bd rounded-inp px-3 py-2 text-[14px] bg-bg outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
              value={decisionTypeCode}
              onChange={(e) => setDecisionTypeCode(e.target.value)}
            >
              <option value="">Выберите вид взыскания...</option>
              {decisionTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {getDecisionTypeLabel(t.code, t.name)}
                </option>
              ))}
            </select>
          ))}

        <div className="flex flex-col gap-1">
          <label htmlFor="stage2-comment" className="text-[12px] text-tx2">
            Комментарий
          </label>
          <input
            id="stage2-comment"
            className="border border-bd rounded-inp px-3 py-2 text-[14px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
            placeholder="Необязательно"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50"
            disabled={!mode || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Голосование..." : initial ? "Сохранить голос" : "Проголосовать"}
          </button>
          {onCancel && (
            <button
              type="button"
              className="px-4 py-2 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors disabled:opacity-50"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Отмена
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddMemberModal({
  commissionId,
  existingUids,
  onClose,
  onAdded,
}: {
  commissionId: string;
  existingUids: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (employee: EmployeeResponse) => {
    if (!employee.uid) return;
    setIsSaving(true);
    setError(null);
    try {
      await commissionApi.addMember(commissionId, { employeeUid: employee.uid });
      onAdded();
      onClose();
    } catch (err: any) {
      console.error("Ошибка добавления участника комиссии:", err);
      setError(getErrorMessage(err, "Не удалось добавить участника"));
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[18px] font-bold text-tx">Добавить участника</h3>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="text-[13px] text-tx2">Новый участник добавляется в состав как рядовой член комиссии.</div>
          {error && <div className="text-[13px] text-dgl">{error}</div>}
          <MemberPicker onPick={handlePick} excludedUids={existingUids} />
          {isSaving && <div className="text-[13px] text-tx2">Добавление...</div>}
        </div>
      </div>
    </div>
  );
}

function TransferChairmanshipModal({
  commission,
  onClose,
  onTransferred,
}: {
  commission: CommissionResponse;
  onClose: () => void;
  onTransferred: () => void;
}) {
  const candidates = useMemo(
    () => (commission.members || []).filter((m) => m.roles?.includes("ЧЛЕН") && !m.roles?.includes("ПРЕДСЕДАТЕЛЬ")),
    [commission.members]
  );
  const [selected, setSelected] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !commission.id) return;
    setIsSaving(true);
    setError(null);
    try {
      await commissionApi.transferChairmanship(commission.id, { newChairEmployeeUid: selected });
      onTransferred();
      onClose();
    } catch (err: any) {
      console.error("Ошибка передачи председательства:", err);
      setError(getErrorMessage(err, "Не удалось передать председательство"));
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[18px] font-bold text-tx">Передать председательство</h3>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="text-[13px] text-tx2">
            Вы потеряете роль председателя (останетесь рядовым членом комиссии), выбранный участник её получит.
          </div>
          {candidates.length === 0 ? (
            <div className="text-[13px] text-tx2">В комиссии нет других участников, которым можно передать председательство.</div>
          ) : (
            <select
              required
              className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] bg-bg outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Выберите участника...</option>
              {candidates.map((m) => (
                <option key={m.id} value={m.employeeUid}>{m.fullName || m.employeeUid}</option>
              ))}
            </select>
          )}
          {error && <div className="text-[13px] text-dgl">{error}</div>}
          <div className="flex gap-3 mt-2 pt-4 border-t border-bd">
            <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors disabled:opacity-50">
              Отмена
            </button>
            <button type="submit" disabled={isSaving || !selected} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50">
              {isSaving ? "Передача..." : "Передать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UpdateDeadlineModal({
  commission,
  onClose,
  onUpdated,
}: {
  commission: CommissionResponse;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { timezone } = useTimezoneStore();
  const toInputValue = (iso?: string | null) => {
    const parsed = parseServerDateTime(iso);
    return parsed ? instantToLocalDateTimeInputValue(parsed, timezone) : "";
  };
  const [stage1Value, setStage1Value] = useState(() => toInputValue(commission.stage1VotingDeadline));
  const [stage2Value, setStage2Value] = useState(() => toInputValue(commission.stage2VotingDeadline));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stage1Value || !stage2Value || !commission.id) return;
    const stage1Server = localDateTimeInputToServerString(stage1Value, timezone);
    const stage2Server = localDateTimeInputToServerString(stage2Value, timezone);
    const stage1Ms = parseServerDateTime(stage1Server)?.getTime() ?? 0;
    const stage2Ms = parseServerDateTime(stage2Server)?.getTime() ?? 0;
    if (stage1Ms <= Date.now() || stage2Ms <= Date.now()) {
      setError("Оба срока должны быть в будущем");
      return;
    }
    if (stage1Ms >= stage2Ms) {
      setError("Срок 2-го этапа должен быть строго позже срока 1-го этапа");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await commissionApi.updateVotingDeadline(commission.id, {
        stage1VotingDeadline: stage1Server,
        stage2VotingDeadline: stage2Server,
      });
      onUpdated();
      onClose();
    } catch (err: any) {
      console.error("Ошибка изменения срока голосования:", err);
      setError(getErrorMessage(err, "Не удалось изменить срок голосования"));
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[18px] font-bold text-tx">Изменить сроки голосования</h3>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-[12px] font-medium text-tx2 mb-1">Срок 1-го этапа</label>
            <input
              required
              type="datetime-local"
              className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
              value={stage1Value}
              onChange={(e) => setStage1Value(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-tx2 mb-1">Срок 2-го этапа</label>
            <input
              required
              type="datetime-local"
              className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
              value={stage2Value}
              onChange={(e) => setStage2Value(e.target.value)}
            />
          </div>
          <div className="text-[12px] text-tx2">
            Время указывается в часовом поясе {timezone}. Оба срока обязательны и должны быть в будущем, даже если один из этапов уже завершён.
          </div>
          {error && <div className="text-[13px] text-dgl">{error}</div>}
          <div className="flex gap-3 mt-2 pt-4 border-t border-bd">
            <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors disabled:opacity-50">
              Отмена
            </button>
            <button type="submit" disabled={isSaving || !stage1Value || !stage2Value} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50">
              {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MeetingModal({
  commission,
  onClose,
  onSaved,
}: {
  commission: CommissionResponse;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { timezone } = useTimezoneStore();
  const existing = parseServerDateTime(commission.meetingAt);
  const [whenValue, setWhenValue] = useState(() =>
    existing ? instantToLocalDateTimeInputValue(existing, timezone) : ""
  );
  const [location, setLocation] = useState(commission.meetingLocation || "");
  const [link, setLink] = useState(commission.meetingLink || "");
  const [guests, setGuests] = useState<{ uid: string; name: string; position?: string }[]>(() =>
    (commission.meetingGuests || [])
      .filter((g) => g.employeeUid)
      .map((g) => ({ uid: g.employeeUid!, name: g.fullName || "Сотрудник", position: g.position || undefined }))
  );
  const excludedUids = useMemo(
    () => new Set([...(commission.members || []).map((m) => m.employeeUid || ""), ...guests.map((g) => g.uid)]),
    [commission.members, guests]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!commission.id || !whenValue || !link.trim()) return;
    const serverValue = localDateTimeInputToServerString(whenValue, timezone);
    const timeChanged = parseServerDateTime(serverValue)?.getTime() !== existing?.getTime();
    if (timeChanged && (parseServerDateTime(serverValue)?.getTime() ?? 0) <= Date.now()) {
      setError("Время заседания должно быть в будущем");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await commissionApi.setMeeting(commission.id, { meetingAt: serverValue,
        meetingLocation: location.trim() || null,
        meetingLink: link.trim(),
        meetingGuestUids: guests.map((g) => g.uid),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Ошибка сохранения заседания:", err);
      setError(getErrorMessage(err, "Не удалось сохранить заседание"));
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-bg rounded-lg border border-bd w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bd">
          <h3 className="text-[18px] font-bold text-tx">{commission.meetingAt ? "Изменить заседание" : "Назначить заседание"}</h3>
          <button onClick={onClose} className="text-tx2 hover:text-tx transition-colors" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-[12px] font-medium text-tx2 mb-1">Дата и время</label>
            <input
              required
              type="datetime-local"
              className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
              value={whenValue}
              onChange={(e) => setWhenValue(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-tx2 mb-1">Кабинет <span className="font-normal">(необязательно)</span></label>
            <input
              type="text"
              maxLength={512}
              placeholder="Например, кабинет 305"
              className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-tx2 mb-1">Ссылка на комнату в чате</label>
            <input
              required
              type="url"
              maxLength={512}
              placeholder="https://…"
              className="w-full min-h-[40px] border border-bd rounded-inp px-3 py-2 text-[14px] outline-none focus:border-pr focus:ring-3 focus:ring-pr/10"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            {!link.trim() && <div className="mt-1 text-[12px] text-dgl">Укажите ссылку — без неё заседание сохранить нельзя</div>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-tx2 mb-1">Приглашённые <span className="font-normal">(необязательно)</span></label>
            {guests.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {guests.map((g) => (
                  <div key={g.uid} className="flex items-center justify-between gap-2 border border-bd rounded-inp px-3 py-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar avatarUrl={userApi.employeeAvatarUrl(g.uid)} name={g.name} size={32} />
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-tx truncate">{g.name}</div>
                        {g.position && <div className="text-[12px] text-tx2 truncate">{g.position}</div>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuests((prev) => prev.filter((x) => x.uid !== g.uid))}
                      className="shrink-0 text-[13px] font-medium text-dgl hover:text-dgt transition-colors"
                    >
                      Убрать
                    </button>
                  </div>
                ))}
              </div>
            )}
            <MemberPicker
              excludedUids={excludedUids}
              onPick={(e) =>
                e.uid && setGuests((prev) => [...prev, { uid: e.uid!, name: e.fullName || "Сотрудник", position: e.position }])
              }
            />
            <div className="mt-1 text-[12px] text-tx2">Сотрудники из системы, не участники комиссии. Каждый получит уведомление о приглашении.</div>
          </div>
          <div className="text-[12px] text-tx2">
            Время указывается в часовом поясе {timezone}. Заседание увидят все участники комиссии.
          </div>
          {error && <div className="text-[13px] text-dgl">{error}</div>}
          <div className="flex gap-3 mt-2 pt-4 border-t border-bd">
            <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-bg text-tx border border-bd hover:bg-surf transition-colors disabled:opacity-50">
              Отмена
            </button>
            <button type="submit" disabled={isSaving || !whenValue || !link.trim()} className="flex-1 px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors disabled:opacity-50">
              {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MeetingLocation({ value }: { value: string }) {
  if (/^https?:\/\/\S+$/i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-prl hover:text-prt underline break-all">
        {value}
      </a>
    );
  }
  return <span className="break-words">{value}</span>;
}

function MeetingBanner({
  commission,
  canEdit,
  onEdit,
  onRemove,
  isRemoving,
}: {
  commission: CommissionResponse;
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const { timezone } = useTimezoneStore();
  const hasMeeting = Boolean(commission.meetingAt);
  if (!hasMeeting && !canEdit) return null;

  return (
    <div className={`rounded-card border p-4 flex flex-wrap items-start justify-between gap-3 ${hasMeeting ? "bg-okbg/40 border-ok/20" : "bg-ntbg border-bd"}`}>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-tx2 mb-1">Заседание комиссии</div>
        {hasMeeting ? (
          <div className="text-[14px] leading-[20px] text-tx">
            <div className="font-semibold">{formatServerDateTime(commission.meetingAt, timezone)}</div>
            {commission.meetingLocation && (
              <div className="mt-0.5"><span className="text-tx2">Кабинет: </span><MeetingLocation value={commission.meetingLocation} /></div>
            )}
            {commission.meetingLink && (
              <div className="mt-0.5"><span className="text-tx2">Комната в чате: </span><MeetingLocation value={commission.meetingLink} /></div>
            )}
            {(commission.meetingGuests?.length ?? 0) > 0 && (
              <div className="mt-2">
                <div className="text-[12px] text-tx2 mb-1">{commission.meetingGuests!.length > 1 ? "Приглашены" : "Приглашён"}</div>
                <div className="flex flex-col gap-1.5">
                  {commission.meetingGuests!.map((g) => (
                    <div key={g.employeeUid} className="flex items-center gap-2.5">
                      <Avatar avatarUrl={g.employeeUid ? userApi.employeeAvatarUrl(g.employeeUid) : null} name={g.fullName || "?"} size={28} />
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-tx truncate">
                          <EmployeeLink employeeUid={g.employeeUid}>{g.fullName || g.employeeUid}</EmployeeLink>
                        </div>
                        {g.position && <div className="text-[12px] text-tx2 truncate">{g.position}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[14px] text-tx2">Заседание не назначено</div>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={onEdit} className="text-[13px] font-medium text-prl hover:text-prt transition-colors">
            {hasMeeting ? "Изменить" : "Назначить заседание"}
          </button>
          {hasMeeting && (
            <button type="button" onClick={onRemove} disabled={isRemoving} className="text-[13px] font-medium text-dgl hover:text-dgt transition-colors disabled:opacity-50">
              {isRemoving ? "Удаление..." : "Убрать"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CommissionSection({
  commission,
  onChanged,
}: {
  commission: CommissionResponse;
  onChanged: () => void;
}) {
  const { hasPermission, context } = useAuthStore();
  const { timezone } = useTimezoneStore();
  const currentMember = commission.members?.find((m) => m.employeeUid === context?.employeeUid);
  const canVote =
    hasPermission("commission:vote") && Boolean(currentMember?.roles?.includes("ЧЛЕН")) && currentMember?.isActive !== false;
  const isChair = Boolean(currentMember?.roles?.includes("ПРЕДСЕДАТЕЛЬ"));
  const isSecretary = Boolean(currentMember?.roles?.includes("СЕКРЕТАРЬ"));
  const canClose = hasPermission("commission:close") && isChair;
  const canManage = hasPermission("commission:manage") && (isChair || isSecretary);
  const canEditMeeting = hasPermission("commission:manage") && (isChair || isSecretary);
  const [isClosing, setIsClosing] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isChangingDeadline, setIsChangingDeadline] = useState(false);
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [isRemovingMeeting, setIsRemovingMeeting] = useState(false);

  const [now] = useState(() => new Date());
  const open = isCommissionOpen(commission.status);
  const stage = commission.status === "ПЕРВЫЙ_ЭТАП" ? 1 : commission.status === "ВТОРОЙ_ЭТАП" ? 2 : null;
  const currentStageDeadline = getCurrentStageVotingDeadline(commission);
  const deadlinePassed = Boolean(
    currentStageDeadline && (parseServerDateTime(currentStageDeadline)?.getTime() ?? Infinity) < now.getTime()
  );

  const existingMemberUids = useMemo(
    () => new Set((commission.members || []).map((m) => m.employeeUid).filter((uid): uid is string => Boolean(uid))),
    [commission.members]
  );

  const handleCloseEarly = async () => {
    if (!commission.id) return;
    if (!(await showConfirm("Закрыть текущий этап досрочно и подвести итоги по уже поданным голосам?", { title: "Закрытие этапа", confirmLabel: "Закрыть этап" }))) return;
    setIsClosing(true);
    try {
      await commissionApi.closeCurrentStageEarly(commission.id);
      onChanged();
    } catch (err: any) {
      console.error("Ошибка закрытия этапа комиссии:", err);
      showAlert(getErrorMessage(err, "Не удалось закрыть этап. Закрывать этап вправе только председатель."));
    } finally {
      setIsClosing(false);
    }
  };

  const handleCloseCommission = async () => {
    if (!commission.id) return;
    if (!(await showConfirm(
      "Закрыть комиссию полностью досрочно? В отличие от закрытия этапа, голоса не будут подводиться — комиссия завершится без решения.", { title: "Закрытие комиссии", confirmLabel: "Закрыть комиссию", danger: true }))) return;
    setIsClosing(true);
    try {
      await commissionApi.closeCommissionEarly(commission.id);
      onChanged();
    } catch (err: any) {
      console.error("Ошибка закрытия комиссии:", err);
      showAlert(getErrorMessage(err, "Не удалось закрыть комиссию. Закрывать комиссию вправе только председатель."));
    } finally {
      setIsClosing(false);
    }
  };

  const handleRemoveMeeting = async () => {
    if (!commission.id) return;
    if (!(await showConfirm("Убрать заседание? Участники перестанут его видеть.", { title: "Удаление заседания", confirmLabel: "Убрать", danger: true }))) return;
    setIsRemovingMeeting(true);
    try {
      await commissionApi.clearMeeting(commission.id);
      onChanged();
    } catch (err: any) {
      console.error("Ошибка удаления заседания:", err);
      showAlert(getErrorMessage(err, "Не удалось убрать заседание"));
    } finally {
      setIsRemovingMeeting(false);
    }
  };

  const handleRemoveMember = async (member: CommissionMemberResponse) => {
    if (!commission.id || !member.id) return;
    if (!(await showConfirm(`Удалить ${member.fullName || "участника"} из состава комиссии?`, { title: "Удаление участника", confirmLabel: "Удалить", danger: true }))) return;
    setRemovingMemberId(member.id);
    try {
      await commissionApi.removeMember(commission.id, member.id);
      onChanged();
    } catch (err: any) {
      console.error("Ошибка удаления участника комиссии:", err);
      showAlert(getErrorMessage(err, "Не удалось удалить участника"));
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[12px] text-tx2 mb-1">Комиссия №{commission.iterationNumber}</div>
          <h2 className="text-[20px] sm:text-[22px] leading-[28px] font-semibold text-tx">
            {getCommissionMainQuestion(commission.status)}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[13px] text-tx2">
            {stage && <span>Этап {stage} из 2</span>}
            <span>{capitalize(getVotingRuleLabel(commission.votingRule))}</span>
            <span>Кворум {commission.quorumMin ?? "—"} чел.</span>
            {open &&
              (deadlinePassed ? (
                <span className="text-dgt font-medium">Срок {stage}-го этапа истёк</span>
              ) : (
                currentStageDeadline && <span>До {formatServerDateTime(currentStageDeadline, timezone)}</span>
              ))}
            {open && stage === 1 && commission.stage2VotingDeadline && (
              <span className="text-tx2">Этап 2: до {formatServerDateTime(commission.stage2VotingDeadline, timezone)}</span>
            )}
            {!open && <span>Назначена {formatServerDateTime(commission.createdAt, timezone)}</span>}
            {commission.closedAt && <span>Закрыта {formatServerDateTime(commission.closedAt, timezone)}</span>}
          </div>
          {commission.reason && <div className="text-[13px] text-tx2 mt-1.5">{commission.reason}</div>}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${getCommissionStatusTextClass(commission.status)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${getCommissionStatusDotClass(commission.status)}`} />
            {getCommissionStatusShortLabel(commission.status)}
          </span>
          {open && (canClose || canManage) && (
            <ActionsMenu
              trigger={<span className="inline-flex items-center gap-1 text-[13px] font-medium text-tx2 hover:text-tx transition-colors">Управление<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></span>}
              triggerClassName="cursor-pointer disabled:opacity-50"
              ariaLabel="Управление комиссией"
            >
              {canManage && (
                <ActionsMenuItem onClick={() => setIsAddingMember(true)}>Добавить участника</ActionsMenuItem>
              )}
              {canManage && isChair && (
                <ActionsMenuItem onClick={() => setIsTransferring(true)}>Передать председательство</ActionsMenuItem>
              )}
              {canManage && isSecretary && (
                <ActionsMenuItem onClick={() => setIsChangingDeadline(true)}>Изменить сроки голосования</ActionsMenuItem>
              )}
              {canClose && (
                <>
                  <div className="h-px bg-bd my-1" />
                  <ActionsMenuItem onClick={handleCloseEarly} disabled={isClosing}>Закрыть этап досрочно</ActionsMenuItem>
                  <ActionsMenuItem onClick={handleCloseCommission} disabled={isClosing} danger>Закрыть комиссию досрочно</ActionsMenuItem>
                </>
              )}
            </ActionsMenu>
          )}
        </div>
      </div>

      {open && (
        <MeetingBanner
          commission={commission}
          canEdit={canEditMeeting}
          onEdit={() => setIsEditingMeeting(true)}
          onRemove={handleRemoveMeeting}
          isRemoving={isRemovingMeeting}
        />
      )}

      <div>
        <div className="text-[14px] font-semibold text-tx mb-2">Участники комиссии</div>
        <MembersTable
          commission={commission}
          currentEmployeeUid={context?.employeeUid}
          canManageMembers={open && isChair}
          onRemoveMember={handleRemoveMember}
          removingMemberId={removingMemberId}
        />
      </div>

      {commission.decision && <DecisionSummary commission={commission} />}

      {open && !deadlinePassed && canVote && stage && commission.id && (
        <VotingSection
          key={stage}
          commissionId={commission.id}
          stage={stage}
          myVote={currentMember ? voteForStage(currentMember, stage) : null}
          onVoted={onChanged}
        />
      )}

      {isAddingMember && commission.id && (
        <AddMemberModal
          commissionId={commission.id}
          existingUids={existingMemberUids}
          onClose={() => setIsAddingMember(false)}
          onAdded={onChanged}
        />
      )}
      {isTransferring && (
        <TransferChairmanshipModal
          commission={commission}
          onClose={() => setIsTransferring(false)}
          onTransferred={onChanged}
        />
      )}
      {isEditingMeeting && (
        <MeetingModal
          commission={commission}
          onClose={() => setIsEditingMeeting(false)}
          onSaved={onChanged}
        />
      )}
      {isChangingDeadline && (
        <UpdateDeadlineModal
          commission={commission}
          onClose={() => setIsChangingDeadline(false)}
          onUpdated={onChanged}
        />
      )}
    </div>
  );
}

function HistoryItem({ commission }: { commission: CommissionResponse }) {
  const [expanded, setExpanded] = useState(false);
  const { timezone } = useTimezoneStore();
  const dateLabel = formatServerDateTime(commission.closedAt || commission.createdAt, timezone);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex flex-col gap-0.5 py-3 px-3 -mx-3 text-left rounded-inp hover:bg-surf transition-colors"
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] font-medium text-tx">Комиссия №{commission.iterationNumber}</span>
          <span className={`text-[13px] font-medium shrink-0 ${getCommissionStatusTextClass(commission.status)}`}>
            {getCommissionStatusShortLabel(commission.status)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[12px] text-tx2 truncate min-w-0">
            {dateLabel}
            {commission.decision?.noDecisionReason && ` · ${commission.decision.noDecisionReason}`}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-tx2 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M6 3l5 5-5 5" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="pb-4 px-3 flex flex-col gap-4">
          <MembersTable commission={commission} />
          {commission.decision && <DecisionSummary commission={commission} />}
        </div>
      )}
    </div>
  );
}

export interface DecisionActCaseContext {
  caseNumber?: string;
  violationTypeName?: string;
  violatorFullName?: string;
  violatorPosition?: string;
  domainName?: string;
  departmentName?: string;
  employeeUid?: string;
  incidentDateIso?: string | null;
  discoveryDateIso?: string | null;
}

interface CommissionTabProps {
  caseId: string;
  caseContext?: DecisionActCaseContext;
  caseStatus?: CaseStatus | string;
  violationTypeCode?: string;
  assignees: CaseAssigneeResponse[];
  onCaseChanged: () => void;
}

export function CommissionTab({ caseId, caseContext, caseStatus, violationTypeCode, assignees, onCaseChanged }: CommissionTabProps) {
  const { hasPermission, context } = useAuthStore();
  const { timezone } = useTimezoneStore();
  const [isGeneratingAct, setIsGeneratingAct] = useState(false);
  const requestNavBadgeRefresh = useNavBadgeStore((s) => s.requestRefresh);
  const canReadAny =
    hasPermission("commission:read:own") ||
    hasPermission("commission:read:department") ||
    hasPermission("commission:read:domain") ||
    hasPermission("commission:read:all");

  const secretaryAssignee = assignees.find((a) => a.role === "COMMISSION_SECRETARY");
  const isCurrentUserSecretary =
    Boolean(context?.employeeUid) && secretaryAssignee?.employeeUid === context?.employeeUid;
  const hasCreatePermission = hasPermission("commission:create");
  const canCreate = hasCreatePermission && isCurrentUserSecretary;

  const [isCreating, setIsCreating] = useState(false);
  const [noAccess, setNoAccess] = useState(false);

  const allCommissions = useAllCommissionsStore((s) => s.commissions);
  const isAllCommissionsLoading = useAllCommissionsStore((s) => s.isLoading);
  const isAllCommissionsLoaded = useAllCommissionsStore((s) => s.isLoaded);
  const ensureAllCommissionsLoaded = useAllCommissionsStore((s) => s.ensureLoaded);
  const refreshAllCommissions = useAllCommissionsStore((s) => s.refresh);

  useEffect(() => {
    if (!canReadAny) {
      setNoAccess(true);
      return;
    }
    setNoAccess(false);
    ensureAllCommissionsLoaded().catch(() => setNoAccess(true));
  }, [canReadAny, ensureAllCommissionsLoaded]);

  const commissions = useMemo(
    () =>
      allCommissions
        .filter((c) => c.caseId === caseId)
        .sort((a, b) => (b.iterationNumber ?? 0) - (a.iterationNumber ?? 0)),
    [allCommissions, caseId]
  );

  const loading = isAllCommissionsLoading && !isAllCommissionsLoaded;

  const handleChanged = () => {
    refreshAllCommissions();
    onCaseChanged();
    requestNavBadgeRefresh();
  };

  const activeCommission = commissions.find((c) => isCommissionOpen(c.status));
  const historyCommissions = commissions.filter((c) => c !== activeCommission);
  const hasSecretary = Boolean(secretaryAssignee);

  const caseAllowsCreation =
    Boolean(caseStatus) &&
    caseStatus !== "НОВОЕ" &&
    caseStatus !== "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ" &&
    caseStatus !== "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ" &&
    !isCaseLocked(caseStatus);

  const decidedCommission = commissions.find((c) => c.status === "ЗАВЕРШЕНО");
  const isChairOfDecidedCommission = Boolean(
    context?.employeeUid &&
      decidedCommission?.members?.some(
        (m) => m.employeeUid === context.employeeUid && m.roles?.includes("ПРЕДСЕДАТЕЛЬ")
      )
  );
  const canGenerateDecisionAct =
    caseStatus === "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ" && isChairOfDecidedCommission && hasPermission("document:generate");

  const canCreateNow = canCreate && caseAllowsCreation && !activeCommission;

  let blockedReason: string | null = null;
  if (!canCreateNow && !activeCommission) {
    if (!hasSecretary) {
      blockedReason = "Сначала назначьте секретаря комиссии (роль «Секретарь комиссии») во вкладке «Участники дела».";
    } else if (!isCurrentUserSecretary) {
      blockedReason = "Назначить комиссию может только секретарь, указанный во вкладке «Участники дела».";
    } else if (!hasCreatePermission) {
      blockedReason = "У вашей учётной записи нет прав на назначение комиссии — обратитесь к администратору.";
    } else if (!caseAllowsCreation) {
      blockedReason = isCaseLocked(caseStatus)
        ? "Дело уже завершено — назначить новую комиссию нельзя."
        : caseStatus === "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ"
          ? "Комиссия вынесла решение — дело ожидает акта о решении, новую комиссию назначить нельзя."
          : "Комиссию можно назначить после того, как сотрудник предоставит объяснение.";
    }
  }

  if (loading) {
    return <div className="text-[14px] text-tx2 py-2">Загрузка данных о комиссии...</div>;
  }

  if (noAccess) {
    return <div className="text-[14px] text-tx2 py-2">У вас нет прав на просмотр комиссий по этому делу.</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {canCreateNow && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[15px] font-medium text-tx">
              {commissions.length === 0 ? "Комиссия ещё не назначена" : "Комиссию можно назначить повторно"}
            </div>
            <div className="text-[13px] text-tx2 mt-0.5">Вы назначены секретарём комиссии по этому делу.</div>
          </div>
          <button
            type="button"
            className="px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors shrink-0"
            onClick={() => setIsCreating(true)}
          >
            {commissions.length === 0 ? "Назначить комиссию" : "Назначить новую комиссию"}
          </button>
        </div>
      )}

      {caseStatus === "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ" && decidedCommission && (
        <div className="rounded-card border border-wn/30 bg-wnbg/40 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-tx">Комиссия вынесла решение</div>
            <div className="text-[13px] text-tx2 mt-0.5">
              {canGenerateDecisionAct
                ? "Сформируйте акт о решении комиссии — после этого дело перейдёт в статус «Решение принято»."
                : "Ожидается, что председатель комиссии сформирует акт о решении."}
            </div>
          </div>
          {canGenerateDecisionAct && (
            <button
              type="button"
              className="px-4 py-2.5 rounded-inp font-medium text-[14px] bg-pr text-white hover:bg-prh transition-colors shrink-0"
              onClick={() => setIsGeneratingAct(true)}
            >
              Сформировать акт о решении
            </button>
          )}
        </div>
      )}

      {!activeCommission && blockedReason && <div className="text-[14px] text-tx2">{blockedReason}</div>}

      {activeCommission && <CommissionSection commission={activeCommission} onChanged={handleChanged} />}

      {historyCommissions.length > 0 && (
        <div className={activeCommission ? "pt-6 border-t border-bd" : undefined}>
          <div className="text-[14px] font-semibold text-tx mb-2">История рассмотрений</div>
          <div className="divide-y divide-bd">
            {historyCommissions.map((c) => (
              <HistoryItem key={c.id} commission={c} />
            ))}
          </div>
        </div>
      )}

      {isGeneratingAct && decidedCommission && (
        <GenerateDocumentModal
          caseId={caseId}
          caseNumber={caseContext?.caseNumber}
          violationTypeCode={violationTypeCode || ""}
          violationTypeName={caseContext?.violationTypeName}
          violatorFullName={caseContext?.violatorFullName}
          violatorPosition={caseContext?.violatorPosition}
          generatorFullName={context?.fullName}
          generatorPosition={context?.position}
          domainName={caseContext?.domainName}
          departmentName={caseContext?.departmentName}
          employeeUid={caseContext?.employeeUid}
          incidentDateIso={caseContext?.incidentDateIso}
          discoveryDateIso={caseContext?.discoveryDateIso}
          protocolNumber={decidedCommission.decision?.protocolNumber}
          commission={decidedCommission}
          timezone={timezone}
          decisionActMode
          title="Формирование акта о решении комиссии"
          onGenerated={handleChanged}
          onClose={() => setIsGeneratingAct(false)}
        />
      )}

      {isCreating && (
        <CreateCommissionModal
          caseId={caseId}
          violationTypeCode={violationTypeCode}
          caseAssignees={assignees}
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            handleChanged();
          }}
        />
      )}
    </div>
  );
}
