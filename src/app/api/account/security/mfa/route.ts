import { enforceApiRateLimit } from "@/lib/security/api-rate-limit";
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

type MfaAction =
  | {
      action: "enroll";
      friendlyName?: string;
    }
  | {
      action: "verify";
      factorId: string;
      code: string;
    }
  | {
      action: "unenroll";
      factorId: string;
    };

function normalizeCode(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\D/g, "").slice(0, 6)
    : "";
}

export async function GET(request: Request) {
  /* BRASIVO_API_RATE_LIMIT_V2:GET:account-mfa */
  const brasivoRateLimit = await enforceApiRateLimit(
    request,
    "SECURITY_READ",
    "account-mfa-state",
  );
  if (brasivoRateLimit) return brasivoRateLimit;

  try {
    const { context, response } =
      await requireAuthenticatedSecurityContext();

    if (response || !context) {
      return response;
    }

    return securityJson({
      authenticated: true,
      currentLevel: context.currentLevel,
      nextLevel: context.nextLevel,
      mfaRequired:
        context.verifiedTotpFactors.length > 0 &&
        context.currentLevel !== "aal2",
      factors: context.verifiedTotpFactors,
    });
  } catch {
    return securityJson(
      {
        error: "Não foi possível consultar a segurança da conta.",
        code: "SECURITY_STATE_FAILED",
      },
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  /* BRASIVO_API_RATE_LIMIT_V2:POST:account-mfa */
  const brasivoRateLimit = await enforceApiRateLimit(
    request,
    "SECURITY",
    "account-mfa",
  );
  if (brasivoRateLimit) return brasivoRateLimit;

  const originGate = enforceSameOrigin(request);
  if (originGate) return originGate;

  const { context, response } =
    await requireAuthenticatedSecurityContext();

  if (response || !context) {
    return response;
  }

  let body: MfaAction;

  try {
    body = (await request.json()) as MfaAction;
  } catch {
    return securityJson(
      {
        error: "Requisição inválida.",
        code: "INVALID_JSON",
      },
      400,
    );
  }

  const supabase = await createRequestSupabaseClient();

  if (body.action === "enroll") {
    const friendlyName =
      typeof body.friendlyName === "string"
        ? body.friendlyName.trim().slice(0, 64)
        : "";

    try {
      const { data: existing } = await supabase.auth.mfa.listFactors();

      // Clean abandoned unverified TOTP enrollments only.
      for (const factor of existing?.totp ?? []) {
        if (factor.status !== "verified") {
          await supabase.auth.mfa
            .unenroll({
              factorId: factor.id,
            })
            .catch(() => undefined);
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName:
          friendlyName ||
          (context.verifiedTotpFactors.length > 0
            ? "BRASIVO Backup Authenticator"
            : "BRASIVO Authenticator"),
      });

      if (error) throw error;

      return securityJson({
        factorId: data.id,
        friendlyName: data.friendly_name ?? null,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
    } catch {
      return securityJson(
        {
          error: "Não foi possível iniciar a configuração do 2FA.",
          code: "MFA_ENROLL_FAILED",
        },
        400,
      );
    }
  }

  if (body.action === "verify") {
    const factorId =
      typeof body.factorId === "string" ? body.factorId.trim() : "";
    const code = normalizeCode(body.code);

    if (!factorId || code.length !== 6) {
      return securityJson(
        {
          error: "Fator ou código de verificação inválido.",
          code: "INVALID_MFA_CODE",
        },
        400,
      );
    }

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const ownFactor = (factors?.totp ?? []).find(
        (factor) => factor.id === factorId,
      );

      if (!ownFactor) {
        return securityJson(
          {
            error: "Fator de autenticação não encontrado.",
            code: "MFA_FACTOR_NOT_FOUND",
          },
          404,
        );
      }

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });

      if (error) throw error;

      await supabase.auth.refreshSession();

      return securityJson({
        ok: true,
        level: "aal2",
      });
    } catch {
      return securityJson(
        {
          error: "Código inválido ou expirado.",
          code: "MFA_VERIFY_FAILED",
        },
        400,
      );
    }
  }

  if (body.action === "unenroll") {
    const sensitiveGate = await enforceSensitiveAction();
    if (sensitiveGate) return sensitiveGate;

    const factorId =
      typeof body.factorId === "string" ? body.factorId.trim() : "";

    if (!factorId) {
      return securityJson(
        {
          error: "Fator de autenticação inválido.",
          code: "INVALID_FACTOR",
        },
        400,
      );
    }

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();

      const ownVerifiedFactor = (factors?.totp ?? []).find(
        (factor) =>
          factor.id === factorId &&
          factor.status === "verified",
      );

      if (!ownVerifiedFactor) {
        return securityJson(
          {
            error: "Fator verificado não encontrado.",
            code: "MFA_FACTOR_NOT_FOUND",
          },
          404,
        );
      }

      const { error } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (error) throw error;

      await supabase.auth.refreshSession();

      return securityJson({
        ok: true,
      });
    } catch {
      return securityJson(
        {
          error: "Não foi possível remover o autenticador.",
          code: "MFA_UNENROLL_FAILED",
        },
        400,
      );
    }
  }

  return securityJson(
    {
      error: "Ação de segurança não reconhecida.",
      code: "UNKNOWN_ACTION",
    },
    400,
  );
}
