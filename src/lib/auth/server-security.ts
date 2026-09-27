import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function normalizeAalLevel(value: unknown): "aal1" | "aal2" | null {
  return value === "aal1" || value === "aal2" ? value : null;
}

type SecurityContext = {
  userId: string;
  email: string | null;
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  verifiedTotpFactors: Array<{
    id: string;
    friendlyName: string | null;
  }>;
};

function env(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

/**
 * Create one Supabase SSR client per request.
 * Never share this object across requests.
 */
export async function createRequestSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // A Server Component may be unable to mutate cookies.
            // Route Handlers used for security-sensitive mutations can.
          }
        },
      },
    },
  );
}

export async function getServerSecurityContext(): Promise<SecurityContext | null> {
  const supabase = await createRequestSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const [
    { data: factors, error: factorsError },
    { data: aal, error: aalError },
  ] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (factorsError) {
    throw factorsError;
  }

  if (aalError) {
    throw aalError;
  }

  const verifiedTotpFactors = (factors?.totp ?? [])
    .filter((factor) => factor.status === "verified")
    .map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name ?? null,
    }));

  return {
    userId: user.id,
    email: user.email ?? null,
    currentLevel: normalizeAalLevel(aal?.currentLevel),
    nextLevel: normalizeAalLevel(aal?.nextLevel),
    verifiedTotpFactors,
  };
}

export function securityJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Defense in depth for cookie-authenticated mutating endpoints.
 */
export function enforceSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(request.url).origin;

  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      return securityJson(
        {
          error: "Origem da requisição não pôde ser validada.",
          code: "ORIGIN_REQUIRED",
        },
        403,
      );
    }

    return null;
  }

  if (origin !== expectedOrigin) {
    return securityJson(
      {
        error: "Origem da requisição não autorizada.",
        code: "ORIGIN_MISMATCH",
      },
      403,
    );
  }

  return null;
}

/**
 * Sensitive account actions:
 * - require an authenticated user;
 * - if the user opted into MFA, require an AAL2 session.
 *
 * This is the backend authority. Frontend redirects are only UX.
 */
export async function enforceSensitiveAction() {
  const context = await getServerSecurityContext();

  if (!context) {
    return securityJson(
      {
        error: "Sessão inválida ou expirada.",
        code: "AUTH_REQUIRED",
      },
      401,
    );
  }

  if (
    context.verifiedTotpFactors.length > 0 &&
    context.currentLevel !== "aal2"
  ) {
    return securityJson(
      {
        error: "Confirme a autenticação em duas etapas para continuar.",
        code: "MFA_REQUIRED",
      },
      403,
    );
  }

  return null;
}

export async function requireAuthenticatedSecurityContext() {
  const context = await getServerSecurityContext();

  if (!context) {
    return {
      context: null,
      response: securityJson(
        {
          error: "Sessão inválida ou expirada.",
          code: "AUTH_REQUIRED",
        },
        401,
      ),
    };
  }

  return {
    context,
    response: null,
  };
}
