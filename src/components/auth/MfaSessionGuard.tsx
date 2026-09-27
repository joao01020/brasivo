"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type StateResponse = {
  authenticated?: boolean;
  mfaRequired?: boolean;
};

export default function MfaSessionGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

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

      try {
        const response = await fetch(
          "/api/account/security/mfa",
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          },
        );

        if (!active || !response.ok) return;

        const state = (await response.json()) as StateResponse;

        if (!state.authenticated || !state.mfaRequired) return;

        const query = searchParams?.toString();
        const next = `${pathname}${query ? `?${query}` : ""}`;

        router.replace(
          `/mfa?next=${encodeURIComponent(next)}`,
        );
      } catch {
        // Sensitive APIs remain protected on the backend even if this UX check
        // cannot complete.
      }
    }

    void check();

    return () => {
      active = false;
    };
  }, [pathname, router, searchParams]);

  return null;
}
