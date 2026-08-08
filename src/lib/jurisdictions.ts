// =============================================================================
// Al Mizan — Multi-Country / Jurisdiction catalog
// -----------------------------------------------------------------------------
// Single source of truth for every supported jurisdiction in the product.
//
// Used by:
//   - Organization settings UI (default jurisdiction picker)
//   - Matter intake form (per-matter override picker)
//   - Auth / signup form (initial org jurisdiction)
//   - Court-rules deadline calculator (ruleset selection)
//   - AI route handlers (system-prompt context for the country's legal system)
//
// DESIGN RULES:
//   1. The DB stores `jurisdiction` as a free-form String (already on
//      Organization + Matter + User). We don't change the schema — we just
//      normalize to a canonical `JurisdictionCode` at read time. Existing rows
//      with legacy free-text values are mapped via `normalizeJurisdiction()`.
//   2. Every entry has bilingual labels (ar + en) for direct UI use, and a
//      short bilingual `legalContext` blurb that gets appended to AI system
//      prompts so the model adapts its answers to the right country.
//   3. `resolveMatterJurisdiction()` is the override resolver: matter → org →
//      "OTHER" fallback. Always returns a usable JurisdictionInfo, never null.
//   4. Catalog entries are pure data + pure functions. No DB / fetch calls.
//      Safe to import from server AND client code.
// =============================================================================

export type JurisdictionCode =
  | "JO"   // Jordan
  | "EG"   // Egypt
  | "AE"   // United Arab Emirates
  | "SA"   // Saudi Arabia
  | "KW"   // Kuwait
  | "OTHER"; // Other / Generic

export interface JurisdictionInfo {
  /** Canonical short code, persisted alongside the human label. */
  code: JurisdictionCode;
  /** English display label (e.g. "Jordan"). */
  labelEn: string;
  /** Arabic display label (e.g. "الأردن"). */
  labelAr: string;
  /** Bilingual "Jordan — الأردن" — convenience for selects / badges. */
  labelBilingual: string;
  /** ISO 3166-1 alpha-2 country code (null for OTHER). */
  iso2: string | null;
  /** Default court system / procedural framework name (bilingual). */
  courtSystemEn: string;
  courtSystemAr: string;
  /** Default procedural code reference, used by the court-deadlines calculator. */
  proceduralRulesetEn: string;
  proceduralRulesetAr: string;
  /** Default language of proceedings. */
  languageOfProceedings: "ar" | "en" | "ar+en";
  /** Whether the self-hosted Jordanian Law MCP tools are applicable. */
  hasJordanianLawTools: boolean;
  /** Applicable arbitration rules (bilingual, semicolon-separated). */
  arbitrationRulesEn: string;
  arbitrationRulesAr: string;
  /**
   * Short, bilingual legal context appended to AI system prompts.
   * Written so the model adapts draft language, citation style, and
   * procedural assumptions to the right country.
   */
  aiSystemContext: string;
}

