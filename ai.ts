const MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];

export function geminiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    null
  );
}

export function aiConfigured(): boolean {
  return Boolean(geminiKey());
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
};

/**
 * Calls Gemini. Returns null when the key is missing or the request fails so
 * callers can fall back to the deterministic reasoning engine.
 */
export async function generateText(system: string, prompt: string, maxTokens = 700): Promise<string | null> {
  const key = geminiKey();
  if (!key) return null;

  for (const model of MODEL_CANDIDATES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
          }),
        },
      );
      if (!response.ok) continue;
      const data = (await response.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (text) return text;
    } catch {
      // try next model
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}
