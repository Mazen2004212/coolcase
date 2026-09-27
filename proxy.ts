import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

function secretsMatch(actual: string | null, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function proxy(request: NextRequest) {
  const originSecret = process.env.AWS_ORIGIN_VERIFY_SECRET;
  if (
    originSecret
    && request.nextUrl.pathname !== "/api/health"
    && !secretsMatch(request.headers.get("x-coolcase-origin-verify"), originSecret)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
