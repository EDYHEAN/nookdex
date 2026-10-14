"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { signIn, signInWithGoogle, useCloud } from "@/lib/cloud";
import { useLang, useT } from "@/lib/lang";
import { BASE, BUNDLE, BUNDLES, COLLECTIONS, ITEM, ITEMS, buySkin, formatEuros, shopView, itemsOf, onSale, useSkins, wear, worthOf, type Bundle, type Item, type Rarity, type Slot } from "@/lib/shop";
import { sfx } from "@/lib/sound";
import styles from "./Shop.module.css";

const RARITY: Record<Rarity, { fr: string; en: string }> = {
  uncommon: { fr: "Peu commun", en: "Uncommon" },
  rare: { fr: "Rare", en: "Rare" },
  epic: { fr: "Épique", en: "Epic" },
  legendary: { fr: "Légendaire", en: "Legendary" },
};

type Thing = Item | Bundle;
const isBundle = (x: Thing): x is Bundle => "items" in x;
/** the moment it leaves the shop: the end of its last day */
const endOf = (until: string) => new Date(`${until}T23:59:59`).getTime();

/** The time left before it leaves the shop, ticking every second: a game shop's "leaves in…" */
function Countdown({ until, big }: { until: string; big?: boolean }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor((endOf(until) - now) / 1000));
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const sec = left % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className={`${styles.timer} ${big ? styles.timerBig : ""}`} role="timer" aria-label={t("Quitte la boutique dans", "Leaves the shop in")}>
      <span aria-hidden>⏳</span>
      <b>
        {d > 0 && `${d} ${t("j", "d")} `}
        {pad(h)} h {pad(m)} min {pad(sec)} s
      </b>
    </span>
  );
}

/**
 * The shop (lib/shop, docs/skins.md), an item shop like a game's: the featured bundle, the items one by one on tiles
 * coloured by rarity, a card to try on, buy or wear each, and the locker of what's owned (each item on or off).
 */