export const JURISDICTIONS: Record<JurisdictionCode, JurisdictionInfo> = {
  JO: {
    code: "JO",
    labelEn: "Jordan",
    labelAr: "الأردن",
    labelBilingual: "Jordan — الأردن",
    iso2: "JO",
    courtSystemEn: "Jordanian Courts (First Instance, Appeal, Cassation) + Jordanian Arbitration",
    courtSystemAr: "المحاكم الأردنية (البداية / الاستئناف / النقض) والتحكيم الأردني",
    proceduralRulesetEn: "Jordan Civil Procedure Law No. 24 of 1988 (as amended)",
    proceduralRulesetAr: "قانون أصول المحاكمات المدنية الأردني رقم 24 لسنة 1988 وتعديلاته",
    languageOfProceedings: "ar",
    hasJordanianLawTools: true,
    arbitrationRulesEn: "Jordan Arbitration Law No. 31 of 2001",
    arbitrationRulesAr: "قانون التحكيم الأردني رقم 31 لسنة 2001",
    aiSystemContext:
      "Operating under Jordanian law. Primary statutes: Jordan Civil Code No. 43 of 1976, " +
      "Civil Procedure Law No. 24 of 1988, Commercial Law No. 12 of 1966. " +
      "Court hierarchy: Magistrates / First Instance → Court of Appeal → Court of Cassation. " +
      "Language of proceedings: Arabic. When drafting for Jordan, prefer citing the actual " +
      "article number from the Jordanian Law MCP tools (search_legislation / get_provision) " +
      "instead of inventing citations. Citation style: «القانون المدني الأردني رقم 43 لسنة 1976، المادة 256».",
  },
  EG: {
    code: "EG",
    labelEn: "Egypt",
    labelAr: "مصر",
    labelBilingual: "Egypt — مصر",
    iso2: "EG",
    courtSystemEn: "Egyptian National Courts (First Instance, Appeal, Cassation) + Cairo Regional Center for Arbitration (CRCICA)",
    courtSystemAr: "المحاكم المصرية (أول درجة / استئناف / نقض) ومركز القاهرة الإقليمي للتحكيم التجاري الدولي (CRCICA)",
    proceduralRulesetEn: "Egyptian Civil and Commercial Procedure Law No. 13 of 1968 (as amended)",
    proceduralRulesetAr: "قانون المرافعات المدنية والتجارية المصري رقم 13 لسنة 1968 وتعديلاته",
    languageOfProceedings: "ar",
    hasJordanianLawTools: false,
    arbitrationRulesEn: "CRCICA Arbitration Rules (revised 2011); Egyptian Arbitration Law No. 27 of 1994",
    arbitrationRulesAr: "قواعد التحكيم لمركز القاهرة الإقليمي (تعديل 2011)؛ قانون التحكيم المصري رقم 27 لسنة 1994",
    aiSystemContext:
      "Operating under Egyptian law. Primary statutes: Egyptian Civil Code No. 131 of 1948, " +
      "Civil and Commercial Procedure Law No. 13 of 1968, Evidence Law No. 25 of 1968. " +
      "Court hierarchy: Summary / First Instance → Court of Appeal → Court of Cassation. " +
      "Language of proceedings: Arabic. Citation style: «القانون المدني المصري رقم 131 لسنة 1948، المادة 146».",
  },
  AE: {
    code: "AE",
    labelEn: "United Arab Emirates",
    labelAr: "الإمارات العربية المتحدة",
    labelBilingual: "UAE — الإمارات",
    iso2: "AE",
    courtSystemEn: "UAE Federal Courts + DIFC Courts + ADGM Courts (parallel common-law jurisdictions)",
    courtSystemAr: "المحاكم الاتحادية الإماراتية + محاكم مركز دبي المالي العالمي (DIFC) + محاكم سوق أبوظبي العالمي (ADGM)",
    proceduralRulesetEn: "UAE Civil Procedure Code (Federal Law No. 11 of 1992, as amended by Federal Law No. 42 of 2022)",
    proceduralRulesetAr: "قانون الإجراءات المدنية الإماراتي (قانون اتحادي رقم 11 لسنة 1992، معدّلاً بالقانون رقم 42 لسنة 2022)",
    languageOfProceedings: "ar+en",
    hasJordanianLawTools: false,
    arbitrationRulesEn: "UAE Federal Arbitration Law (Federal Law No. 6 of 2018); DIFC-LCIA / DIAC / SCCA Rules",
    arbitrationRulesAr: "قانون التحكيم الإماراتي الاتحادي (قانون اتحادي رقم 6 لسنة 2018)؛ قواعد DIFC-LCIA و DIAC و SCCA",
    aiSystemContext:
      "Operating under UAE law. Note the parallel jurisdictions: UAE Federal Courts apply " +
      "Federal Civil Procedure Code (No. 11 of 1992, amended by No. 42 of 2022), while DIFC " +
      "and ADGM courts apply English common law (RDC 2020 / ADGM CPR 2019). " +
      "Primary civil statute: UAE Civil Transactions Law No. 5 of 1985. Language of proceedings: " +
      "Arabic in federal courts, English in DIFC/ADGM. When the matter doesn't specify, " +
      "default to UAE federal courts. Citation style: «Federal Law No. 5 of 1985, Article 156».",
  },
  SA: {
    code: "SA",
    labelEn: "Saudi Arabia",
    labelAr: "المملكة العربية السعودية",
    labelBilingual: "Saudi Arabia — السعودية",
    iso2: "SA",
    courtSystemEn: "Saudi Commercial Courts + Board of Grievances (Diwan Al-Mazalim) + SCCA Arbitration",
    courtSystemAr: "المحاكم التجارية السعودية + ديوان المظالم + مركز التحكيم السعودي (SCCA)",
    proceduralRulesetEn: "Saudi Law of Civil Procedure (Royal Decree M/34 of 2000, as amended)",
    proceduralRulesetAr: "نظام المرافعات الشرعية السعودي (المرسوم الملكي م/34 لسنة 1422هـ) وتعديلاته",
    languageOfProceedings: "ar",
    hasJordanianLawTools: false,
    arbitrationRulesEn: "Saudi Arbitration Law (Royal Decree M/34 of 2012); SCCA Arbitration Rules",
    arbitrationRulesAr: "نظام التحكيم السعودي (المرسوم الملكي م/34 لسنة 1433هـ)؛ قواعد التحكيم لمركز التحكيم السعودي (SCCA)",
    aiSystemContext:
      "Operating under Saudi Arabian law, which is grounded in Shariah principles codified " +
      "into statute. Primary statutes: Saudi Civil Transactions Law (Royal Decree M/191 of 1444H / 2023), " +
      "Law of Civil Procedure (M/34), Commercial Courts Law (M/93). " +
      "Court hierarchy: First Instance → Appeal → Supreme Court. Commercial disputes go to " +
      "Commercial Courts; administrative disputes to the Board of Grievances (Diwan Al-Mazalim). " +
      "Language of proceedings: Arabic. Citation style: «نظام المرافعات الشرعية، المادة 43» " +
      "or «Royal Decree M/34, Article 43».",
  },
  KW: {
    code: "KW",
    labelEn: "Kuwait",
    labelAr: "الكويت",
    labelBilingual: "Kuwait — الكويت",
    iso2: "KW",
    courtSystemEn: "Kuwaiti Courts (First Instance, Appeal, Cassation) + Kuwait Chamber for Arbitration (KCIA)",
    courtSystemAr: "المحاكم الكويتية (أول درجة / استئناف / تمييز) + غرفة التحكيم الكويتية (KCIA)",
    proceduralRulesetEn: "Kuwait Civil and Commercial Procedure Law No. 38 of 1980 (as amended)",
    proceduralRulesetAr: "قانون المرافعات المدنية والتجارية الكويتي رقم 38 لسنة 1980 وتعديلاته",
    languageOfProceedings: "ar",
    hasJordanianLawTools: false,
    arbitrationRulesEn: "Kuwait Arbitration Law No. 11 of 1995; KCIA Arbitration Rules",
    arbitrationRulesAr: "قانون التحكيم الكويتي رقم 11 لسنة 1995؛ قواعد غرفة التحكيم الكويتية",
    aiSystemContext:
      "Operating under Kuwaiti law. Primary statutes: Kuwait Civil Code No. 67 of 1980, " +
      "Civil and Commercial Procedure Law No. 38 of 1980, Commercial Code No. 68 of 1980. " +
      "Court hierarchy: First Instance → Appeal → Court of Cassation. " +
      "Language of proceedings: Arabic. Citation style: «القانون المدني الكويتي رقم 67 لسنة 1980، المادة 172».",
  },
  OTHER: {
    code: "OTHER",
    labelEn: "Other / Generic",
    labelAr: "أخرى / عام",
    labelBilingual: "Other / Generic — أخرى / عام",
    iso2: null,
    courtSystemEn: "Generic / international civil procedure (no specific country)",
    courtSystemAr: "إجراءات مدنية عامة / دولية (دولة غير محددة)",
    proceduralRulesetEn: "Applicable civil procedure rules (unspecified jurisdiction)",
    proceduralRulesetAr: "قواعد الإجراءات المدنية المعمول بها (ولاية قضائية غير محددة)",
    languageOfProceedings: "en",
    hasJordanianLawTools: false,
    arbitrationRulesEn: "ICC Rules of Arbitration; LCIA Arbitration Rules; UNCITRAL Arbitration Rules",
    arbitrationRulesAr: "قواعد التحكيم لغرفة التجارة الدولية (ICC)؛ قواعد التحكيم LCIA؛ قواعد التحكيم UNCITRAL",
    aiSystemContext:
      "Jurisdiction is unspecified or international. Default to general MENA / GCC civil-law " +
      "principles and clearly flag any citation as needing country-specific verification. " +
      "When the matter later gets a country assigned, regenerate the document with the " +
      "country-specific procedural code.",
  },
};

