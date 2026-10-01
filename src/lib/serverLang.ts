import { cookies, headers } from "next/headers";
import { LANG_COOKIE } from "./site";

/** The visitor's language on the server: the one picked in the app (cookie), else the browser's (French unless it says otherwise). */
export async function serverLang(): Promise<"fr" | "en"> {
  const picked = (await cookies()).get(LANG_COOKIE)?.value;
  if (picked === "fr" || picked === "en") return picked;
  const accept = (await headers()).get("accept-language");
  // robots and browsers that say nothing get the French site
  if (!accept) return "fr";
  return /(^|,)\s*fr\b/i.test(accept) ? "fr" : "en";
}
