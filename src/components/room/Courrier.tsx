"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { claimAsk, useWantAsk } from "@/lib/calm";
import { useSets } from "@/lib/catalog";
import {
  type Letter,
  type Tile,
  MIN_GAP,
  devSnap,
  isStale,
  markShown,
  pinLetter,
  readSnap,
  saveSnap,
  shownToday,
  takeSnap,
  useCourrier,
  writeLetter,
} from "@/lib/courrier";
import { funnelStep } from "@/lib/funnel";
import { useLang, useT } from "@/lib/lang";
import { formatMoney } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./Courrier.module.css";

/** the calm room this long before the envelope slides in */
const CALM_MS = 1600;

/**
 * « Le courrier » (lib/courrier): an envelope slides onto the desk when the player is back and something moved since their
 * last visit; opened, a letter of up to 4 big numbers, each one a way in (the card's binder, the trade binder, the
 * calendar). Read, it's pinned on the cork board (room/PaintedRoom shows the last 4, a click reads one again). One ask of
 * the calm room (lib/calm), just after the account.
 */
export function Courrier({
  calm,
  compact,
  onCard,
  onWants,
  onRelease,
}: {
  calm: boolean;
  compact: boolean;
  onCard: (key: string) => void;
  onWants: () => void;
  onRelease: () => void;
}) {
  const lang = useLang();
  const profile = useStore((s) => !!s.profile);
  const collection = useStore((s) => s.collection);
  const cards = useSets((s) => s.cards);
  const reading = useCourrier((s) => s.reading);
  /** written, waiting for a calm moment */
  const [pending, setPending] = useState<Letter | null>(null);
  /** on the desk */
  const [envelope, setEnvelope] = useState<Letter | null>(null);
  const [open, setOpen] = useState(false);
  /** a letter put away: no other one until the page loads again (with ?courrier, it was written anew at once, in a loop) */
  const [done, setDone] = useState(false);
  // dev: ?courrier writes a letter whatever the day (cards a little off today's prices)
  const [force] = useState(() => process.env.NODE_ENV !== "production" && /[?&]courrier\b/.test(window.location.search));

  // once the player's cards are loaded: the letter since the last visit, or the first snapshot
  useEffect(() => {
    if (!profile || pending || envelope || done) return;
    const snap = readSnap();
    // the first snapshot, once there are cards to compare (a newcomer's empty one would compare nothing for weeks)
    if (!force && (!snap || !Object.keys(snap.owned).length)) {
      const s = Object.keys(collection).length ? takeSnap() : null;
      if (s) saveSnap(s);
      return;
    }
    if (!force && snap && (shownToday() || Date.now() - snap.at < MIN_GAP)) return;
    const base = force ? devSnap() : snap;
    if (!base) return;
    const { ready, letter } = writeLetter(base, lang);
    if (!ready) return;
    if (!letter) {
      // nothing worth a letter for two weeks: start again from today (with the cards added since)
      if (snap && isStale(snap)) {
        const s = takeSnap();
        if (s) saveSnap(s);
      }
      return;
    }
    // (the letter is written from what's loaded: a set file coming later doesn't change it)
    const t = setTimeout(() => setPending(letter), 0);
    return () => clearTimeout(t);
  }, [profile, cards, collection, pending, envelope, done, force, lang]);

  useWantAsk("courrier", !!pending && !envelope);
  useEffect(() => {
    if (!pending || envelope || !calm) return;
    const t = setTimeout(() => {
      if (!claimAsk("courrier")) return;
      markShown();
      setEnvelope(pending);
      sfx.riffle();
    }, CALM_MS);
    return () => clearTimeout(t);
  }, [pending, envelope, calm]);

  const openIt = () => {
    if (!envelope) return;
    sfx.flip();
    setOpen(true);
    funnelStep("courrier");
    // today's prices become the next letter's starting point
    const s = takeSnap();
    if (s) saveSnap(s);
  };
  const putAway = () => {
    if (envelope) {
      pinLetter(envelope);
      setDone(true);
    }
    setEnvelope(null);
    setPending(null);
    setOpen(false);
    useCourrier.setState({ reading: null });
  };

  const shown = open ? envelope : reading;
  return (
    <>
      <AnimatePresence>
        {envelope && !open && calm && (
          <motion.button
            key="envelope"
            className={`${styles.envelope} ${compact ? styles.phone : ""}`}
            initial={{ x: 380, y: -40, rotate: 28, opacity: 0 }}
            animate={{ x: 0, y: 0, rotate: -6, opacity: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 160, damping: 16 }}
            whileHover={{ rotate: -2, y: -6 }}
            whileTap={{ scale: 0.92 }}
            onClick={openIt}
            onPointerEnter={sfx.hover}
            aria-label={lang === "en" ? "You've got mail: open it" : "Du courrier : ouvre-le"}
          >
            <span className={styles.flap} aria-hidden />
            <span className={styles.seal} aria-hidden>
              ✉
            </span>
            <span className={styles.envTag}>{lang === "en" ? "Mail!" : "Du courrier !"}</span>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {shown && (
          <LetterView
            key={shown.day}
            letter={shown}
            onClose={putAway}
            onTile={(tile) => {
              putAway();
              if (tile.kind === "card") onCard(tile.key);
              else if (tile.kind === "wants") onWants();
              else if (tile.kind === "release") onRelease();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/** « depuis mardi », « depuis hier » */
function sinceText(at: number, en: boolean) {
  const days = Math.round((Date.now() - at) / 86_400_000);
  if (days <= 1) return en ? "since yesterday" : "depuis hier";
  if (days < 7) return `${en ? "since" : "depuis"} ${new Date(at).toLocaleDateString(en ? "en-GB" : "fr-FR", { weekday: "long" })}`;
  return en ? `in ${days} days` : `en ${days} jours`;
}

const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
// (a narrow no-break space before the %: « 13 % » never splits)
const pctText = (p: number, en: boolean) => `${signed(p)}${Math.abs(p).toLocaleString(en ? "en-US" : "fr-FR", { maximumFractionDigits: Math.abs(p) < 10 ? 1 : 0 })}${en ? "" : " "}%`;

function LetterView({ letter, onClose, onTile }: { letter: Letter; onClose: () => void; onTile: (t: Tile) => void }) {
  const tr = useT();
  const en = useLang() === "en";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className={styles.letter}
        role="dialog"
        aria-label={tr("Le courrier du bureau", "The desk's mail")}
        initial={{ y: 80, scaleY: 0.2, rotate: -3, opacity: 0 }}
        animate={{ y: 0, scaleY: 1, rotate: -0.8, opacity: 1 }}
        exit={{ y: 40, opacity: 0, rotate: 4 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
      >
        <header className={styles.head}>
          <h2>✉ {tr("Le courrier du bureau", "The desk's mail")}</h2>
          <p>{sinceText(letter.since, en)}</p>
        </header>
        <div className={styles.tiles}>
          {letter.tiles.map((t, i) => (
            <motion.button
              key={t.kind}
              className={`${styles.tile} ${styles[t.kind]}`}
              initial={{ opacity: 0, y: 18, rotate: i % 2 ? 2 : -2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.25 + i * 0.12, type: "spring", stiffness: 260, damping: 18 }}
              onAnimationComplete={() => i === 0 && t.kind === "value" && t.delta > 0 && sfx.coin()}
              onClick={() => {
                sfx.pop();
                onTile(t);
              }}
              onPointerEnter={sfx.hover}
            >
              <TileBody tile={t} en={en} />
            </motion.button>
          ))}
        </div>
        <button className={styles.close} onClick={() => (sfx.click(), onClose())}>
          {tr("Épingler au tableau ✓", "Pin it on the board ✓")}
        </button>
      </motion.div>
    </motion.div>
  );
}

function TileBody({ tile, en }: { tile: Tile; en: boolean }) {
  const t = (fr: string, english: string) => (en ? english : fr);
  if (tile.kind === "value")
    return (
      <>
        <b className={tile.delta >= 0 ? styles.up : styles.down}>
          {signed(tile.delta)}
          {formatMoney(Math.abs(tile.delta))}
        </b>
        <span>{t("ta collection", "your collection")}</span>
        <small>{pctText(tile.pct, en)}</small>
      </>
    );
  if (tile.kind === "card")
    return (
      <>
        {tile.img && <img src={`${tile.img}/low.webp`} alt="" />}
        <b className={tile.pct >= 0 ? styles.up : styles.down}>
          {tile.pct >= 0 ? "↗" : "↘"} {pctText(tile.pct, en)}
        </b>
        <span>{tile.name}</span>
        <small>{t("ta carte qui a le plus bougé", "your card that moved most")}</small>
      </>
    );
  if (tile.kind === "wants")
    return (
      <>
        {tile.img && <img src={`${tile.img}/low.webp`} alt="" />}
        <b className={styles.down}>↘ {pctText(tile.pct, en)}</b>
        <span>{tile.name}</span>
        <small>
          {tile.count > 1
            ? t(`et ${tile.count - 1} autre${tile.count > 2 ? "s" : ""} de ta liste en baisse`, `and ${tile.count - 1} more of your list down`)
            : t("une carte que tu cherches a baissé", "a card you're after got cheaper")}
        </small>
      </>
    );
  return (
    <>
      <b>{tile.days === 0 ? t("aujourd'hui", "today") : `J-${tile.days}`}</b>
      <span>{tile.name}</span>
      <small>{t("la prochaine sortie", "the next release")}</small>
    </>
  );
}
