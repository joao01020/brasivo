import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const redirectTo = request.nextUrl.clone();

  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");

  if (!tokenHash || !type) {
    redirectTo.pathname = "/reset-password";
    redirectTo.searchParams.set("error", "invalid_link");

    return NextResponse.redirect(redirectTo);
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      console.error("[BRASIVO recovery verifyOtp]", {
        name: error.name,
        message: error.message,
        status: error.status,
      });

      redirectTo.pathname = "/reset-password";
      redirectTo.searchParams.set("error", "invalid_link");

      return NextResponse.redirect(redirectTo);
    }

    redirectTo.pathname = "/reset-password";
    redirectTo.searchParams.delete("error");

    return NextResponse.redirect(redirectTo);
  } catch (error) {
    console.error("[BRASIVO recovery confirm]", error);

    redirectTo.pathname = "/reset-password";
    redirectTo.searchParams.set("error", "invalid_link");

    return NextResponse.redirect(redirectTo);
  }
}
