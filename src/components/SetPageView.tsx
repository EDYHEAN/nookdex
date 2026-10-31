import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, num } from "@/lib/blog";
import { amazonOn, amazonSearch, inShops } from "@/lib/amazon";
import { KIND_LABEL, SHOP_PATH, boosterPics, byInterest, goLabel, productHref, productPic, shopOfSet } from "@/lib/amazonShop";
import { kindArt } from "@/lib/kindArt";
import { currencyOf, keyOf } from "@/lib/cardLang";
import { type PageLang, SET_PAGES_ROOT, setPageEntries } from "@/lib/setPath";
import { cardSlug, topCards } from "@/lib/cardPages";
import { cardCount, money, setFaq, setPage, trendOf } from "@/lib/setPages";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { CardData } from "@/lib/types";
import { Affiliate, AmazonButton, CardStage, KindTiles, ProductRail, Stage } from "./shop/ShopBits";
import { ShopHero } from "./shop/ShopHero";
import { StickyBuy } from "./shop/StickyBuy";
import s from "./shop/Shop.module.css";
import c from "./shop/SetShop.module.css";
import { WidePage } from "./WidePage";

/**
 * One set's page, French cards (/extensions/<slug>) or English ones (/en/sets/<slug>): its cards, today's prices, the most
 * wanted ones, and a door to the desk. Written for the people who search "<set> card list" or "<set> prices".
 */
export const setPageParams = (lang: PageLang) => setPageEntries(lang).map((e) => ({ slug: e.slug }));

export async function setPageMetadata(lang: PageLang, slug: string): Promise<Metadata> {
  const p = await setPage(lang, slug);
  if (!p) return {};
  const fr = lang === "fr";
  const { n } = cardCount(p);
  const name = p.set.name;
  const best = p.top[0];
  const title = fr ? `${name} (${p.set.code}) : liste des cartes et prix · ${SITE_NAME}` : `${name} (${p.set.code}): card list and prices · ${SITE_NAME}`;
  const description = fr
    ? `Les ${n} cartes de ${name} (${p.set.serieName}${p.set.releaseDate ? `, ${p.set.releaseDate.slice(0, 4)}` : ""}) avec leur rareté et leur prix Cardmarket du jour.` +
      (best ? ` La plus chère : ${best.name} (${money(trendOf(best)!, p)}).` : "")
    : `All ${n} cards of ${name} (${p.set.serieName}${p.set.releaseDate ? `, ${p.set.releaseDate.slice(0, 4)}` : ""}) with their rarity and today's TCGplayer price.` +
      (best ? ` Most expensive: ${best.name} (${money(trendOf(best)!, p)}).` : "");
  const languages = { [lang]: p.path, ...(p.other ? { [p.other.lang]: p.other.path } : {}) };
  return {
    title,
    description,
    alternates: { canonical: p.path, languages },
    openGraph: {
      type: "website",
      url: p.path,
      siteName: SITE_NAME,
      title,
      description,
      locale: fr ? "fr_FR" : "en_GB",
      images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: SITE_NAME }],
    },
  };
}

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

/** a set's logo: the site's small webp ones (fetch-set makes them beside the PNG, some of which weigh 1 MB), else TCGdex's */
const logoOf = (logo: string | null, big = false) =>
  !logo
    ? null
    : logo.startsWith("/")
      ? { src: `${logo}-sm.webp`, srcSet: big ? `${logo}-sm.webp 320w, ${logo}-md.webp 640w` : undefined }
      : { src: `${logo}.png`, srcSet: undefined };

/**
 * A set's page under the lamp (« Sous la lampe », Johan 2026-10-31; WidePage shop, drawn without the room). While the set
 * is in the shops (out within two years): its products in the hero and « le rayon » (amazon.fr's, else searches by kind;
 * amazon.com's on an English page), its dearest cards, the desk after them. Older: the desk is the hero's button, no
 * Amazon. Every word of the old page stays: the facts, the text, the rarities, every card, the FAQ, the posts.
 */
