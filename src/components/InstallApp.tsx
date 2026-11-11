"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { iosBrowser, promptInstall, useInstallWay } from "@/lib/install";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import styles from "./InstallApp.module.css";

/**
 * « Installer l'app » (lib/install): Chrome's own window where it offers one, else the steps by hand (iPhone, Firefox…).
 * Nothing at all once installed, or on a computer whose browser can't install.
 */
export function InstallButton({ className, children, after }: { className?: string; children: ReactNode; after?: ReactNode }) {
  const way = useInstallWay();
  const [steps, setSteps] = useState(false);
  if (way === "installed" || way === "none") return null;
  return (
    <>
      <button
        className={className}
        onPointerEnter={sfx.hover}
        onClick={async (e) => {
          e.stopPropagation();
          sfx.pop();
          if (way === "prompt") {
            if (await promptInstall()) sfx.coin();
          } else setSteps(true);
        }}
      >
        {children}
      </button>
      {/* a separator that goes with it (the notebook's « · ») */}
      {after}
      {typeof document !== "undefined" &&
        createPortal(<AnimatePresence>{steps && <InstallSteps key="steps" ios={way === "ios"} onClose={() => setSteps(false)} />}</AnimatePresence>, document.body)}
    </>
  );
}

function InstallSteps({ ios, onClose }: { ios: boolean; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // where the iPhone's browser keeps its Share button (lib/install iosBrowser)
  const browser = ios ? iosBrowser() : null;
  const share =
    browser === "chrome" || browser === "edge"
      ? t(<>Touche <b>Partager</b> en haut à droite, dans la barre d&apos;adresse</>, <>Tap <b>Share</b> at the top right, in the address bar</>)
      : browser === "firefox"
        ? t(<>Ouvre le <b>menu ☰</b>, puis <b>Partager</b></>, <>Open the <b>☰ menu</b>, then <b>Share</b></>)
        : t(<>Touche <b>Partager</b> en bas de Safari (dans <b>···</b> sur iOS 26)</>, <>Tap <b>Share</b> at the bottom of Safari (under <b>···</b> on iOS 26)</>);
  // a picture each step: the button to look for, as the browser draws it
  const list: [ReactNode, ReactNode][] = ios
    ? [
        [<span key="i" className={styles.glyph}>⬆</span>, share],
        [
          <span key="i" className={styles.glyph}>⊞</span>,
          t(<>Fais défiler et choisis <b>Sur l&apos;écran d&apos;accueil</b></>, <>Scroll down and pick <b>Add to Home Screen</b></>),
        ],
        [<span key="i" className={styles.glyph}>✓</span>, t(<>Touche <b>Ajouter</b> : NookDex s&apos;ouvre en plein écran</>, <>Tap <b>Add</b>: NookDex opens full screen</>)],
      ]
    : [
        [<span key="i" className={styles.glyph}>⋮</span>, t(<>Ouvre le <b>menu</b> de ton navigateur</>, <>Open your browser&apos;s <b>menu</b></>)],
        [<span key="i" className={styles.glyph}>⊞</span>, t(<><b>Installer</b> ou <b>Ajouter à l&apos;écran d&apos;accueil</b></>, <><b>Install</b> or <b>Add to Home screen</b></>)],
        [<span key="i" className={styles.glyph}>✓</span>, t(<>Confirme : NookDex rejoint tes apps</>, <>Confirm: NookDex joins your apps</>)],
      ];

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
      <motion.div
        className={styles.card}
        role="dialog"
        aria-label={t("Installer NookDex", "Install NookDex")}
        initial={{ y: 60, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 40, opacity: 0, transition: { duration: 0.2 } }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
      >
        <button
          className={styles.close}
          onClick={() => {
            sfx.click();
            onClose();
          }}
          aria-label={t("Fermer", "Close")}
        >
          ✕
        </button>
        <img className={styles.icon} src="/icon-512.png" alt="" width={72} height={72} />
        <h2>{t("NookDex sur ton écran d'accueil", "NookDex on your home screen")}</h2>
        <ol className={styles.steps}>
          {list.map(([glyph, text], i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }}>
              <span className={styles.num}>{i + 1}</span>
              {glyph}
              <span>{text}</span>
            </motion.li>
          ))}
        </ol>
      </motion.div>
    </motion.div>
  );
}