/** Ordered list (for UI dropdowns in both languages). "OTHER" always last. */
export const JURISDICTION_LIST: JurisdictionInfo[] = [
  JURISDICTIONS.JO,
  JURISDICTIONS.EG,
  JURISDICTIONS.AE,
  JURISDICTIONS.SA,
  JURISDICTIONS.KW,
  JURISDICTIONS.OTHER,
];

// -----------------------------------------------------------------------------
// Normalization — maps legacy free-text jurisdiction strings to canonical codes.
// -----------------------------------------------------------------------------
// Every legacy value we've ever written to Organization.jurisdiction /
// Matter.jurisdiction is listed here so existing data keeps working. New rows
// are written with the canonical `code` value (e.g. "JO", "AE", "OTHER").
// -----------------------------------------------------------------------------

const NORMALIZE_MAP: Record<string, JurisdictionCode> = {
  // Canonical codes (already in canonical form)
  jo: "JO",
  eg: "EG",
  ae: "AE",
  sa: "SA",
  kw: "KW",
  other: "OTHER",
  generic: "OTHER",

  // Legacy auth-modal dropdown values (pre-Multi-Country feature)
  "jordan courts & arbitration": "JO",
  "jordan courts": "JO",
  "jordan": "JO",
  "الأردن": "JO",
  "jordanian": "JO",

  "saudi commercial courts (scca)": "SA",
  "saudi commercial courts & scca": "SA",
  "saudi": "SA",
  "saudi arabia": "SA",
  "السعودية": "SA",

  "uae federal & difc courts": "AE",
  "uae federal courts": "AE",
  "difc courts": "AE",
  "adgm courts": "AE",
  "uae": "AE",
  "emirates": "AE",
  "الإمارات": "AE",
  "امارات": "AE",

  "kuwait": "KW",
  "الكويت": "KW",

  "egypt": "EG",
  "مصر": "EG",

  "international tribunals (icc/lcia)": "OTHER",
  "icc/lcia": "OTHER",
  "international": "OTHER",

  // Legacy court-rules-calendaring-module dropdown values
  "uae civil procedure law (federal law no. 42 / 2022)": "AE",
  "saudi arabia commercial courts law (royal decree m/93)": "SA",
  "difc courts rules (rdc 2014)": "AE",
  "adgm courts civil evidence rules": "AE",
  "us federal rules of civil procedure (frcp)": "OTHER",
};

