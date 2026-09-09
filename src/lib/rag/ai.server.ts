/**
 * Lovable AI Gateway helpers.
 *
 * Deployment note (for the thesis defence):
 * the notebook used `intfloat/multilingual-e5-base` (768-d) with a FAISS
 * IndexFlatIP. A Python/FAISS process cannot run inside this web runtime, so the
 * deployed system keeps the exact same dense-retrieval mathematics — L2
 * normalised multilingual embeddings compared with inner product / cosine — but
 * uses a hosted multilingual embedding model and a pgvector index instead.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const EMBED_MODEL = "google/gemini-embedding-2";
export const CHAT_MODEL = "google/gemini-3.8-flash";

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

function l2normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

export class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Embed texts with the E5-style "query: " / "passage: " prefixing from the notebook. */
export async function embedTexts(
  texts: string[],
  kind: "query" | "passage",
): Promise<number[][]> {
  const input = texts.map((t) => `${kind}: ${t.slice(0, 6000)}`);

  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GatewayError(res.status, `Embedding request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { data: Array<{ embedding: number[]; index?: number }> };
  const sorted = [...json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((d) => l2normalize(d.embedding));
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) dot += a[i]! * b[i]!;
  return dot;
}

export async function chatComplete(prompt: string, maxTokens = 700): Promise<string> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GatewayError(res.status, `Generation failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}
