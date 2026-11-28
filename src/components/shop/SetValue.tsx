import Link from "next/link";
import { formatDate, num } from "@/lib/blog";
import { cardSlug, setMoves } from "@/lib/cardPages";
import { money, setPage, trendOf } from "@/lib/setPages";
import { type PageLang, setPageEntries, setPagePath } from "@/lib/setPath";
import { SITE_NAME } from "@/lib/site";
import c from "./SetShop.module.css";

/** The latest sets out (release date passed), newest first: their TCGdex ids */
export function latestSetsOut(lang: PageLang, n = 3) {
  const today = new Date().toISOString().slice(0, 10);
  return setPageEntries(lang)
    .filter((e) => !e.set.extra && !!e.set.releaseDate && e.set.releaseDate <= today)
    .sort((a, b) => b.set.releaseDate!.localeCompare(a.set.releaseDate!))
    .slice(0, n)
    .map((e) => e.set.id);
}

/**
 * « Ce que valent ses cartes aujourd'hui » (2026-11-28): the first of `setIds` that has priced cards, in our own figures (the
 * day's prices, the month's move from public/history, its dearest cards), linked to its set and card pages. Google had
 * dropped the Amazon and calendar pages with the rest of the site: what only we can tell, next to what every shop lists.
 */
export async function SetValue({ lang, setIds }: { lang: PageLang; setIds: (string | null | undefined)[] }) {
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  for (const id of setIds) {
    const path = id ? setPagePath(lang, id) : null;
    const p = path ? await setPage(lang, path.split("/").pop()!) : null;
    if (!p || p.priced < 5) continue;
    const moves = await setMoves(lang, p.set, p.data);
    const change = moves ? (moves.totalTo / moves.totalFrom - 1) * 100 : null;
    const dear = p.top.filter((x) => x.img).slice(0, 4);
    const market = fr ? "Cardmarket" : "TCGplayer";
    const name = p.set.name;
    return (
      <section className={c.sec}>
        <h2>{fr ? <>Ce que valent les cartes de <em>{name}</em> aujourd&apos;hui</> : <>What <em>{name}</em> cards are worth today</>}</h2>
        <p className={c.sub}>
          {t(
            `Une carte de chaque : ${money(p.total, p)} au prix tendance ${market} du ${formatDate(p.data.pricesUpdated.slice(0, 10), lang)}`,
            `One of each card: ${money(p.total, p)} at ${market}'s market price of ${formatDate(p.data.pricesUpdated.slice(0, 10), lang)}`,
          )}
          {moves && change != null && Math.abs(change) >= 1
            ? t(
                `, ${change > 0 ? "+" : "−"}${Math.abs(Math.round(change))} % depuis le ${formatDate(moves.from, lang)} (relevé chaque jour par ${SITE_NAME}).`,
                `, ${change > 0 ? "+" : "−"}${Math.abs(Math.round(change))}% since ${formatDate(moves.from, lang)} (logged daily by ${SITE_NAME}).`,
              )
            : "."}
          {p.set.releaseDate && t(` Sortie le ${formatDate(p.set.releaseDate, lang)}.`, ` Released ${formatDate(p.set.releaseDate, lang)}.`)}
        </p>
        <ul className={c.moves}>
          {dear.map((card) => (
            <li key={card.id}>
              <Link prefetch={false} href={`${p.path}/${cardSlug(card)}`}>
                <img src={`${card.img}/low.webp`} width={245} height={342} alt="" loading="lazy" decoding="async" />
                <span>
                  <b>
                    {card.name} {num(card, p.data)}
                  </b>
                  <small>{card.rarity}</small>
                </span>
                <em>{money(trendOf(card) ?? 0, p)}</em>
              </Link>
            </li>
          ))}
        </ul>
        <p className={c.other}>
          <Link prefetch={false} href={p.path}>
            {t(`Les ${p.data.cards.length} cartes de ${name} et leurs prix →`, `All ${p.data.cards.length} ${name} cards and their prices →`)}
          </Link>
        </p>
      </section>
    );
  }
  return null;
}
