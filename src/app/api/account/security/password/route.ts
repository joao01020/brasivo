import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import {
  createRequestSupabaseClient,
  enforceSameOrigin,
  enforceSensitiveAction,
  requireAuthenticatedSecurityContext,
  securityJson,
} from "@/lib/auth/server-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function POST(request: NextRequest) {
  /* BRASIVO_API_RATE_LIMIT_V2:POST:account-password */
  const brasivoRateLimit = await enforceApiRateLimit(
    request,
    "SECURITY",
    "account-password",
  );
  if (brasivoRateLimit) return brasivoRateLimit;

  const originGate = enforceSameOrigin(request);
  if (originGate) return originGate;

  const sensitiveGate = await enforceSensitiveAction();
  if (sensitiveGate) return sensitiveGate;

  const { context, response } =
    await requireAuthenticatedSecurityContext();

  if (response || !context) {
    return response;
  }

  let body: {
    currentPassword?: string;
    newPassword?: string;
  };

  try {
    body = await request.json();
  } catch {
    return securityJson(
      {
        error: "Requisição inválida.",
        code: "INVALID_JSON",
      },
      400,
    );
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  if (!context.email) {
    return securityJson(
      {
        error: "A conta não possui e-mail disponível para reautenticação.",
        code: "EMAIL_REQUIRED",
      },
      400,
    );
  }

  if (!currentPassword) {
    return securityJson(
      {
        error: "Informe sua senha atual.",
        code: "CURRENT_PASSWORD_REQUIRED",
      },
      400,
    );
  }

  if (newPassword.length < 8) {
    return securityJson(
      {
        error: "A nova senha precisa ter pelo menos 8 caracteres.",
        code: "WEAK_PASSWORD",
      },
      400,
    );
  }

  if (currentPassword === newPassword) {
    return securityJson(
      {
        error: "A nova senha deve ser diferente da senha atual.",
        code: "PASSWORD_REUSE",
      },
      400,
    );
  }

  /*
   * Verify the current password with an isolated, non-persisted Auth client.
   * This avoids replacing/downgrading the authenticated SSR cookie session.
   */
  const verifier = createSupabaseClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { error: verificationError } =
    await verifier.auth.signInWithPassword({
      email: context.email,
      password: currentPassword,
    });

  if (verificationError) {
    return securityJson(
      {
        error: "A senha atual está incorreta.",
        code: "INVALID_CURRENT_PASSWORD",
      },
      401,
    );
  }

  const supabase = await createRequestSupabaseClient();

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return securityJson(
      {
        error: "Não foi possível alterar a senha.",
        code: "PASSWORD_UPDATE_FAILED",
      },
      400,
    );
  }

  return securityJson({
    ok: true,
  });
}
