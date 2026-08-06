// =============================================================================
// Al Mizan — shared TypeScript types
// Ported from reference/types.ts; augmented with multi-tenancy fields.
// =============================================================================

export type Role =
  | "Managing Partner"
  | "Senior Associate"
  | "In-House Counsel"
  | "Legal Executive"
  | "Client Representative";

export type AccountType = "Law Firm" | "Solo Practitioner" | "Corporate Counsel" | "Client";

export type SubscriptionTier = "Free Trial" | "Solo Practice" | "Pro Practice" | "Enterprise & Arbitration";

export type PlanStatus = "Active" | "Trial" | "Expired";
export type BillingCycle = "Monthly" | "Annual";
export type AccessKind = "free" | "paid" | "promo";
export type AiQuotaPeriod = "total" | "monthly";

// ── Bring Your Own API Key (BYOK) ──────────────────────────────────────────
export type AiProvider = "openai" | "xai" | "gemini";
/** Where the resolved key comes from — the org's stored key or the platform env key. */
export type AiKeySource = "org" | "platform";

/** Decrypted org AI keys (server-side only — never sent to the browser). */
export interface OrgAiKeys {
  /** Preferred provider for AI calls, or null when unset. */
  provider: AiProvider | null;
  openai: string | null;
  xai: string | null;
  gemini: string | null;
  updatedAt: string | null;
  lastVerifiedAt: string | null;
}

/** A single resolved key chosen for an AI call. */
export interface ResolvedAiKey {
  provider: AiProvider;
  apiKey: string;
  keySource: AiKeySource;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  firmName: string;            // organization.name
  organizationId: string;
  role: Role;
  barAssociationId: string;
  jurisdiction: string;
  accountType: AccountType;
  avatarUrl?: string;
  subscriptionTier: SubscriptionTier;
  planStatus: PlanStatus;
  trialDaysLeft: number;
  seats: number;
  maxSeats: number;
  billingCycle: BillingCycle;
  renewalDate: string;
  biometricEnabled: boolean;
  // ── Student / promo access (optional for backward compat with older
  //    profile constructors; populated by /api/auth/me) ───────────────────
  accessKind?: AccessKind;
  promoCode?: string;
  promoMaxMatters?: number;
  promoAiQuota?: number;
  promoAiQuotaPeriod?: AiQuotaPeriod;
  promoAiUsed?: number;
  promoExpiresAt?: string;
  // ── Paid add-on toggles (mirrors Organization columns) ─────────────────
  // When false, the UI shows an upgrade CTA instead of the module, and the
  // API returns 402. Phase 2: Case Investigation Agent.
  investigationAgentEnabled: boolean;
}

export interface Matter {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  clientName: string;
  clientEmail: string;
  jurisdiction: string;
  opposingParty?: string;
  opposingCounsel?: string;
  budget: number;
  expenses: number;
  riskLevel: "High" | "Medium" | "Low";
  winProbability: number;
  judge?: string;
  court?: string;
  statuteOfLimitations?: string;
  statuteDeadline?: string;
  status?: string;
  aiStrategy?: string;
}

/** Represents a StudentCode row as returned by the admin generate/list API. */
export interface StudentCode {
  id: string;
  code: string;
  maxMatters: number;
  aiQuota: number;
  aiQuotaPeriod: AiQuotaPeriod;
  isActive: boolean;
  expiresAt: string | null;
  usedCount: number;
  createdAt: string;
}

/** Client-facing promo usage summary (returned by /api/student-codes). */
export interface PromoAllowance {
  accessKind: AccessKind;
  mattersUsed: number;
  mattersMax: number | null;
  aiUsed: number;
  aiQuota: number | null;
  aiQuotaPeriod?: AiQuotaPeriod;
  expiresAt?: string | null;
  upgradeRequired?: boolean;
}export interface Document {
  id: string;
  organizationId: string;
  matterId: string;
  name: string;
  category: string;
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
  visibleToClient: boolean;
  version: number;
  aiSummary?: string;
  aiTags?: string[];
  isRedacted?: boolean;
  redactedVersionId?: string;
  redactionCount?: number;
}

