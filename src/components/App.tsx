"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "@/data/changelog";
import { MAX_BINDERS, shelfBinders } from "@/lib/binders";
import { bareId, keyOf } from "@/lib/cardLang";
import { loadSet, loadSets, neededSets, setIdOfCard, useSets } from "@/lib/catalog";
import { returningFromSignIn, startCloud, useCloud } from "@/lib/cloud";
import { setMuted, sfx, startAmbient, stopAmbient } from "@/lib/sound";
import { OS_NAME } from "@/lib/site";
import { useStore } from "@/lib/store";
import { useTrophyWatch } from "@/lib/useTrophyWatch";
import { funnelStep, funnelVisit, watchAmazonClicks } from "@/lib/funnel";
import { closeTrade, useTradeMat } from "@/lib/trade";
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
import { SavePrompt } from "./room/SavePrompt";
import { SupportCat } from "./room/SupportCat";
import { TipCorner } from "./room/TipCorner";
import { TrophyCase } from "./room/TrophyCase";
import { ITEM, backFromShop, itemsOf, paidFor, preloadShop, refreshOwned, setShopView, useShopNews, useShopOpen, useSkins } from "@/lib/shop";
import { Shop, ThankYou, TryOnBar } from "./room/Shop";
import { Box } from "./room/Box";
import { TrophyToasts } from "./room/TrophyToast";
import { BinderPicker, type BinderChoice } from "./shelf/BinderPicker";
import { Tour } from "./shelf/Tour";
import { Welcome } from "./shelf/Welcome";
import styles from "./App.module.css";
import { LANG_COOKIE, currentLang, useLang, useT } from "@/lib/lang";

