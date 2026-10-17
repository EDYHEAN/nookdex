import fs from "node:fs";
import path from "node:path";
import type { CardLang } from "./cardLang";
import { SITE_URL } from "./site";
import type { SetData } from "./types";

/**
 * A set's file (public/sets) on the server: set pages, the blog's card sheets, the sitemap, the share pictures.
 * The files are left out of the server functions (next.config: 30 MB in each of them, and Vercel's Hobby plan keeps every
 * deploy of the last 30 days within 10 GB): they're read from disk where it has them (dev, and the build that prerenders
 * the sitemap), else fetched from the site's own static files, which are this deploy's once it's live.
 */

const files = new Map<string, Promise<SetData | null>>();

export function setFile(lang: CardLang, id: string): Promise<SetData | null> {
  // literal path parts: the tracer then only sees public/sets (excluded in next.config), not the whole project
  const file = path.join(process.cwd(), "public", "sets", ...(lang === "fr" ? [] : [lang]), `${id}.json`);
  // read once per server instance in production: the daily prices come with a new deploy
  if (!files.has(file) || process.env.NODE_ENV !== "production") {
    const read = load(file, ["sets", ...(lang === "fr" ? [] : [lang]), `${id}.json`].join("/"));
    files.set(file, read);
    // a fetch that failed is tried again on the next request instead of hiding the set until the next deploy
    void read.then((d) => {
      if (!d && files.get(file) === read) files.delete(file);
    });
  }
  return files.get(file)!;
}

const others = new Map<string, Promise<unknown>>();

/**
 * Another file of public/ the same way (a set's price history, the search index): from disk, else from the site. Parts
 * of its path, e.g. ["history", "fr", "sv08.json"].
 */
export function publicJson<T>(...parts: string[]): Promise<T | null> {
  const file = path.join(process.cwd(), "public", ...parts);
  if (!others.has(file) || process.env.NODE_ENV !== "production") {
    const read = load(file, parts.join("/"));
    others.set(file, read);
    void read.then((d) => {
      if (!d && others.get(file) === read) others.delete(file);
    });
  }
  return others.get(file) as Promise<T | null>;
}

async function load<T = SetData>(file: string, url: string): Promise<T | null> {
  if (fs.existsSync(file)) return JSON.parse(await fs.promises.readFile(file, "utf8")) as T;
  try {
    const r = await fetch(`${SITE_URL}/${url}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
