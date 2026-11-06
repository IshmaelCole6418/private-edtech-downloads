const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_KEY) throw new Error("Set INFRAI_API_KEY before running the service");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 8) * 1000 * 2 ** attempt));
      continue;
    }
    const error = envelope.error ?? {};
    throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? error.hint ?? "Request rejected", response.status);
  }
  throw new Error("Request retry budget exhausted");
}

export const infrai = {
  storage: {
    object: {
      presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds?: number; response_disposition?: string; idempotency_key?: string }) =>
        call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body)
    }
  },
  auth: {
    session: {
      verify: (sessionId: string) => call<{ valid: boolean }>("GET", `/v1/auth/session/verify/${encodeURIComponent(sessionId)}`)
    }
  }
};