/** The NookBoy game: its code, sprites and sounds load only when the Game Boy is picked up. */
const NookBoy = dynamic(() => import("./game/NookBoy"), { ssr: false });
/** The trade mat (NookDex OS → « Échange », a card sheet's « Échanger »): loaded when it's brought out. */
const TradeMat = dynamic(() => import("./trade/TradeMat"), { ssr: false });

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
  /** the trophy case, out of the Poké Ball (where it is on screen) */
  const [trophies, setTrophies] = useState<{ x: number; y: number } | null>(null);
  /** the box on the shelf, open (from where it is on screen) */
  const [box, setBox] = useState<{ x: number; y: number } | null>(null);
  /** the shop (lib/shop): hidden for players until it opens */
  const shopOpen = useShopOpen();
  const [shop, setShop] = useState(false);
  /** the Game Boy, zoomed in (where it is on screen) */
  const [game, setGame] = useState<{ x: number; y: number } | null>(null);
  /**
   * A returning player gets the road log once per version (per device), when the room is calm. A newcomer (no
   * profile yet) starts on the current version: the welcome and the tour show them everything already.
   */
  const [news, setNews] = useState(() => {
    if (useStore.getState().profile) return seenVersion() !== APP_VERSION;
    markSeen(APP_VERSION);
    return false;
  });
  // Back from Google, the e-mail link or Stripe's payment page: the player already went in, no loader again.
  const [entered, setEntered] = useState(returningFromSignIn || backFromShop);
  /** the loader started melting away: the room shows through */
  const [revealed, setRevealed] = useState(false);
  // Landed on a page over the room (a notebook page, a card's page, from a search engine): the loader doesn't wait for
  // its « Appuie pour entrer » behind it (Johan, 2026-10-18: the notebook over a waiting loader looked broken).
  const pathname = usePathname();
  const overPage = pathname !== "/" && pathname !== "/en";
  const profile = useStore((s) => s.profile);
  const cloud = useCloud();
  const trade = useTradeMat();
  // the funnel (lib/funnel): a visit a day, and each step the first time it's reached
  const binderCount = useStore((s) => s.binders.length);
  const copyCount = useStore((s) => Object.values(s.collection).reduce((n, c) => n + c.length, 0));
  useEffect(funnelVisit, []);
  useEffect(watchAmazonClicks, []);
  useEffect(() => void (profile && funnelStep("profile")), [profile]);
  useEffect(() => void (binderCount && funnelStep("binder")), [binderCount]);
  useEffect(() => void (copyCount >= 10 && funnelStep("cards10")), [copyCount]);
  useEffect(() => void (cloud.email && funnelStep("account")), [cloud.email]);
  useEffect(() => void (game && funnelStep("game")), [game]);
  // the skins this account bought, read again on each sign-in
  useEffect(() => {
    if (shopOpen && cloud.email) void refreshOwned();
  }, [shopOpen, cloud.email]);
  useEffect(() => {
    if (shopOpen) preloadShop();
  }, [shopOpen]);
  const [shopNews, shopSeen] = useShopNews();
  /** back from Stripe's payment page: the thank-you, while the purchase arrives and once it's in */
  const [thanks, setThanks] = useState<{ id: string; state: "waiting" | "done" | "late" } | null>(() => (paidFor ? { id: paidFor, state: "waiting" } : null));
  // back from Stripe's payment page (app/api/shop/checkout): the purchase comes with the webhook, a moment later.
  // Once it's in, a thank-you and the way to the locker to wear it.
  useEffect(() => {
    if (!backFromShop) return;
    window.history.replaceState(null, "", window.location.pathname);
    const bought = paidFor;
    if (!bought) return;
    let tries = 0;
    const check = async () => {
      await refreshOwned();
      const owned = itemsOf(bought).every((id) => useSkins.getState().owned.includes(id));
      if (!owned && ++tries < 20) return;
      clearInterval(timer);
      setThanks({ id: bought, state: owned ? "done" : "late" });
      if (owned) sfx.trophy("gold");
    };
    const timer = window.setInterval(check, 2000);
    void check();
    return () => clearInterval(timer);
  }, []);
  /** the account was offered this visit: the cat waits for another one */
  const [saveAsked, setSaveAsked] = useState(false);
  const onSaveAsked = useCallback(() => setSaveAsked(true), []);
  // Dev screenshots (?skip ?open ?os ?demo ?game) skip the sign-in.
  const [devBypass] = useState(
    () => process.env.NODE_ENV !== "production" && /[?&](skip|open|os|demo|game)\b/.test(window.location.search),
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

  // No loader after signing in or paying: the cards of the binders load in the background instead.
  useEffect(() => {
    if (!returningFromSignIn && !backFromShop) return;
    const { binders, collection } = useStore.getState();
    void loadSets(neededSets(binders, collection));
  }, []);

  // Dev-only shortcuts for screenshots: ?skip  ?open=swsh12  ?demo  ?os  ?game  ?skin=halloween (an item or a bundle worn; ?skin alone takes them off)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const q = new URLSearchParams(window.location.search);
    if (q.has("skin")) useSkins.setState({ equipped: itemsOf(q.get("skin") ?? "") });
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
      if ((q.has("demo") || q.has("skip") || q.has("open") || q.has("os") || q.has("game")) && !useStore.getState().profile) {
        useStore.getState().createProfile("Dev");
        setWelcome(false);
      }
      if (q.has("demo")) await demo();
      if (q.has("skip") || q.has("open") || q.has("os") || q.has("game")) setEntered(true);
      const want = q.get("open");
      const b = want ? shelfBinders(useStore.getState().binders).find((x) => x.setId === want || (x.setId && bareId(x.setId) === want) || x.id === want) : undefined;
      if (b) {
        if (b.setId) await loadSet(b.setId);
        setOpen({ binderId: b.id });
      }
      if (q.has("os")) setComputer({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      if (q.has("game")) setGame({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
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
  const busy = !!openBinder || !!computer || adding || about || roadLog || !!trophies || !!box || shop || (shopOpen && !!thanks) || !!game;
  // the room pauses just after a panel opens: the panel is drawn first, the room's redraw doesn't hold it back
  const roomPaused = useDeferredValue(busy);
  // A nickname, then a first binder; the account is offered later (SavePrompt).
  const showWelcome =
    entered &&
    cloud.ready &&
    // While the online save is looked up, nothing pops: a returning player would see the card flash, then close.
    cloud.status !== "loading" &&
    !devBypass &&
    (!profile || (welcome && !userBinders.length));

  // a page over the room (notebook, card page) isn't calm either: the road log waits for it to close
  const calm = entered && !busy && !tour && !showWelcome && !overPage;
  useTrophyWatch(entered);
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
        paused={roomPaused}
        onOpen={(binder) => setOpen({ binderId: binder.id })}
        onOpenComputer={(r) => setComputer({ x: r.left + r.width / 2, y: r.top + r.height / 2 })}
        onAddBinder={() => setAdding(true)}
        onOpenAbout={() => {
          // the tour's last step points at the notebook: opening it ends the tour (else its note sat over the book)
          setTour(false);
          setAbout(true);
        }}
        onOpenTrophies={setTrophies}
        onOpenBox={setBox}
        onOpenGame={setGame}
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
          onRemoved={(keep) => {
            setOpen(null);
            useStore.getState().removeBinder(openBinder.id, keep);
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
            onOpenBox={() => {
              setSheet(null);
              setComputer(null);
              setTimeout(() => setBox({ x: window.innerWidth / 2, y: window.innerHeight / 2 }), 300);
            }}
            onOpenBinder={(binderId, cardId) => {
              sfx.shelfOut();
              setSheet(null);
              setComputer(null);
              setTimeout(() => setOpen({ binderId, focusCardId: cardId }), 350);
            }}
          />
        )}
      </AnimatePresence>

      {(computer || box) && sheet && sheetCard && (
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

      <AnimatePresence>{trophies && <TrophyCase key="trophies" origin={trophies} onClose={() => setTrophies(null)} />}</AnimatePresence>

      <AnimatePresence>{shop && <Shop key="shop" onClose={() => setShop(false)} />}</AnimatePresence>
      <AnimatePresence>
        {shopOpen && thanks && (
          <ThankYou
            key="thanks"
            id={thanks.id}
            state={thanks.state}
            onClose={() => setThanks(null)}
            onLocker={() => {
              // the locker, on the slot of the first thing bought
              setShopView({ tab: "locker", open: null, slot: ITEM.get(itemsOf(thanks.id)[0])?.slot ?? null });
              setThanks(null);
              setShop(true);
            }}
          />
        )}
      </AnimatePresence>
      {shopOpen && !busy && <TryOnBar onOpenShop={() => setShop(true)} />}

      <AnimatePresence>
        {box && (
          <Box
            key="box"
            origin={box}
            paused={!!sheet}
            onClose={() => {
              setSheet(null);
              setBox(null);
            }}
            onOpenCards={(keys, index) => void openCards(keys, index)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{game && <NookBoy key="nookboy" origin={game} onClose={() => setGame(null)} />}</AnimatePresence>
      <AnimatePresence>{trade.open && <TradeMat key="trade" seed={trade.seed} onClose={closeTrade} />}</AnimatePresence>

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
              subtitle={tr(`Il prendra la place libre de l'étagère (${binders.length + 1}/${MAX_BINDERS}).`, `It takes the free spot on the shelf (${binders.length + 1}/${MAX_BINDERS}).`)}
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
        {shopOpen && !busy && (
          <button
            className={`${styles.iconBtn} ${styles.shopBtn}`}
            onClick={() => {
              sfx.pop();
              shopSeen();
              setShop(true);
            }}
            aria-label={shopNews ? tr("La boutique : nouveau", "The shop: new") : tr("La boutique", "The shop")}
            title={tr("La boutique", "The shop")}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path d="M5 8h14l-1.2 12H6.2z" fill="currentColor" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            {shopNews && (
              <span className={`${styles.shopNew} ${compact ? styles.shopNewDot : ""}`} aria-hidden>
                {tr("Nouveau", "New")}
              </span>
            )}
          </button>
        )}
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
      {/* a trophy won pops in the corner (it waits for the room: the loader, the welcome) */}
      <TrophyToasts
        ready={entered && !showWelcome}
        onOpen={() => {
          sfx.ballOpen();
          setTrophies({ x: 60, y: window.innerHeight - 80 });
        }}
      />
      {/* a tip for the project, asked by the cat once the player has a few cards (never over a binder, the OS or the tour) */}
      {/* the account, offered once the player without one has a few cards */}
      {entered && <SavePrompt compact={compact} calm={calm && !news} onShown={onSaveAsked} />}
      {entered && <SupportCat compact={compact} calm={calm && !news && !saveAsked} />}
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
      {!entered && <Loader auto={overPage} onLeave={() => setRevealed(true)} onEnter={() => setEntered(true)} />}
      {/* on a phone, the full-screen grain layers are memory a binder or the OS needs (their paper has its own grain) */}
      <Grain off={compact && busy} />
    </>
  );
}
