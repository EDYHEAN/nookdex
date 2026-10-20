"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { MAX_BINDERS } from "@/lib/binders";
import { useT } from "@/lib/lang";
import { type ImportResult, isPokecardex, matchImport, parseCsv } from "@/lib/pokecardex";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./Computer.module.css";
import { ImportReport } from "./ImportReport";

/** sets offered for the shelf at first: the big ones (a handful of cards waits in the box) */
const BIG = 20;
const OFFER = 12;

/**
 * NookDex OS → Save: a pokecardex.com export (CSV) into the collection. The file is read here, in the browser; a report
 * says what was found and what wasn't; the player picks which sets go on the shelf (the rest waits in the box).
 */
export function ImportPokecardex({ say, focus }: { say: (m: string) => void; focus?: boolean }) {
  const tr = useT();
  const file = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // opened for it (the room's strip, the welcome): brought into view once the OS has zoomed in, and lit up a moment
  useEffect(() => {
    if (!focus) return;
    const id = setTimeout(() => box.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 700);
    return () => clearTimeout(id);
  }, [focus]);
  const [step, setStep] = useState<"idle" | "reading" | "report">("idle");
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [shelf, setShelf] = useState<Set<string>>(new Set());
  const binders = useStore((s) => s.binders);
  const onShelf = new Set(binders.flatMap((b) => (b.kind === "set" ? [b.setId] : [])));
  const room = MAX_BINDERS - binders.length;

  const read = async (f: File) => {
    try {
      const rows = parseCsv(await f.text());
      if (!isPokecardex(rows)) throw new Error("not a Pokécardex export");
      setStep("reading");
      const r = await matchImport(rows, (done, total) => setProgress([done, total]));
      setResult(r);
      // the big sets not on the shelf yet, as many as there's room for
      const room = MAX_BINDERS - useStore.getState().binders.length;
      setShelf(new Set(r.sets.filter((s) => s.binder && !onShelf.has(s.setId) && s.copies >= BIG).slice(0, Math.min(OFFER, room)).map((s) => s.setId)));
      setStep("report");
      sfx.pop();
    } catch {
      setStep("idle");
      sfx.locked();
      say(tr("ce fichier n'est pas un export Pokécardex", "this file isn't a Pokécardex export"));
    }
  };

  const confirm = (shelf: Set<string>) => {
    if (!result) return;
    const { importCopies, addBinder } = useStore.getState();
    const added = importCopies(result.found);
    // in the order of the list, the biggest first
    const put = result.sets.filter((s) => shelf.has(s.setId));
    put.forEach((s) => addBinder({ kind: "set", setId: s.setId }));
    sfx.add(0, "rare");
    say(
      tr(
        `${added} cartes ajoutées${put.length ? `, ${put.length} classeurs sur l'étagère` : ""} ! Le reste t'attend dans la boîte.`,
        `${added} cards added${put.length ? `, ${put.length} binders on the shelf` : ""}! The rest waits in the box.`,
      ),
    );
    setStep("idle");
    setResult(null);
  };

  const input = (
    <input
      ref={file}
      type="file"
      accept=".csv,text/csv"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void read(f);
        e.target.value = "";
      }}
    />
  );

  if (step === "idle")
    return (
      <div ref={box} className={`${styles.importBox} ${focus ? styles.importFocus : ""}`}>
        <p>
          {tr(
            "Ta collection est sur Pokécardex ? Exporte-la (Mon compte → Exporter ma collection), puis dépose le fichier ici.",
            "Your collection is on Pokécardex? Export it (Mon compte → Exporter ma collection), then drop the file here.",
          )}
        </p>
        <div className={styles.saveActions}>
          <button
            className={styles.btnBig}
            onClick={() => {
              sfx.click();
              file.current?.click();
            }}
          >
            {tr("⬆ Importer depuis Pokécardex", "⬆ Import from Pokécardex")}
          </button>
        </div>
        {input}
      </div>
    );

  if (step === "reading")
    return (
      <div className={styles.importBox}>
        <p>
          {tr("Je range tes cartes…", "Filing your cards…")} <b>{progress[0]}</b>/{progress[1]} {tr("extensions", "sets")}
        </p>
      </div>
    );

  // the report, in its own window over the OS
  return (
    <div className={styles.importBox}>
      <p>{tr("Ta collection est lue, choisis où la ranger…", "Your collection is read, choose where it goes…")}</p>
      <AnimatePresence>
        {step === "report" && result && (
          <ImportReport
            result={result}
            room={room}
            onShelf={onShelf}
            initial={shelf}
            onConfirm={confirm}
            onCancel={() => {
              sfx.click();
              setStep("idle");
              setResult(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
