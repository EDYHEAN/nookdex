"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useCloud } from "@/lib/cloud";
import { OS_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
import type { Tab } from "../computer/Computer";
import styles from "./Tour.module.css";

interface Step {
  title: string;
  icon: string;
  body: ReactNode;
  /** A button that shows the thing being explained. */
  action?: { label: string; run: "binder" | Tab } | { label: string; href: string };
}

interface Props {
  compact: boolean;
  onOpenBinder: () => void;
  onOpenOS: (tab: Tab) => void;
  onDone: () => void;
}

/**
 * First visit, after the first binder: a note taped at the bottom of the screen walks through the essentials
 * (add / remove a card, the binder summary, the OS, the wishlist, the save, the contact form) while the player
 * tries them for real. The rest (combos, sorting, colors, day and night…) is left to discover.
 */
export function Tour({ compact, onOpenBinder, onOpenOS, onDone }: Props) {
  const email = useCloud((c) => c.email);
  const [i, setI] = useState(0);
  const [folded, setFolded] = useState(false);

  const steps: Step[] = [
    {
      title: "Ajoute tes cartes",
      icon: "🃏",
      body: (
        <>
          Dans ton classeur, les cartes <b>grises</b> sont celles qui te manquent. <b>Clique sur une carte grise</b> : elle est à toi ! La loupe 🔍
          montre sa fiche avant.
        </>
      ),
      action: { label: "Ouvrir mon classeur", run: "binder" },
    },
    {
      title: "La fiche d'une carte",
      icon: "🔍",
      body: (
        <>
          <b>Clique sur une carte que tu as</b> pour ouvrir sa fiche : variante (normale, reverse, holo), état, doublons, prix payé. Pour
          l&apos;enlever, <b>maintiens « Retirer du classeur »</b>.
        </>
      ),
      action: { label: "Ouvrir mon classeur", run: "binder" },
    },
    {
      title: "Le sommaire du classeur",
      icon: "📒",
      body: (
        <>
          La première page résume tout : cartes qui manquent, <b>valeur Cardmarket</b> du jour, plus-value. Tu peux y chercher une carte, changer
          l&apos;ordre et la couleur. Tourne les pages avec les flèches ou les coins.
        </>
      ),
      action: { label: "Ouvrir mon classeur", run: "binder" },
    },
    {
      title: OS_NAME,
      icon: "🖥️",
      body: (
        <>
          {compact ? (
            <>
              Le bouton <b>OS</b> en haut à droite
            </>
          ) : (
            <>
              <b>L&apos;écran du PC</b> sur le bureau
            </>
          )}{" "}
          ouvre {OS_NAME} : le tableau de bord de ta collec, tes doublons à échanger et la recherche de cartes.
        </>
      ),
      action: { label: `Ouvrir ${OS_NAME}`, run: "home" },
    },
    {
      title: "Ta wishlist",
      icon: "⭐",
      body: (
        <>
          Onglet <b>Wishlist</b> : toutes les cartes qui te manquent, avec leur prix. Copie la liste en un clic pour tes achats ou tes échanges.
        </>
      ),
      action: { label: "Voir la wishlist", run: "wish" },
    },
    {
      title: "Ta sauvegarde",
      icon: "☁️",
      body: email ? (
        <>
          Tu es connecté avec <b>{email}</b> : ta collec est <b>sauvegardée en ligne</b> toute seule et te suit sur tous tes appareils. Onglet{" "}
          <b>Sauvegarde</b> : état de la synchro, export en fichier, déconnexion.
        </>
      ) : (
        <>
          Tu joues sans compte : ta collec reste <b>dans ce navigateur</b>. Onglet <b>Sauvegarde</b> pour te connecter (et la garder en ligne) ou
          l&apos;exporter en fichier.
        </>
      ),
      action: { label: "Voir la sauvegarde", run: "save" },
    },
    {
      title: "Une question ?",
      icon: "✉️",
      body: (
        <>
          Le <b>carnet</b> sur l&apos;étagère raconte l&apos;histoire du site. Un bug, une idée, une question : écris-nous via le formulaire de contact.
          Le reste, c&apos;est à toi de le découvrir…
        </>
      ),
      action: { label: "Formulaire de contact", href: "/contact" },
    },
  ];

  const step = steps[i];
  const last = i === steps.length - 1;
  const go = (n: number) => {
    sfx.pop();
    setI(n);
  };
  const act = () => {
    const a = step.action;
    if (!a || "href" in a) return;
    sfx.click();
    if (a.run === "binder") onOpenBinder();
    else onOpenOS(a.run);
  };

  if (folded)
    return (
      <button
        className={styles.pill}
        onClick={() => {
          sfx.pop();
          setFolded(false);
        }}
        aria-label="Rouvrir la visite guidée"
      >
        ? Visite {i + 1}/{steps.length}
      </button>
    );

  return (
    <motion.aside
      className={styles.note}
      role="dialog"
      aria-label="Visite guidée"
      initial={{ y: 80, rotate: 2, opacity: 0 }}
      animate={{ y: 0, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
    >
      <div className={styles.top}>
        <span className={styles.count}>
          Visite · {i + 1}/{steps.length}
        </span>
        <button className={styles.fold} onClick={() => setFolded(true)} aria-label="Réduire la visite">
          –
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.15 }}
        >
          <h2>
            <span aria-hidden>{step.icon}</span> {step.title}
          </h2>
          <p>{step.body}</p>
        </motion.div>
      </AnimatePresence>

      <div className={styles.dots} aria-hidden>
        {steps.map((_, n) => (
          <span key={n} className={n === i ? styles.dotOn : n < i ? styles.dotDone : ""} />
        ))}
      </div>

      <div className={styles.actions}>
        {step.action &&
          ("href" in step.action ? (
            <Link href={step.action.href} className={styles.show} onClick={() => sfx.click()}>
              {step.action.label}
            </Link>
          ) : (
            <button className={styles.show} onClick={act}>
              {step.action.label}
            </button>
          ))}
        <span className={styles.spacer} />
        {i > 0 && (
          <button className={styles.prev} onClick={() => go(i - 1)} aria-label="Étape précédente">
            ◀
          </button>
        )}
        <button
          className={styles.next}
          onClick={() => {
            if (!last) return go(i + 1);
            sfx.add(0, "rare");
            onDone();
          }}
        >
          {last ? "À toi de jouer ▶" : "Suivant ▶"}
        </button>
      </div>
      {!last && (
        <button
          className={styles.skip}
          onClick={() => {
            sfx.click();
            onDone();
          }}
        >
          passer la visite
        </button>
      )}
    </motion.aside>
  );
}