/**
 * Convert any legacy / free-text jurisdiction string into a canonical
 * JurisdictionCode. Falls back to "OTHER" so the system never breaks on
 * unknown values — the existing matter / org still loads, just without a
 * country-specific AI context.
 *
 * Lookup is intentionally EXACT (case-insensitive) — no substring heuristic.
 * This is to avoid false positives like "legacy" matching "eg" → Egypt. Every
 * legacy value we've ever shipped (the 4-item signup dropdown, the 5-item
 * court-rules dropdown, plus common shorthand / Arabic labels) is listed
 * explicitly in NORMALIZE_MAP above. New unknown values fall back to OTHER.
 */
export function normalizeJurisdiction(raw: string | null | undefined): JurisdictionCode {
  if (!raw) return "OTHER";
  const trimmed = raw.trim();
  if (!trimmed) return "OTHER";
  // Direct canonical match (case-sensitive)
  if (trimmed in JURISDICTIONS) return trimmed as JurisdictionCode;
  // Case-insensitive lookup against the explicit map
  const key = trimmed.toLowerCase();
  if (key in NORMALIZE_MAP) return NORMALIZE_MAP[key];
  return "OTHER";
}

/**
 * Resolve the canonical JurisdictionInfo for a matter, applying the
 * matter → organization → OTHER fallback chain. Used by every AI route so
 * the country's legal context reaches the model even when the matter itself
 * doesn't override its org's jurisdiction.
 */
