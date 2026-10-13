"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadSets, neededSets } from "@/lib/catalog";
import { askPlayers, signIn, signInWithGoogle, useCloud, usePlayers } from "@/lib/cloud";
import { NAME_PARTS, SITE_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
import { useT } from "@/lib/lang";
import { isBackup, useStore } from "@/lib/store";
import { BinderPicker, type BinderChoice } from "./BinderPicker";
import styles from "./Welcome.module.css";

interface Props {
  /** Adds the first binder (loads its cards first). */
  onPick: (choice: BinderChoice) => Promise<unknown>;
  onDone: () => void;
  /** No binder yet: look around every card first (NookDex OS, "All cards") */
  onExplore: () => void;
}

/**
 * The way in: 1. nickname → 2. first binder, nothing more (Johan, 2026-10-13: asking for an account first held people
 * back). The account comes later, once the player has a few cards (`room/SavePrompt`). A player coming back on a new
 * device signs in from the nickname card ("already have an account?"); App closes this screen once their save is in.
 */
export function Welcome({ onPick, onDone, onExplore }: Props) {
  const profile = useStore((s) => s.profile);
  const binders = useStore((s) => s.binders);
  const { email, firstName, status } = useCloud();
  const t = useT();
  const players = usePlayers((p) => p.count);
  useEffect(askPlayers, []);
  /** "Already have an account?": the sign-in card, for a player coming back */
  const [account, setAccount] = useState(false);
  const step = status === "loading" || (account && !email && !profile) ? "account" : !profile ? "hello" : "binder";
  /** null = untouched: suggests the first name Google gave */
  const [name, setName] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const nickname = name ?? firstName?.slice(0, 20) ?? "";

  useEffect(() => {
    if (step === "hello") input.current?.focus();
  }, [step]);

  const finish = () => {
    setLeaving(true);
    setTimeout(onDone, 380);
  };

  const sendLink = async () => {
    const to = address.trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) {
      sfx.locked();
      setShake((k) => k + 1);
      return;
    }
    setBusy(true);
    const error = await signIn(to);
    setBusy(false);
    if (error) {
      sfx.locked();
      setNote(t("L'envoi a échoué, réessaie dans un moment.", "Couldn't send it, try again in a moment."));
      console.warn("[cloud] sign in", error);
      return;
    }
    sfx.pop();
    setNote(null);
    setSent(to);
  };

  const google = async () => {
    sfx.click();
    setBusy(true);
    const error = await signInWithGoogle();
    // On success the page leaves for Google: only an error comes back here.
    if (error) {
      setBusy(false);
      sfx.locked();
      setNote(t("Connexion Google impossible pour le moment.", "Google sign-in isn't available right now."));
      console.warn("[cloud] google", error);
    }
  };

  const signUp = () => {
    const n = nickname.trim();
    if (n.length < 2) {
      sfx.locked();
      setShake((k) => k + 1);
      input.current?.focus();
      return;
    }
    sfx.add(0, "rare");
    useStore.getState().createProfile(n);
    // Saves from before accounts already have their binders.
    if (useStore.getState().binders.length) finish();
  };

  /** A file exported before accounts: loaded here, it goes online once signed in. */
  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!isBackup(data)) throw new Error("bad file");
      useStore.getState().importBackup(data);
      const s = useStore.getState();
      await loadSets(neededSets(s.binders, s.collection));
      sfx.add(1, "rare");
      const n = Object.keys(data.collection).length;
      setNote(t(`${n} cartes récupérées ! Connecte-toi pour les sauvegarder en ligne, ou continue sans compte.`, `${n} cards back! Sign in to save them online, or go on without an account.`));
    } catch {
      sfx.locked();
      setNote(t(`Ce fichier n'est pas une sauvegarde ${SITE_NAME}.`, `This file isn't a ${SITE_NAME} save.`));
    }
  };

  const card = (key: string, children: React.ReactNode) => (
    <motion.section
      key={key}
      className={styles.card}
      initial={{ y: -60, rotate: -3, opacity: 0 }}
      animate={{ y: 0, rotate: 0, opacity: 1 }}
      exit={{ y: 40, rotate: 2, opacity: 0, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
    >
      <p className={styles.brand}>
        {NAME_PARTS[0]}
        <span>{NAME_PARTS[1]}</span>
      </p>
      {children}
    </motion.section>
  );

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.35 }}
    >
      <AnimatePresence mode="wait">
        {step === "account" &&
          card(
            "account",
            <>
              <h1>{t("Content de te revoir !","Good to see you again!")}</h1>
              {email ? (
                <div className={styles.form}>
                  <p className={styles.text}>
                    {t("Connecté avec", "Signed in as")} <b>{email}</b>. {t("On cherche ta collection…", "Looking for your collection…")}
                  </p>
                </div>
              ) : sent ? (
                <div className={styles.form}>
                  <p className={styles.note}>
                    {t(
                      <>
                        Lien envoyé à <b>{sent}</b> ! Ouvre l&apos;e-mail sur cet appareil et clique sur le lien pour entrer.
                      </>,
                      <>
                        Link sent to <b>{sent}</b>! Open the e-mail on this device and click the link to come in.
                      </>,
                    )}
                  </p>
                  <button
                    className={styles.linkBtn}
                    onClick={() => {
                      sfx.click();
                      setSent(null);
                    }}
                  >
                    {t("changer d'adresse", "use another address")}
                  </button>
                </div>
              ) : (
                <div className={styles.form}>
                  <button className={styles.go} disabled={busy} onClick={() => void google()} onPointerEnter={sfx.hover}>
                    G&nbsp;&nbsp;{t("Continuer avec Google", "Continue with Google")}
                  </button>
                  <p className={styles.or}>{t("ou avec ton e-mail", "or with your e-mail")}</p>
                  <form
                    className={styles.inline}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void sendLink();
                    }}
                  >
                    <motion.input
                      key={shake}
                      type="email"
                      value={address}
                      placeholder={t("sacha@bourg-palette.fr", "ash@pallet-town.com")}
                      autoComplete="email"
                      aria-label={t("Adresse e-mail", "E-mail address")}
                      className={styles.email}
                      animate={shake ? { x: [0, -10, 9, -6, 4, 0] } : undefined}
                      transition={{ duration: 0.35 }}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                    <button type="submit" className={styles.go} disabled={busy} onPointerEnter={sfx.hover}>
                      ▶
                    </button>
                  </form>
                  <p className={styles.small}>
                    {t("On t'envoie un lien pour entrer, sans mot de passe.", "We send you a link to come in, no password.")}{" "}
                    <Link href="/a-propos">{t(`C'est quoi ${SITE_NAME} ?`, `What's ${SITE_NAME}?`)}</Link> ·{" "}
                    <Link href="/confidentialite">{t("Confidentialité", "Privacy")}</Link>
                  </p>
                  {note && <p className={styles.note}>{note}</p>}
                  <p className={styles.small}>
                    {t("Un fichier de sauvegarde ?", "Got a save file?")}{" "}
                    <button
                      className={styles.linkBtn}
                      onClick={() => {
                        sfx.click();
                        file.current?.click();
                      }}
                    >
                      {t("Importe-le", "Import it")}
                    </button>
                  </p>
                  <button
                    className={styles.linkBtn}
                    onClick={() => {
                      sfx.click();
                      setNote(null);
                      setAccount(false);
                    }}
                  >
                    {t("← nouveau ici ? commence sans compte", "← new here? start without an account")}
                  </button>
                  <input
                    ref={file}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </>,
          )}

        {step === "hello" &&
          card(
            "hello",
            <>
              <h1>{t("Bienvenue au bureau !","Welcome to the desk!")}</h1>
              {players != null && players >= 50 && (
                <p className={styles.players}>
                  {t(`★ Rejoins les ${players} dresseurs de NookDex`, `★ Join NookDex's ${players} collectors`)}
                </p>
              )}
              <p className={styles.steps}>
                <b>{t("1. Pseudo", "1. Nickname")}</b> · {t("2. Premier classeur", "2. First binder")}
              </p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  signUp();
                }}
              >
                <label className={styles.field}>
                  <span>{t("Comment on t'appelle ?", "What should we call you?")}</span>
                  <motion.input
                    key={shake}
                    ref={input}
                    autoFocus
                    value={nickname}
                    maxLength={20}
                    placeholder={t("Sacha", "Ash")}
                    autoComplete="nickname"
                    animate={shake ? { x: [0, -10, 9, -6, 4, 0] } : undefined}
                    transition={{ duration: 0.35 }}
                    onChange={(e) => {
                      setName(e.target.value);
                      sfx.hover();
                    }}
                  />
                </label>
                {note && <p className={styles.note}>{note}</p>}
                <button type="submit" className={styles.go} onPointerEnter={sfx.hover}>
                  {binders.length ? t("Retrouver mon bureau ▶", "Back to my desk ▶") : t("C'est parti ▶", "Let's go ▶")}
                </button>
                <p className={styles.small}>
                  {email ? (
                    <>
                      {t("Connecté avec", "Signed in as")} <b>{email}</b>{t(" : ta collec est sauvegardée en ligne.", ": your collection is saved online.")}
                    </>
                  ) : (
                    <>
                      {t("Pas besoin de compte pour commencer.", "No account needed to start.")}{" "}
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => {
                          sfx.click();
                          setAccount(true);
                        }}
                      >
                        {t("Déjà un compte ? Connecte-toi", "Already have an account? Sign in")}
                      </button>
                    </>
                  )}
                </p>
              </form>
            </>,
          )}

        {step === "binder" && (
          <motion.div key="binder" className={styles.pickerWrap} exit={{ opacity: 0, y: 40, transition: { duration: 0.25 } }}>
            <BinderPicker
              wishes={false}
              title={t(`${profile?.name ?? "Dresseur"}, choisis ton premier classeur`, `${profile?.name ?? "Trainer"}, pick your first binder`)}
              subtitle={
                <>
                  {t(
                    "Une extension à compléter, ou un classeur libre où tu ranges ce que tu veux. Tu pourras en ajouter d'autres sur l'étagère.",
                    "A set to complete, or a free binder for whatever you like. You can add more on the shelf later.",
                  )}
                  <button
                    className={styles.explore}
                    onClick={() => {
                      sfx.click();
                      onExplore();
                      finish();
                    }}
                    onPointerEnter={sfx.hover}
                  >
                    {t("Pas encore de collection ? Explore d'abord toutes les cartes ▸", "No collection yet? Look around every card first ▸")}
                  </button>
                </>
              }
              onPick={async (choice) => {
                await onPick(choice);
                finish();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
