// =============================================================================
// Al Mizan — Zod validation schemas for auth + common fields
// =============================================================================

import { z } from "zod";

export const ROLE_VALUES = [
  "Managing Partner",
  "Senior Associate",
  "In-House Counsel",
  "Legal Executive",
  "Client Representative",
] as const;

// PRD v0.6 §4.3: "Client" is removed from public self-registration entirely.
// A client account can only be created by accepting a matter-level invitation
// from their attorney. The "Client Representative" role still exists — it's
// assigned server-side at invite-acceptance, never chosen by the user.
export const ACCOUNT_TYPE_VALUES = [
  "Law Firm",
  "Solo Practitioner",
  "Corporate Counsel",
] as const;

export const SUBSCRIPTION_TIER_VALUES = [
  "Free Trial",
  "Solo Practice",
  "Pro Practice",
  "Enterprise & Arbitration",
] as const;

export const BILLING_CYCLE_VALUES = ["Monthly", "Annual"] as const;

// -----------------------------------------------------------------------------
// Auth schemas
// -----------------------------------------------------------------------------

export const registerSchema = z.object({
  name: z.string().min(2, "Name is too short").max(120),
  email: z.string().email("Invalid email"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  firmName: z.string().min(2, "Firm name is required").max(200),
  barAssociationId: z.string().max(80).optional().or(z.literal("")),
  jurisdiction: z.string().min(2).max(120),
  accountType: z.enum(ACCOUNT_TYPE_VALUES),
  role: z.enum(ROLE_VALUES).optional(),
  studentCode: z.string().trim().min(3).max(80).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

export const subscriptionSchema = z.object({
  tier: z.enum(SUBSCRIPTION_TIER_VALUES),
  billingCycle: z.enum(BILLING_CYCLE_VALUES),
});

export const redeemStudentCodeSchema = z.object({
  code: z.string().trim().min(3).max(80),
});

export const generateStudentCodeSchema = z.object({
  maxMatters: z.number().int().min(0).max(1000).default(3),
  aiQuota: z.number().int().min(0).max(100000).default(20),
  aiQuotaPeriod: z.enum(["total", "monthly"]).default("total"),
  expiresAt: z.string().optional().nullable(),
  count: z.number().int().min(1).max(100).default(1),
});

// -----------------------------------------------------------------------------
// Matter schemas (used in later turns)
// -----------------------------------------------------------------------------

export const matterCreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  clientName: z.string().min(1).max(200),
  clientEmail: z.string().email(),
  jurisdiction: z.string().min(2).max(120),
  opposingParty: z.string().max(200).optional().or(z.literal("")),
  opposingCounsel: z.string().max(200).optional().or(z.literal("")),
  budget: z.number().min(0).default(0),
  riskLevel: z.enum(["High", "Medium", "Low"]).default("Medium"),
  judge: z.string().max(120).optional().or(z.literal("")),
  court: z.string().max(200).optional().or(z.literal("")),
  statuteOfLimitations: z.string().max(120).optional().or(z.literal("")),
  statuteDeadline: z.string().max(40).optional().or(z.literal("")),
});

export const matterUpdateSchema = matterCreateSchema.partial().extend({
  id: z.string(),
  winProbability: z.number().min(0).max(100).optional(),
  expenses: z.number().min(0).optional(),
  status: z.string().max(40).optional(),
  aiStrategy: z.string().max(4000).optional().or(z.literal("")),
});

// -----------------------------------------------------------------------------
// Helper to safely parse + flatten errors
// -----------------------------------------------------------------------------

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown):
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> } {
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };

  const flattened = result.error.flatten();
  const first = result.error.issues[0];
  return {
    ok: false,
    error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid input",
    fieldErrors: flattened.fieldErrors,
  };
}
