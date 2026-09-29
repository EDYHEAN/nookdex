"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cardTier, formatEur, setStats, unitPrice, type Tier } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { BinderDef, CardData } from "@/lib/types";
import { isCompact, useViewport } from "@/lib/useViewport";
import { CardSlot, type AddResult } from "./CardSlot";
import { Celebration } from "./Celebration";
import { Inspector } from "./Inspector";
import { StatsPage } from "./StatsPage";
import styles from "./Binder.module.css";

type Face = { type: "cover" } | { type: "stats" } | { type: "page"; index: number } | { type: "blank" } | null;
interface LeafDef {
  front: Face;
  back: Face;
}

interface Props {
  binder: BinderDef;
  /** Card to show once the binder is open (from the PC search / wishlist). */
  focusCardId?: string | null;
  onClosed: () => void;
}

const ASPECT = 0.74; // page width / height for a 3x3 pocket page
const PER_PAGE = 9;

export function BinderView({ binder, focusCardId, onClosed }: Props) {
  const set = binder.set!;
  const vp = useViewport();
  const single = isCompact(vp);
  const titleH = single ? 64 : 58;
  const navH = single ? 70 : 64;

  const { pageW, pageH, gap } = useMemo(() => {
    const maxH = vp.h - titleH - navH - 16;
    const maxW = single ? vp.w - 24 : (vp.w - 120) / 2.08;
    const ph = Math.max(200, Math.min(maxH, maxW / ASPECT));
    const pw = ph * ASPECT;
    return { pageW: Math.round(pw), pageH: Math.round(ph), gap: single ? 0 : Math.round(pw * 0.08) };
  }, [vp.w, vp.h, single, titleH, navH]);

  const pages = useMemo(() => {
    const out: CardData[][] = [];
    for (let i = 0; i < set.cards.length; i += PER_PAGE) out.push(set.cards.slice(i, i + PER_PAGE));
    return out;
  }, [set]);

  const leaves = useMemo<LeafDef[]>(() => {
    if (single) {
      return [
        { front: { type: "cover" }, back: null },
        { front: { type: "stats" }, back: null },
        ...pages.map((_, i) => ({ front: { type: "page", index: i } as Face, back: null })),
      ];
    }
    const out: LeafDef[] = [{ front: { type: "cover" }, back: { type: "stats" } }];
    for (let i = 0; i < pages.length; i += 2) {
      out.push({
        front: { type: "page", index: i },
        back: i + 1 < pages.length ? { type: "page", index: i + 1 } : { type: "blank" },
      });
    }
    return out;
  }, [pages, single]);

  const maxF = single ? leaves.length - 1 : leaves.length;
  const [f, setF] = useState(0);
  const fRef = useRef(0);
  const [fast, setFast] = useState(false);
  const [phase, setPhase] = useState<"enter" | "open" | "closing">("enter");
  const [inspect, setInspect] = useState<string | null>(null);
  const [party, setParty] = useState<{ id: number; card: CardData } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const riffleTimer = useRef<number | null>(null);

  const collection = useStore((s) => s.collection);
  const addCard = useStore((s) => s.addCard);
  const stats = useMemo(() => setStats(set, collection), [set, collection]);

  const go = useCallback((next: number, quick = false) => {
    fRef.current = next;
    setFast(quick);
    setF(next);
  }, []);

  /** Flip several leaves in a row, like riffling through the binder. */
  const riffleTo = useCallback(
    (target: number, done?: () => void) => {
      if (riffleTimer.current) clearInterval(riffleTimer.current);
      const step = () => {
        const cur = fRef.current;
        if (cur === target) {
          if (riffleTimer.current) clearInterval(riffleTimer.current);
          riffleTimer.current = null;
          done?.();
          return;
        }
        sfx.riffle();
        go(cur + (target > cur ? 1 : -1), true);
      };
      if (Math.abs(target - fRef.current) === 1) {
        sfx.flip();
        go(target);
        done?.();
        return;
      }
      step();
      riffleTimer.current = window.setInterval(step, 55);
    },
    [go],
  );

  useEffect(() => () => {
    if (riffleTimer.current) clearInterval(riffleTimer.current);
  }, []);

  // Open the cover once the binder has landed in front of us.
  useEffect(() => {
    const t = setTimeout(() => {
      sfx.coverOpen();
      go(1);
      setPhase("open");
    }, 560);
    return () => clearTimeout(t);
  }, [go]);

  // Closing drops the open binder out of the screen: no riffling back, so pages never overlap.
  const close = useCallback(() => {
    if (phase !== "open") return;
    if (riffleTimer.current) clearInterval(riffleTimer.current);
    setInspect(null);
    setPhase("closing");
    sfx.drop();
    setLeaving(true);
  }, [phase]);


  const next = useCallback(() => {
    if (phase !== "open" || fRef.current >= maxF) return;
    riffleTo(fRef.current + 1);
  }, [phase, maxF, riffleTo]);
  const prev = useCallback(() => {
    if (phase !== "open" || fRef.current <= 1) return;
    riffleTo(fRef.current - 1);
  }, [phase, riffleTo]);

  const jumpToPage = useCallback(
    (pageIndex: number, force = false) => {
      if (phase !== "open" && !force) return;
      const target = single ? pageIndex + 2 : Math.floor(pageIndex / 2) + 1 + (pageIndex % 2);
      riffleTo(Math.min(maxF, Math.max(1, target)));
    },
    [phase, single, maxF, riffleTo],
  );

  // Coming from the PC: riffle to the card and make it pulse.
  const focusDone = useRef(false);
  useEffect(() => {
    if (phase !== "open" || !focusCardId || focusDone.current) return;
    focusDone.current = true;
    const i = set.cards.findIndex((c) => c.id === focusCardId);
    if (i < 0) return;
    const t1 = setTimeout(() => {
      jumpToPage(Math.floor(i / PER_PAGE), true);
      setFocused(focusCardId);
    }, 450);
    const t2 = setTimeout(() => setFocused(null), 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase, focusCardId, set, jumpToPage]);

  // keyboard + wheel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inspect) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") close();
    };
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      if (inspect) return;
      const now = performance.now();
      if (now - lastWheel < 380 || Math.abs(e.deltaY) < 8) return;
      lastWheel = now;
      if (e.deltaY > 0) next();
      else prev();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [next, prev, close, inspect]);

  // swipe
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      if (dx < 0) next();
      else prev();
    }
  };

  const combo = useRef({ n: 0, t: 0 });
  const onAdd = useCallback(
    (card: CardData): AddResult => {
      const now = performance.now();
      const c = combo.current;
      c.n = now - c.t < 2500 ? c.n + 1 : 0;
      c.t = now;
      const variant = card.variants[0];
      addCard(card.id, variant);
      const tier: Tier = cardTier(card);
      sfx.add(c.n, tier);
      if (tier === "legend") setParty({ id: now, card });
      return { combo: c.n + 1, gain: unitPrice(card, variant, "trend"), tier };
    },
    [addCard],
  );

  // geometry
  const spreadW = single ? pageW : pageW * 2 + gap;
  const left = (vp.w - spreadW) / 2;
  const top = titleH + (vp.h - titleH - navH - pageH) / 2;
  const closedShift = single ? 0 : -(pageW + gap) / 2;
  // The binder rises from the bottom of the screen, with a touch of motion blur.
  const below = {
    y: vp.h - top + 40,
    rotateX: 32,
    scale: 0.84,
    opacity: 0,
    filter: "blur(10px)",
  };
  const dropped = { ...below, rotateX: -14, filter: "blur(8px)" };

  const renderFace = (face: Face, side: "front" | "back", leafIndex: number): ReactNode => {
    if (!face) return null;
    const near = Math.abs(leafIndex - f) <= 2 || (leafIndex === 0 && f <= 2);
    if (face.type === "cover") return <Cover binder={binder} owned={stats.owned} total={stats.total} />;
    if (face.type === "stats")
      return <StatsPage binder={binder} stats={stats} pages={pages} collection={collection} onJump={jumpToPage} />;
    if (face.type === "blank") return <div className={styles.sheet} />;
    const cards = pages[face.index];
    return (
      <div className={styles.sheet} data-side={side}>
        <div className={styles.grid}>
          {near &&
            cards.map((card) => (
              <CardSlot
                key={card.id}
                card={card}
                copies={collection[card.id]}
                cardWidth={pageW * 0.28}
                focused={focused === card.id}
                onAdd={onAdd}
                onInspect={setInspect}
              />
            ))}
        </div>
        <span className={styles.pageNum}>{face.index + 1}</span>
      </div>
    );
  };

  let pageLabel = "";
  if (f === 0) pageLabel = "fermé";
  else if (single) pageLabel = f === 1 ? "sommaire" : `page ${f - 1} / ${pages.length}`;
  else if (f === 1) pageLabel = `sommaire · page 1 / ${pages.length}`;
  else if (f > leaves.length - 1) pageLabel = `page ${pages.length} / ${pages.length}`;
  else pageLabel = `pages ${2 * (f - 1)}–${Math.min(2 * (f - 1) + 1, pages.length)} / ${pages.length}`;

  const inspectIndex = inspect ? set.cards.findIndex((c) => c.id === inspect) : -1;

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: leaving ? 0.45 : 0.35 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.header
        className={styles.title}
        style={{ height: titleH }}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: phase === "open" ? 0 : -40, opacity: phase === "open" ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <div className={styles.titleText}>
          <h1>{set.name}</h1>
          <p>
            {stats.owned}/{stats.total} cartes · <b>{formatEur(stats.trend)}</b>
          </p>
        </div>
        <button className={styles.pixelBtn} onClick={close} onPointerEnter={sfx.hover}>
          Ranger <kbd>Échap</kbd>
        </button>
      </motion.header>

      <motion.div
        className={styles.wrapper}
        style={{ left, top, width: spreadW, height: pageH, ["--pw" as string]: `${pageW}px`, ["--ph" as string]: `${pageH}px` }}
        initial={below}
        animate={leaving ? dropped : { y: 0, rotateX: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={
          leaving
            ? { duration: 0.42, ease: [0.55, 0, 0.8, 0.2] }
            : {
                duration: 0.62,
                ease: [0.16, 1, 0.3, 1],
                opacity: { duration: 0.2 },
                filter: { duration: 0.45, ease: "easeOut" },
              }
        }
        onAnimationComplete={() => {
          if (leaving) onClosed();
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <motion.div
          className={styles.book}
          initial={{ x: closedShift }}
          animate={{ x: f === 0 ? closedShift : 0 }}
          transition={{ duration: 0.75, ease: [0.45, 0, 0.2, 1] }}
        >
          {/* inside of the back cover */}
          <div
            className={styles.board}
            style={{ left: single ? 0 : pageW + gap, width: pageW, background: binder.dark }}
          >
            <div className={styles.endPage}>
              <span>✦</span>
              <p>fin du classeur</p>
            </div>
          </div>
          {!single && (
            <div className={styles.rings} style={{ left: pageW, width: gap }}>
              {[0.2, 0.5, 0.8].map((p) => (
                <span key={p} style={{ top: `${p * 100}%` }} />
              ))}
            </div>
          )}
          {leaves.map((leaf, i) => (
            <Leaf
              key={i}
              index={i}
              total={leaves.length}
              flipped={i < f}
              fast={fast}
              single={single}
              left={single ? 0 : pageW + gap}
              pivot={single ? 0 : -gap / 2}
              width={pageW}
              color={binder.dark}
              front={renderFace(leaf.front, "front", i)}
              back={renderFace(leaf.back, "back", i)}
            />
          ))}
          {phase === "open" && f < maxF && (
            <button className={`${styles.corner} ${styles.cornerRight}`} onClick={next} aria-label="Page suivante" />
          )}
          {phase === "open" && f > 1 && !single && (
            <button className={`${styles.corner} ${styles.cornerLeft}`} onClick={prev} aria-label="Page précédente" />
          )}
        </motion.div>
      </motion.div>

      <motion.nav
        className={styles.nav}
        style={{ height: navH }}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: phase === "open" ? 0 : 40, opacity: phase === "open" ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <button className={styles.arrow} onClick={prev} disabled={f <= 1} onPointerEnter={sfx.hover} aria-label="Précédent">
          ◀
        </button>
        <span className={styles.pageLabel}>{pageLabel}</span>
        <button className={styles.arrow} onClick={next} disabled={f >= maxF} onPointerEnter={sfx.hover} aria-label="Suivant">
          ▶
        </button>
      </motion.nav>

      {inspect && inspectIndex >= 0 && (
        <Inspector
          key={inspect}
          card={set.cards[inspectIndex]}
          onClose={() => setInspect(null)}
          onNavigate={(d) => {
            const n = inspectIndex + d;
            if (n >= 0 && n < set.cards.length) {
              sfx.riffle();
              setInspect(set.cards[n].id);
            }
          }}
          onAdd={onAdd}
        />
      )}

      {party && <Celebration key={party.id} card={party.card} onDone={() => setParty(null)} />}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

interface LeafProps {
  index: number;
  total: number;
  flipped: boolean;
  fast: boolean;
  single: boolean;
  left: number;
  pivot: number;
  width: number;
  color: string;
  front: ReactNode;
  back: ReactNode;
}

function Leaf({ index, total, flipped, fast, single, left, pivot, width, color, front, back }: LeafProps) {
  const rot = useMotionValue(flipped ? -180 : 0);
  const [moving, setMoving] = useState(false);
  const shade = useTransform(rot, [0, -90, -180], [0, 0.5, 0]);
  const blur = useTransform(rot, [0, -90, -180], ["blur(0px)", "blur(1.4px)", "blur(0px)"]);
  const sheen = useTransform(rot, [0, -180], ["-60%", "160%"]);

  useEffect(() => {
    const target = flipped ? -180 : 0;
    if (rot.get() === target) return;
    const ctrl = animate(rot, target, {
      duration: fast ? 0.3 : 0.52,
      ease: [0.33, 0, 0.15, 1],
      onPlay: () => setMoving(true),
      onComplete: () => setMoving(false),
    });
    return () => ctrl.stop();
  }, [flipped, fast, rot]);

  // While turning, the leaf goes on top; among several turning leaves, the last one launched wins.
  const z = moving ? total * 3 + (flipped ? index : total - index) : flipped ? index + 1 : total * 2 - index;
  const hidden = single && flipped && !moving;
  const isCover = index === 0;

  return (
    <motion.div
      className={`${styles.leaf} ${moving ? styles.moving : ""} ${isCover ? styles.coverLeaf : ""}`}
      style={{
        left,
        width,
        zIndex: z,
        rotateY: rot,
        transformPerspective: 2400,
        originX: `${pivot}px`,
        visibility: hidden ? "hidden" : "visible",
        ["--leaf" as string]: color,
      }}
    >
      <div className={styles.face}>
        <motion.div className={styles.faceInner} style={moving ? { filter: blur } : undefined}>
          {front}
        </motion.div>
        <motion.div className={styles.shade} style={{ opacity: shade }} />
        {moving && <motion.div className={styles.sheen} style={{ left: sheen }} />}
      </div>
      <div className={`${styles.face} ${styles.back}`}>
        <motion.div className={styles.faceInner} style={moving ? { filter: blur } : undefined}>
          {back}
        </motion.div>
        <motion.div className={styles.shade} style={{ opacity: shade }} />
      </div>
    </motion.div>
  );
}

function Cover({ binder, owned, total }: { binder: BinderDef; owned: number; total: number }) {
  const set = binder.set!;
  return (
    <div className={styles.cover} style={{ background: binder.color, color: binder.ink }}>
      <div className={styles.coverStitch} style={{ borderColor: binder.dark }} />
      <div className={styles.coverInner}>
        <span className={styles.coverCode} style={{ background: binder.dark, color: binder.color }}>
          {binder.code}
        </span>
        <img className={styles.coverLogo} src={`${binder.logo}.png`} alt={set.name} draggable={false} />
        <p className={styles.coverName}>{set.name}</p>
        <p className={styles.coverCount}>
          {owned} / {total}
        </p>
      </div>
      <span className={styles.coverBrand}>PokéPocket</span>
    </div>
  );
}
