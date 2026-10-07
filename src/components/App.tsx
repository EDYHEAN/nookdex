"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "@/data/changelog";
import { shelfBinders } from "@/lib/binders";
import { bareId, keyOf } from "@/lib/cardLang";
import { loadSet, loadSets, neededSets, setIdOfCard, useSets } from "@/lib/catalog";
import { returningFromSignIn, startCloud, useCloud } from "@/lib/cloud";
import { setMuted, sfx, startAmbient, stopAmbient } from "@/lib/sound";
import { OS_NAME } from "@/lib/site";
import { useStore } from "@/lib/store";
import { isCompact, useViewport } from "@/lib/useViewport";
import { BinderView } from "./binder/BinderView";
import { Inspector } from "./binder/Inspector";
import { Computer, type Tab } from "./computer/Computer";
import { Loader } from "./Loader";
import { BoilFilter } from "./fx/Boil";
import { Grain } from "./fx/Grain";
import { AboutBook } from "./room/AboutBook";
import { PaintedRoom } from "./room/PaintedRoom";
import { RoadLog, markSeen, seenVersion } from "./room/RoadLog";
import { SupportCat } from "./room/SupportCat";
import { TipCorner } from "./room/TipCorner";
import { BinderPicker, type BinderChoice } from "./shelf/BinderPicker";
import { Tour } from "./shelf/Tour";
import { Welcome } from "./shelf/Welcome";
import styles from "./App.module.css";
import { LANG_COOKIE, currentLang, useLang, useT } from "@/lib/lang";

interface Open {
  binderId: string;
  focusCardId?: string;
}

