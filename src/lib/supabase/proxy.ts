import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  isAuthPage,
  isProtectedPage,
  safeInternalNext,
} from "@/lib/auth/route-access";

function requiredEnv(name: string) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

/**
 * Refreshes the Supabase cookie session and enforces page access.
 *
 * Security rule:
 * - never authorize a protected page using getSession();
 * - getClaims() verifies the JWT before the route can render.
 */
export async function updateSession(
  request: NextRequest,
) {
  let response =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      requiredEnv(
        "NEXT_PUBLIC_SUPABASE_URL",
      ),
      requiredEnv(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet,
          ) {
            for (
              const {
                name,
                value,
              }
              of cookiesToSet
            ) {
              request.cookies.set(
                name,
                value,
              );
            }

            response =
              NextResponse.next({
                request,
              });

            for (
              const {
                name,
                value,
                options,
              }
              of cookiesToSet
            ) {
              response.cookies.set(
                name,
                value,
                options,
              );
            }
          },
        },
      },
    );

  let authenticated =
    false;

  try {
    const {
      data,
      error,
    } =
      await supabase.auth.getClaims();

    authenticated =
      !error &&
      Boolean(
        data?.claims?.sub,
      );
  } catch {
    /*
     * Authentication verification failed.
     * Protected routes must fail closed.
     */
    authenticated =
      false;
  }

  const pathname =
    request.nextUrl.pathname;

  if (
    isProtectedPage(
      pathname,
    ) &&
    !authenticated
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      "/login";

    loginUrl.search =
      "";

    loginUrl.searchParams.set(
      "next",
      safeInternalNext(
        pathname,
        request.nextUrl.search,
      ),
    );

    const redirect =
      NextResponse.redirect(
        loginUrl,
        307,
      );

    /*
     * Never cache auth redirects at Cloudflare/CDN level.
     */
    redirect.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0",
    );
    redirect.headers.set(
      "Pragma",
      "no-cache",
    );
    redirect.headers.set(
      "X-Content-Type-Options",
      "nosniff",
    );

    /*
     * Preserve refreshed auth cookies, if Supabase emitted any.
     */
    for (
      const cookie
      of response.cookies.getAll()
    ) {
      redirect.cookies.set(
        cookie,
      );
    }

    return redirect;
  }

  /*
   * An already-authenticated user does not need login/register.
   * This also avoids confusing navigation back to login after sign-in.
   */
  if (
    authenticated &&
    isAuthPage(
      pathname,
    )
  ) {
    const destination =
      request.nextUrl.clone();

    destination.pathname =
      "/dashboard";
    destination.search =
      "";

    const redirect =
      NextResponse.redirect(
        destination,
        307,
      );

    redirect.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0",
    );
    redirect.headers.set(
      "Pragma",
      "no-cache",
    );

    for (
      const cookie
      of response.cookies.getAll()
    ) {
      redirect.cookies.set(
        cookie,
      );
    }

    return redirect;
  }

  /*
   * Any response that may refresh authentication cookies must never be
   * shared through a CDN cache.
   */
  if (
    isProtectedPage(pathname) ||
    isAuthPage(pathname)
  ) {
    response.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0",
    );
    response.headers.set(
      "Pragma",
      "no-cache",
    );
  }

  return response;
}
