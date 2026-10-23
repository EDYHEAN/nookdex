"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { loadSets, neededSets, useSets } from "@/lib/catalog";
import { useT } from "@/lib/lang";
import { formatMoney, priceOf } from "@/lib/price";
import { doublesOf, pushShare, removeShare, shareUrl, useShareSync, wantedOf } from "@/lib/share";
import { sfx } from "@/lib/sound";
import { type ShareSettings, useStore } from "@/lib/store";
import { unlock } from "@/lib/trophyStore";
import { GivePicker } from "./GivePicker";
import { WantPicker } from "./WantPicker";
import styles from "./ShareListPanel.module.css";

/**
 * The trade binder's inside (« Mon classeur d'échange », 2026-10-23): the player's public list, nookdex.com/c/<slug>.
 * On top the link, always in reach (« Partager », or « Créer mon lien » before it exists); two big tabs, one side at a
 * time: « je cherche » (the cards missing from the set binders picked, the wishlists) and « j'échange » (the doubles
 * ticked); at the bottom a bar that sums it up. Once made the list follows the collection by itself (lib/share).
 * A column that fills whatever holds it: the binder on the shelf (share/TradeBinder), NookDex OS → Échange.
 */

type Draft = Omit<ShareSettings, "slug">;
const DEFAULTS: Draft = { want: true, give: true, sets: null, prices: true };
export type ListTab = "want" | "give";

