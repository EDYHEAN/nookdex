"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { loadSets, setIdOfCard, useSets } from "@/lib/catalog";
import { useLang, useT } from "@/lib/lang";
import { DENSITIES, type Density, type ListItem, densityFor, drawPage, sortItems } from "@/lib/listImages";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { unlock } from "@/lib/trophyStore";
import type { Double } from "@/lib/share";
import { BottomSheet } from "./BottomSheet";
import panel from "./TradePanel.module.css";
import styles from "./ExportImages.module.css";

type Side = "want" | "give";
interface Shot {
  url: string;
  blob: Blob;
  name: string;
}

/**
 * « En images » (Johan, 2026-11-10): the list as a few pictures for the Facebook groups that refuse links (lib/listImages
 * draws them). A side, how many cards a picture, with or without prices; then the phone's share sheet, or downloads.
 */
export function ExportImages({ start, want, give, onClose }: { start: Side; want: string[]; give: Double[]; onClose: () => void }) {
  const tr = useT();
  const en = useLang() === "en";
  const cards = useSets((s) => s.cards);
  const name = useStore((s) => s.profile?.name ?? "");
  const pricesOn = useStore((s) => s.share?.prices ?? true);
  const [side, setSide] = useState<Side>(start);
  const [prices, setPrices] = useState(pricesOn);

  const items = useMemo(
    (): ListItem[] =>
      sortItems(side === "want" ? want.map((key) => ({ key, card: cards[key] })) : give.map((d) => ({ key: d.key, card: cards[d.key], variant: d.variant, n: d.ticked }))),
    [side, want, give, cards],
  );
  const [density, setDensity] = useState<Density>(() => densityFor(start === "want" ? want.length : give.length));
  const pages = Math.ceil(items.length / density);

  // the ★ cards of sets no binder holds may not be loaded yet
  useEffect(() => {
    const missing = [...new Set(items.filter((i) => !i.card).map((i) => setIdOfCard(i.key)).filter((s): s is string => !!s))];
    if (missing.length) void loadSets(missing);
  }, [items]);

  /** the pictures drawn, for the choice `sig` (those of a former choice aren't shown) */
  const sig = `${side}|${density}|${prices}|${items.map((i) => (i.card ? i.key : "")).join()}`;
  const [run, setRun] = useState<{ sig: string; shots: Shot[]; done: number }>({ sig: "", shots: [], done: 0 });
  const shots = useMemo(() => (run.sig === sig ? run.shots : []), [run, sig]);
  const done = run.sig === sig ? run.done : 0;
  useEffect(() => {
    let live = true;
    const made: Shot[] = [];
    // a moment's wait: ticking through the chips draws only the last choice
    const tr = <T,>(fr: T, english: T): T => (en ? english : fr);
    const t = setTimeout(async () => {
      setRun({ sig, shots: [], done: 0 });
      const date = new Date().toLocaleDateString(tr("fr-FR", "en-GB"));
      for (let p = 0; p < pages && live; p++) {
        const blob = await drawPage(items.slice(p * density, (p + 1) * density), density, prices, {
          title: side === "want" ? tr("JE CHERCHE", "WANTED") : tr("J'ÉCHANGE", "FOR TRADE"),
          color: side === "want" ? "#7cc4ff" : "#ffd35a",
          sub: [name, `${items.length} ${tr(items.length > 1 ? "cartes" : "carte", items.length > 1 ? "cards" : "card")}`].filter(Boolean).join(" · "),
          page: pages > 1 ? `${p + 1}/${pages}` : "",
          note: tr(`Prix du ${date} · Cardmarket / TCGplayer`, `Prices of ${date} · Cardmarket / TCGplayer`),
        }).catch(() => null);
        if (!live) return;
        if (blob) made.push({ blob, url: URL.createObjectURL(blob), name: `nookdex-${side === "want" ? tr("je-cherche", "wanted") : tr("j-echange", "for-trade")}-${p + 1}.jpg` });
        setRun({ sig, shots: [...made], done: p + 1 });
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
      made.forEach((s) => URL.revokeObjectURL(s.url));
    };
      // `sig` holds the items that matter (a card loaded), not their identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, name, en]);

  const ready = pages > 0 && done === pages && shots.length > 0;
  const files = useMemo(() => shots.map((s) => new File([s.blob], s.name, { type: "image/jpeg" })), [shots]);
  /** the phone's share sheet when it takes pictures (a touch device: on a computer, downloads are what's wanted) */
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    matchMedia("(pointer: coarse)").matches &&
    (files.length ? navigator.canShare({ files }) : true);

  const download = (s: Shot) => {
    const a = document.createElement("a");
    a.href = s.url;
    a.download = s.name;
    a.click();
  };
  const downloadAll = async () => {
    sfx.coin();
    unlock("share");
    for (const s of shots) {
      download(s);
      // one at a time: a browser drops downloads fired together
      await new Promise((r) => setTimeout(r, 350));
    }
  };
  const shareAll = async () => {
    sfx.pop();
    try {
      await navigator.share({ files });
      sfx.coin();
      unlock("share");
    } catch (e) {
      if ((e as Error).name !== "AbortError") void downloadAll();
    }
  };

  return (
    <BottomSheet
      icon="📸"
      title={tr("Ma liste en images", "My list as pictures")}
      sub={<small>{tr("Pour les groupes qui refusent les liens", "For the groups that refuse links")}</small>}
      onClose={onClose}
    >
      <div className={styles.body}>
        <div className={styles.tabs} role="tablist">
          {(
            [
              ["want", `🔎 ${tr("Je cherche", "Wanted")}`, want.length],
              ["give", `🔁 ${tr("J'échange", "For trade")}`, give.length],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              role="tab"
              aria-selected={side === k}
              className={`${styles.tab} ${side === k ? styles.tabOn : ""} ${k === "want" ? styles.tabWant : styles.tabGive}`}
              disabled={!n}
              onClick={() => {
                sfx.riffle();
                setSide(k);
                setDensity(densityFor(n));
              }}
            >
              {label}
              <b>{n}</b>
            </button>
          ))}
        </div>

        <div className={styles.row}>
          <span className={styles.chips} role="radiogroup" aria-label={tr("Cartes par image", "Cards per picture")}>
            {(Object.keys(DENSITIES).map(Number) as Density[]).map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={density === d}
                className={`${styles.chip} ${density === d ? styles.chipOn : ""}`}
                onClick={() => {
                  sfx.click();
                  setDensity(d);
                }}
              >
                <b>{d}</b>
                <small>{tr("/ image", "/ picture")}</small>
              </button>
            ))}
          </span>
          <button
            className={`${panel.switch} ${prices ? panel.switchOn : ""}`}
            onClick={() => {
              sfx.click();
              setPrices(!prices);
            }}
            aria-pressed={prices}
          >
            <i aria-hidden />
            {tr("Prix", "Prices")}
          </button>
        </div>

        {!items.length ? (
          <p className={styles.empty}>{side === "want" ? tr("Rien à chercher pour l'instant.", "Nothing wanted yet.") : tr("Coche tes doubles à échanger d'abord.", "Tick your doubles for trade first.")}</p>
        ) : (
          <ul className={styles.shots}>
            {Array.from({ length: pages }, (_, i) => {
              const s = shots[i];
              return (
                <li key={i}>
                  {s ? (
                    <motion.button
                      initial={{ opacity: 0, y: 10, rotate: i % 2 ? 2 : -2 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      onClick={() => {
                        sfx.pop();
                        download(s);
                      }}
                      aria-label={tr(`Télécharger l'image ${i + 1}`, `Download picture ${i + 1}`)}
                    >
                      <img src={s.url} alt="" />
                    </motion.button>
                  ) : (
                    <span className={styles.wait} aria-hidden>
                      {i === done ? "✏️" : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={`${panel.bar} ${styles.bar}`}>
        <span>
          <b>
            {pages} {tr(pages > 1 ? "images" : "image", pages > 1 ? "pictures" : "picture")}
          </b>
          {ready ? tr("Warwick signe en bas, discret 🐾", "Warwick signs at the bottom, quietly 🐾") : tr(`On dessine… ${done}/${pages}`, `Drawing… ${done}/${pages}`)}
        </span>
        <motion.button className={`${panel.btn} ${panel.btnBig}`} disabled={!ready} onClick={canShare ? shareAll : downloadAll} whileTap={{ scale: 0.92 }} onPointerEnter={sfx.hover}>
          {canShare ? tr("Partager ↗", "Share ↗") : tr("Télécharger", "Download")}
        </motion.button>
      </div>
    </BottomSheet>
  );
}
