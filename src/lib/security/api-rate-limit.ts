import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type ApiRateLimitPolicyName =
  | "PUBLIC_LIGHT"
  | "PUBLIC_HEAVY"
  | "AI"
  | "AUTH_WRITE"
  | "SECURITY"
  | "ACCOUNT_DELETE"
  | "INTERNAL";

type Policy = {
  limit: number;
  windowSeconds: number;
  failOpen: boolean;
  includeUserIdentity: boolean;
  maxBodyBytes?: number;
};

type RpcResult = {
  allowed: boolean;
  remaining: number;
  retry_after: number;
  reset_at: string;
};

const POLICIES: Record<ApiRateLimitPolicyName, Policy> = {
  PUBLIC_LIGHT: {
    limit: 180,
    windowSeconds: 60,
    failOpen: true,
    includeUserIdentity: false,
  },
  PUBLIC_HEAVY: {
    limit: 60,
    windowSeconds: 60,
    failOpen: true,
    includeUserIdentity: false,
  },
  AI: {
    limit: 10,
    windowSeconds: 60,
    failOpen: false,
    includeUserIdentity: false,
  },
  AUTH_WRITE: {
    limit: 20,
    windowSeconds: 60,
    failOpen: false,
    includeUserIdentity: true,
    maxBodyBytes: 64 * 1024,
  },
  SECURITY: {
    limit: 5,
    windowSeconds: 15 * 60,
    failOpen: false,
    includeUserIdentity: true,
    maxBodyBytes: 32 * 1024,
  },
  ACCOUNT_DELETE: {
    limit: 3,
    windowSeconds: 60 * 60,
    failOpen: false,
    includeUserIdentity: true,
    maxBodyBytes: 16 * 1024,
  },
  INTERNAL: {
    limit: 5,
    windowSeconds: 60,
    failOpen: false,
    includeUserIdentity: false,
    maxBodyBytes: 16 * 1024,
  },
};

const MAX_URL_LENGTH = 4096;
const MAX_FOLLOWER_IDS = 100;

let warnedMissingConfig = false;

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function requestIp(request: Request) {
  return (
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ??
    firstHeaderValue(request.headers.get("x-forwarded-for")) ??
    firstHeaderValue(request.headers.get("x-real-ip")) ??
    "unknown"
  );
}

function contentLength(request: Request) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function rateLimitHeaders(
  policy: Policy,
  remaining: number,
  retryAfter: number,
  resetAt: string,
) {
  return {
    "Cache-Control": "no-store",
    "Retry-After": String(Math.max(1, retryAfter)),
    "RateLimit-Limit": String(policy.limit),
    "RateLimit-Remaining": String(Math.max(0, remaining)),
    "RateLimit-Reset": resetAt,
  };
}

function jsonError(
  status: number,
  message: string,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(headers ?? {}),
      },
    },
  );
}

async function hmacHex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function limiterConfiguration() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "";

  const pepper = process.env.RATE_LIMIT_PEPPER?.trim() || "";

  return {
    url,
    serviceKey,
    pepper,
    configured: Boolean(url && serviceKey && pepper),
  };
}

async function currentUserId() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
  } catch {
    return null;
  }
}

function validateRequestShape(request: Request, routeKey: string, policy: Policy) {
  if (request.url.length > MAX_URL_LENGTH) {
    return jsonError(414, "Requisição muito longa.");
  }

  if (policy.maxBodyBytes) {
    const length = contentLength(request);

    if (length !== null && length > policy.maxBodyBytes) {
      return jsonError(413, "Corpo da requisição excede o limite permitido.");
    }
  }

  if (routeKey === "mandates-followers-batch") {
    try {
      const url = new URL(request.url);
      const ids = (url.searchParams.get("ids") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (ids.length > MAX_FOLLOWER_IDS) {
        return jsonError(
          400,
          `No máximo ${MAX_FOLLOWER_IDS} identificadores podem ser consultados por requisição.`,
        );
      }
    } catch {
      return jsonError(400, "Parâmetros de consulta inválidos.");
    }
  }

  return null;
}

/**
 * Proteção distribuída de abuso para Route Handlers do BRASIVO.
 *
 * - contador atômico em Supabase/Postgres;
 * - IP nunca é persistido em texto puro;
 * - HMAC-SHA256 com RATE_LIMIT_PEPPER;
 * - usuário autenticado vira uma segunda chave em operações sensíveis;
 * - 429 inclui Retry-After e RateLimit-*;
 * - leituras públicas falham abertas se o limitador estiver indisponível;
 * - IA, mutações e segurança falham fechadas.
 */
export async function enforceApiRateLimit(
  request: Request,
  policyName: ApiRateLimitPolicyName,
  routeKey: string,
): Promise<NextResponse | null> {
  const policy = POLICIES[policyName];

  const invalidRequest = validateRequestShape(request, routeKey, policy);
  if (invalidRequest) return invalidRequest;

  const config = limiterConfiguration();

  if (!config.configured) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        "[BRASIVO rate limit] configuração incompleta: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY e RATE_LIMIT_PEPPER são necessários.",
      );
    }

    if (policy.failOpen) return null;

    return jsonError(
      503,
      "Proteção de segurança temporariamente indisponível.",
    );
  }

  try {
    const ip = requestIp(request);
    const identities = [`ip:${ip}`];

    if (policy.includeUserIdentity) {
      const userId = await currentUserId();
      if (userId) identities.push(`user:${userId}`);
    }

    const bucketKeys = await Promise.all(
      identities.map((identity) =>
        hmacHex(
          config.pepper,
          `brasivo:v2:${policyName}:${routeKey}:${identity}`,
        ),
      ),
    );

    const admin = createSupabaseAdminClient(
      config.url,
      config.serviceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data, error } = await admin.rpc(
      "consume_api_rate_limits",
      {
        p_bucket_keys: bucketKeys,
        p_policy: `${policyName}:${routeKey}`,
        p_limit: policy.limit,
        p_window_seconds: policy.windowSeconds,
      },
    );

    if (error) throw error;

    const raw = Array.isArray(data) ? data[0] : data;
    const result = raw as RpcResult | null;

    if (!result || typeof result.allowed !== "boolean") {
      throw new Error("Resposta inválida do limitador distribuído.");
    }

    if (result.allowed) return null;

    return jsonError(
      429,
      "Muitas requisições. Aguarde e tente novamente.",
      rateLimitHeaders(
        policy,
        Number(result.remaining ?? 0),
        Number(result.retry_after ?? policy.windowSeconds),
        String(result.reset_at ?? ""),
      ),
    );
  } catch (error) {
    console.error(
      `[BRASIVO rate limit] ${policyName}/${routeKey}`,
      error,
    );

    if (policy.failOpen) return null;

    return jsonError(
      503,
      "Proteção de segurança temporariamente indisponível.",
    );
  }
}
