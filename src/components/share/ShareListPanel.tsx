"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { loadSets, neededSets, useSets } from "@/lib/catalog";
import { useT } from "@/lib/lang";
import { doublesOf, pushShare, removeShare, shareUrl, useShareSync, wantedOf } from "@/lib/share";
import { sfx } from "@/lib/sound";
import { type ShareSettings, useStore } from "@/lib/store";
import { unlock } from "@/lib/trophyStore";
import { GivePicker } from "./GivePicker";
import { WantPicker } from "./WantPicker";
import styles from "./ShareListPanel.module.css";

/**
 * « Ma liste »'s inside: the player's public list made in three taps (here, « Créer mon lien », « Partager »). What it
 * shows: the cards missing from the set binders picked (all by default) and the wishlists, the doubles ticked (nothing goes
 * out until ticked), the prices or not. Once made it follows the collection by itself (lib/share). A column that fills its
 * container: mounted in a sheet over NookDex OS or a binder (computer/ShareList), or anywhere else.
 */

type Draft = Omit<ShareSettings, "slug">;
const DEFAULTS: Draft = { want: true, give: true, sets: null, prices: true };

export function ShareListPanel({ focusSet }: { focusSet?: string }) {
  const tr = useT();
  const share = useStore((s) => s.share);
  const binders = useStore((s) => s.binders);
  const collection = useStore((s) => s.collection);
  const tradable = useStore((s) => s.tradable);
  const profile = useStore((s) => s.profile);
  const sets = useSets((s) => s.sets);
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
  // doubles ticked (a card's version once, whatever its copies): the pickers' unit, and the page's
  const ticked = useMemo(() => doublesOf(collection, tradable).filter((d) => d.ticked > 0).length, [collection, tradable]);

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
      say(tr("ton lien est prêt !", "your link is ready!"));
    } else {
      sfx.locked();
      say(tr("le lien n'a pas pu être fait, réessaie", "couldn't make the link, try again"));
    }
  };

  const url = slug ? shareUrl(slug) : "";
  const text = tr("Ma liste Pokémon : ce que je cherche, ce que j'échange", "My Pokémon list: what I'm after, what I trade");
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const doShare = async () => {
    sfx.pop();
    try {
      await navigator.share({ text, url });
      sfx.coin();
      unlock("share");
    } catch (e) {
      if ((e as Error).name !== "AbortError") say(tr("partage impossible", "couldn't share"));
    }
  };
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

  const status =
    making || sync.state === "saving"
      ? tr("⏳ envoi de ta liste…", "⏳ sending your list…")
      : sync.state === "error" && slug
        ? tr("⚠ pas pu mettre à jour, on réessaie", "⚠ couldn't update, trying again")
        : slug
          ? tr("✓ à jour : ta liste suit ta collection toute seule", "✓ up to date: your list follows your collection")
          : null;

  return (
    <div className={styles.panel}>
      <p className={styles.lead}>
        {tr(
          "Un lien à coller dans tes groupes Facebook ou ton Discord : ce que tu cherches, ce que tu échanges, toujours à jour.",
          "A link for your Facebook groups or Discord: what you're after, what you trade, always up to date.",
        )}
      </p>

      <div className={styles.scroll}>
        <div className={styles.sides}>
          <button
            className={`${styles.side} ${settings.want ? styles.on : ""}`}
            onClick={() => (sfx.click(), update({ want: !settings.want }))}
            aria-pressed={settings.want}
          >
            <i aria-hidden>{settings.want ? "✓" : ""}</i>
            <b>{settings.want ? wanted.keys.length : 0}</b>
            <span>{tr("🔎 je cherche", "🔎 wanted")}</span>
          </button>
          <button
            className={`${styles.side} ${settings.give ? styles.on : ""}`}
            onClick={() => (sfx.click(), update({ give: !settings.give }))}
            aria-pressed={settings.give}
          >
            <i aria-hidden>{settings.give ? "✓" : ""}</i>
            <b>{settings.give ? ticked : 0}</b>
            <span>{tr("🔁 j'échange", "🔁 for trade")}</span>
          </button>
        </div>

        {settings.want && (
          <section>
            <h3>{tr("Je cherche : les cartes qui manquent à", "Wanted: the cards missing from")}</h3>
            <WantPicker only={settings.sets} onChange={(sets) => update({ sets })} focusSet={focusSet} />
            <p className={styles.muted}>{tr("+ les cartes de tes ★ wishlists.", "+ the cards of your ★ wishlists.")}</p>
          </section>
        )}

        {settings.give && (
          <section>
            <h3>{tr("J'échange : coche tes doubles", "For trade: tick your doubles")}</h3>
            <GivePicker />
          </section>
        )}

        <button
          className={`${styles.switch} ${settings.prices ? styles.switchOn : ""}`}
          onClick={() => (sfx.click(), update({ prices: !settings.prices }))}
          aria-pressed={settings.prices}
        >
          <i aria-hidden />
          {tr("Montrer les prix du jour", "Show today's prices")}
        </button>
        <p className={styles.muted}>
          {tr(
            `Sur la page : ton pseudo${profile?.name ? ` (${profile.name})` : ""} et tes cartes. Jamais la valeur de ta collection, ni ton nom, ni ta ville.`,
            `On the page: your nickname${profile?.name ? ` (${profile.name})` : ""} and your cards. Never your collection's value, your name or your town.`,
          )}
        </p>
      </div>

      <div className={styles.actions}>
        {slug ? (
          <>
            <input className={styles.url} value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label={tr("Ton lien", "Your link")} />
            {canShare && (
              <button className={styles.main} onClick={doShare} onPointerEnter={sfx.hover}>
                {tr("Partager ↗", "Share ↗")}
              </button>
            )}
            <button className={canShare ? styles.second : styles.main} onClick={copy} onPointerEnter={sfx.hover}>
              {tr("Copier le lien", "Copy the link")}
            </button>
            <a className={styles.second} href={url} target="_blank" rel="noreferrer" onClick={() => sfx.pop()} onPointerEnter={sfx.hover}>
              {tr("Voir ma page", "See my page")}
            </a>
          </>
        ) : (
          <motion.button
            className={styles.main}
            onClick={make}
            disabled={making || (!settings.want && !settings.give)}
            onPointerEnter={sfx.hover}
            animate={making ? { rotate: [0, -2, 2, 0] } : {}}
            transition={{ repeat: making ? Infinity : 0, duration: 0.5 }}
          >
            {making ? tr("On fabrique ton lien…", "Making your link…") : tr("Créer mon lien ▶", "Make my link ▶")}
          </motion.button>
        )}
      </div>
      <p className={styles.note} aria-live="polite">
        {note ?? status ?? " "}
      </p>
      {slug && (
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={sure ? "sure" : "ask"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              {sure ? tr("Sûr ? Touche encore pour supprimer", "Sure? Tap again to delete") : tr("Supprimer mon lien", "Delete my link")}
            </motion.span>
          </AnimatePresence>
        </button>
      )}
    </div>
  );
}
