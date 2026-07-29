import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

export interface GeminiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GeminiResult {
  text: string;
  _stub: boolean;
}

export async function callGemini(
  prompt: string,
  systemInstruction?: string,
): Promise<GeminiResult> {
  const client = getClient();
  if (!client) {
    return {
      text:
        "[AI DISABLED — GEMINI_API_KEY not set on server]\n\nThis is a stub response. Set the GEMINI_API_KEY environment variable on your Vercel project to enable real AI generation.\n\nYour prompt was:\n" +
        prompt.slice(0, 500),
      _stub: true,
    };
  }

  try {
    const result = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction ?? undefined,
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    });

    const text = result.text ?? "";
    return { text, _stub: false };
  } catch (err: any) {
    console.error("[gemini] call failed:", err?.message ?? err);
    return {
      text: `[AI ERROR] ${err?.message ?? "Unknown error"}`,
      _stub: true,
    };
  }
}
