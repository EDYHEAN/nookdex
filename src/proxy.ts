import { type NextRequest, NextResponse } from "next/server";
import { PATH_LANG_HEADER } from "@/lib/site";

/**
 * Pages whose address says their language (/en…: English, /extensions…: French cards): the server renders them in it,
 * <html lang> included, whatever the cookie or the browser says (lib/serverLang reads this header first).
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATH_LANG_HEADER, request.nextUrl.pathname.startsWith("/en") ? "en" : "fr");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/en", "/en/:path*", "/extensions", "/extensions/:path*"],
};