export async function SetPageView({ lang, slug }: { lang: PageLang; slug: string }) {
  const p = await setPage(lang, slug);
  if (!p) notFound();
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const { n, official, beyond } = cardCount(p);
  const name = p.set.name;
  const day = formatDate(p.data.pricesUpdated.slice(0, 10), lang);
  const market = fr ? "Cardmarket" : "TCGplayer";
  const faq = setFaq(p);
  const url = `${SITE_URL}${p.path}`;
  const root = SET_PAGES_ROOT[lang];
  const logo = logoOf(p.set.logo, true);
  /** "186/195": the number as printed on the card */
  const numOf = (c: CardData) => num(c, p.data);
  // the shop: amazon.fr's products of a French set, else searches; nothing once the set is out of the shops
  const inShop = amazonOn(lang) && inShops(p.set.releaseDate);
  const shop = fr && inShop ? shopOfSet(p.set.id) : undefined;
  const soon = !!shop?.date && shop.date > new Date().toISOString().slice(0, 10);
  const product = shop ? byInterest(shop.products)[0] : undefined;
  const pic = product && shop ? productPic(product, shop) : null;
  const fan = shop ? boosterPics(shop) : [];
  const buyHref = product ? productHref(product, "extension") : amazonSearch(fr ? `Pokémon ${name} booster` : `Pokemon TCG ${name}`, "extension", lang);
  // the boosters, quietly: the bundle (six of them) if it's listed, else a search
  const bundle = shop?.products.find((x) => x.kind === "bundle");
  const boostersHref = bundle ? productHref(bundle, "extension") : amazonSearch(fr ? `Pokémon ${name} booster` : `Pokemon TCG ${name} booster`, "extension", lang);
  // the desk with this set's binder (App: ?classeur= offers it, or opens it)
  const deskHref = `${fr ? "/" : "/en"}?classeur=${encodeURIComponent(keyOf(lang, p.set.id))}`;
  const jackpot = p.top.filter((c) => c.img).slice(0, 8);
  const best = jackpot[0];
  const bestPrice = p.top[0] ? trendOf(p.top[0]) : null;
  const thumb = pic ?? fan[0] ?? null;

  const hero = (
    <ShopHero
      head={
        <>
          {logo && (
            <img className={s.setLogo} src={logo.src} srcSet={logo.srcSet} sizes="(min-width: 900px) 300px, 62vw" alt={`${p.set.serieName} ${name}`} />
          )}
          <h1 className={s.title}>
            <span className={`${s.big} ${s.setName}`}>{name}</span>
            <span className="sr-only">{t(" : ", ": ")}</span>
            <span className={s.rest}>{t("liste des cartes et prix", "card list and prices")}</span>
          </h1>
          {inShop && (
            <p className={s.pills}>
              <span className={s.pill}>
                <i className={s.dot} />
                {t("En boutique", "In shops")}
              </span>
            </p>
          )}
          {/* a phone: three of them, the button comes up (the rest stays in the page, shown from a tablet up) */}
          <dl className={s.stats}>
            <div>
              <dt>{t("Cartes", "Cards")}</dt>
              <dd>{beyond ? `${n} (${official} + ${beyond})` : n}</dd>
            </div>
            {p.priced > 0 && (
              <div>
                <dt>{t("Une de chaque", "One of each")}</dt>
                <dd>≈ {money(p.total, p)}</dd>
              </div>
            )}
            {bestPrice != null && (
              <div className={s.fromTablet}>
                <dt>{t("La plus chère", "Top card")}</dt>
                <dd>{money(bestPrice, p)}</dd>
              </div>
            )}
            {p.set.releaseDate && (
              <div>
                <dt>{t("Sortie", "Released")}</dt>
                <dd>{formatDate(p.set.releaseDate, lang)}</dd>
              </div>
            )}
            <div className={s.fromTablet}>
              <dt>{t("Code", "Code")}</dt>
              <dd>{p.set.code}</dd>
            </div>
            <div className={s.fromTablet}>
              <dt>{t("Série", "Series")}</dt>
              <dd>{p.set.serieName}</dd>
            </div>
          </dl>
        </>
      }
      stage={
        shop && product ? (
          <Stage pic={pic} kind={product.kind} fan={fan} alt={pic ? `${KIND_LABEL[product.kind]} ${name}` : `Boosters ${name}`} />
        ) : best ? (
          <CardStage src={best.img!} alt={`${best.name} ${numOf(best)} · ${name}`} />
        ) : undefined
      }
      buy={
        inShop ? (
          <>
            <p className={s.what}>
              <b>{product ? product.name : t(`Boosters et coffrets ${name}`, `${name} packs and boxes`)}</b>
              {product && !product.name.startsWith(KIND_LABEL[product.kind]) && ` · ${KIND_LABEL[product.kind]}`}
            </p>
            <div className={s.btns}>
              <AmazonButton id="hero-cta" href={buyHref} place="extension" size="lg" nudge>
                {product ? goLabel(product, soon) : t("Voir sur Amazon", "See it on Amazon")}
              </AmazonButton>
            </div>
            <ul className={s.reassure}>
              {product?.asin && !soon ? (
                <>
                  <li>Gratuit</li>
                  <li>Au prix public</li>
                  <li>Amazon t&apos;écrit si c&apos;est ton tour</li>
                </>
              ) : (
                <li>{t("Vérifie « Expédié et vendu par Amazon »", "Check “Ships from and sold by Amazon”")}</li>
              )}
            </ul>
            <Affiliate lang={lang} />
          </>
        ) : (
          <>
            <p className={s.what}>
              <b>{t(`Ta collection ${name}`, `Your ${name} collection`)}</b>
            </p>
            <div className={s.btns}>
              <Link prefetch={false} href={deskHref} className={`${s.btn} ${s.lg} ${s.green}`}>
                {t("Coche tes cartes ▶", "Tick your cards ▶")}
              </Link>
            </div>
            <ul className={s.reassure}>
              <li>{t("Gratuit, sans compte pour commencer", "Free, no account to start")}</li>
              <li>{t(`Prix ${market} du jour`, `Today's ${market} prices`)}</li>
            </ul>
          </>
        )
      }
    />
  );

  return (
    <WidePage en={!fr} shop={root} crumbs={[{ href: root, label: t("Extensions", "Sets") }, { href: p.path, label: name }]} hero={hero}>
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: fr ? SITE_URL : `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: t("Extensions", "Sets"), item: `${SITE_URL}${root}` },
          { "@type": "ListItem", position: 3, name, item: url },
        ],
      })}
      {ld({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: lang,
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      })}

      <p>
        {fr ? (
          <>
            Les {n} cartes de <b>{name}</b>, extension de la série {p.set.serieName}
            {beyond ? ` (${official} numérotées et ${beyond} au-delà : cartes secrètes et séries spéciales)` : ""}, avec leur rareté et leur
            prix tendance Cardmarket, mis à jour le {day}. Les prix Cardmarket mélangent toutes les langues d&apos;impression de la carte.
          </>
        ) : (
          <>
            All {n} cards of <b>{name}</b>, a {p.set.serieName} set{beyond ? ` (${official} in the official numbering and ${beyond} beyond it: secret rares and special sub-sets)` : ""}, with
            their rarity and TCGplayer market price for English cards, updated {day}. Cards TCGplayer doesn&apos;t sell show
            Cardmarket&apos;s price, converted to dollars.
          </>
        )}
      </p>
      {p.other && (
        <p className={c.other}>
          <Link prefetch={false} href={p.other.path} hrefLang={p.other.lang}>
            {fr ? `EN · ${p.other.name}: the English cards and their TCGplayer prices` : `FR · ${p.other.name} : les cartes françaises et leurs prix Cardmarket`}
          </Link>
        </p>
      )}

      {/* « le rayon »: the set's sealed products while it's in the shops (Amazon affiliate, lib/amazon): amazon.fr's products
          of a French set with their pictures, else its four kinds drawn, each a search (amazon.com on an English page) */}
      {inShop && (
        <section className={c.sec}>
          <h2>{fr ? <>Le rayon <em>{name}</em></> : <>The <em>{name}</em> shelf</>}</h2>
          <p className={c.sub}>
            {shop
              ? `${shop.products.length} produit${shop.products.length > 1 ? "s" : ""} scellé${shop.products.length > 1 ? "s" : ""}, sur invitation Amazon.`
              : t("Ses boîtes et ses boosters, sur Amazon.", "Its boxes and booster packs, on Amazon.")}
          </p>
          {shop ? <ProductRail group={shop} place="extension" max={4} /> : <KindTiles name={name} place="extension" soon={false} lang={lang} />}
          {shop && (
            <p className={c.other}>
              <Link prefetch={false} href={`${SHOP_PATH}#${shop.id}`}>
                {shop.products.length > 4 ? `Les ${shop.products.length} produits ${name} sur Amazon →` : `Toutes les invitations Amazon ${name} →`}
              </Link>
            </p>
          )}
        </section>
      )}

      {jackpot.length > 0 && (
        <section className={c.sec}>
          <h2>{fr ? <>Les cartes les plus chères de <em>{name}</em></> : <>The most expensive <em>{name}</em> cards</>}</h2>
          <p className={c.sub}>{t(`Prix tendance Cardmarket du ${day}, toutes langues mêlées.`, `TCGplayer market prices, ${day}.`)}</p>
          <ul className={c.jack}>
            {jackpot.map((card) => {
              const price = trendOf(card);
              return (
                <li key={card.id}>
                  <Link prefetch={false} href={`${p.path}/${cardSlug(card)}`}>
                    <img
                      src={`${card.img}/low.webp`}
                      srcSet={`${card.img}/low.webp 245w, ${card.img}/high.webp 600w`}
                      sizes="(min-width: 760px) 270px, 45vw"
                      width={245}
                      height={342}
                      alt={`${card.name} ${numOf(card)} · ${name}`}
                      loading="lazy"
                      decoding="async"
                    />
                    <b>{price != null ? money(price, p) : "—"}</b>
                    <small>
                      {card.name} · {numOf(card)}
                    </small>
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* the boosters they come in, said plainly (no odds, no « instead of 173 € »: teens read this, Johan 2026-10-31) */}
          {inShop && (
            <>
              <div className={c.hide}>
                <p>
                  <b>{t(`Elles se cachent dans les boosters ${name}`, `They hide in ${name} booster packs`)}</b>
                </p>
                <AmazonButton href={boostersHref} place="extension">
                  {bundle ? t("Le bundle sur Amazon", "The bundle on Amazon") : t("Boosters sur Amazon", "Booster packs on Amazon")}
                </AmazonButton>
              </div>
              <Affiliate lang={lang} />
            </>
          )}
        </section>
      )}

      {/* the desk, after the products: green, never in an Amazon hero */}
      <div className={s.app}>
        <p>
          {inShop
            ? t(`Tes boosters ouverts ? Coche tes cartes de ${name} et suis leur cote chaque jour.`, `Opened your packs? Tick your ${name} cards and follow their value every day.`)
            : t(`Coche tes cartes de ${name} et suis leur cote chaque jour, sur le bureau ${SITE_NAME}.`, `Tick your ${name} cards and follow their value every day, on the ${SITE_NAME} desk.`)}
        </p>
        <Link prefetch={false} href={deskHref} className={`${s.btn} ${s.green}`}>
          {t("Coche tes cartes ▶", "Tick your cards ▶")}
        </Link>
      </div>

      {p.rarities.length > 1 && (
        <section className={c.sec}>
          <h2>{t("Les raretés", "Rarities")}</h2>
          <div className={c.table}>
            <table>
              <thead>
                <tr>
                  <th>{t("Rareté", "Rarity")}</th>
                  <th>{t("Cartes", "Cards")}</th>
                  <th>{t("Valeur (une de chaque)", "Value (one of each)")}</th>
                </tr>
              </thead>
              <tbody>
                {p.rarities.map((r) => (
                  <tr key={r.rarity}>
                    <td>{r.rarity}</td>
                    <td>{r.count}</td>
                    <td>{r.value ? money(r.value, p) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={c.sec}>
        <h2>{t(`Liste des ${n} cartes de ${name}`, `All ${n} ${name} cards`)}</h2>
        <p className={c.sub}>{t(`Prix tendance ${market} du ${day}.`, `${market} market prices, ${day}.`)}</p>
        {/* every card with its scan: what people come to see (and what image search finds), loaded as the page scrolls */}
        <ul className={c.cards}>
          {p.data.cards.map((card) => {
            const price = trendOf(card);
            const label = `${card.name} ${numOf(card)}`;
            return (
              <li key={card.id}>
                {/* its own page (lib/cardPages): how search engines find the cards */}
                <Link prefetch={false} href={`${p.path}/${cardSlug(card)}`}>
                  {card.img ? (
                    <img src={`${card.img}/low.webp`} alt={`${label} · ${name}`} width={245} height={342} loading="lazy" decoding="async" />
                  ) : (
                    // taken out by TCGdex for now (see CardBack in the binders)
                    <span className={c.back}>{t("Bientôt de retour", "Back soon")}</span>
                  )}
                  <small>{numOf(card)}</small>
                  <b>{card.name}</b>
                  {card.rarity && <small>{card.rarity}</small>}
                  <span className={c.price}>{price != null ? money(price, p) : "—"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={s.faq} data-sticky-stop>
        <h2>{t("Questions fréquentes", "FAQ")}</h2>
        {faq.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      {p.posts.length > 0 && (
        <nav className={c.sec} aria-label={t("Sur le blog", "On the blog")}>
          <h2>{t("Sur le blog", "On the blog")}</h2>
          <ul className={c.links}>
            {p.posts.map((post) => (
              <li key={post.slug}>
                <Link prefetch={false} href={`/blog/${post.slug}`}>
                  <time dateTime={post.date}>{formatDate(post.date, post.lang)}</time>
                  <b>{post.title}</b>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {p.series.length > 0 && (
        <nav className={c.sec} aria-label={p.set.serieName}>
          <h2>{t(`Les autres extensions ${p.set.serieName}`, `Other ${p.set.serieName} sets`)}</h2>
          <ul className={c.links}>
            {p.series.map((x) => (
              <li key={x.path}>
                <Link prefetch={false} href={x.path}>{x.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p>
        <Link prefetch={false} href={root}>{t("← toutes les extensions", "← all sets")}</Link>
      </p>

      {inShop && (
        <StickyBuy
          target="hero-cta"
          href={buyHref}
          place="extension-bar"
          thumb={thumb ? <img src={thumb.src} width={thumb.w} height={thumb.h} alt="" loading="lazy" /> : <span dangerouslySetInnerHTML={{ __html: kindArt("etb") }} />}
          title={name}
          sub={product ? product.name : t("Boosters et coffrets", "Packs and boxes")}
          label={product?.asin && !soon ? "L'invitation" : t("Sur Amazon", "On Amazon")}
        />
      )}
    </WidePage>
  );
}

/** Every set with a page, by series, newest first: the shelf of the set pages. */
export async function SetIndexView({ lang }: { lang: PageLang }) {
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const top = await topCards(lang);
  const price = { lang, currency: currencyOf(lang) };
  const root = SET_PAGES_ROOT[lang];
  const series = new Map<string, { name: string; sets: { name: string; code: string; year: string; path: string; logo: string | null; total: number }[] }>();
  for (const e of setPageEntries(lang)) {
    const x = series.get(e.set.serie) ?? { name: e.set.serieName, sets: [] };
    x.sets.push({
      name: e.set.name,
      code: e.set.code,
      year: e.set.releaseDate?.slice(0, 4) ?? "",
      path: `${root}/${e.slug}`,
      logo: logoOf(e.set.logo)?.src ?? null,
      total: e.set.total,
    });
    series.set(e.set.serie, x);
  }
  const hero = (
    <ShopHero
      head={
        <>
          <p className={s.eyebrow}>{t("Prix du jour", "Today's prices")}</p>
          <h1 className={`${s.big} ${c.bigSm}`}>{t("Les extensions du JCC Pokémon", "Pokémon TCG sets")}</h1>
          <p className={s.lede}>
            {fr
              ? "Chaque extension du JCC Pokémon en français : la liste de ses cartes, leur rareté et leur prix Cardmarket mis à jour chaque jour."
              : "Every Pokémon TCG set in English: its card list, rarities and TCGplayer prices, updated every day."}
          </p>
        </>
      }
    />
  );
  return (
    <WidePage en={!fr} shop={root} crumbs={[{ href: root, label: t("Extensions", "Sets") }]} hero={hero}>
      <p className={c.other}>
        <Link prefetch={false} href={fr ? "/en/sets" : "/extensions"} hrefLang={fr ? "en" : "fr"}>
          {fr ? "EN · The English sets and their TCGplayer prices" : "FR · Les extensions en français et leurs prix Cardmarket"}
        </Link>
      </p>
      {[...series.values()].map((x) => (
        <section key={x.name} className={c.sec}>
          <h2>{x.name}</h2>
          <ul className={c.grid}>
            {x.sets.map((set) => (
              <li key={set.path}>
                <Link prefetch={false} href={set.path} className={c.tile}>
                  <span className={c.tileLogo}>{set.logo ? <img src={set.logo} alt="" loading="lazy" /> : <span>{set.code}</span>}</span>
                  <b>{set.name}</b>
                  <small>
                    {set.code} · {set.year} · {set.total} {t("cartes", "cards")}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* plain links to the most wanted card pages (lib/cardPages topCards): how Google finds them, one click from here */}
      {[
        { list: top.all, title: t("Les cartes Pokémon les plus chères", "The most expensive Pokémon cards") },
        // "Méga-Évolution et Écarlate et Violet" would read badly: the series names side by side, in quotes
        {
          list: top.recent,
          title: t(`Les plus chères des séries ${top.series.map((x) => `« ${x} »`).join(" et ")}`, `The most expensive ${top.series.join(" and ")} cards`),
        },
      ].map(
        ({ list, title }) =>
          list.length > 0 && (
            <nav key={title} className={`${c.sec} ${c.top}`} aria-label={title}>
              <h2>{title}</h2>
              <p className={c.sub}>
                {t("Prix tendance Cardmarket du jour, toutes langues d'impression mêlées.", "Today's TCGplayer market prices, English cards.")}
              </p>
              <ol>
                {list.map((card) => (
                  <li key={card.path}>
                    <Link prefetch={false} href={card.path}>
                      <b>
                        {card.name} {card.num}
                      </b>
                    </Link>{" "}
                    <small>{card.set}</small> <span className={c.price}>{money(card.trend, price)}</span>
                  </li>
                ))}
              </ol>
            </nav>
          ),
      )}
    </WidePage>
  );
}
