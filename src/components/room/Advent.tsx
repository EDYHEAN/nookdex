"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ADVENT_PROMO, DAYS, type Gift, giftsOfDay, goldOf, openDay, useAdvent, useAdventToday } from "@/lib/advent";
import { useLang, useT } from "@/lib/lang";
import { useStore } from "@/lib/store";
import { sfx } from "@/lib/sound";
import styles from "./Advent.module.css";

/** The boxes' places on the board, like a real calendar's: numbers scattered, not in a row */
const ORDER = [13, 4, 21, 8, 1, 17, 10, 24, 6, 15, 2, 19, 11, 22, 7, 3, 18, 9, 14, 23, 5, 20, 12, 16];

const POSTERS: Record<string, [string, string]> = {
  "hiver-village": ["Village sous la neige", "Snowy village"],
  "hiver-marche": ["Marché de Noël", "Christmas market"],
  "hiver-chalet": ["Chalet la nuit", "Chalet at night"],
  "hiver-patinoire": ["Patinoire", "Ice rink"],
  "hiver-bonhomme": ["Bonhomme de neige", "Snowman"],
  "hiver-aurore": ["Aurore boréale", "Northern lights"],
};
const CATS: Record<string, [string, string]> = {
  renne: ["Warwick en renne", "Reindeer Warwick"],
  lutin: ["Warwick en lutin", "Elf Warwick"],
  bonnet: ["Warwick en bonnet de nuit", "Nightcap Warwick"],
};
const LAYERS: Record<string, [string, string, string]> = {
  lights: ["✨", "Une guirlande lumineuse sur le sapin", "Fairy lights on the tree"],
  gifts: ["🎁", "Des cadeaux au pied du sapin", "Presents under the tree"],
  snow: ["❄️", "De la neige sur les branches", "Snow on the branches"],
  candy: ["🍭", "Des sucres d'orge et des pommes de pin", "Candy canes and pine cones"],
  garland: ["🎀", "Une guirlande dorée", "A golden garland"],
  socks: ["🧦", "Deux chaussettes au sapin", "Two stockings on the tree"],
  star: ["⭐", "L'étoile, tout en haut du sapin", "The star, on top of the tree"],
};

/** A gift as the box shows it: an icon and a line */
function giftLine(g: Gift, t: (fr: string, en: string) => string, gold: number | null): [string, string] {
  switch (g.kind) {
    case "tree":
      return ["🎄", t("Le sapin de l'Avent, dans ta chambre", "The Advent tree, in your room")];
    case "layer":
      return [LAYERS[g.layer][0], t(LAYERS[g.layer][1], LAYERS[g.layer][2])];
    case "poster":
      return ["🖼️", t(`Un poster, « ${POSTERS[g.id]?.[0]} », déjà accroché (un clic dessus pour en changer)`, `A poster, « ${POSTERS[g.id]?.[1]} », already up (click it to change)`)];
    case "cat":
      return ["🐱", t(`${CATS[g.id]?.[0]}, il la porte déjà`, `${CATS[g.id]?.[1]}, already wearing it`)];
    case "gold":
      return ["🪙", gold ? t(`${gold.toLocaleString("fr-FR")} pièces d'or pour Nook Survivors`, `${gold.toLocaleString("en-US")} gold for Nook Survivors`) : t("De l'or pour Nook Survivors", "Gold for Nook Survivors")];
    case "trophy":
      return ["🏆", t("Un trophée", "A trophy")];
    case "promo":
      return ["🏷️", t("−20 % sur le pack d'hiver, jusqu'au 31 décembre", "−20% off the winter pack, until December 31st")];
    case "frost":
      return ["🪟", t("Du givre aux carreaux", "Frost on the window panes")];
    case "card":
      return ["💌", t("Ta carte de vœux à partager", "Your greeting card to share")];
    case "radio":
      return ["📻", t("« Douce nuit » en boîte à musique, à la radio", "« Silent Night » on a music box, on the radio")];
  }
}

/** What a box gives, its bauble first (the 2nd to the 23rd); `first`: the first box opened, with the 1st's gifts */
function giftsOf(day: number, t: (fr: string, en: string) => string, gold: number | null, first = false): [string, string][] {
  const lines = giftsOfDay(day, first).map((g) => giftLine(g, t, gold));
  return day >= 2 && day <= 23 ? [["🔴", t("Une boule sur ton sapin", "A bauble on your tree")], ...lines] : lines;
}

/**
 * The Advent calendar (lib/advent): 24 little doors on a board, only today's opens (the server's day). Opening it plays
 * the door, then its gifts: the tree in the room grows with each one.
 */
