"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type StateResponse = {
  authenticated?: boolean;
  mfaRequired?: boolean;
};

/*
 * O SessionGuard é apenas uma proteção de UX.
 * APIs sensíveis continuam protegidas no backend.
 *
 * O cache curto e a Promise compartilhada evitam que React Strict Mode,
 * remounts ou pequenas atualizações de navegação façam várias consultas
 * simultâneas ao mesmo endpoint de MFA.
 */
const MFA_STATE_CACHE_MS = 2_000;

let pendingMfaStateRequest: Promise<StateResponse | null> | null = null;

let cachedMfaState:
  | {
      value: StateResponse;
      timestamp: number;
    }
  | null = null;

async function requestMfaState(): Promise<StateResponse | null> {
  const now = Date.now();

  if (
    cachedMfaState &&
    now - cachedMfaState.timestamp < MFA_STATE_CACHE_MS
  ) {
    return cachedMfaState.value;
  }

  if (pendingMfaStateRequest) {
    return pendingMfaStateRequest;
  }

  pendingMfaStateRequest = fetch("/api/account/security/mfa", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      /*
       * O guard não transforma falha da checagem de UX em erro global.
       * A autorização real continua sendo feita pelas APIs protegidas.
       */
      if (!response.ok) {
        return null;
      }

      const state = (await response.json()) as StateResponse;

      cachedMfaState = {
        value: state,
        timestamp: Date.now(),
      };

      return state;
    })
    .catch(() => null)
    .finally(() => {
      pendingMfaStateRequest = null;
    });

  return pendingMfaStateRequest;
}

export default function MfaSessionGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  /*
   * Dependemos da representação textual da query, não do objeto
   * ReadonlyURLSearchParams inteiro.
   */
  const search = searchParams?.toString() ?? "";

  useEffect(() => {
    let active = true;

    async function check() {
      if (
        !pathname ||
        pathname === "/mfa" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/register")
      ) {
        return;
      }

      const state = await requestMfaState();

      if (!active || !state) {
        return;
      }

      if (!state.authenticated || !state.mfaRequired) {
        return;
      }

      const next = `${pathname}${search ? `?${search}` : ""}`;

      router.replace(`/mfa?next=${encodeURIComponent(next)}`);
    }

    void check();

    return () => {
      active = false;
    };
  }, [pathname, router, search]);

  return null;
}
