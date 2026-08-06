// Quick functional smoke test for the jurisdiction catalog.
// Verifies the normalization + resolution helpers behave correctly across
// legacy free-text values and canonical codes.
//
// Run: npx tsx /home/z/my-project/almizan/scripts/test-jurisdictions.ts

import {
  JURISDICTIONS,
  JURISDICTION_LIST,
  normalizeJurisdiction,
  resolveMatterJurisdiction,
  resolveOrgJurisdiction,
  buildJurisdictionAiContext,
  jurisdictionLabel,
  proceduralRulesetFor,
} from "../src/lib/jurisdictions";

let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    pass++;
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${msg}`);
  }
}

// ── Catalog sanity ────────────────────────────────────────────────────────
assert(JURISDICTION_LIST.length === 6, "catalog has 6 entries (JO, EG, AE, SA, KW, OTHER)");
assert(JURISDICTION_LIST[5].code === "OTHER", "OTHER is last in the catalog");
assert(JURISDICTION_LIST[0].code === "JO", "JO is first in the catalog");

// ── Canonical-code inputs ─────────────────────────────────────────────────
assert(normalizeJurisdiction("JO") === "JO", "canonical JO passes through");
assert(normalizeJurisdiction("AE") === "AE", "canonical AE passes through");
assert(normalizeJurisdiction("OTHER") === "OTHER", "canonical OTHER passes through");

// ── Legacy free-text inputs ───────────────────────────────────────────────
assert(normalizeJurisdiction("Jordan Courts & Arbitration") === "JO", "legacy 'Jordan Courts & Arbitration' → JO");
assert(normalizeJurisdiction("Jordan Courts") === "JO", "legacy 'Jordan Courts' → JO");
assert(normalizeJurisdiction("Jordan") === "JO", "legacy 'Jordan' → JO");
assert(normalizeJurisdiction("الأردن") === "JO", "Arabic 'الأردن' → JO");
assert(normalizeJurisdiction("Saudi Commercial Courts (SCCA)") === "SA", "legacy Saudi label → SA");
assert(normalizeJurisdiction("Saudi Commercial Courts & SCCA") === "SA", "legacy Saudi label alt → SA");
assert(normalizeJurisdiction("UAE Federal & DIFC Courts") === "AE", "legacy UAE label → AE");
assert(normalizeJurisdiction("DIFC Courts") === "AE", "DIFC → AE");
assert(normalizeJurisdiction("ADGM Courts") === "AE", "ADGM → AE");
assert(normalizeJurisdiction("International Tribunals (ICC/LCIA)") === "OTHER", "ICC/LCIA → OTHER");
assert(normalizeJurisdiction("UAE Civil Procedure Law (Federal Law No. 42 / 2022)") === "AE", "legacy court-deadlines UAE ruleset → AE");
assert(normalizeJurisdiction("Saudi Arabia Commercial Courts Law (Royal Decree M/93)") === "SA", "legacy court-deadlines SA ruleset → SA");
assert(normalizeJurisdiction("US Federal Rules of Civil Procedure (FRCP)") === "OTHER", "FRCP → OTHER");

// ── Unknown / empty values ────────────────────────────────────────────────
assert(normalizeJurisdiction("") === "OTHER", "empty → OTHER");
assert(normalizeJurisdiction(null) === "OTHER", "null → OTHER");
assert(normalizeJurisdiction(undefined) === "OTHER", "undefined → OTHER");
assert(normalizeJurisdiction("Zimbabwe") === "OTHER", "unknown country → OTHER");
assert(normalizeJurisdiction("Some custom legacy value") === "OTHER", "unrecognized custom → OTHER");

// ── Matter → Org fallback chain ───────────────────────────────────────────
assert(
  resolveMatterJurisdiction({ jurisdiction: "JO" }, { jurisdiction: "AE" }).code === "JO",
  "matter JO overrides org AE",
);
assert(
  resolveMatterJurisdiction({ jurisdiction: "Egypt" }, { jurisdiction: "AE" }).code === "EG",
  "matter 'Egypt' (legacy) → EG",
);
assert(
  resolveMatterJurisdiction({ jurisdiction: "" }, { jurisdiction: "SA" }).code === "SA",
  "matter empty falls back to org SA",
);
assert(
  resolveMatterJurisdiction(null, { jurisdiction: "KW" }).code === "KW",
  "null matter falls back to org KW",
);
assert(
  resolveMatterJurisdiction(null, null).code === "OTHER",
  "both null → OTHER (graceful default)",
);
assert(
  resolveMatterJurisdiction({ jurisdiction: null }, { jurisdiction: null }).code === "OTHER",
  "both fields null → OTHER",
);

// ── Org-only resolver ─────────────────────────────────────────────────────
assert(resolveOrgJurisdiction({ jurisdiction: "JO" }).code === "JO", "resolveOrgJurisdiction(JO)");
assert(resolveOrgJurisdiction(null).code === "OTHER", "resolveOrgJurisdiction(null) → OTHER");

// ── AI system context ─────────────────────────────────────────────────────
const joCtx = buildJurisdictionAiContext(JURISDICTIONS.JO);
assert(joCtx.enableJordanianLawTools === true, "JO enables Jordanian MCP tools");
assert(joCtx.systemContext.includes("Jordan"), "JO system context mentions Jordan");
assert(joCtx.systemContext.includes("Civil Procedure Law"), "JO system context cites the procedural law");

const aeCtx = buildJurisdictionAiContext(JURISDICTIONS.AE);
assert(aeCtx.enableJordanianLawTools === false, "AE does NOT enable Jordanian MCP tools");
assert(aeCtx.systemContext.includes("DIFC"), "AE system context mentions DIFC");
assert(aeCtx.systemContext.includes("ADGM"), "AE system context mentions ADGM");

const otherCtx = buildJurisdictionAiContext(JURISDICTIONS.OTHER);
assert(otherCtx.enableJordanianLawTools === false, "OTHER does NOT enable MCP tools");
assert(otherCtx.systemContext.includes("unspecified"), "OTHER flags unspecified jurisdiction");

// ── Bilingual labels ──────────────────────────────────────────────────────
assert(jurisdictionLabel("JO", "en") === "Jordan", "label(JO, en) = Jordan");
assert(jurisdictionLabel("JO", "ar") === "الأردن", "label(JO, ar) = الأردن");
assert(jurisdictionLabel("AE", "en") === "United Arab Emirates", "label(AE, en) = UAE");
assert(jurisdictionLabel("OTHER", "ar") === "أخرى / عام", "label(OTHER, ar)");

// ── Procedural ruleset lookup ────────────────────────────────────────────
assert(
  proceduralRulesetFor("JO", "en").includes("Civil Procedure Law No. 24 of 1988"),
  "proceduralRulesetFor(JO, en)",
);
assert(
  proceduralRulesetFor("Jordan Courts & Arbitration", "en").includes("Civil Procedure Law"),
  "legacy 'Jordan Courts & Arbitration' resolves to JO procedural ruleset",
);
assert(
  proceduralRulesetFor("Some custom legacy value", "en") === "Some custom legacy value",
  "unrecognized ruleset is preserved verbatim (no info loss)",
);

// ── Summary ───────────────────────────────────────────────────────────────
// eslint-disable-next-line no-console
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
