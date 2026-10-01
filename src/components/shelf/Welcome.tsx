"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadSets, neededSets } from "@/lib/catalog";
import { signIn, signInWithGoogle, useCloud } from "@/lib/cloud";
import { NAME_PARTS, SITE_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
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
  const frenchOk = useStore((s) => s.frenchOk);
  // The site only speaks French for now: a browser in another language first gets a note saying so (in English).
  const [french] = useState(() => (navigator.languages?.length ? navigator.languages : [navigator.language]).some((l) => /^fr\b/i.test(l)));
  const base = (!email && !offline) || status === "loading" ? "account" : !profile ? "hello" : "binder";
  const step = base === "account" && !email && !french && !frenchOk ? "lang" : base;
  /** "Play without an account" asks once more, with what it costs. */
  const [warn, setWarn] = useState(false);
  /** null = untouched: suggests the first name Google gave */
  const [name, setName] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitlist, setWaitlist] = useState<"idle" | "busy" | "done" | "error">("idle");
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
      setNote("L'envoi a échoué, réessaie dans un moment.");
      console.warn("[cloud] sign in", error);
      return;
    }
    sfx.pop();
    setNote(null);
    setSent(to);
  };

  /** English waiting list: one e-mail when the English version is out. */
  const joinWaitlist = async () => {
    const to = address.trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) {
      sfx.locked();
      return;
    }
    setWaitlist("busy");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: to, lang: navigator.language }),
      });
      if (!res.ok) throw new Error(String(res.status));
      sfx.pop();
      setWaitlist("done");
    } catch {
      sfx.locked();
      setWaitlist("error");
    }
  };

  const google = async () => {
    sfx.click();
    setBusy(true);
    const error = await signInWithGoogle();
    // On success the page leaves for Google: only an error comes back here.
    if (error) {
      setBusy(false);
      sfx.locked();
      setNote("Connexion Google impossible pour le moment.");
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
      setNote(`${Object.keys(data.collection).length} cartes récupérées ! Connecte-toi pour les sauvegarder en ligne.`);
    } catch {
      sfx.locked();
      setNote(`Ce fichier n'est pas une sauvegarde ${SITE_NAME}.`);
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
        {step === "lang" &&
          card(
            "lang",
            <>
              <h1>Hello, trainer!</h1>
              <p className={styles.text}>
                {SITE_NAME} only speaks <b>French</b> for now. An English version is on its way: leave your e-mail and we&apos;ll let you know
                (once, when it&apos;s ready).
              </p>
              {waitlist === "done" ? (
                <p className={styles.note}>Thanks! We&apos;ll write to you as soon as English is here.</p>
              ) : (
                <form
                  className={styles.inline}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void joinWaitlist();
                  }}
                >
                  <input
                    type="email"
                    value={address}
                    placeholder="ash@pallet-town.com"
                    autoComplete="email"
                    aria-label="E-mail address"
                    className={styles.email}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <button type="submit" className={styles.go} disabled={waitlist === "busy"} aria-label="Notify me">
                    ✉
                  </button>
                </form>
              )}
              {waitlist === "error" && <p className={styles.note}>That didn&apos;t work, please try again later.</p>}
              <button
                className={styles.linkBtn}
                onClick={() => {
                  sfx.click();
                  useStore.getState().acceptFrench();
                }}
              >
                Continue in French anyway ▶
              </button>
            </>,
          )}

        {step === "account" &&
          card(
            "account",
            <>
              <h1>Bienvenue au bureau !</h1>
              <p className={styles.steps}>
                <b>1. Connexion</b> · 2. Pseudo · 3. Premier classeur
              </p>
              {warn && !email ? (
                <div className={styles.form}>
                  <p className={styles.warn}>
                    Sans compte, ta collec reste <b>uniquement dans ce navigateur</b> : pas de sauvegarde en ligne, pas de synchro entre tes
                    appareils. Si tu vides les données du site ou changes d&apos;appareil, elle est perdue.
                  </p>
                  <p className={styles.text}>
                    Pense à l&apos;exporter de temps en temps depuis le PC du bureau (<b>NookDex OS → Sauvegarde</b>). Tu pourras aussi créer ton
                    compte plus tard, au même endroit, sans rien perdre.
                  </p>
                  <button
                    className={styles.go}
                    onClick={() => {
                      sfx.click();
                      useStore.getState().setOffline(true);
                    }}
                    onPointerEnter={sfx.hover}
                  >
                    Jouer sans compte ▶
                  </button>
                  <button
                    className={styles.linkBtn}
                    onClick={() => {
                      sfx.click();
                      setWarn(false);
                    }}
                  >
                    ← finalement, je me connecte
                  </button>
                </div>
              ) : email ? (
                <div className={styles.form}>
                  <p className={styles.text}>
                    Connecté avec <b>{email}</b>. On cherche ta collection…
                  </p>
                </div>
              ) : sent ? (
                <div className={styles.form}>
                  <p className={styles.note}>
                    Lien envoyé à <b>{sent}</b> ! Ouvre l&apos;e-mail sur cet appareil et clique sur le lien pour entrer.
                  </p>
                  <button
                    className={styles.linkBtn}
                    onClick={() => {
                      sfx.click();
                      setSent(null);
                    }}
                  >
                    changer d&apos;adresse
                  </button>
                </div>
              ) : (
                <div className={styles.form}>
                  <button className={styles.go} disabled={busy} onClick={() => void google()} onPointerEnter={sfx.hover}>
                    G&nbsp;&nbsp;Continuer avec Google
                  </button>
                  <p className={styles.or}>ou avec ton e-mail</p>
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
                      placeholder="sacha@bourg-palette.fr"
                      autoComplete="email"
                      aria-label="Adresse e-mail"
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
                    On t&apos;envoie un lien pour entrer, sans mot de passe. <Link href="/a-propos">C&apos;est quoi {SITE_NAME} ?</Link> ·{" "}
                    <Link href="/confidentialite">Confidentialité</Link>
                  </p>
                  {note && <p className={styles.note}>{note}</p>}
                  <p className={styles.small}>
                    Ta collec est sauvegardée sur ton compte et te suit sur tous tes appareils. Tu as un fichier de sauvegarde ?{" "}
                    <button
                      className={styles.linkBtn}
                      onClick={() => {
                        sfx.click();
                        file.current?.click();
                      }}
                    >
                      Importe-le
                    </button>{" "}
                    puis connecte-toi. Ou{" "}
                    <button
                      className={styles.linkBtn}
                      onClick={() => {
                        sfx.click();
                        setNote(null);
                        setWarn(true);
                      }}
                    >
                      jouer sans compte
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
              <h1>Comment on t&apos;appelle ?</h1>
              <p className={styles.steps}>
                1. Connexion · <b>2. Pseudo</b> · 3. Premier classeur
              </p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  signUp();
                }}
              >
                <label className={styles.field}>
                  <span>Ton pseudo de dresseur</span>
                  <motion.input
                    key={shake}
                    ref={input}
                    autoFocus
                    value={nickname}
                    maxLength={20}
                    placeholder="Sacha"
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
                  {binders.length ? "Retrouver mon bureau ▶" : "C'est parti ▶"}
                </button>
                <p className={styles.small}>
                  {email ? (
                    <>
                      Connecté avec <b>{email}</b> : ta collec est sauvegardée en ligne.
                    </>
                  ) : (
                    <>
                      Sans compte : ta collec reste dans ce navigateur. Exporte-la depuis <b>NookDex OS → Sauvegarde</b>.
                    </>
                  )}
                </p>
              </form>
            </>,
          )}

        {step === "binder" && (
          <motion.div key="binder" className={styles.pickerWrap} exit={{ opacity: 0, y: 40, transition: { duration: 0.25 } }}>
            <BinderPicker
              title={`${profile?.name ?? "Dresseur"}, choisis ton premier classeur`}
              subtitle="Une extension à compléter, ou un classeur libre où tu ranges ce que tu veux. Tu pourras en ajouter d'autres sur l'étagère."
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
