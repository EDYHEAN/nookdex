import { cookies, headers } from "next/headers";
import { LANG_COOKIE, PATH_LANG_HEADER } from "./site";

/**
 * The visitor's language on the server: the page's own when its address says it (/en, /extensions, see proxy), else the one
 * picked in the app (cookie), else the browser's (French unless it says otherwise).
 */
export async function serverLang(): Promise<"fr" | "en"> {
  const byPath = (await headers()).get(PATH_LANG_HEADER);
  if (byPath === "fr" || byPath === "en") return byPath;
  const picked = (await cookies()).get(LANG_COOKIE)?.value;
  if (picked === "fr" || picked === "en") return picked;
  const accept = (await headers()).get("accept-language");
  // robots and browsers that say nothing get the French site
  if (!accept) return "fr";
  return /(^|,)\s*fr\b/i.test(accept) ? "fr" : "en";
}
