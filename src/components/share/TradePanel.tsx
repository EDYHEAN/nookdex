"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { loadSets, neededSets, useSets } from "@/lib/catalog";
import { useT } from "@/lib/lang";
import { formatMoney, priceOf } from "@/lib/price";
import { doublesOf, pushShare, removeShare, shareUrl, starsWanted, useShareSync, wantedOf } from "@/lib/share";
import { sceneImg } from "@/lib/scene";
import { sfx } from "@/lib/sound";
import { type ShareSettings, useStore } from "@/lib/store";
import { unlock } from "@/lib/trophyStore";
import type { CardData } from "@/lib/types";
import { SheetHost } from "./BottomSheet";
import { GiveView } from "./GiveView";
import { WantView } from "./WantView";
import styles from "./TradePanel.module.css";

/**
 * The trade binder's inside (Johan, 2026-10-23, the UX designer's v2): the player's public list, nookdex.com/c/<slug>.
 * Its home: Warwick, the link (copy it, or make it), two big doors, « Je cherche » and « J'échange », each opening its own
 * screen, and « Partager » always at the bottom. On a wide screen the doors make a column on the left, their screen on
 * the right. The page's settings (prices, which sides) wait in the ⚙ menu. A column that fills whatever holds it: the
 * gold binder of the shelf (share/TradeBinder), NookDex OS → Échange.
 */

export type ListView = "home" | "want" | "give";
type Draft = Omit<ShareSettings, "slug">;
const DEFAULTS: Draft = { want: true, give: true, prices: true };
/** past this width the doors make a column, their screen beside it */
const WIDE = 820;

const scanOf = (c: CardData | undefined) => (c?.img ? `${c.img}/low.webp` : null);