export interface Task {
  id: string;
  organizationId: string;
  matterId: string;
  title: string;
  description?: string;
  assignedTo: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  visibleToClient: boolean;
  status: "To Do" | "In Progress" | "Under Review" | "Completed";
  dependsOnTaskIds?: string[];
}

export interface TimeEntry {
  id: string;
  organizationId: string;
  matterId: string;
  description: string;
  hours: number;
  rate: number;
  date: string;
  billed: boolean;
  taskCode?: string;
  activityCode?: string;
  isBillable?: boolean;
}

export interface CourtRuleDeadline {
  id?: string;
  title: string;
  category: "Hearing" | "Court Deadline" | "Filing" | "Arbitration";
  daysFromTrigger: number;
  calculatedDate: string;
  ruleReference: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  autoAddTasks?: boolean;
}

export interface Invoice {
  id: string;
  organizationId: string;
  matterId: string;
  invoiceNumber: string;
  totalAmount: number;
  status: "Draft" | "Sent" | "Paid" | "Overdue";
  dueDate: string;
  issueDate?: string;
  paymentTxId?: string;
}

export interface ClientMessage {
  id: string;
  organizationId: string;
  matterId: string;
  sender: "Lawyer" | "Client";
  text: string;
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  organizationId: string;
  matterId: string;
  title: string;
  description: string;
  date: string;
  visibleToClient: boolean;
  type?: string;
}

export interface CalendarEvent {
  id: string;
  organizationId: string;
  matterId: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  time?: string;
  location?: string;
  category: "Hearing" | "Court Deadline" | "Client Meeting" | "Filing" | "Arbitration";
  syncedToGoogleCalendar?: boolean;
  googleEventId?: string;
}

export interface TranscriptPage {
  pageNumber: number;
  lineNumber?: string;
  timestamp?: string;
  speaker: string;
  text: string;
  isKeyAdmission?: boolean;
  tags?: string[];
}

export interface DepositionTranscript {
  id: string;
  organizationId: string;
  matterId: string;
  witnessName: string;
  witnessRole: string;
  depositionDate: string;
  deponentParty: "Fact Witness" | "Expert Witness" | "Adverse Party" | "Client Corporate Representative";
  pagesCount: number;
  pages: TranscriptPage[];
  keyAdmissionsSummary?: string;
  uploadedAt: string;
}

export interface PrivilegeLogEntry {
  id: string;
  organizationId: string;
  matterId: string;
  docControlNum: string;
  docDate: string;
  author: string;
  recipients: string;
  docType: string;
  subject: string;
  privilegeClaimed:
    | "Attorney-Client Privilege"
    | "Work-Product Doctrine"
    | "Common Interest Privilege"
    | "Bank Confidentiality"
    | "Sharia Professional Secrecy";
  justification: string;
  isRedacted?: boolean;
  reviewStatus: "Flagged" | "Verified" | "Withheld";
}

export interface WarRoomWitness {
  id: string;
  organizationId: string;
  matterId: string;
  name: string;
  type: "Fact" | "Expert" | "Adverse";
  examinationNotes?: string;
  order: number;
}

export interface WarRoomExhibit {
  id: string;
  organizationId: string;
  matterId: string;
  exhibitNumber: string;
  description: string;
  admissionStatus: "Pending" | "Admitted" | "Excluded";
  party: "Plaintiff" | "Defense";
}

export interface ConflictCheck {
  id: string;
  organizationId: string;
  certificateNumber: string;
  searchQuery: string;
  matchedEntities?: any[];
  clearanceStatus: "Pending" | "Cleared" | "Conflict";
  ethicalWallSet: boolean;
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  matterId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
