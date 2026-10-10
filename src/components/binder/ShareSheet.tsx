"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { bareId, langOfKey } from "@/lib/cardLang";
import { useLang } from "@/lib/lang";
import { playerCurrency } from "@/lib/price";
import { setPagePath, slugify } from "@/lib/setPath";
import { SITE_DOMAIN } from "@/lib/site";
import { sfx } from "@/lib/sound";
import { unlock } from "@/lib/trophyStore";
import { useStore } from "@/lib/store";
import type { SetData } from "@/lib/types";
import styles from "./ShareSheet.module.css";

/**
 * "Show my binder": the progress picture (drawn by /share/progress from what's in the address), then the phone's own
 * share sheet with the picture and a link to the set's page; on a computer, download it or copy the link.
 * The picture is fetched first, so the share button runs right in the tap (Safari refuses a share after a wait).
 */
export function ShareSheet({ setKey, set, owned, value, onClose }: { setKey: string; set: SetData; owned: number; value: number; onClose: () => void }) {
  const lang = useLang();
  const t = <T,>(fr: T, en: T) => (lang === "en" ? en : fr);
  const collection = useStore((s) => s.collection);
  const nickname = useStore((s) => s.profile?.name ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const total = set.cards.length;
  const src = useMemo(() => {
    // the three most valuable cards the player owns, with a scan
    const best = set.cards
      .filter((c) => collection[c.id]?.length && c.img)
      .sort((a, b) => (b.price.trend ?? b.price.trendHolo ?? 0) - (a.price.trend ?? a.price.trendHolo ?? 0))
      .slice(0, 3)
      .map((c) => c.id);
    const q = new URLSearchParams({ s: setKey, n: String(owned), v: value.toFixed(2), c: playerCurrency(), l: lang });
    if (nickname) q.set("p", nickname);
    if (best.length) q.set("k", best.join(","));
    return `/share/progress?${q}`;
  }, [set, collection, setKey, owned, value, lang, nickname]);

  const link = `https://${SITE_DOMAIN}${setPagePath(langOfKey(setKey), bareId(setKey)) ?? (lang === "en" ? "/en" : "")}`;
  const text = t(`J'ai ${owned}/${total} cartes de ${set.name} dans mon classeur NookDex !`, `I have ${owned}/${total} ${set.name} cards in my NookDex binder!`);
  const fileName = `nookdex-${slugify(set.name) || "binder"}.png`;

  useEffect(() => {
    let gone = false;
    let made: string | null = null;
    fetch(src)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (gone) return;
        made = URL.createObjectURL(blob);
        setBlobUrl(made);
        setFile(new File([blob], fileName, { type: "image/png" }));
      })
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [src, fileName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const say = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote((n) => (n === msg ? null : n)), 1800);
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const canShareFile = !!file && canShare && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const share = async () => {
    sfx.pop();
    try {
      // the link goes in the text: some apps drop the url field when a picture comes with it
      await navigator.share(canShareFile ? { files: [file!], text: `${text} ${link}` } : { text, url: link });
      sfx.coin();
      unlock("share");
    } catch (e) {
      if ((e as Error).name !== "AbortError") say(t("partage impossible", "couldn't share"));
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      sfx.pop();
      unlock("share");
      say(t("lien copié !", "link copied!"));
    } catch {
      sfx.locked();
      say(t("copie impossible", "couldn't copy"));
    }
  };

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className={styles.sheet}
        role="dialog"
        aria-label={t("Partager mon classeur", "Share my binder")}
        initial={{ y: 60, scale: 0.9, rotate: -2 }}
        animate={{ y: 0, scale: 1, rotate: 0 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
      >
        <button
          className={styles.close}
          onClick={() => {
            sfx.click();
            onClose();
          }}
          aria-label={t("Fermer", "Close")}
        >
          ✕
        </button>
        <h2>{t("Montre ton classeur", "Show your binder")}</h2>
        <div className={styles.preview}>
          {blobUrl ? (
            <motion.img
              src={blobUrl}
              alt={text}
              initial={{ scale: 0.85, rotate: -4, opacity: 0 }}
              animate={{ scale: 1, rotate: -1.5, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            />
          ) : (
            <p className={styles.wait}>{failed ? t("L'image n'a pas pu être dessinée.", "The picture couldn't be drawn.") : t("On dessine ta photo…", "Drawing your picture…")}</p>
          )}
        </div>
        <div className={styles.actions}>
          {canShare && (
            <button className={styles.main} onClick={share} disabled={!file && !failed} onPointerEnter={sfx.hover}>
              {t("Partager ↗", "Share ↗")}
            </button>
          )}
          {blobUrl && (
            <a className={canShare ? styles.second : styles.main} href={blobUrl} download={fileName} onClick={() => {
                sfx.pop();
                unlock("share");
              }} onPointerEnter={sfx.hover}>
              {t("Télécharger l'image", "Download the picture")}
            </a>
          )}
          <button className={styles.second} onClick={copy} onPointerEnter={sfx.hover}>
            {t("Copier le lien", "Copy the link")}
          </button>
        </div>
        <p className={styles.note} aria-live="polite">
          {note ?? " "}
        </p>
      </motion.div>
    </motion.div>
  );
}