export function TradePanel({ onClose, focusSet, start }: { onClose?: () => void; focusSet?: string; start?: ListView }) {
  const tr = useT();
  const share = useStore((s) => s.share);
  const profile = useStore((s) => s.profile);
  const binders = useStore((s) => s.binders);
  const collection = useStore((s) => s.collection);
  const tradable = useStore((s) => s.tradable);
  const rules = useStore((s) => s.tradeRules);
  const stars = useStore((s) => s.stars);
  const modes = useStore((s) => s.wantModes);
  const sets = useSets((s) => s.sets);
  const cards = useSets((s) => s.cards);
  const sync = useShareSync();
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [note, setNote] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [gear, setGear] = useState(false);
  const [sure, setSure] = useState(false);
  const settings: Draft = share ?? draft;
  const slug = share?.slug ?? null;

  const root = useRef<HTMLDivElement>(null);
  /** the layer the bottom sheets are drawn in (over the whole panel) */
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= WIDE));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [view, setView] = useState<ListView>(start ?? (focusSet ? "want" : "home"));
  // a wide screen has no home of its own: the doors stay on the left
  const shown: ListView = wide && view === "home" ? "want" : view;

  // the binders' and wishlists' cards may not be loaded yet (a wishlist of sets no binder holds)
  useEffect(() => {
    void loadSets(neededSets(binders, collection).filter((id) => !useSets.getState().sets[id]));
  }, [binders, collection]);

  const update = (patch: Partial<Draft>) => {
    if (share) useStore.getState().setShare(patch);
    else setDraft((d) => ({ ...d, ...patch }));
  };

  const wanted = useMemo(() => wantedOf(binders, collection, sets, modes, stars), [binders, collection, sets, modes, stars]);
  const starCount = useMemo(() => starsWanted(stars, collection).length, [stars, collection]);
  const doubles = useMemo(() => doublesOf(collection, tradable, rules), [collection, tradable, rules]);
  const giving = useMemo(() => {
    const on = doubles.filter((d) => d.ticked > 0);
    // what the copies offered are worth today, in the player's money (cards not for sale add nothing)
    const value = on.reduce((n, d) => n + d.ticked * ((cards[d.key] && priceOf(cards[d.key], d.variant, "trend")) || 0), 0);
    return { count: on.length, value, on };
  }, [doubles, cards]);
  const setCount = binders.filter((b) => b.kind === "set").length;

  // three cards fanned on each door: the priciest of each side (those whose set is loaded)
  const fanWant = useMemo(
    () =>
      wanted.keys
        .map((k) => cards[k])
        .filter((c): c is CardData => !!c?.img)
        .sort((a, b) => (b.price.trend ?? 0) - (a.price.trend ?? 0))
        .slice(0, 3)
        .map(scanOf),
    [wanted.keys, cards],
  );
  const fanGive = useMemo(
    () =>
      (giving.on.length ? giving.on : doubles)
        .map((d) => cards[d.key])
        .filter((c): c is CardData => !!c?.img)
        .sort((a, b) => (b.price.trend ?? 0) - (a.price.trend ?? 0))
        .slice(0, 3)
        .map(scanOf),
    [giving.on, doubles, cards],
  );

  const say = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote((n) => (n === msg ? null : n)), 2200);
  };

  const make = async () => {
    if (making) return;
    setMaking(true);
    sfx.stamp();
    await loadSets(neededSets(binders, collection));
    if (!useStore.getState().share) useStore.getState().setShare({ ...draft, slug: null });
    const made = await pushShare(true);
    setMaking(false);
    if (made) {
      sfx.coin();
      say(tr("ta page est prête ! partage-la ↗", "your page is ready! share it ↗"));
    } else {
      sfx.locked();
      say(tr("le lien n'a pas pu être fait, réessaie", "couldn't make the link, try again"));
    }
  };

  const url = slug ? shareUrl(slug) : "";
  const shortUrl = url.replace(/^https?:\/\//, "");
  /**
   * The phone's share sheet only on a touch device that has one (Johan, 2026-10-23): on a computer, Windows' or macOS's
   * share panel is a detour; the link copied is what the player pastes in a group. By capability, not by width.
   */
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches,
  );
  /** « Copié ✓ » on the buttons a moment after a copy */
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      sfx.coin();
      unlock("share");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      say(tr("lien copié ! colle-le dans ton groupe", "link copied! paste it in your group"));
    } catch {
      sfx.locked();
      say(tr("copie impossible", "couldn't copy"));
    }
  };
  /** the phone's share sheet, else the link copied */
  const shareIt = async () => {
    if (!canShare) return copy();
    sfx.pop();
    try {
      await navigator.share({ text: tr("Ma liste Pokémon : ce que je cherche, ce que j'échange", "My Pokémon list: what I'm after, what I trade"), url });
      sfx.coin();
      unlock("share");
    } catch (e) {
      if ((e as Error).name !== "AbortError") void copy();
    }
  };
  const mainButton = (big?: boolean) =>
    slug ? (
      <motion.button
        className={`${styles.btn} ${big ? styles.btnBig : ""} ${copied ? styles.btnDone : ""}`}
        onClick={shareIt}
        onPointerEnter={sfx.hover}
        whileTap={{ scale: 0.92 }}
        animate={copied ? { scale: [1, 1.12, 1], rotate: [0, -3, 0] } : {}}
      >
        {canShare ? tr("Partager ↗", "Share ↗") : copied ? tr("Copié ✓", "Copied ✓") : tr("Copier mon lien", "Copy my link")}
      </motion.button>
    ) : (
      <motion.button
        className={`${styles.btn} ${big ? styles.btnBig : ""}`}
        onClick={make}
        disabled={making || (!settings.want && !settings.give)}
        onPointerEnter={sfx.hover}
        whileTap={{ scale: 0.92 }}
        animate={making ? { rotate: [0, -2, 2, 0] } : {}}
        transition={{ repeat: making ? Infinity : 0, duration: 0.5 }}
      >
        {making ? tr("On fabrique…", "Making…") : tr("Créer mon lien ▶", "Make my link ▶")}
      </motion.button>
    );
  const fresh = making || sync.state === "saving" ? tr("envoi…", "sending…") : sync.state === "error" ? tr("on réessaie…", "retrying…") : tr("✓ suit ta collec toute seule", "✓ follows your collection");
  const n = (x: number) => x.toLocaleString(tr("fr-FR", "en-US"));

  const go = (v: ListView) => {
    sfx.riffle();
    setView(v);
  };

  const doors = (
    <>
      <Door
        kind="want"
        active={wide && shown === "want"}
        label={tr("Je cherche", "Wanted")}
        num={n(wanted.keys.length)}
        sub={`${setCount} ${tr(setCount > 1 ? "classeurs" : "classeur", setCount > 1 ? "binders" : "binder")}${starCount ? ` · ${starCount} ★` : ""}`}
        off={!settings.want}
        fan={fanWant}
        compact={wide}
        onOpen={() => go("want")}
      />
      <Door
        kind="give"
        active={wide && shown === "give"}
        label={tr("J'échange", "For trade")}
        num={n(giving.count)}
        sub={giving.value > 0 ? tr(`≈ ${formatMoney(giving.value)} de doubles`, `≈ ${formatMoney(giving.value)} of doubles`) : doubles.length ? tr(`${n(doubles.length)} doubles à cocher`, `${n(doubles.length)} doubles to tick`) : tr("pas encore de doubles", "no doubles yet")}
        off={!settings.give}
        fan={fanGive}
        compact={wide}
        onOpen={() => go("give")}
      />
      <p className={styles.help}>{tr("Une carte rangée dans ta collec sort de « je cherche » toute seule ✨", "A card filed in your collection leaves « wanted » by itself ✨")}</p>
    </>
  );

  const head =
    !wide && shown !== "home" ? (
      <header className={styles.top}>
        <motion.button className={styles.back} onClick={() => go("home")} whileTap={{ scale: 0.88 }} aria-label={tr("Retour", "Back")}>
          ‹
        </motion.button>
        <h2 className={shown === "want" ? styles.blue : styles.gold}>
          {shown === "want" ? `🔎 ${tr("Je cherche", "Wanted")}` : `🔁 ${tr("J'échange", "For trade")}`}
          <small>{shown === "want" ? `${n(wanted.keys.length)} ${tr("cartes", "cards")}` : `${n(giving.count)} ${tr("cochées", "ticked")} · ${n(doubles.length)} doubles`}</small>
        </h2>
        <img className={styles.cat} src={sceneImg("warwick-head.webp")} alt="" />
      </header>
    ) : (
      <header className={styles.top}>
        <img className={styles.cat} src={sceneImg("warwick-head.webp")} alt="" />
        <h2>
          {tr("Classeur d'échange", "Trade binder")}
          <small>
            {profile?.name ? tr(`de ${profile.name}`, `${profile.name}'s`) : ""}
            {wide && slug && ` · ${shortUrl} · ${fresh}`}
          </small>
        </h2>
        {wide && (slug ? (
          <button className={`${styles.btn} ${styles.btnWhite}`} onClick={copy}>
            {copied ? tr("Copié ✓", "Copied ✓") : tr("Copier le lien", "Copy the link")}
          </button>
        ) : (
          mainButton()
        ))}
        <motion.button className={styles.gearBtn} onClick={() => (sfx.click(), setGear(!gear))} aria-expanded={gear} aria-label={tr("Réglages de ma page", "My page's settings")} whileTap={{ rotate: 90 }}>
          ⚙
        </motion.button>
        {onClose && (
          <button className={styles.x} onClick={() => (sfx.click(), onClose())} aria-label={tr("Fermer", "Close")}>
            ✕
          </button>
        )}
      </header>
    );

  return (
    <SheetHost.Provider value={host}>
    <div ref={root} className={`${styles.panel} ${wide ? styles.wide : ""}`}>
      {head}
      <AnimatePresence>
        {gear && (
          <motion.div className={styles.gear} initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}>
            {(
              [
                ["prices", tr("Les prix du jour sur ma page", "Today's prices on my page"), settings.prices],
                ["want", tr("« Je cherche » sur ma page", "« Wanted » on my page"), settings.want],
                ["give", tr("« J'échange » sur ma page", "« For trade » on my page"), settings.give],
              ] as const
            ).map(([k, label, on]) => (
              <button
                key={k}
                className={`${styles.switch} ${on ? styles.switchOn : ""}`}
                onClick={() => {
                  sfx.click();
                  update({ [k]: !on });
                }}
                aria-pressed={on}
              >
                <i aria-hidden />
                {label}
              </button>
            ))}
            {slug && (
              <div className={styles.gearLinks}>
                <a href={url} target="_blank" rel="noreferrer" onClick={() => sfx.pop()}>
                  {tr("Voir ma page ↗", "See my page ↗")}
                </a>
                <button
                  className={styles.remove}
                  onClick={async () => {
                    if (!sure) {
                      sfx.click();
                      setSure(true);
                      setTimeout(() => setSure(false), 3000);
                      return;
                    }
                    sfx.drop();
                    await removeShare();
                    setSure(false);
                    say(tr("lien supprimé : la page n'existe plus", "link deleted: the page is gone"));
                  }}
                >
                  {sure ? tr("Sûr ? Touche encore", "Sure? Tap again") : tr("Supprimer mon lien", "Delete my link")}
                </button>
              </div>
            )}
            <p className={styles.muted}>{tr("Jamais la valeur de ta collection, ni ton nom, ni ta ville.", "Never your collection's value, your name or your town.")}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.layout}>
        {wide && <aside className={styles.rail}>{doors}</aside>}
        <div className={styles.body}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={shown}
              className={styles.view}
              initial={{ opacity: 0, x: shown === "home" ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {shown === "home" && (
                <>
                  <div className={styles.linkCard}>
                    <span>
                      <i aria-hidden>🔗</i>
                      {slug ? (
                        <>
                          <b>{shortUrl}</b>
                          <small>{fresh}</small>
                        </>
                      ) : (
                        <small>{tr("Ta page : ce que tu cherches + tes doubles, toujours à jour.", "Your page: what you're after + your doubles, always up to date.")}</small>
                      )}
                    </span>
                    {slug ? (
                      <button className={`${styles.btn} ${styles.btnWhite}`} onClick={copy}>
                        {copied ? tr("Copié ✓", "Copied ✓") : tr("Copier", "Copy")}
                      </button>
                    ) : (
                      mainButton()
                    )}
                  </div>
                  {doors}
                </>
              )}
              {shown === "want" && <WantView focusSet={focusSet} wide={wide} />}
              {shown === "give" && <GiveView wide={wide} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <p className={styles.note} aria-live="polite">
        {note}
      </p>
      <div className={styles.bar}>
        <span>
          {wide ? (
            <>
              <b>
                {n(wanted.keys.length)} {tr("cherchées", "wanted")} · {n(giving.count)} {tr("à échanger", "for trade")}
              </b>
              {tr("Ta page suit ta collection toute seule", "Your page follows your collection")}
            </>
          ) : shown === "want" ? (
            <>
              <b>
                {n(wanted.keys.length)} {tr("cherchées", "wanted")}
              </b>
              {starCount ? tr(`dont ${starCount} ★ à la carte`, `${starCount} ★ picked one by one`) : tr(`${setCount} classeurs`, `${setCount} binders`)}
            </>
          ) : shown === "give" ? (
            <>
              <b>
                {n(giving.count)} {tr("à échanger", "for trade")}
              </b>
              {settings.prices && giving.value > 0 ? `≈ ${formatMoney(giving.value)} · ${tr("prix du jour", "today's prices")}` : tr("tes doubles cochés", "your doubles ticked")}
            </>
          ) : (
            <>
              <b>{slug ? tr("Ta page est prête", "Your page is ready") : tr("Crée ta page", "Make your page")}</b>
              {tr("pour Facebook, Discord…", "for Facebook, Discord…")}
            </>
          )}
        </span>
        {mainButton(true)}
      </div>
      <div ref={setHost} className={styles.sheetLayer} />
    </div>
    </SheetHost.Provider>
  );
}

/** A door of the home: its side's count, three cards fanned, ▸ opens its screen */
function Door({
  kind,
  active,
  label,
  num,
  sub,
  off,
  fan,
  compact,
  onOpen,
}: {
  kind: "want" | "give";
  active: boolean;
  label: string;
  num: string;
  sub: string;
  off: boolean;
  fan: (string | null)[];
  compact: boolean;
  onOpen: () => void;
}) {
  const tr = useT();
  return (
    <motion.button
      className={`${styles.door} ${kind === "want" ? styles.doorWant : styles.doorGive} ${active ? styles.doorOn : ""} ${off ? styles.doorOff : ""}`}
      onClick={onOpen}
      onPointerEnter={sfx.hover}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -3 }}
    >
      <span className={styles.doorLbl}>
        <i aria-hidden>{kind === "want" ? "🔎" : "🔁"}</i> {label}
      </span>
      <b className={styles.doorNum}>{num}</b>
      <small className={styles.doorSub}>
        {sub}
        {off && ` · ${tr("pas sur ma page", "not on my page")}`}
      </small>
      {!compact && (
        <span className={styles.fan} aria-hidden>
          {fan.map((src, i) => src && <motion.img key={src} src={src} alt="" initial={{ rotate: 0, y: 10, opacity: 0 }} animate={{ rotate: [-12, 0, 12][i] ?? 0, y: 0, opacity: 1 }} transition={{ delay: 0.05 * i, type: "spring", stiffness: 260, damping: 18 }} style={{ left: i * 26 }} />)}
        </span>
      )}
      {!compact && (
        <span className={styles.go} aria-hidden>
          ▸
        </span>
      )}
    </motion.button>
  );
}
