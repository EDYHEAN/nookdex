"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { shelfBinders } from "@/lib/binders";
import { loadSet, loadSets, neededSets, setIdOfCard } from "@/lib/catalog";
import { returningFromSignIn, startCloud, useCloud } from "@/lib/cloud";
import { setMuted, sfx, startAmbient, stopAmbient } from "@/lib/sound";
import { OS_NAME } from "@/lib/site";
import { useStore } from "@/lib/store";
import { isCompact, useViewport } from "@/lib/useViewport";
import { BinderView } from "./binder/BinderView";
import { Computer } from "./computer/Computer";
import { Loader } from "./Loader";
import { BoilFilter } from "./fx/Boil";
import { Grain } from "./fx/Grain";
import { AboutBook } from "./room/AboutBook";
import { PaintedRoom } from "./room/PaintedRoom";
import { BinderPicker, type BinderChoice } from "./shelf/BinderPicker";
import { Tour } from "./shelf/Tour";
import { Welcome } from "./shelf/Welcome";
import styles from "./App.module.css";

interface Open {
  binderId: string;
  focusCardId?: string;
}

export function App() {
  const vp = useViewport();
  const compact = isCompact(vp);
  const [open, setOpen] = useState<Open | null>(null);
  const [computer, setComputer] = useState<{ x: number; y: number } | null>(null);
  /** The guided tour, after the first binder is picked (and replayable from the notebook). */
  const [tour, setTour] = useState(false);
  const [adding, setAdding] = useState(false);
  const [about, setAbout] = useState(false);
  // Back from Google or the e-mail link: the player already went in, no loader again.
  const [entered, setEntered] = useState(returningFromSignIn);
  const profile = useStore((s) => s.profile);
  const cloud = useCloud();
  const offline = useStore((s) => s.offline);
  // Dev screenshots (?skip ?open ?os ?demo) skip the sign-in.
  const [devBypass] = useState(
    () => process.env.NODE_ENV !== "production" && /[?&](skip|open|os|demo)\b/.test(window.location.search),
  );
  const userBinders = useStore((s) => s.binders);
  const binders = useMemo(() => shelfBinders(userBinders), [userBinders]);
  const [welcome, setWelcome] = useState(() => !useStore.getState().profile);
  const sound = useStore((s) => s.sound);
  const ambient = useStore((s) => s.ambient);
  const toggleSound = useStore((s) => s.toggleSound);
  const daytime = useStore((s) => s.daytime);
  const toggleDaytime = useStore((s) => s.toggleDaytime);
  const setAmbient = useStore((s) => s.setAmbient);

  useEffect(() => setMuted(!sound), [sound]);

  useEffect(startCloud, []);

  // No loader after signing in: the cards of the binders load in the background instead.
  useEffect(() => {
    if (!returningFromSignIn) return;
    const { binders, collection } = useStore.getState();
    void loadSets(neededSets(binders, collection));
  }, []);

  // Dev-only shortcuts for screenshots: ?skip  ?open=swsh12  ?demo  ?os
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const q = new URLSearchParams(window.location.search);
    const demo = async () => {
      if (!useStore.getState().binders.length) useStore.getState().addBinder({ kind: "set", setId: "swsh12" });
      if (Object.keys(useStore.getState().collection).length) return;
      const set = await loadSet("swsh12");
      const { addCard, addCopy, updateCopy } = useStore.getState();
      set.cards.forEach((c, i) => {
        if ((i * 7) % 10 < 6) addCard(c.id, c.variants[0]);
        if (i % 9 === 0 && c.variants[1]) addCopy(c.id, c.variants[1]);
        const copy = useStore.getState().collection[c.id]?.[0];
        if (copy && i % 4 === 0) updateCopy(c.id, copy.id, { paid: i % 8 === 0 ? 0 : Math.round((c.price.trend ?? 0) * 80) / 100 });
      });
    };
    const t = setTimeout(async () => {
      if ((q.has("demo") || q.has("skip") || q.has("open") || q.has("os")) && !useStore.getState().profile) {
        useStore.getState().createProfile("Dev");
        setWelcome(false);
      }
      if (q.has("demo")) await demo();
      if (q.has("skip") || q.has("open") || q.has("os")) setEntered(true);
      const want = q.get("open");
      const b = want ? shelfBinders(useStore.getState().binders).find((x) => x.setId === want || x.id === want) : undefined;
      if (b) {
        if (b.setId) await loadSet(b.setId);
        setOpen({ binderId: b.id });
      }
      if (q.has("os")) setComputer({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }, 50);
    return () => clearTimeout(t);
  }, []);

  /** Opens the binder holding the card: its set binder if on the shelf, else a free binder it was slipped in. */
  const goToCard = async (cardId: string) => {
    const { collection } = useStore.getState();
    const setId = setIdOfCard(cardId);
    const home =
      binders.find((b) => b.setId && b.setId === setId) ??
      binders.find((b) => collection[cardId]?.some((c) => c.at?.binder === b.id));
    if (!home) return;
    if (home.setId) await loadSet(home.setId);
    sfx.shelfOut();
    setComputer(null);
    setTimeout(() => setOpen({ binderId: home.id, focusCardId: cardId }), 350);
  };

  /** A new binder: download its cards, then put it on the shelf. */
  const addBinder = async (choice: BinderChoice) => {
    if (choice.kind === "set") await loadSet(choice.setId);
    return useStore.getState().addBinder(choice);
  };

  /** The tour: opens the first binder (or the first one on the shelf), lets it settle, then the spotlight starts. */
  const startTour = async (binderId?: string) => {
    const b = binders.find((x) => x.id === binderId) ?? binders[0];
    setComputer(null);
    setAbout(false);
    if (b) {
      if (b.setId) await loadSet(b.setId);
      setOpen({ binderId: b.id });
    }
    setTimeout(() => setTour(true), 1300);
  };

  const openBinder = open ? binders.find((b) => b.id === open.binderId) : undefined;
  const busy = !!openBinder || !!computer || adding || about;

  return (
    <>
      <BoilFilter paused={!!openBinder || !!computer} />
      <PaintedRoom
        openId={openBinder?.id ?? null}
        compact={compact}
        paused={busy}
        onOpen={(binder) => setOpen({ binderId: binder.id })}
        onOpenComputer={(r) => setComputer({ x: r.left + r.width / 2, y: r.top + r.height / 2 })}
        onAddBinder={() => setAdding(true)}
        onOpenAbout={() => setAbout(true)}
      />

      {openBinder && (
        <BinderView
          key={openBinder.id}
          binder={openBinder}
          focusCardId={open?.focusCardId}
          onClosed={() => setOpen(null)}
          onRemoved={() => {
            setOpen(null);
            useStore.getState().removeBinder(openBinder.id);
          }}
        />
      )}

      <AnimatePresence>
        {computer && (
          <Computer key="os" origin={computer} onClose={() => setComputer(null)} onGoToCard={goToCard} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {about && (
          <AboutBook
            key="about"
            onClose={() => setAbout(false)}
            onTour={() => void startTour()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adding && (
          <motion.div
            key="add"
            className={styles.modal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setAdding(false);
            }}
          >
            <BinderPicker
              title="Nouveau classeur"
              subtitle={`Il prendra la place libre de l'étagère (${binders.length + 1}/14).`}
              onPick={async (choice) => {
                await addBinder(choice);
                setAdding(false);
              }}
              onClose={() => {
                sfx.click();
                setAdding(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* while a binder, the OS or a menu covers the room, only the sound button stays (their own buttons go there) */}
      <div className={styles.corner}>
        {compact && !busy && (
          <>
            <button
              className={styles.iconBtn}
              data-tour="os-button"
              onClick={() => {
                sfx.boot();
                setComputer({ x: window.innerWidth - 40, y: 30 });
              }}
              aria-label={OS_NAME}
              title={OS_NAME}
            >
              <span className={styles.os}>OS</span>
            </button>
            <button
              className={`${styles.iconBtn} ${ambient ? styles.on : ""}`}
              onClick={() => {
                sfx.click();
                if (ambient) stopAmbient();
                else startAmbient();
                setAmbient(!ambient);
              }}
              aria-label="Musique"
              title="Musique lofi"
            >
              ♪
            </button>
          </>
        )}
        {!busy && (
          <button
            className={`${styles.iconBtn} ${styles.sunMoon}`}
            onClick={() => {
              sfx.dayNight(!daytime);
              toggleDaytime();
            }}
            aria-label={daytime ? "Passer à la nuit" : "Passer au jour"}
            title={daytime ? "Passer à la nuit" : "Passer au jour"}
          >
            <span key={String(daytime)} className={daytime ? styles.sun : styles.moon} />
          </button>
        )}
        {/* on a phone, a binder or the OS needs the whole top bar: the sound button waits in the room */}
        {(!compact || !busy) && (
          <button
            className={`${styles.iconBtn} ${sound ? styles.on : ""}`}
            onClick={() => {
              toggleSound();
              if (!sound) setTimeout(() => sfx.pop(), 60);
            }}
            aria-label={sound ? "Couper le son" : "Activer le son"}
            title={sound ? "Couper le son" : "Activer le son"}
          >
            <span className={`${styles.speaker} ${sound ? "" : styles.muted}`} />
          </button>
        )}
      </div>

      {/* Sign in (or play offline, warned), then a nickname, then a first binder. */}
      {entered &&
        cloud.ready &&
        // While the online save is looked up, nothing pops: a returning player would see the card flash, then close.
        cloud.status !== "loading" &&
        !devBypass &&
        ((!cloud.email && !offline) || !profile || (welcome && !userBinders.length)) && (
          <Welcome
            onPick={async (choice) => {
              // The first binder: once the welcome card is gone, it opens and the tour starts.
              const id = await addBinder(choice);
              setTimeout(() => {
                setOpen({ binderId: id });
                setTimeout(() => setTour(true), 1300);
              }, 450);
            }}
            onDone={() => setWelcome(false)}
          />
        )}
      {tour && <Tour onDone={() => setTour(false)} />}
      {!entered && <Loader onEnter={() => setEntered(true)} />}
      <Grain />
    </>
  );
}