export function App() {
  const vp = useViewport();
  const compact = isCompact(vp);
  const tr = useT();
  const [open, setOpen] = useState<Open | null>(null);
  /** the open binder covers the room: on a phone, the room behind it is let go */
  const [covered, setCovered] = useState(false);
  const [computer, setComputer] = useState<{ x: number; y: number; tab?: Tab } | null>(null);
  /** A card sheet over NookDex OS, for a card found there: the list it was found in, walked with the arrows */
  const [sheet, setSheet] = useState<{ keys: string[]; index: number } | null>(null);
  const sheetCard = useSets((s) => (sheet ? s.cards[sheet.keys[sheet.index]] : undefined));
  /** The guided tour, after the first binder is picked (and replayable from the notebook). */
  const [tour, setTour] = useState(false);
  const [adding, setAdding] = useState(false);
  const [about, setAbout] = useState(false);
  const [roadLog, setRoadLog] = useState(false);
  /**
   * A returning player gets the road log once per version (per device), when the room is calm. A newcomer (no
   * profile yet) starts on the current version: the welcome and the tour show them everything already.
   */
  const [news, setNews] = useState(() => {
    if (useStore.getState().profile) return seenVersion() !== APP_VERSION;
    markSeen(APP_VERSION);
    return false;
  });
  // Back from Google or the e-mail link: the player already went in, no loader again.
  const [entered, setEntered] = useState(returningFromSignIn);
  /** the loader started melting away: the room shows through */
  const [revealed, setRevealed] = useState(false);
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
  const setAmbient = useStore((s) => s.setAmbient);

  useEffect(() => setMuted(!sound), [sound]);

  // The server pages (notebook pages, page text) follow the language the app speaks.
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  }, [lang]);

  // The home page's tagline (app/(desk)/page) is written on the loader's paper: it leaves with it.
  useEffect(() => {
    if (entered || revealed) document.documentElement.dataset.room = "in";
  }, [entered, revealed]);

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
      // the demo binder in the site's language
      const demoSet = keyOf(currentLang(), "swsh12");
      if (!useStore.getState().binders.length) useStore.getState().addBinder({ kind: "set", setId: demoSet });
      if (Object.keys(useStore.getState().collection).length) return;
      const set = await loadSet(demoSet);
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
      const b = want ? shelfBinders(useStore.getState().binders).find((x) => x.setId === want || (x.setId && bareId(x.setId) === want) || x.id === want) : undefined;
      if (b) {
        if (b.setId) await loadSet(b.setId);
        setOpen({ binderId: b.id });
      }
      if (q.has("os")) setComputer({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }, 50);
    return () => clearTimeout(t);
  }, []);

  /** The binder holding a card: its set binder if on the shelf, else a free binder it was slipped in. */
  const homeOf = (cardId: string) => {
    const { collection } = useStore.getState();
    const setId = setIdOfCard(cardId);
    return binders.find((b) => b.setId && b.setId === setId) ?? binders.find((b) => collection[cardId]?.some((c) => c.at?.binder === b.id));
  };

  /** The sheet of a card from a list of NookDex OS, its set downloaded first. */
  const openCards = async (keys: string[], index: number) => {
    const setId = setIdOfCard(keys[index]);
    if (!setId) return;
    try {
      await loadSet(setId);
    } catch {
      sfx.locked();
      return;
    }
    setSheet({ keys, index });
  };

  /** Opens the binder holding the card; a card no binder holds gets its sheet over the OS. */
  const goToCard = async (cardId: string) => {
    const home = homeOf(cardId);
    if (!home) return openCards([cardId], 0);
    if (home.setId) await loadSet(home.setId);
    sfx.shelfOut();
    setSheet(null);
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
  const busy = !!openBinder || !!computer || adding || about || roadLog;
  // Sign in (or play offline, warned), then a nickname, then a first binder.
  const showWelcome =
    entered &&
    cloud.ready &&
    // While the online save is looked up, nothing pops: a returning player would see the card flash, then close.
    cloud.status !== "loading" &&
    !devBypass &&
    ((!cloud.email && !offline) || !profile || (welcome && !userBinders.length));

  const calm = entered && !busy && !tour && !showWelcome;
  useEffect(() => {
    if (!news || !calm) return;
    const id = setTimeout(() => {
      markSeen(APP_VERSION);
      setNews(false);
      setRoadLog(true);
      sfx.pop();
    }, 1200);
    return () => clearTimeout(id);
  }, [news, calm]);

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
        veiled={!entered && !revealed}
        behind={compact && !!openBinder && covered}
      />

      {openBinder && (
        <BinderView
          key={openBinder.id}
          binder={openBinder}
          focusCardId={open?.focusCardId}
          onCover={setCovered}
          onClosed={() => setOpen(null)}
          onRemoved={() => {
            setOpen(null);
            useStore.getState().removeBinder(openBinder.id);
          }}
        />
      )}

      <AnimatePresence>
        {computer && (
          <Computer
            key="os"
            origin={computer}
            startTab={computer.tab}
            paused={!!sheet}
            onClose={() => {
              setSheet(null);
              setComputer(null);
            }}
            onGoToCard={goToCard}
            onOpenCards={(keys, index) => void openCards(keys, index)}
          />
        )}
      </AnimatePresence>

      {computer && sheet && sheetCard && (
        <Inspector
          key={sheetCard.id}
          card={sheetCard}
          binderId={null}
          onClose={() => setSheet(null)}
          onNavigate={(d) => {
            const n = sheet.index + d;
            if (n < 0 || n >= sheet.keys.length) return;
            sfx.riffle();
            void openCards(sheet.keys, n);
          }}
          onOpenBinder={homeOf(sheetCard.id) ? () => void goToCard(sheetCard.id) : undefined}
        />
      )}

      <AnimatePresence>
        {about && (
          <AboutBook
            key="about"
            onClose={() => setAbout(false)}
            onTour={() => void startTour()}
            onRoadLog={() => {
              setAbout(false);
              setRoadLog(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{roadLog && <RoadLog key="roadlog" onClose={() => setRoadLog(false)} />}</AnimatePresence>

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
              title={tr("Nouveau classeur", "New binder")}
              subtitle={tr(`Il prendra la place libre de l'étagère (${binders.length + 1}/14).`, `It takes the free spot on the shelf (${binders.length + 1}/14).`)}
              onPick={async (choice) => {
                // a player who went exploring before their first binder gets the tour with it
                const first = !userBinders.length;
                const id = await addBinder(choice);
                setAdding(false);
                if (first)
                  setTimeout(() => {
                    setOpen({ binderId: id });
                    setTimeout(() => setTour(true), 1300);
                  }, 450);
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
              aria-label={tr("Musique", "Music")}
              title={tr("Musique lofi", "Lofi music")}
            >
              ♪
            </button>
          </>
        )}
        {/* on a phone, a binder or the OS needs the whole top bar: the sound button waits in the room */}
        {(!compact || !busy) && (
          <button
            className={`${styles.iconBtn} ${sound ? styles.on : ""}`}
            onClick={() => {
              toggleSound();
              if (!sound) setTimeout(() => sfx.pop(), 60);
            }}
            aria-label={sound ? tr("Couper le son", "Mute") : tr("Activer le son", "Sound on")}
            title={sound ? tr("Couper le son", "Mute") : tr("Activer le son", "Sound on")}
          >
            <span className={`${styles.speaker} ${sound ? "" : styles.muted}`} />
          </button>
        )}
      </div>

      {showWelcome && (
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
            onExplore={() => {
              sfx.boot();
              setComputer({ x: window.innerWidth / 2, y: window.innerHeight / 2, tab: "cards" });
            }}
          />
        )}
      {tour && <Tour onDone={() => setTour(false)} />}
      {/* a tip for the project, asked by the cat once the player has a few cards (never over a binder, the OS or the tour) */}
      {entered && <SupportCat compact={compact} calm={calm && !news} />}
      {/* a computer: the cat and its tip tag in the corner of the calm room (a phone has the pop-in only) */}
      {entered && !compact && <TipCorner show={calm && !news} />}
      {/* the version, in the room's corner: it opens the road log */}
      {entered && !busy && !tour && (
        <button
          className={styles.version}
          onClick={() => {
            sfx.click();
            setRoadLog(true);
          }}
          onPointerEnter={sfx.hover}
          title={tr("Carnet de route : les nouveautés", "Road log: what's new")}
        >
          v{APP_VERSION}
        </button>
      )}
      {!entered && <Loader onLeave={() => setRevealed(true)} onEnter={() => setEntered(true)} />}
      {/* on a phone, the full-screen grain layers are memory a binder or the OS needs (their paper has its own grain) */}
      <Grain off={compact && busy} />
    </>
  );
}