export function Advent({ onClose }: { onClose: () => void }) {
  const t = useT();
  const opened = useAdvent();
  const today = useAdventToday();
  const [reveal, setReveal] = useState<number | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [gold, setGold] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  // the box being shown was the first opened (it brought the tree): kept for its card
  const [first, setFirst] = useState(false);
  const lang = useLang();
  const nickname = useStore((s) => s.profile?.name ?? "");
  // the greeting card (the 23rd's): fetched as soon as its box shows, Safari refuses a share after a wait
  const [card, setCard] = useState<File | null>(null);
  const hasCard = !!reveal && DAYS[reveal - 1].some((g) => g.kind === "card");
  useEffect(() => {
    if (!hasCard) return;
    let live = true;
    void fetch(`/share/voeux?p=${encodeURIComponent(nickname)}&l=${lang}`)
      .then((r) => r.blob())
      .then((b) => live && setCard(new File([b], "nookdex-joyeuses-fetes.png", { type: "image/png" })))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [hasCard, nickname, lang]);
  const sendCard = async () => {
    if (!card) return;
    sfx.click();
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [card] })) {
      try {
        await navigator.share({ files: [card], text: t("Joyeuses fêtes ! 🎄 nookdex.com", "Happy holidays! 🎄 nookdex.com") });
        return;
      } catch {
        return;
      }
    }
    // no share sheet (a computer): the picture is saved
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(card), download: card.name });
    a.click();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (reveal ? setReveal(null) : onClose());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reveal, onClose]);

  // a box with gold says how much (the game's scale, read when it's shown)
  useEffect(() => {
    const g = reveal ? DAYS[reveal - 1].find((x) => x.kind === "gold") : undefined;
    if (g?.kind === "gold") void goldOf(g.waves).then(setGold);
  }, [reveal]);

  const open = (day: number) => {
    if (day !== today || opened.includes(day) || opening) return;
    setOpening(day);
    sfx.ballOpen();
    const isFirst = opened.length === 0;
    setTimeout(() => {
      setFirst(isFirst);
      void openDay(day);
      setOpening(null);
      setReveal(day);
      sfx.trophy(day === 24 ? "gold" : "bronze");
    }, 650);
  };

  return (
    <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.section
        className={styles.board}
        role="dialog"
        aria-label={t("Calendrier de l'Avent", "Advent calendar")}
        initial={{ y: 40, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <header className={styles.head}>
          <h2>{t("Calendrier de l'Avent", "Advent calendar")}</h2>
          <p>
            {today
              ? opened.includes(today)
                ? t("Reviens demain pour la case suivante !", "Come back tomorrow for the next door!")
                : t(`La case ${today} t'attend !`, `Door ${today} is waiting for you!`)
              : t("Une case par jour, du 1er au 24 décembre.", "One door a day, December 1st to 24th.")}
          </p>
          <button className={styles.close} onClick={onClose} onPointerEnter={sfx.hover} aria-label={t("Fermer", "Close")}>
            ✕
          </button>
        </header>

        <div className={styles.grid}>
          {ORDER.map((day) => {
            const isOpen = opened.includes(day);
            const isToday = day === today && !isOpen;
            const missed = !isOpen && today !== null && day < today;
            const state = isOpen ? styles.open : isToday ? styles.today : missed ? styles.missed : styles.locked;
            return (
              <button
                key={day}
                className={`${styles.door} ${state} ${day === 24 ? styles.last : ""}`}
                onPointerEnter={isToday || isOpen ? sfx.hover : undefined}
                onClick={() => (isOpen ? (sfx.pop(), setFirst(false), setReveal(day)) : open(day))}
                disabled={!isOpen && !isToday}
                aria-label={t(`Case ${day}`, `Door ${day}`)}
              >
                {isOpen ? (
                  <span className={styles.inside}>{giftLine(DAYS[day - 1][0], t, null)[0]}</span>
                ) : (
                  <motion.span
                    className={styles.leaf}
                    animate={opening === day ? { rotateY: -110 } : { rotateY: 0 }}
                    transition={{ duration: 0.6, ease: "easeIn" }}
                  >
                    {missed ? "❄" : day}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {reveal && (
            <motion.div className={styles.reveal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && setReveal(null)}>
              <motion.div className={styles.card} initial={{ scale: 0.6, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
                <span className={styles.number}>{reveal}</span>
                <h3>{t(`Case ${reveal}`, `Door ${reveal}`)}</h3>
                <ul>
                  {giftsOf(reveal, t, gold, first).map(([icon, text], i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }}>
                      <span>{icon}</span>
                      {text}
                    </motion.li>
                  ))}
                </ul>
                {hasCard && (
                  <button className={styles.code} disabled={!card} onClick={() => void sendCard()}>
                    💌 {card ? t("Envoyer ma carte", "Send my card") : t("Ta carte arrive…", "Your card is coming…")}
                  </button>
                )}
                {giftsOfDay(reveal, first).some((g) => g.kind === "promo") && (
                  <button
                    className={styles.code}
                    onClick={() => {
                      sfx.click();
                      void navigator.clipboard?.writeText(ADVENT_PROMO).then(() => setCopied(true));
                    }}
                  >
                    {ADVENT_PROMO} <small>{copied ? t("copié ✓", "copied ✓") : t("copier", "copy")}</small>
                  </button>
                )}
                <button
                  className={styles.go}
                  onPointerEnter={sfx.hover}
                  onClick={() => {
                    sfx.click();
                    setReveal(null);
                    onClose();
                  }}
                >
                  {t("Voir mon sapin ▶", "See my tree ▶")}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
