"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadSets, neededSets } from "@/lib/catalog";
import { signIn, signInWithGoogle, useCloud } from "@/lib/cloud";
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
}

/**
 * The way in: 1. sign in (e-mail link or Google), the save lives online → 2. nickname → 3. first binder.
 * Playing without an account is allowed after a warning: no online save, the player exports it by hand.
 * A player coming back on a new device gets their save from the cloud, and App closes this screen on its own.
 */
export function Welcome({ onPick, onDone }: Props) {
  const profile = useStore((s) => s.profile);
  const binders = useStore((s) => s.binders);
  const { email, firstName, status } = useCloud();
  const offline = useStore((s) => s.offline);
  const t = useT();
  const step = (!email && !offline) || status === "loading" ? "account" : !profile ? "hello" : "binder";
  /** "Play without an account" asks once more, with what it costs. */
  const [warn, setWarn] = useState(false);
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
      setNote(t(`${n} cartes récupérées ! Connecte-toi pour les sauvegarder en ligne.`, `${n} cards back! Sign in to save them online.`));
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
              <h1>{t("Bienvenue au bureau !", "Welcome to the desk!")}</h1>
              <p className={styles.steps}>
                <b>{t("1. Connexion", "1. Sign in")}</b> · {t("2. Pseudo", "2. Nickname")} · {t("3. Premier classeur", "3. First binder")}
              </p>
              {warn && !email ? (
                <div className={styles.form}>
                  <p className={styles.warn}>
                    {t(
                      <>
                        Sans compte, ta collec reste <b>uniquement dans ce navigateur</b> : pas de sauvegarde en ligne, pas de synchro entre tes
                        appareils. Si tu vides les données du site ou changes d&apos;appareil, elle est perdue.
                      </>,
                      <>
                        Without an account, your collection stays <b>in this browser only</b>: no online save, no sync between your devices. Clear
                        the site&apos;s data or change device and it&apos;s gone.
                      </>,
                    )}
                  </p>
                  <p className={styles.text}>
                    {t(
                      <>
                        Pense à l&apos;exporter de temps en temps depuis le PC du bureau (<b>NookDex OS → Sauvegarde</b>). Tu pourras aussi créer
                        ton compte plus tard, au même endroit, sans rien perdre.
                      </>,
                      <>
                        Remember to export it now and then from the desk computer (<b>NookDex OS → Save</b>). You can also create your account
                        later, from the same place, without losing anything.
                      </>,
                    )}
                  </p>
                  <button
                    className={styles.go}
                    onClick={() => {
                      sfx.click();
                      useStore.getState().setOffline(true);
                    }}
                    onPointerEnter={sfx.hover}
                  >
                    {t("Jouer sans compte ▶", "Play without an account ▶")}
                  </button>
                  <button
                    className={styles.linkBtn}
                    onClick={() => {
                      sfx.click();
                      setWarn(false);
                    }}
                  >
                    {t("← finalement, je me connecte", "← actually, I'll sign in")}
                  </button>
                </div>
              ) : email ? (
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
                    {t(
                      "Ta collec est sauvegardée sur ton compte et te suit sur tous tes appareils. Tu as un fichier de sauvegarde ?",
                      "Your collection is saved on your account and follows you on all your devices. Got a save file?",
                    )}{" "}
                    <button
                      className={styles.linkBtn}
                      onClick={() => {
                        sfx.click();
                        file.current?.click();
                      }}
                    >
                      {t("Importe-le", "Import it")}
                    </button>{" "}
                    {t("puis connecte-toi. Ou", "then sign in. Or")}{" "}
                    <button
                      className={styles.linkBtn}
                      onClick={() => {
                        sfx.click();
                        setNote(null);
                        setWarn(true);
                      }}
                    >
                      {t("jouer sans compte", "play without an account")}
                    </button>
                    .
                  </p>
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
              <h1>{t("Comment on t'appelle ?", "What should we call you?")}</h1>
              <p className={styles.steps}>
                {t("1. Connexion", "1. Sign in")} · <b>{t("2. Pseudo", "2. Nickname")}</b> · {t("3. Premier classeur", "3. First binder")}
              </p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  signUp();
                }}
              >
                <label className={styles.field}>
                  <span>{t("Ton pseudo de dresseur", "Your trainer name")}</span>
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
                      {t("Sans compte : ta collec reste dans ce navigateur. Exporte-la depuis", "No account: your collection stays in this browser. Export it from")}{" "}
                      <b>{t("NookDex OS → Sauvegarde", "NookDex OS → Save")}</b>.
                    </>
                  )}
                </p>
              </form>
            </>,
          )}

        {step === "binder" && (
          <motion.div key="binder" className={styles.pickerWrap} exit={{ opacity: 0, y: 40, transition: { duration: 0.25 } }}>
            <BinderPicker
              title={t(`${profile?.name ?? "Dresseur"}, choisis ton premier classeur`, `${profile?.name ?? "Trainer"}, pick your first binder`)}
              subtitle={t(
                "Une extension à compléter, ou un classeur libre où tu ranges ce que tu veux. Tu pourras en ajouter d'autres sur l'étagère.",
                "A set to complete, or a free binder for whatever you like. You can add more on the shelf later.",
              )}
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