export function ShareListPanel({ focusSet, startTab }: { focusSet?: string; startTab?: ListTab }) {
  const tr = useT();
  const share = useStore((s) => s.share);
  const binders = useStore((s) => s.binders);
  const collection = useStore((s) => s.collection);
  const tradable = useStore((s) => s.tradable);
  const rules = useStore((s) => s.tradeRules);
  const sets = useSets((s) => s.sets);
  const cards = useSets((s) => s.cards);
  const sync = useShareSync();
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [note, setNote] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [sure, setSure] = useState(false);
  const settings: Draft = share ?? draft;
  const slug = share?.slug ?? null;

  // the binders' and wishlists' cards may not be loaded yet (a wishlist of sets no binder holds)
  useEffect(() => {
    void loadSets(neededSets(binders, collection).filter((id) => !useSets.getState().sets[id]));
  }, [binders, collection]);

  const update = (patch: Partial<Draft>) => {
    if (share) useStore.getState().setShare(patch);
    else setDraft((d) => ({ ...d, ...patch }));
  };

  const wanted = useMemo(() => wantedOf(binders, collection, sets, settings.sets), [binders, collection, sets, settings.sets]);
  const doubles = useMemo(() => doublesOf(collection, tradable, rules), [collection, tradable, rules]);
  const giving = useMemo(() => {
    const on = doubles.filter((d) => d.ticked > 0);
    // what the copies offered are worth today, in the player's money (cards not for sale add nothing)
    const value = on.reduce((n, d) => n + d.ticked * ((cards[d.key] && priceOf(cards[d.key], d.variant, "trend")) || 0), 0);
    return { count: on.length, value };
  }, [doubles, cards]);
  const [tab, setTab] = useState<ListTab>(startTab ?? (focusSet || !doubles.length ? "want" : "give"));
  const setCount = binders.filter((b) => b.kind === "set").length;
  const shownSets = settings.sets ? settings.sets.length : setCount;
  const wishCount = binders.filter((b) => b.kind === "free" && b.wish).length;

  const say = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote((n) => (n === msg ? null : n)), 2200);
  };

  const make = async () => {
    if (making) return;
    setMaking(true);
    sfx.stamp();
    await loadSets(neededSets(binders, collection));
    if (!useStore.getState().share) useStore.getState().setShare({ ...draft, slug: null });
    const made = await pushShare(true);
    setMaking(false);
    if (made) {
      sfx.coin();
      say(tr("ton lien est prêt ! partage-le ↗", "your link is ready! share it ↗"));
    } else {
      sfx.locked();
      say(tr("le lien n'a pas pu être fait, réessaie", "couldn't make the link, try again"));
    }
  };

  const url = slug ? shareUrl(slug) : "";
  const text = tr("Ma liste Pokémon : ce que je cherche, ce que j'échange", "My Pokémon list: what I'm after, what I trade");
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      sfx.pop();
      unlock("share");
      say(tr("lien copié ! colle-le dans ton groupe", "link copied! paste it in your group"));
    } catch {
      sfx.locked();
      say(tr("copie impossible", "couldn't copy"));
    }
  };
  /** the phone's share sheet, else the link copied */
  const share_ = async () => {
    if (!canShare) return copy();
    sfx.pop();
    try {
      await navigator.share({ text, url });
      sfx.coin();
      unlock("share");
    } catch (e) {
      if ((e as Error).name !== "AbortError") void copy();
    }
  };
  const mainButton = slug ? (
    <button className={styles.main} onClick={share_} onPointerEnter={sfx.hover}>
      {tr("Partager ↗", "Share ↗")}
    </button>
  ) : (
    <motion.button
      className={styles.main}
      onClick={make}
      disabled={making || (!settings.want && !settings.give)}
      onPointerEnter={sfx.hover}
      animate={making ? { rotate: [0, -2, 2, 0] } : {}}
      transition={{ repeat: making ? Infinity : 0, duration: 0.5 }}
    >
      {making ? tr("On fabrique…", "Making…") : tr("Créer mon lien ▶", "Make my link ▶")}
    </motion.button>
  );

  const fresh =
    making || sync.state === "saving" ? tr("envoi…", "sending…") : sync.state === "error" ? tr("on réessaie…", "retrying…") : tr("à jour ✓", "up to date ✓");

  return (
    <div className={styles.panel}>
      <div className={styles.linkBar}>
        {slug ? (
          <button className={styles.linkText} onClick={copy} title={tr("Copier le lien", "Copy the link")}>
            <span aria-hidden>🔗</span>
            <b>{url.replace(/^https?:\/\//, "")}</b>
            <small>· {fresh}</small>
          </button>
        ) : (
          <span className={styles.linkText}>
            <span aria-hidden>🔗</span>
            <small>{tr("Ton lien : un clic, et il suit ta collection tout seul.", "Your link: one click, and it follows your collection.")}</small>
          </span>
        )}
        {mainButton}
      </div>
      <p className={styles.note} aria-live="polite">
        {note ?? " "}
      </p>

      <nav className={styles.tabs} role="tablist">
        {(
          [
            ["want", wanted.keys.length, tr("je cherche", "wanted"), "🔎", settings.want],
            ["give", giving.count, tr("j'échange", "for trade"), "🔁", settings.give],
          ] as const
        ).map(([id, n, label, icon, on]) => (
          <motion.button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabOn : ""} ${on ? "" : styles.tabOff}`}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              sfx.riffle();
              setTab(id);
            }}
          >
            <b>{n.toLocaleString(tr("fr-FR", "en-US"))}</b>
            <span>
              <i aria-hidden>{icon}</i> {label}
            </span>
          </motion.button>
        ))}
      </nav>

      <div className={styles.scroll}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, x: tab === "give" ? 24 : -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <div className={styles.sideOpts}>
              <button
                className={`${styles.switch} ${(tab === "want" ? settings.want : settings.give) ? styles.switchOn : ""}`}
                onClick={() => {
                  sfx.click();
                  update(tab === "want" ? { want: !settings.want } : { give: !settings.give });
                }}
                aria-pressed={tab === "want" ? settings.want : settings.give}
              >
                <i aria-hidden />
                {tab === "want" ? tr("« je cherche » sur ma page", "« wanted » on my page") : tr("« j'échange » sur ma page", "« for trade » on my page")}
              </button>
              <button
                className={`${styles.switch} ${settings.prices ? styles.switchOn : ""}`}
                onClick={() => {
                  sfx.click();
                  update({ prices: !settings.prices });
                }}
                aria-pressed={settings.prices}
              >
                <i aria-hidden />
                {tr("prix du jour", "today's prices")}
              </button>
            </div>
            {tab === "want" ? <WantPicker only={settings.sets} onChange={(next) => update({ sets: next })} focusSet={focusSet} /> : <GivePicker />}

            <p className={styles.muted}>
              {tr(
                "Sur ta page : ton pseudo et tes cartes. Jamais la valeur de ta collection, ni ton nom, ni ta ville.",
                "On your page: your nickname and your cards. Never your collection's value, your name or your town.",
              )}
            </p>
            {slug && (
              <div className={styles.linkMore}>
                <a href={url} target="_blank" rel="noreferrer" onClick={() => sfx.pop()}>
                  {tr("Voir ma page ↗", "See my page ↗")}
                </a>
                <button
                  className={styles.remove}
                  onClick={async () => {
                    if (!sure) {
                      sfx.click();
                      setSure(true);
                      setTimeout(() => setSure(false), 3000);
                      return;
                    }
                    sfx.drop();
                    await removeShare();
                    setSure(false);
                    say(tr("lien supprimé : la page n'existe plus", "link deleted: the page is gone"));
                  }}
                >
                  {sure ? tr("Sûr ? Touche encore pour supprimer", "Sure? Tap again to delete") : tr("Supprimer mon lien", "Delete my link")}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.bottomBar}>
        <span>
          {tab === "give" ? (
            <>
              <b>
                {giving.count.toLocaleString(tr("fr-FR", "en-US"))} {tr("à échanger", "for trade")}
              </b>
              {settings.prices && giving.value > 0 && <small>≈ {formatMoney(giving.value)} · {tr("prix du jour", "today's prices")}</small>}
            </>
          ) : (
            <>
              <b>
                {wanted.keys.length.toLocaleString(tr("fr-FR", "en-US"))} {tr("cherchées", "wanted")}
              </b>
              <small>
                {tr(`${shownSets} classeurs sur ${setCount}`, `${shownSets} binders of ${setCount}`)}
                {wishCount > 0 && ` · ${wishCount} wishlist${wishCount > 1 ? "s" : ""}`}
              </small>
            </>
          )}
        </span>
        {slug && tab === "want" ? (
          <a className={styles.main} href={url} target="_blank" rel="noreferrer" onClick={() => sfx.pop()}>
            {tr("Voir ma page", "See my page")}
          </a>
        ) : (
          mainButton
        )}
      </div>
    </div>
  );
}
