"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { loadSets, neededSets } from "@/lib/catalog";
import { sfx } from "@/lib/sound";
import { isBackup, useStore } from "@/lib/store";
import { BinderPicker, type BinderChoice } from "./BinderPicker";
import styles from "./Welcome.module.css";

type Step = "hello" | "binder";

interface Props {
  /** Adds the first binder (loads its cards first). */
  onPick: (choice: BinderChoice) => Promise<void>;
  onDone: () => void;
}

/**
 * First visit: create a (local) account, then pick a first binder.
 * The account is only a name for now: the collection stays in this browser until online accounts land.
 */
export function Welcome({ onPick, onDone }: Props) {
  const profile = useStore((s) => s.profile);
  const binders = useStore((s) => s.binders);
  const [step, setStep] = useState<Step>(profile ? "binder" : "hello");
  const [mode, setMode] = useState<"new" | "back">("new");
  const [name, setName] = useState("");
  const [shake, setShake] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "hello" && mode === "new") input.current?.focus();
  }, [step, mode]);

  const finish = () => {
    setLeaving(true);
    setTimeout(onDone, 380);
  };

  const signUp = () => {
    const n = name.trim();
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
    else setStep("binder");
  };

  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!isBackup(data)) throw new Error("bad file");
      useStore.getState().importBackup(data);
      const s = useStore.getState();
      await loadSets(neededSets(s.binders, s.collection));
      sfx.add(1, "rare");
      if (s.profile) {
        finish();
        return;
      }
      setMode("new");
      setNote(`${Object.keys(data.collection).length} cartes récupérées ! Il ne manque que ton pseudo.`);
    } catch {
      sfx.locked();
      setNote("Ce fichier n'est pas une sauvegarde PokéPocket.");
    }
  };

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.35 }}
    >
      <AnimatePresence mode="wait">
        {step === "hello" ? (
          <motion.section
            key="hello"
            className={styles.card}
            initial={{ y: -60, rotate: -3, opacity: 0 }}
            animate={{ y: 0, rotate: 0, opacity: 1 }}
            exit={{ y: 40, rotate: 2, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
          >
            <p className={styles.brand}>
              Poké<span>Pocket</span>
            </p>
            <h1>Bienvenue au bureau !</h1>

            <div className={styles.switch} role="tablist">
              {(
                [
                  ["new", "Nouveau compte"],
                  ["back", "J'ai déjà une collec"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={mode === id}
                  className={mode === id ? styles.on : ""}
                  onClick={() => {
                    if (mode === id) return;
                    sfx.click();
                    setMode(id);
                    setNote(null);
                  }}
                  onPointerEnter={sfx.hover}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "new" ? (
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
                    value={name}
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
                  {binders.length ? "Retrouver mon bureau ▶" : "Créer mon compte ▶"}
                </button>
                <p className={styles.small}>
                  Pour l&apos;instant ta collec reste sur cet appareil. Les comptes en ligne (et la synchro entre appareils) arrivent
                  bientôt.
                </p>
              </form>
            ) : (
              <div className={styles.form}>
                <p className={styles.text}>
                  Les comptes en ligne n&apos;existent pas encore : ta collec est gardée dans le navigateur où tu l&apos;as créée. Tu changes
                  d&apos;appareil ? Exporte ta sauvegarde depuis le PC du bureau (onglet <b>Sauvegarde</b>), puis importe-la ici.
                </p>
                {note && <p className={styles.note}>{note}</p>}
                <button
                  className={styles.go}
                  onClick={() => {
                    sfx.click();
                    file.current?.click();
                  }}
                  onPointerEnter={sfx.hover}
                >
                  ⬆ Importer ma sauvegarde
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
          </motion.section>
        ) : (
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
