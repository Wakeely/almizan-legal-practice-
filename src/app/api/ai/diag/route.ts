// =============================================================================
// GET /api/ai/diag — AI provider diagnostic (Managing Partner only)
// -----------------------------------------------------------------------------
// Shows EXACTLY what the server sees for each AI provider key, and tests each
// key against its provider's API live. This cuts through all ambiguity about
// "is my key deployed?" and "is my key valid?".
//
// Returns (no secrets are exposed — only first 8 + last 4 chars):
// {
//   gemini: { configured, keyPreview, keyLength, liveTest: "ok"|"invalid"|"error:..." },
//   openai: { configured, keyPreview, keyLength, liveTest: "ok"|"invalid"|"error:..." },
//   groq:   { configured, keyPreview, keyLength, liveTest: "ok"|"invalid"|"error:..." },
//   deployTime: "2026-...",
//   fallbackOrder: ["gemini", "openai", "groq"]
// }
//
// SECURITY: Managing Partner only. Key values are NEVER returned — only a
// preview (first 8 + last 4 chars) so you can verify the right key is deployed.
// =============================================================================

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/org";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

function previewKey(key: string | undefined): string {
  if (!key) return "(not set)";
  if (key.length < 12) return `(too short: ${key.length} chars)`;
  return `${key.slice(0, 8)}...${key.slice(-4)} (len ${key.length})`;
}

async function testGemini(key: string): Promise<string> {
  try {
    const client = new GoogleGenAI({ apiKey: key });
    await client.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: "test",
      config: { maxOutputTokens: 1 },
    });
    return "ok";
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
      return "quota_exhausted (key is VALID, just out of free-tier quota)";
    }
    if (msg.includes("API key not valid") || msg.includes("INVALID_ARGUMENT")) {
      return "INVALID_KEY (key is rejected by Google)";
    }
    return `error: ${msg.substring(0, 200)}`;
  }
}

async function testOpenAI(key: string): Promise<string> {
  try {
    const client = new OpenAI({ apiKey: key });
    await client.models.list();
    return "ok";
  } catch (err: any) {
    const msg = err?.error?.message ?? err?.message ?? String(err);
    if (msg.includes("insufficient_quota") || msg.includes("no credits")) {
      return "no_credits (key is VALID, but account has no billing/credits)";
    }
    if (msg.includes("Incorrect API key") || msg.includes("invalid_api_key")) {
      return "INVALID_KEY (key is rejected by OpenAI)";
    }
    return `error: ${msg.substring(0, 200)}`;
  }
}

async function testGroq(key: string): Promise<string> {
  try {
    const client = new OpenAI({
      apiKey: key,
      baseURL: "https://api.groq.com/openai/v1",
    });
    await client.models.list();
    return "ok";
  } catch (err: any) {
    const msg = err?.error?.message ?? err?.message ?? String(err);
    if (msg.includes("Invalid API Key") || msg.includes("invalid_api_key")) {
      return "INVALID_KEY (key is rejected by Groq — check for extra spaces or copy errors)";
    }
    return `error: ${msg.substring(0, 200)}`;
  }
}

export async function GET() {
  const r = await requireRole(["MANAGING_PARTNER", "Managing Partner"]);
  if (r.ok === false) return r.response;

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const [geminiTest, openaiTest, groqTest] = await Promise.all([
    geminiKey ? testGemini(geminiKey) : Promise.resolve("not_configured"),
    openaiKey ? testOpenAI(openaiKey) : Promise.resolve("not_configured"),
    groqKey ? testGroq(groqKey) : Promise.resolve("not_configured"),
  ]);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "unknown",
    fallbackOrder: ["gemini", "openai", "groq"],
    providers: {
      gemini: {
        configured: !!geminiKey,
        keyPreview: previewKey(geminiKey),
        liveTest: geminiTest,
      },
      openai: {
        configured: !!openaiKey,
        keyPreview: previewKey(openaiKey),
        liveTest: openaiTest,
      },
      groq: {
        configured: !!groqKey,
        keyPreview: previewKey(groqKey),
        liveTest: groqTest,
      },
    },
    howToFix: {
      gemini: geminiTest.includes("INVALID")
        ? "Delete GEMINI_API_KEY in Vercel, paste a fresh key from https://aistudio.google.com/app/apikey, REDEPLOY."
        : geminiTest.includes("quota")
          ? "Key is valid but quota exhausted. Enable billing at https://aistudio.google.com or wait for reset."
          : "OK or not configured.",
      openai: openaiTest.includes("INVALID")
        ? "Delete OPENAI_API_KEY in Vercel, paste a fresh key from https://platform.openai.com/api-keys, REDEPLOY."
        : openaiTest.includes("no_credits")
          ? "Key is valid but account has no credits. Add billing at https://platform.openai.com/settings/organization/billing."
          : "OK or not configured.",
      groq: groqTest.includes("INVALID")
        ? "Delete GROQ_API_KEY in Vercel, paste a fresh key from https://console.groq.com/keys, REDEPLOY."
        : "OK or not configured.",
    },
    redeployReminder:
      "IMPORTANT: changing an env var in Vercel does NOT take effect until you Redeploy (Deployments → ⋯ → Redeploy → uncheck 'Use existing Build Cache').",
  });
}
