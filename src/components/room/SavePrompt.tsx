"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn, signInWithGoogle, useCloud } from "@/lib/cloud";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { useTrophyQueue } from "@/lib/trophyStore";
import styles from "./SavePrompt.module.css";

/** Cards owned before the desk offers an account: they have something worth keeping by then. */
const MIN_CARDS = 10;
/** "Later": asked again once the collection has grown this much, and a few days on. Per device, outside the save. */
const MORE_CARDS = 15;
const LATER_DAYS = 3;
const CALM_MS = 1500;
const DAY = 86_400_000;
const KEY = "nookdex:save-ask";

const snoozed = (): { cards: number; at: number } => {
  try {
    return { cards: 0, at: 0, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { cards: 0, at: 0 };
  }
};

/** A floppy disk, bouncing: the save. */
function Floppy() {
  return (
    <motion.svg
      className={styles.floppy}
      viewBox="0 0 64 64"
      aria-hidden
      animate={{ y: [0, -6, 0], rotate: [-4, 3, -4] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d="M8 6 H48 L58 16 V58 H8 Z" fill="#6c8fd8" stroke="#2b2230" strokeWidth="4" strokeLinejoin="round" />
      <rect x="18" y="6" width="26" height="16" fill="#e8e2d6" stroke="#2b2230" strokeWidth="3" />
      <rect x="35" y="9" width="6" height="10" fill="#2b2230" />
      <rect x="15" y="32" width="36" height="26" rx="2" fill="#fdf2e8" stroke="#2b2230" strokeWidth="3" />
      <path d="M21 41 H45 M21 49 H39" stroke="#c9502f" strokeWidth="3" strokeLinecap="round" />
    </motion.svg>
  );
}

/**
 * The account, asked once it's worth it (Johan, 2026-10-13: asking it first held people back): when a player without one
 * owns a few cards, in the calm room, a short card offers to keep them online. "Later" waits for more cards and a few days.
 */
export function SavePrompt({ compact, calm, onShown }: { compact: boolean; calm: boolean; onShown: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const owned = useStore((s) => Object.keys(s.collection).length);
  const { ready, email, status } = useCloud();
  // a trophy toast first (the 10th card often wins one): the card comes after it
  const toast = useTrophyQueue((q) => q.showing || q.batches.length > 0);
  const [shown, setShown] = useState(false);
  /** asked once this visit, whatever the answer */
  const [asked, setAsked] = useState(false);
  const [mail, setMail] = useState(false);
  const [address, setAddress] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const eligible = calm && !toast && ready && !email && status !== "loading" && !asked && owned >= MIN_CARDS && (pathname === "/" || pathname === "/en");

  useEffect(() => {
    if (!eligible) return;
    const s = snoozed();
    if (owned < s.cards || Date.now() < s.at) return;
    const id = setTimeout(() => {
      setAsked(true);
      setShown(true);
      onShown();
      sfx.pop();
    }, CALM_MS);
    return () => clearTimeout(id);
  }, [eligible, owned, onShown]);

  // signed in meanwhile (the e-mail link opened in another tab): nothing left to ask
  const visible = shown && !email && (calm || !!sent);

  const later = () => {
    sfx.click();
    try {
      localStorage.setItem(KEY, JSON.stringify({ cards: owned + MORE_CARDS, at: Date.now() + LATER_DAYS * DAY }));
    } catch {}
    setShown(false);
  };
  const google = async () => {
    sfx.click();
    setBusy(true);
    const error = await signInWithGoogle();
    // on success the page leaves for Google: only an error comes back here
    if (error) {
      setBusy(false);
      sfx.locked();
      setNote(t("Connexion Google impossible pour le moment.", "Google sign-in isn't available right now."));
    }
  };
  const sendLink = async () => {
    const to = address.trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) {
      sfx.locked();
      setNote(t("Cette adresse ne ressemble pas à un e-mail.", "That doesn't look like an e-mail."));
      return;
    }
    setBusy(true);
    const error = await signIn(to);
    setBusy(false);
    if (error) {
      sfx.locked();
      setNote(t("L'envoi a échoué, réessaie dans un moment.", "Couldn't send it, try again in a moment."));
      return;
    }
    sfx.pop();
    setNote(null);
    setSent(to);
  };

  const body = sent ? (
    <p className={styles.text}>
      {t("Lien envoyé à", "Link sent to")} <b>{sent}</b>. {t("Ouvre-le sur cet appareil : tes cartes partent en ligne.", "Open it on this device: your cards go online.")}
    </p>
  ) : (
    <>
      <p className={styles.text}>
        {t(
          `${owned} cartes déjà ! Crée ton compte pour ne pas les perdre et les retrouver partout.`,
          `${owned} cards already! Make an account to keep them and find them on any device.`,
        )}
      </p>
      <div className={styles.actions}>
        {mail ? (
          <form
            className={styles.inline}
            onSubmit={(e) => {
              e.preventDefault();
              void sendLink();
            }}
          >
            <input
              type="email"
              autoFocus
              value={address}
              placeholder={t("sacha@bourg-palette.fr", "ash@pallet-town.com")}
              autoComplete="email"
              aria-label={t("Adresse e-mail", "E-mail address")}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button type="submit" className={styles.go} disabled={busy}>
              ▶
            </button>
          </form>
        ) : (
          <>
            <button className={styles.go} disabled={busy} onClick={() => void google()} onPointerEnter={sfx.hover}>
              G&nbsp;&nbsp;{t("Avec Google", "With Google")}
            </button>
            <button
              className={styles.alt}
              onClick={() => {
                sfx.click();
                setMail(true);
              }}
              onPointerEnter={sfx.hover}
            >
              {t("Par e-mail", "By e-mail")}
            </button>
          </>
        )}
      </div>
      {note && <p className={styles.note}>{note}</p>}
      <button className={styles.later} onClick={later}>
        {t("Plus tard", "Maybe later")}
      </button>
    </>
  );
  const title = t("Sauvegarde ta collec", "Save your collection");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="save"
          className={compact ? styles.sheetWrap : styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !sent) later();
          }}
        >
          <motion.aside
            className={compact ? styles.sheet : styles.card}
            role="dialog"
            aria-label={title}
            initial={compact ? { y: 260 } : { scale: 0.6, rotate: -6, y: 40 }}
            animate={compact ? { y: 0 } : { scale: 1, rotate: -1, y: 0 }}
            exit={compact ? { y: 280 } : { scale: 0.8, rotate: 4, y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: compact ? 28 : 18 }}
          >
            <Floppy />
            <h2>{title}</h2>
            {body}
            {sent && (
              <button className={styles.later} onClick={() => setShown(false)}>
                {t("OK", "OK")}
              </button>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
