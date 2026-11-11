

export interface Pageable {
  page?: number;
  size?: number;
  sort?: string[];
}

export interface SortObject {
  empty?: boolean;
  sorted?: boolean;
  unsorted?: boolean;
}

export interface PageableObject {
  offset?: number;
  paged?: boolean;
  pageNumber?: number;
  pageSize?: number;
  sort?: SortObject;
  unpaged?: boolean;
}

export interface Page<T = unknown> {
  totalElements?: number;
  totalPages?: number;
  size?: number;
  content?: T[];
  number?: number;
  pageable?: PageableObject;
  sort?: SortObject;
  numberOfElements?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
}

export type UserStatus = "ACTIVE" | "BLOCKED";
export type AuthProvider = "SSO" | "LDAP" | "LOCAL" | "OAUTH";

export interface LoginRequest {
  username?: string;
  password?: string;
}

export interface AuthResponse {
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface UserRolesResponse {
  roles?: string[];
  scopeDepartmentId?: string;
  scopeDomainId?: string;
}

export interface UserRolesFullResponse {
  roles?: RoleFullResponse[];
  scopeDepartmentId?: string;
  scopeDomainId?: string;
}

export interface RoleFullResponse {
  code: string;
  name: string;
}

export interface CaseStatsResponse {
  total: number,
  overdue: number,
  expiringSoon: number,
  awaitingCommission: number,
  active: number,
  actionRequired: number,
}

export interface UserResponse {
  id?: string;
  username?: string;
  fullName?: string;
  position?: string;
  employeeUid?: string;
  avatarUrl?: string;
  timezone?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: UserStatus;
  activeRoles?: UserRolesResponse[];
  authProvider?: AuthProvider;
}

export interface UserFullResponse {
  id?: string;
  username?: string;
  fullName?: string;
  position?: string;
  employeeUid?: string;
  avatarUrl?: string;
  timezone?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: UserStatus;
  activeRoles?: UserRolesFullResponse[];
  authProvider?: AuthProvider;
}

export interface UpdateUserRolesRequest {
  roles?: string[];
  scopeDomainId?: string;
  scopeDepartmentId?: string;
  reason?: string;
}

export interface UpdateUserRolesInner {
  assignments?: UpdateUserRolesRequest[];
  reason?: string;
}

export interface UpdateRoleRequest {
  name: string;
  description?: string | null;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  isSystem: boolean;
  permissions?: string[];
}

export interface PermissionResponse {
  id?: string;
  code?: string;
  name?: string;
  resource?: string;
  action?: string;
  description?: string;
  isSystem?: boolean;
}

export interface RoleShortResponse {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  isSystem?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleResponse {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  isSystem?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  permissions?: PermissionResponse[];
}

export interface RolePermissionResponse {
  roleId?: string;
  roleCode?: string;
  permissions?: string[];
}

export interface PermissionsEditRequest {
  permissions: string[];
}

export type PageUserResponse = Page<UserResponse>;

export type ModuleAccessLevel = "READ" | "WRITE";

export interface ModuleResponse {
  id?: string;
  code?: string;
  name?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModulePermissionEntry {
  id?: { moduleId?: string; permissionId?: string };
  module?: ModuleResponse;
  permission?: PermissionResponse;
  accessLevel?: ModuleAccessLevel;
}

export interface ModulePermissionRequest {
  permissionCode: string;
  accessLevel: ModuleAccessLevel;
}

export interface EmployeeResponse {
  uid?: string;
  tabNumber?: string;
  position?: string;
  departmentId?: string;
  isActive?: boolean;
  fullName?: string;
  syncedAt?: string;
  email?: string;
  domainId?: string;
  hrBpUid?: string;
}

export type PageEmployeeResponse = Page<EmployeeResponse>;

export type CaseStatus =
  | "НОВОЕ"
  | "ЗАПРОШЕНО_ОБЪЯСНЕНИЕ"
  | "ОБЪЯСНЕНИЕ_НЕ_ПОЛУЧЕНО"
  | "ОБЪЯСНЕНИЕ_ПОЛУЧЕНО"
  | "КОМИССИОННОЕ_РАССМОТРЕНИЕ"
  | "ОЖИДАЕТСЯ_АКТ_О_РЕШЕНИИ"
  | "РЕШЕНИЕ_ПРИНЯТО"
  | "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ"
  | "ИСПОЛНЕНО";

export type CaseAssigneeRole =
  | "VIOLATOR"
  | "INITIATOR"
  | "MEMBER"
  | "COMMISSION_SECRETARY"
  | "LAWYER"
  | "DEPARTMENT_HEAD";

export type CaseTimerType =
  | "EXPLANATION_DEADLINE"
  | "DISCIPLINARY_ACTION_FROM_DISCOVERY_DEADLINE"
  | "DISCIPLINARY_ACTION_FROM_VIOLATION_DEADLINE"
  | "AUDIT_DISCIPLINARY_ACTION_DEADLINE"
  | "ORDER_ACKNOWLEDGEMENT_DEADLINE"
  | "CUSTOM_DEADLINE";

export interface CreateCaseRequest {
  employeeUid: string;
  violationTypeCode: string;
  departmentId: string;
  domainId: string;
  incidentDate: string;
  discoveryDate: string;
  orderId1C?: string;
}
export type AccessLevel = 'READ' | 'WRITE';

export interface ModuleAccess {
  code: string;
  accessLevel: AccessLevel;
}

export interface UserContextResponse {
  id: string;
  employeeUid?: string;
  username: string;
  fullName: string;
  position?: string;
  avatarUrl?: string;
  roles: string[];
  permissions: string[];
  modules: ModuleAccess[];
}
export interface CaseAssigneeResponse {
  id?: string;
  caseId?: string;
  employeeUid?: string;
  role?: CaseAssigneeRole;
  position?: string;
  assignedAt?: string;
  assignedBy?: string;
  fullName?: string;
}

export interface CaseTimerResponse {
  id?: string;
  caseId?: string;
  timerType?: CaseTimerType;
  isInterrupting?: boolean;
  fireAt?: string;
  firedAt?: string;
  actionTaken?: string;
}

export interface CaseLogResponse {
  id?: string;
  oldStatus?: CaseStatus;
  newStatus?: CaseStatus;
  updatedBy?: string;
  updatedAt?: string;
}

export interface FullCaseResponse {
  id?: string;
  caseNumber?: string;
  employeeUid?: string;
  violationTypeCode?: string;
  violationTypeName?: string;
  departmentId?: string;
  domainId?: string;
  incidentDate?: string;
  discoveryDate?: string;
  status?: CaseStatus;
  decisionTypeName?: string | null;
  export1cStatus?: Export1cStatus | null;
  orderId1C?: string;
  createdAt?: string;
  activeCommissionId?: string;
  createdBy?: string;
  createdByName?: string;
  snapshotFullName?: string;
  snapshotTabNumber?: string;
  snapshotPosition?: string;
  snapshotDepartment?: string;
  snapshotDomain?: string;
  timers?: CaseTimerResponse[];
  assignees?: CaseAssigneeResponse[];
}

export type Export1cStatus = "QUEUED" | "SENT" | "FAILED";

export interface Case1cExportResponse {
  id: string;
  status: Export1cStatus;
  failedStep?: "INTEGRATION" | "ONEC" | null;
  errorMessage?: string | null;
  documentId?: string | null;
  documentFilename?: string | null;
  requestedBy: string;
  requestedAt: string;
  completedAt?: string | null;
}

export interface CaseShortResponse {
  id?: string;
  export1cStatus?: Export1cStatus | null;
  decisionTypeName?: string | null;
  violationTypeName?: string;
  caseNumber?: string;
  isOverdue: boolean;
  nearestOverdue?: string | null;
  overdueSince?: string | null;
  incidentDate?: string;
  status?: CaseStatus;
  createdAt?: string;
  snapshotFullName?: string;
  snapshotPosition?: string;
  snapshotDepartment?: string;
  snapshotDomain?: string;
  myRoles?: CaseAssigneeRole[];
  archivedAt?: string | null;
}

export interface CaseFilterOptionsResponse {
  statuses: string[];
  departments: string[];
  violationTypes: string[];
}

export interface CasesQueryParams {
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  department?: string;
  violationType?: string;
  archived?: boolean;
  sortBy?: "caseNumber" | "fio" | "department" | "incidentDate" | "stage" | "deadline";
  sortDirection?: "asc" | "desc";
}

export interface MemberAssignmentRequest {
  employeeUid: string;
  role: CaseAssigneeRole | string;
}

export interface CreateDocumentRequest {
  file: File | Blob;
  isVisibleToEmployee?: boolean;
  documentTypeCode?: string;
}

export interface CaseDocumentResponse {
  id?: string;
  caseId?: string;
  documentTypeCode?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  downloadUrl?: string;
  uploadedByUid?: string;
  uploadedAt?: string;
  isVisibleToEmployee?: boolean;
  version?: number;
  replacedById?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByUid?: string | null;
  deletedByName?: string | null;
}

export interface UpdateDocumentVisibilityRequest {
  isVisibleToEmployee?: boolean;
  reason?: string;
}

export interface VisibilityLogResponse {
  documentId?: string;
  changedByUid?: string;
  previousVisibility?: boolean;
  newVisibility?: boolean;
  reason?: string;
  changedAt?: string;
}

export interface GiveExplanationRequest {
  explanationText: string;
}

export interface ExplanationStatusResponse {
  caseId?: string;
  caseNumber?: string;
  violationTypeName?: string;
  incidentDate?: string;
  discoveryDate?: string;
  status?: CaseStatus;
  requirementServedAt?: string;
  deadlineAt?: string;
  signerFio?: string;
  explanationText?: string;
  explanationSubmittedAt?: string;
  attachedDocuments?: CaseDocumentResponse[];
  snapshotDomain?: string;
  snapshotDepartment?: string;
  snapshotPosition?: string;
}

export type PageCaseShortResponse = Page<CaseShortResponse>;
export type PageCaseAssigneeResponse = Page<CaseAssigneeResponse>;

export type CommissionMemberRole = "ЧЛЕН" | "ПРЕДСЕДАТЕЛЬ" | "СЕКРЕТАРЬ";

export type CommissionStatus =
  | "ПЕРВЫЙ_ЭТАП"
  | "ВТОРОЙ_ЭТАП"
  | "ЗАКРЫТО_БЕЗ_ВЗЫСКАНИЯ"
  | "ЗАВЕРШЕНО"
  | "ЗАВЕРШЕНО_БЕЗ_РЕШЕНИЯ";

export type CommissionVoteType = "ЗА" | "ПРОТИВ" | "ВОЗДЕРЖАЛСЯ";

export interface CommissionMemberRequest {
  employeeUid: string;
  roles: CommissionMemberRole[];
}

export interface CreateCommissionRequest {
  caseId: string;
  commissionTypeId: string;
  members: CommissionMemberRequest[];
  stage1VotingDeadline: string;
  stage2VotingDeadline: string;
  reason?: string;
}

export interface Stage1VoteRequest {
  vote: CommissionVoteType;
  comment?: string;
}

export interface Stage2VoteRequest {
  vote: CommissionVoteType;
  decisionTypeCode?: string;
  comment?: string;
}

export interface AddCommissionMemberRequest {
  employeeUid: string;
}

export interface TransferChairmanshipRequest {
  newChairEmployeeUid: string;
}

export interface UpdateVotingDeadlineRequest {
  stage1VotingDeadline: string;
  stage2VotingDeadline: string;
}

export interface CommissionVoteResponse {
  id?: string;
  stage?: number;
  vote?: CommissionVoteType;
  decisionTypeCode?: string | null;
  decisionTypeName?: string | null;
  comment?: string | null;
  votedAt?: string;
  superseded?: boolean;
}

export interface CommissionMemberResponse {
  id?: string;
  employeeUid?: string;
  fullName?: string | null;
  position?: string | null;
  roles?: CommissionMemberRole[];
  isPresent?: boolean;
  votes?: CommissionVoteResponse[];
  isActive?: boolean;
}

export interface CommissionDecisionResponse {
  id?: string;
  finalDecisionCode?: string | null;
  finalDecisionName?: string | null;
  votesFor?: number;
  votesAgainst?: number;
  votesAbstained?: number;
  isQuorumMet?: boolean;
  protocolNumber?: string;
  decidedAt?: string;
  signedByEmployeeUid?: string;
  isActiveDecision?: boolean;
  noDecisionReason?: string | null;
}

export interface SetCommissionMeetingRequest {
  meetingAt: string;
  meetingLocation?: string | null;
  meetingLink: string;
  meetingGuestUids?: string[];
}

export interface MeetingGuestResponse {
  employeeUid?: string;
  fullName?: string | null;
  position?: string | null;
}

export interface CommissionResponse {
  id?: string;
  caseId?: string;
  status?: CommissionStatus;
  quorumMin?: number;
  votingRule?: VotingRule | string;
  stage1VotingDeadline?: string;
  stage2VotingDeadline?: string;
  meetingAt?: string | null;
  meetingLocation?: string | null;
  meetingLink?: string | null;
  meetingGuests?: MeetingGuestResponse[];
  createdAt?: string;
  closedAt?: string | null;
  iterationNumber?: number;
  reason?: string;
  commissionTypeId?: string;
  members?: CommissionMemberResponse[];
  decision?: CommissionDecisionResponse | null;
  votes?: CommissionVoteResponse[];
}

export interface MyCommissionResponse {
  commission: CommissionResponse;
  myRoles?: CommissionMemberRole[];
  caseNumber?: string | null;
  caseEmployeeFullName?: string | null;
  caseViolationTypeName?: string | null;
  caseStatus?: CaseStatus | string | null;
}

export type VotingRule =
  | "MAJORITY"
  | "QUALIFIED_MAJORITY"
  | "UNANIMOUS"
  | "CONSENSUS";

export type DecisionCategory =
  | "DISCIPLINARY"
  | "MONETARY"
  | "TERMINATION"
  | "PREVENTIVE"
  | "PERSONNEL"
  | "DEVELOPMENT";

export interface SeverityLevelResponse {
  code?: string;
  name?: string;
  weight?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ViolationTypeResponse {
  id?: string;
  code?: string;
  name?: string;
  isActive?: boolean;
  severity?: SeverityLevelResponse;
  article?: string;
  validFrom?: string;
  validTo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ViolationTypeBriefResponse {
  id?: string;
  code?: string;
  name?: string;
  isActive?: boolean;
  severity?: SeverityLevelResponse;
  article?: string;
}

export interface CreateViolationTypeRequest {
  name: string;
  severityLevelCode: string;
  article?: string;
  validTo?: string;
}

export interface EditViolationTypeRequest {
  name?: string | null;
  severityLevelCode?: string | null;
  article?: string | null;
  isActive?: boolean | null;
  validTo?: string | null;
}

export interface RequiredRoleRequest {
  roleCode: string;
  isMandatory: boolean;
  minCount?: number;
}

export interface RequiredRoleResponse {
  roleCode?: string;
  minCount?: number;
  isMandatory?: boolean;
}

export interface CreateCommissionTypeRequest {
  name: string;
  isActive: boolean;
  requiredRoles: RequiredRoleRequest[];
  triggerViolationCodes?: string[];
  triggerDepartmentIds?: string[];
  quorumMin?: number;
  votingRule?: VotingRule;
  description?: string;
  sortOrder?: number;
}

export interface CommissionTypeResponse {
  id?: string;
  code?: string;
  name?: string;
  triggerOnViolationCodes?: string[];
  triggerOnDepartments?: string[];
  quorumMin?: number;
  votingRule?: VotingRule | string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  requiredRoles?: RequiredRoleResponse[];
}

export interface EditCommissionTypeRequest {
  code?: string | null;
  name?: string | null;
  triggerViolationCodes?: string[] | null;
  triggerDepartmentIds?: string[] | null;
  quorumMin?: number | null;
  votingRule?: VotingRule | null;
  description?: string | null;
  isActive?: boolean | null;
  sortOrder?: number | null;
  requiredRoles?: RequiredRoleRequest[] | null;
}

export interface CreateDecisionTypeRequest {
  name: string;
  category: DecisionCategory;
  requiredComment: boolean;
  isActive?: boolean;
  validTo?: string;
}

export interface DecisionTypeResponse {
  id?: string;
  code?: string;
  name?: string;
  category?: DecisionCategory | string;
  requiredComment?: boolean;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
}

export interface EditDecisionTypeRequest {
  code?: string | null;
  name?: string | null;
  category?: DecisionCategory | null;
  requiredComment?: boolean | null;
  isActive?: boolean | null;
  validTo?: string | null;
}

export interface DepartmentTreeItem {
  id?: string;
  code?: string;
  name?: string;
  headEmployeeUid?: string | null;
  isActive?: boolean;
  children?: DepartmentTreeItem[];
}

export interface DomainResponse {
  id?: string;
  code?: string;
  nameFull?: string;
  nameShort?: string;
  departments?: DepartmentTreeItem[];
  organizationRef?: string;
  inn?: string;
  kpp?: string;
  emailDomain?: string;
  logoUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DomainShortResponse {
  id?: string;
  code?: string;
  nameFull?: string;
  nameShort?: string;
  organizationRef?: string;
  inn?: string;
  kpp?: string;
  emailDomain?: string;
  logoUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentBriefResponse {
  id?: string;
  code?: string;
  name?: string;
  headEmployeeUid?: string | null;
}

export type StatsDateFormat = "ГОД" | "МЕСЯЦ" | "НЕДЕЛЯ" | "ДЕНЬ";

export type ReactionSpeedGroupBy = "VIOLATION_TYPE" | "DEPARTMENT";

export interface StatPoint {
  columnName?: string;
  count?: number;
}

export interface StatResponse {
  rowName?: string;
  stats?: StatPoint[];
}

export interface DocumentPlaceholderResponse {
  key?: string;
  label?: string;
  isRequired?: boolean;
  autoFillSource?: string;
  autoFillEditable?: boolean;
  grammaticalCase?: string | null;
  autoFillParams?: string | null;
}

export interface DocumentTemplatePreviewResponse {
  placeholders?: string[];
  previewText?: string;
}

export interface DocumentTemplateResponse {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  originalFilename?: string;
  violationTypeCode?: string | null;
  isActive?: boolean;
  version?: number;
  placeholders?: DocumentPlaceholderResponse[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentPurposeTemplateResponse {
  id?: string;
  code?: string;
  name?: string;
  originalFilename?: string;
  isActive?: boolean;
}

export interface DocumentPurposeResponse {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  template?: DocumentPurposeTemplateResponse | null;
  violationTemplates?: PurposeViolationTemplateResponse[];
  updatedAt?: string;
}

export interface PurposeViolationTemplateResponse {
  violationTypeCode?: string;
  template?: DocumentPurposeTemplateResponse | null;
}

export interface TemplateFoldersResponse {
  total?: number;
  violationFolders?: { violationTypeCode?: string; count?: number }[];
}

export interface DocumentTemplateVersionResponse {
  id?: string;
  versionNumber?: number;
  originalFilename?: string;
  mimeType?: string;
  createdBy?: string;
  createdAt?: string;
  archivedAt?: string;
  downloadUrl?: string;
}

export interface PlaceholderAutoFillSetting {
  source?: string;
  editable?: boolean;
  grammaticalCase?: string | null;
  isRequired?: boolean;
  params?: AutoFillParams;
}

export interface AutoFillParams {
  nameForm?: "FULL" | "SHORT" | "LAST" | "FIRST" | "MIDDLE";
  dateFormat?:
    | "FULL"
    | "NUMERIC"
    | "DAY"
    | "MONTH_NUMBER"
    | "MONTH_NAME"
    | "MONTH_NAME_GENITIVE"
    | "YEAR"
    | "TIME"
    | "TIME_WORDS"
    | "DATETIME";
  stage?: 1 | 2;
  includePosition?: boolean;
}

export interface GenerateDocumentRequest {
  templateId: string;
  fieldValues: Record<string, string>;
  caseId?: string;
  employeeUid?: string;
  purposeCode?: string;
}

export interface GeneratedDocumentResponse {
  id?: string;
  templateId?: string;
  templateVersion?: number;
  caseId?: string;
  employeeUid?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  generatedAt?: string;
  generatedByUid?: string;
  caseDocumentId?: string;
  downloadUrl?: string;
}

export interface FieldErrorDto {
  field?: string;
  message?: string;
}

export interface ErrorResponse {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  fieldErrors?: FieldErrorDto[];
}

export type ComplaintStatus = "НОВАЯ" | "ДЕЛО_СОЗДАНО" | "ОТКЛОНЕНА";

export interface ComplaintAttachmentResponse {
  id: string;
  originalFilename: string;
  contentType?: string;
  sizeBytes: number;
  downloadUrl: string;
}

export interface ComplaintResponse {
  id: string;
  status: ComplaintStatus;
  createdAt: string;
  anonymous: boolean;
  complainantUid?: string;
  complainantName?: string;
  complainantPosition?: string;
  accusedUid: string;
  accusedName?: string;
  accusedPosition?: string;
  hrBpUid: string;
  departmentHeadUid?: string | null;
  message: string;
  attachments: ComplaintAttachmentResponse[];
  decidedAt?: string;
  decisionComment?: string;
  caseId?: string;
  caseNumber?: string;
}

export interface ComplaintSummaryResponse {
  hrBp: boolean;
  newCount: number;
}

export interface EmployeeLookupResponse {
  uid: string;
  fullName: string;
  position?: string;
}

export type NotificationType =
  | "NEW_MEETING"
  | "CASE_STATUS_UPDATED"
  | "ACTION_REQUIRED"
  | "DEADLINE_APPROACHING"
  | "DEADLINE_EXPIRED"
  | "NEW_CASE"
  | "CASE_PARTICIPANT_ADDED"
  | "EXPLANATION_REQUESTED"
  | "COMPLAINT_SUBMITTED"
  | "COMPLAINT_DECIDED"
  | "COMMISSION_ASSIGNED"
  | "COMMISSION_STAGE_2_VOTING";

export interface InAppNotificationResponse {
  id: string;
  title: string;
  body: string;
  iconCode?: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  readAt?: string;
  isArchived?: boolean;
  expiresAt?: string;
  createdAt: string;
  type: NotificationType;
}