export function Shop({ onClose }: { onClose: () => void }) {
  const t = useT();
  // where it was left (lib/shop shopView): after a try-on, the shop opens there again
  const [tab, setTab] = useState(() => shopView.tab);
  const [open, setOpen] = useState(() => shopView.open);
  useEffect(() => {
    shopView.tab = tab;
    shopView.open = open;
  }, [tab, open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (open) setOpen(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const featured = BUNDLES.filter(onSale);
  const items = ITEMS.filter(onSale);
  const until = featured[0]?.until;
  const thing = open ? (BUNDLE.get(open) ?? ITEM.get(open)) : undefined;

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
      <motion.section
        className={styles.shop}
        role="dialog"
        aria-label={t("La boutique", "The shop")}
        initial={{ y: 50, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 40, opacity: 0, transition: { duration: 0.2 } }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <header className={styles.head}>
          <h2>{t("Boutique", "Shop")}</h2>
          <nav className={styles.tabs}>
            {(["shop", "locker"] as const).map((k) => (
              <button
                key={k}
                className={`${styles.tab} ${tab === k ? styles.tabOn : ""}`}
                onPointerEnter={sfx.hover}
                onClick={() => {
                  sfx.click();
                  setTab(k);
                }}
              >
                {k === "shop" ? t("Vitrine", "Featured") : t("Mon casier", "My locker")}
              </button>
            ))}
          </nav>
          {until && tab === "shop" && <Countdown until={until} />}
          <button className={styles.close} onClick={onClose} onPointerEnter={sfx.hover} aria-label={t("Fermer la boutique", "Close the shop")}>
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {tab === "shop" ? (
            <>
              {featured.map((b, i) => (
                <Tile key={b.id} thing={b} index={i} big onOpen={() => setOpen(b.id)} />
              ))}
              <h3 className={styles.section}>{t("À l'unité", "One by one")}</h3>
              <div className={styles.grid}>
                {items.map((it, i) => (
                  <Tile key={it.id} thing={it} index={i + featured.length} onOpen={() => setOpen(it.id)} />
                ))}
              </div>
              <p className={styles.small}>
                {t(
                  "Contenus numériques NookDex, achat unique, gardés avec ton compte. Paiement et reçus par Stripe. Tout ce qui touche à Pokémon reste gratuit.",
                  "NookDex digital items, one-off purchase, kept with your account. Payment and receipts by Stripe. Everything Pokémon stays free.",
                )}
              </p>
            </>
          ) : (
            <Locker onShop={setOpen} />
          )}
        </div>

        <AnimatePresence>{thing && <Card key={thing.id} thing={thing} onBack={() => setOpen(null)} onClose={onClose} />}</AnimatePresence>
      </motion.section>
    </motion.div>
  );
}

/** A tile of the shop: its art on its rarity's colours, its name and price on a strip */
function Tile({ thing, index, big, onOpen }: { thing: Thing; index: number; big?: boolean; onOpen: () => void }) {
  const t = useT();
  const lang = useLang();
  const owned = useSkins((s) => s.owned);
  const mine = itemsOf(thing.id).every((id) => owned.includes(id));
  const worth = isBundle(thing) ? worthOf(thing) : null;
  return (
    <motion.button
      className={`${styles.tile} ${styles[thing.rarity]} ${big ? styles.big : ""} ${mine ? styles.mine : ""}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.08 + index * 0.06, type: "spring", stiffness: 320, damping: 22 }}
      whileHover={{ y: -4, rotate: big ? 0 : -0.8 }}
      whileTap={{ scale: 0.97 }}
      onPointerEnter={sfx.hover}
      onClick={() => {
        sfx.pop();
        onOpen();
      }}
    >
      <span className={styles.rays} aria-hidden />
      <img className={thing.cutout ? styles.cutout : styles.framed} src={thing.icon} alt="" draggable={false} />
      {big && thing.until && <span className={styles.ribbon}>{t("Édition limitée", "Limited edition")}</span>}
      <span className={styles.badges}>
        {!mine && <span className={styles.badgeNew}>{t("NOUVEAU", "NEW")}</span>}
        {worth && !mine && <span className={styles.badgeDeal}>−{Math.round((1 - thing.price / worth) * 100)} %</span>}
      </span>
      <span className={styles.strip}>
        <span className={styles.name}>{t(thing.name.fr, thing.name.en)}</span>
        <span className={styles.rarity}>{t(RARITY[thing.rarity].fr, RARITY[thing.rarity].en)}</span>
        {!mine && (
          <span className={styles.price}>
            {worth && <s>{formatEuros(worth, lang)}</s>}
            <b>{formatEuros(thing.price, lang)}</b>
          </span>
        )}
      </span>
      {mine && <Owned />}
      <span className={styles.shine} aria-hidden />
    </motion.button>
  );
}

/** Owned: the same stamp, at the same place, on every tile and card */
function Owned() {
  const t = useT();
  return <span className={styles.ownedStamp}>✓ {t("Possédé", "Owned")}</span>;
}

/** One item or bundle up close: what's in it, try it on, buy it, or wear it once owned */
function Card({ thing, onBack, onClose }: { thing: Thing; onBack: () => void; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const { owned, equipped } = useSkins();
  const ids = itemsOf(thing.id);
  const mine = ids.every((id) => owned.includes(id));
  const worn = ids.every((id) => equipped.includes(id));
  const worth = isBundle(thing) ? worthOf(thing) : null;
  const email = useCloud((s) => s.email);
  // signed in: straight to Stripe's page; else the sign-in box opens under the button
  const [buying, setBuying] = useState(false);
  const [going, setGoing] = useState<"idle" | "going" | "soon" | "error">("idle");
  const buy = async () => {
    setGoing("going");
    const r = await buySkin(thing.id);
    if (r !== "ok") setGoing(r);
  };
  return (
    <motion.div className={styles.cardWrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && onBack()}>
      <motion.article
        className={`${styles.card} ${styles[thing.rarity]}`}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
      >
        <button className={styles.back} onClick={onBack} onPointerEnter={sfx.hover}>
          ← {t("Retour", "Back")}
        </button>
        <div className={styles.cardArt}>
          <span className={styles.rays} aria-hidden />
          <img className={thing.cutout ? styles.cutout : styles.framed} src={thing.icon} alt="" draggable={false} />
          {mine && <Owned />}
        </div>
        <div className={styles.cardText}>
          <span className={styles.rarity}>{t(RARITY[thing.rarity].fr, RARITY[thing.rarity].en)}</span>
          <h3>{t(thing.name.fr, thing.name.en)}</h3>
          <p>{t(thing.blurb.fr, thing.blurb.en)}</p>
          {isBundle(thing) && (
            <ul>
              {thing.items.map((id) => {
                const it = ITEM.get(id);
                return it ? <li key={id}>{t(it.name.fr, it.name.en)}</li> : null;
              })}
            </ul>
          )}
          {!mine && !onSale(thing) && <p className={styles.note}>{t("Plus en vente pour l'instant.", "Not for sale right now.")}</p>}
          {!mine && onSale(thing) && (
            <p className={styles.cardPrice}>
              {worth && <s>{formatEuros(worth, lang)}</s>} <b>{formatEuros(thing.price, lang)}</b>
            </p>
          )}
          <div className={styles.actions}>
            {!mine && !onSale(thing) ? null : mine ? (
              <button
                className={`${styles.btn} ${worn ? "" : styles.primary}`}
                onPointerEnter={sfx.hover}
                onClick={() => {
                  sfx.stamp();
                  ids.forEach((id) => wear(id, !worn));
                }}
              >
                {worn ? t("Retirer de mon bureau", "Take off my desk") : t("Mettre sur mon bureau", "Put it on my desk")}
              </button>
            ) : (
              <>
                <button
                  className={styles.btn}
                  onPointerEnter={sfx.hover}
                  onClick={() => {
                    sfx.pop();
                    useSkins.setState({ trying: thing.id });
                    onClose();
                  }}
                >
                  {t("Essayer sur mon bureau", "Try it on my desk")}
                </button>
                <button
                  className={`${styles.btn} ${styles.primary}`}
                  disabled={going === "going"}
                  onPointerEnter={sfx.hover}
                  onClick={() => {
                    sfx.click();
                    if (email) void buy();
                    else setBuying(!buying);
                  }}
                >
                  {going === "going"
                    ? t("Vers le paiement…", "To the payment…")
                    : t(`Acheter · ${formatEuros(thing.price, lang)}`, `Buy · ${formatEuros(thing.price, lang)}`)}
                </button>
              </>
            )}
          </div>
          {going === "soon" && <p className={styles.note}>{t("Le paiement ouvre très bientôt.", "Payment opens very soon.")}</p>}
          {going === "error" && <p className={styles.note}>{t("Le paiement n'a pas pu s'ouvrir. Réessaie dans un instant.", "The payment couldn't open. Try again in a moment.")}</p>}
          <AnimatePresence>{buying && !mine && !email && <SignInFirst key="signin" />}</AnimatePresence>
        </div>
      </motion.article>
    </motion.div>
  );
}

const SLOTS: { slot: Slot; fr: string; en: string }[] = [
  { slot: "sky", fr: "Fenêtre", en: "Window" },
  { slot: "decor", fr: "Déco", en: "Decor" },
  { slot: "cat", fr: "Warwick", en: "Warwick" },
  { slot: "lamp", fr: "Lumière", en: "Light" },
  { slot: "radio", fr: "Radio", en: "Radio" },
];

/**
 * The locker, by slot like a game's: the slots on the side, each showing what it wears; a slot's options next to it,
 * the room's own first, then every collection's (owned to wear, the others greyed, a tap shows their card).
 */
function Locker({ onShop }: { onShop: (id: string) => void }) {
  const t = useT();
  const lang = useLang();
  const { owned, equipped } = useSkins();
  const [slot, setSlot] = useState<Slot>("sky");
  const wornIn = (s: Slot) => equipped.map((id) => ITEM.get(id)).find((it) => it?.slot === s && owned.includes(it.id));
  const base = BASE.find((b) => b.slot === slot)!;
  const worn = wornIn(slot);
  // owned first, then the rest, each in the catalogue's order
  const options = ITEMS.filter((it) => it.slot === slot).sort((x, y) => Number(owned.includes(y.id)) - Number(owned.includes(x.id)));
  const setName = (it: Item) => COLLECTIONS.find((c) => c.id === it.set)?.name;

  return (
    <div className={styles.locker}>
      <nav className={styles.slots}>
        {SLOTS.map((s) => {
          const it = wornIn(s.slot);
          const b = BASE.find((x) => x.slot === s.slot)!;
          const pick = it ?? b;
          return (
            <button
              key={s.slot}
              className={`${styles.slot} ${slot === s.slot ? styles.slotOn : ""}`}
              onPointerEnter={sfx.hover}
              onClick={() => {
                sfx.click();
                setSlot(s.slot);
              }}
            >
              <span className={`${styles.slotArt} ${it ? styles[it.rarity] : styles.base}`}>
                <img className={pick.cutout ? styles.cutout : styles.framed} src={pick.icon} alt="" draggable={false} />
              </span>
              <span className={styles.slotText}>
                <small>{t(s.fr, s.en)}</small>
                <b>{t(pick.name.fr, pick.name.en)}</b>
              </span>
            </button>
          );
        })}
      </nav>
      <div className={styles.options}>
        <LockCard
          icon={base.icon}
          cutout={base.cutout}
          name={t(base.name.fr, base.name.en)}
          set={t("De base", "Base")}
          state={worn ? "off" : "on"}
          onClick={() => {
            sfx.stamp();
            useSkins.setState((s) => ({ equipped: s.equipped.filter((id) => ITEM.get(id)?.slot !== slot), trying: null }));
          }}
        />
        {options.map((it) => {
          const mine = owned.includes(it.id);
          const name = setName(it);
          return (
            <LockCard
              key={it.id}
              icon={it.icon}
              cutout={it.cutout}
              rarity={it.rarity}
              name={t(it.name.fr, it.name.en)}
              set={name ? t(name.fr, name.en) : ""}
              state={!mine ? "locked" : worn?.id === it.id ? "on" : "off"}
              price={!mine && onSale(it) ? formatEuros(it.price, lang) : undefined}
              onClick={() => {
                if (!mine) {
                  sfx.pop();
                  return onShop(it.id);
                }
                sfx.stamp();
                wear(it.id, true);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function LockCard(p: { icon: string; cutout?: boolean; rarity?: Rarity; name: string; set: string; state: "on" | "off" | "locked"; price?: string; onClick: () => void }) {
  const t = useT();
  return (
    <button
      className={`${styles.lockCard} ${p.rarity ? styles[p.rarity] : styles.base} ${styles["lock_" + p.state]}`}
      onPointerEnter={sfx.hover}
      onClick={p.onClick}
      aria-pressed={p.state === "on"}
    >
      <span className={styles.lockArt}>
        <img className={p.cutout ? styles.cutout : styles.framed} src={p.icon} alt="" draggable={false} />
        {p.state === "locked" && <span className={styles.lockIcon}>🔒</span>}
      </span>
      <span className={styles.lockText}>
        <small>{p.set}</small>
        <b>{p.name}</b>
        <span className={styles.chip}>
          {p.state === "on" ? t("✓ Actif", "✓ Active") : p.state === "off" ? t("Équiper", "Wear") : (p.price ?? t("Plus en vente", "Off sale"))}
        </span>
      </span>
    </button>
  );
}

/** Buying without an account: sign in first (what's bought is kept with it), then "Buy" goes straight to Stripe */
function SignInFirst() {
  const t = useT();
  const [sent, setSent] = useState(false);
  const [mail, setMail] = useState("");
  return (
    <motion.div className={styles.checkout} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      {sent ? (
        <p>{t("Lien envoyé ! Ouvre-le, puis reviens acheter.", "Link sent! Open it, then come back to buy.")}</p>
      ) : (
        <>
          <p>{t("Tes achats sont gardés avec ton compte : connecte-toi d'abord.", "What you buy is kept with your account: sign in first.")}</p>
          <button className={`${styles.btn} ${styles.primary}`} onClick={() => void signInWithGoogle()}>
            {t("Avec Google", "With Google")}
          </button>
          <form
            className={styles.mailForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (!mail.includes("@")) return;
              void signIn(mail).then(() => setSent(true));
            }}
          >
            <input type="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder={t("ton e-mail", "your e-mail")} aria-label={t("Ton e-mail", "Your e-mail")} />
            <button className={styles.btn} type="submit">
              {t("Recevoir un lien", "Get a link")}
            </button>
          </form>
        </>
      )}
    </motion.div>
  );
}

/** While something is tried on: a strip at the bottom to buy it or give it back. */
export function TryOnBar({ onOpenShop }: { onOpenShop: () => void }) {
  const t = useT();
  const lang = useLang();
  const trying = useSkins((s) => s.trying);
  const thing = trying ? (BUNDLE.get(trying) ?? ITEM.get(trying)) : undefined;
  return (
    <AnimatePresence>
      {thing && (
        <motion.div className={styles.tryBar} initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
          <span>
            {t("Essai", "Trying")} · <b>{t(thing.name.fr, thing.name.en)}</b>
          </span>
          <button
            className={`${styles.btn} ${styles.primary}`}
            onPointerEnter={sfx.hover}
            onClick={() => {
              sfx.click();
              onOpenShop();
            }}
          >
            {t(`Acheter · ${formatEuros(thing.price, lang)}`, `Buy · ${formatEuros(thing.price, lang)}`)}
          </button>
          <button
            className={styles.btn}
            onPointerEnter={sfx.hover}
            onClick={() => {
              sfx.click();
              useSkins.setState({ trying: null });
              // back where the shop was left
              onOpenShop();
            }}
          >
            {t("Rendre", "Give back")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
