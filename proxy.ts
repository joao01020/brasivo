import type { NextRequest } from "next/server";

import { updateSession } from "./src/lib/supabase/proxy";

export async function proxy(
  request: NextRequest,
) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on application pages, while skipping static assets and API routes.
     *
     * API authorization remains inside Route Handlers, where the BRASIVO
     * already applies server-side authentication/AAL checks.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
