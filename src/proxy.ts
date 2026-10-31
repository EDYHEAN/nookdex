import { type NextRequest, NextResponse } from "next/server";
import { PATH_HEADER } from "@/lib/roomless";
import { PATH_LANG_HEADER } from "@/lib/site";

/**
 * Pages whose address says their language (/en…: English, /extensions…, /calendrier-des-sorties, /invitations-amazon and /marche: French): the server renders them in it,
 * <html lang> included, whatever the cookie or the browser says (lib/serverLang reads this header first). Their path too:
 * the desk layout leaves the room's logo out of the pages drawn without the room (lib/roomless).
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATH_LANG_HEADER, request.nextUrl.pathname.startsWith("/en") ? "en" : "fr");
  headers.set(PATH_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/en", "/en/:path*", "/extensions", "/extensions/:path*", "/calendrier-des-sorties", "/invitations-amazon", "/marche"],
};