export function resolveMatterJurisdiction(
  matter?: { jurisdiction?: string | null } | null,
  organization?: { jurisdiction?: string | null } | null,
): JurisdictionInfo {
  const matterCode = normalizeJurisdiction(matter?.jurisdiction);
  if (matterCode !== "OTHER") return JURISDICTIONS[matterCode];
  const orgCode = normalizeJurisdiction(organization?.jurisdiction);
  if (orgCode !== "OTHER") return JURISDICTIONS[orgCode];
  return JURISDICTIONS.OTHER;
}

/**
 * Resolve the canonical JurisdictionInfo from an Organization row alone.
 * Used by org-level UI (settings card) and AI routes that don't have a matter.
 */
export function resolveOrgJurisdiction(
  organization?: { jurisdiction?: string | null } | null,
): JurisdictionInfo {
  return JURISDICTIONS[normalizeJurisdiction(organization?.jurisdiction)];
}

/**
 * Build the bilingual AI system-prompt prefix that adapts the model to the
 * country's legal system. Returns a short string (~3-5 lines) suitable for
 * concatenation with any AI route's existing systemInstruction.
 *
 * If the jurisdiction is Jordan, also signals that the Jordanian Law MCP
 * tools should be enabled (returned separately so callers can pass
 * `tools: true` to dispatchAiText).
 */
export function buildJurisdictionAiContext(info: JurisdictionInfo): {
  systemContext: string;
  enableJordanianLawTools: boolean;
} {
  return {
    systemContext: info.aiSystemContext,
    enableJordanianLawTools: info.hasJordanianLawTools,
  };
}

/**
 * Convenience: get a label in the requested language for any persisted
 * jurisdiction string. Used by read-only UI (matter cards, audit logs).
 */
export function jurisdictionLabel(
  raw: string | null | undefined,
  lang: "ar" | "en",
): string {
  const info = JURISDICTIONS[normalizeJurisdiction(raw)];
  return lang === "ar" ? info.labelAr : info.labelEn;
}

/**
 * Convenience: get the procedural ruleset name for a persisted jurisdiction
 * string. Falls back to the raw string when it can't be normalized, so
 * legacy court-deadlines values keep working verbatim.
 */
export function proceduralRulesetFor(
  raw: string | null | undefined,
  lang: "ar" | "en",
): string {
  const info = JURISDICTIONS[normalizeJurisdiction(raw)];
  // If normalization produced OTHER but the input wasn't actually empty,
  // the input was an unrecognized legacy string — keep it verbatim so the
  // AI route doesn't lose information the user typed.
  if (info.code === "OTHER" && raw && raw.trim()) {
    return raw.trim();
  }
  return lang === "ar" ? info.proceduralRulesetAr : info.proceduralRulesetEn;
}
