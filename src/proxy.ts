import { type NextRequest, NextResponse } from "next/server";
import { PATH_HEADER } from "@/lib/roomless";
import { PATH_LANG_HEADER } from "@/lib/site";

/**
 * Pages whose address says their language (/en…: English, /extensions…, /calendrier-des-sorties, /invitations-amazon and /marche: French): the server renders them in it,
 * <html lang> included, whatever the cookie or the browser says (lib/serverLang reads this header first). Their path too:
 * the desk layout leaves the room's logo out of the pages drawn without the room (lib/roomless). The blog and the text
 * pages (terms, legal notice, privacy, terms of sale, contact) only get their path: they speak the visitor's language (a
 * post its own).
 */
const OWN_LANG = /^\/(blog|conditions|mentions-legales|confidentialite|conditions-de-vente|contact)(\/|$)/;

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const path = request.nextUrl.pathname;
  if (!OWN_LANG.test(path)) headers.set(PATH_LANG_HEADER, path.startsWith("/en") ? "en" : "fr");
  headers.set(PATH_HEADER, path);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/en", "/en/:path*", "/extensions", "/extensions/:path*", "/calendrier-des-sorties", "/invitations-amazon", "/marche", "/blog", "/blog/:slug", "/conditions", "/mentions-legales", "/confidentialite", "/conditions-de-vente", "/contact"],
};
