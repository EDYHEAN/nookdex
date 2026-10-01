"use client";

import { useEffect, useState } from "react";
import { shelfBinders } from "@/lib/binders";
import { loadSets, neededSets, useSets } from "@/lib/catalog";
import { SCENE, sceneImg } from "@/lib/scene";
import { SITE_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./Loader.module.css";

const TIPS = [
  "Astuce : balaie les classeurs avec la souris ♪",
  "Astuce : le chat adore les caresses",
  "Astuce : la radio passe du lofi sous la pluie",
  "Astuce : clique sur une carte grise pour l'ajouter",
  "Astuce : l'écran du PC liste tes cartes les plus recherchées",
  "Astuce : la lampe à lave change de couleur",
];

const MIN_MS = 1800;

/** Fonts, the painted room layers, set logos and the first pages of cards (once the sets are downloaded). */
function assetsToPreload() {
  const { binders } = useStore.getState();
  const { sets } = useSets.getState();
  const urls = [
    sceneImg("plate.webp"),
    sceneImg("chair.webp"),
    sceneImg("cat-sleep.webp"),
    sceneImg("cat-awake.webp"),
    sceneImg("lamp-head.webp"),
    sceneImg("lamp-head-day.webp"),
    sceneImg("day.webp"),
    sceneImg("sky.webp"),
    sceneImg("sky-day.webp"),
    sceneImg("night-light.webp"),
  ];
  for (const b of shelfBinders(binders)) {
    if (b.logo) urls.push(`${b.logo}.png`);
    if (b.setId) sets[b.setId]?.cards.slice(0, 18).forEach((c) => c.img && urls.push(`${c.img}/low.webp`));
  }
  return urls;
}

const L = SCENE.logo;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function Loader({ onEnter }: { onEnter: () => void }) {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    let alive = true;
    const started = performance.now();
    let total = 2;
    let done = 0;
    const tick = () => alive && setProgress(++done / total);
    const preload = (src: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          tick();
          resolve();
        };
        img.src = src;
      });
    const { binders, collection } = useStore.getState();
    const jobs: Promise<unknown>[] = [
      document.fonts.ready.then(tick),
      // the cards of the player's binders first, then their pictures
      loadSets(neededSets(binders, collection)).then(() => {
        tick();
        const urls = assetsToPreload();
        total += urls.length;
        return Promise.all(urls.map(preload));
      }),
    ];
    // Never block the user more than a few seconds on a slow network.
    const timeout = new Promise((r) => setTimeout(r, 7000));
    Promise.race([Promise.all(jobs), timeout]).then(() => {
      const wait = Math.max(0, MIN_MS - (performance.now() - started));
      setTimeout(() => {
        if (!alive) return;
        setProgress(1);
        setReady(true);
      }, wait);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 2600);
    return () => clearInterval(t);
  }, []);

  const enter = () => {
    if (!ready || leaving) return;
    sfx.boot();
    sfx.coverOpen();
    setLeaving(true);
    setTimeout(onEnter, 700);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") enter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const segs = 16;
  const lit = Math.round(progress * segs);
  const b = L.ball;
  const ballBox = { x: b.x - b.r - 4, y: b.y - b.r - 4, s: b.r * 2 + 8 };

  return (
    <div className={`${styles.loader} ${leaving ? styles.leaving : ""}`} onClick={enter}>
      <div className={styles.art} style={{ aspectRatio: `${L.width} / ${L.height}` }}>
        <img className={styles.paper} src={sceneImg("logo-paper.webp")} alt={SITE_NAME} draggable={false} />
        <img
          className={`${styles.ball} ${ready ? styles.caught : ""}`}
          src={sceneImg("logo-ball.webp")}
          alt=""
          draggable={false}
          style={{ left: pct(ballBox.x, L.width), top: pct(ballBox.y, L.height), width: pct(ballBox.s, L.width) }}
        />
        {ready && (
          <div className={styles.stars} style={{ left: pct(b.x, L.width), top: pct(b.y - b.r, L.height) }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ ["--i" as string]: i }}>
                ✦
              </span>
            ))}
          </div>
        )}

        <div className={styles.bottom}>
          {!ready ? (
            <>
              <div className={styles.bar}>
                {Array.from({ length: segs }, (_, i) => (
                  <span key={i} className={i < lit ? styles.on : ""} />
                ))}
              </div>
              <p key={tip} className={styles.tip}>
                {TIPS[tip]}
              </p>
            </>
          ) : (
            <>
              <button className={styles.start} onClick={enter}>
                ▶ Appuie pour entrer
              </button>
              <p className={styles.small}>le son est de la partie · pense à monter le volume</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
