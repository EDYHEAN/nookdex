"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { signIn, signInWithGoogle, useCloud } from "@/lib/cloud";
import { useLang, useT } from "@/lib/lang";
import { SKIN, SKINS, buySkin, formatEuros, ownsSkin, useSkins, type Skin } from "@/lib/shop";
import { sfx } from "@/lib/sound";
import styles from "./Shop.module.css";

/**
 * The shop (lib/shop, docs/skins.md): a mail-order catalogue of NookDex's own skins. Each one can be tried on the
 * player's own desk before buying; a bought one is worn or taken off here. Buying needs an account (the skin is kept
 * with it).
 */
export function Shop({ onClose }: { onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        className={styles.catalogue}
        role="dialog"
        aria-label={t("La boutique", "The shop")}
        initial={{ y: 40, rotate: -2, opacity: 0 }}
        animate={{ y: 0, rotate: -0.6, opacity: 1 }}
        exit={{ y: 30, rotate: 2, opacity: 0, transition: { duration: 0.2 } }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <button className={styles.close} onClick={onClose} onPointerEnter={sfx.hover} aria-label={t("Refermer le catalogue", "Close the catalogue")}>
          ✕
        </button>
        <header className={styles.cover}>
          <p className={styles.issue}>{t("Catalogue · automne 2026", "Catalogue · autumn 2026")}</p>
          <h2>{t("La boutique NookDex", "The NookDex shop")}</h2>
          <p className={styles.tagline}>{t("De quoi habiller ton bureau. Essaie avant d'acheter.", "Things to dress up your desk. Try before you buy.")}</p>
        </header>
        <div className={styles.items}>
          {SKINS.map((s, i) => (
            <Item key={s.id} skin={s} index={i} onClose={onClose} />
          ))}
        </div>
        <footer className={styles.small}>
          {t(
            "Contenus numériques NookDex, achat unique, gardés avec ton compte. Tout ce qui touche à Pokémon reste gratuit.",
            "NookDex digital items, one-off purchase, kept with your account. Everything Pokémon stays free.",
          )}
        </footer>
      </motion.section>
    </motion.div>
  );
}

function Item({ skin, index, onClose }: { skin: Skin; index: number; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const { equipped, owned } = useSkins();
  const mine = ownsSkin(skin.id, owned);
  const worn = mine && equipped === skin.id;
  const [buying, setBuying] = useState(false);
  const preview = `/skins/${skin.id}/preview.webp`;

  return (
    <motion.article
      className={styles.item}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.06, type: "spring", stiffness: 300, damping: 24 }}
    >
      <div className={styles.photo}>
        <img src={preview} alt={t(`Le bureau en ${skin.name.fr}`, `The desk in ${skin.name.en}`)} />
        {!mine && <span className={styles.price}>{formatEuros(skin.price, lang)}</span>}
        {mine && <span className={`${styles.price} ${styles.owned}`}>{t("À toi", "Yours")}</span>}
      </div>
      <div className={styles.text}>
        <h3>{t(skin.name.fr, skin.name.en)}</h3>
        <p>{t(skin.blurb.fr, skin.blurb.en)}</p>
        <ul>
          {skin.contents.map((c) => (
            <li key={c.fr}>{t(c.fr, c.en)}</li>
          ))}
        </ul>
        <div className={styles.actions}>
          {mine ? (
            <button
              className={`${styles.btn} ${worn ? "" : styles.primary}`}
              onPointerEnter={sfx.hover}
              onClick={() => {
                sfx.stamp();
                useSkins.setState({ equipped: worn ? null : skin.id, trying: null });
              }}
            >
              {worn ? t("Retirer", "Take off") : t("Mettre sur mon bureau", "Put it on my desk")}
            </button>
          ) : (
            <>
              <button
                className={styles.btn}
                onPointerEnter={sfx.hover}
                onClick={() => {
                  sfx.pop();
                  useSkins.setState({ trying: skin.id });
                  onClose();
                }}
              >
                {t("Essayer sur mon bureau", "Try it on my desk")}
              </button>
              <button
                className={`${styles.btn} ${styles.primary}`}
                onPointerEnter={sfx.hover}
                onClick={() => {
                  sfx.click();
                  setBuying(!buying);
                }}
              >
                {t(`Acheter · ${formatEuros(skin.price, lang)}`, `Buy · ${formatEuros(skin.price, lang)}`)}
              </button>
            </>
          )}
        </div>
        <AnimatePresence>{buying && !mine && <Checkout key="checkout" skin={skin} />}</AnimatePresence>
      </div>
    </motion.article>
  );
}

/** Buying: signed in, off to Stripe's payment page; else sign in first (the skin is kept with the account). */
function Checkout({ skin }: { skin: Skin }) {
  const t = useT();
  const email = useCloud((s) => s.email);
  const [state, setState] = useState<"idle" | "going" | "soon" | "error" | "sent">("idle");
  const [mail, setMail] = useState("");

  const pay = async () => {
    setState("going");
    const r = await buySkin(skin.id);
    if (r === "ok") return; // the page leaves for Stripe
    setState(r);
  };

  return (
    <motion.div className={styles.checkout} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      {email ? (
        <>
          <p>{t(`Lié à ton compte ${email}.`, `Kept with your account ${email}.`)}</p>
          <button className={`${styles.btn} ${styles.primary}`} disabled={state === "going"} onClick={() => void pay()}>
            {state === "going" ? t("Vers le paiement…", "To the payment…") : t("Payer avec Stripe", "Pay with Stripe")}
          </button>
          {state === "soon" && <p className={styles.note}>{t("Le paiement ouvre très bientôt.", "Payment opens very soon.")}</p>}
          {state === "error" && <p className={styles.note}>{t("Le paiement n'a pas pu s'ouvrir. Réessaie dans un instant.", "The payment couldn't open. Try again in a moment.")}</p>}
        </>
      ) : state === "sent" ? (
        <p>{t("Lien envoyé ! Ouvre-le, puis reviens acheter.", "Link sent! Open it, then come back to buy.")}</p>
      ) : (
        <>
          <p>{t("Ton skin est gardé avec ton compte : connecte-toi d'abord.", "Your skin is kept with your account: sign in first.")}</p>
          <button className={`${styles.btn} ${styles.primary}`} onClick={() => void signInWithGoogle()}>
            {t("Avec Google", "With Google")}
          </button>
          <form
            className={styles.mailForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (!mail.includes("@")) return;
              void signIn(mail).then(() => setState("sent"));
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

/** While a skin is tried on: a strip at the bottom to buy it or give it back. */
export function TryOnBar({ onOpenShop }: { onOpenShop: () => void }) {
  const t = useT();
  const lang = useLang();
  const trying = useSkins((s) => s.trying);
  const skin = trying ? SKIN.get(trying) : undefined;
  return (
    <AnimatePresence>
      {skin && (
        <motion.div className={styles.tryBar} initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
          <span>
            {t("Essai", "Trying")} · <b>{t(skin.name.fr, skin.name.en)}</b>
          </span>
          <button
            className={`${styles.btn} ${styles.primary}`}
            onPointerEnter={sfx.hover}
            onClick={() => {
              sfx.click();
              onOpenShop();
            }}
          >
            {t(`Acheter · ${formatEuros(skin.price, lang)}`, `Buy · ${formatEuros(skin.price, lang)}`)}
          </button>
          <button
            className={styles.btn}
            onPointerEnter={sfx.hover}
            onClick={() => {
              sfx.click();
              useSkins.setState({ trying: null });
            }}
          >
            {t("Rendre", "Give back")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
