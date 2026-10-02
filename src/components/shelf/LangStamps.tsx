"use client";

import { motion } from "motion/react";
import { CARD_LANGS, type CardLang, langLabel } from "@/lib/cardLang";
import { useLang, useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import styles from "./LangStamps.module.css";

/** Card language picker: one rubber stamp per language (new binder, free binder search). */
export function LangStamps({ value, onChange, disabled }: { value: CardLang; onChange: (lang: CardLang) => void; disabled?: boolean }) {
  const t = useT();
  const site = useLang();
  const titles: Record<CardLang, string> = {
    fr: t("Cartes françaises · prix Cardmarket", "French cards · Cardmarket prices"),
    en: t("Cartes anglaises · prix TCGplayer", "English cards · TCGplayer prices"),
    ja: t("Cartes japonaises · prix Cardmarket des japonaises", "Japanese cards · Cardmarket prices of Japanese prints"),
  };
  return (
    <div className={styles.langs} role="radiogroup" aria-label={t("Langue des cartes", "Card language")}>
      <span>{t("cartes", "cards")}</span>
      {CARD_LANGS.map((l) => (
        <motion.button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          className={`${styles.lang} ${value === l ? styles.on : ""}`}
          whileTap={{ scale: 0.85, rotate: -6 }}
          onClick={() => {
            if (value === l || disabled) return;
            sfx.stamp();
            onChange(l);
          }}
          onPointerEnter={sfx.hover}
          title={titles[l]}
        >
          {langLabel(l, site)}
        </motion.button>
      ))}
    </div>
  );
}
