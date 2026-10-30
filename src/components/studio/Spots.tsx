"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadIndex, useSets } from "@/lib/catalog";
import { supabase } from "@/lib/cloud";
import { type Row, rowsOf, searchRows } from "@/lib/search";
import { SOCIAL_RENDERS } from "@/lib/site";
import { sfx } from "@/lib/sound";
import styles from "./Studio.module.css";

/**
 * The zoom / find spots of the social games (docs/social.md), drawn by Johan on a card's scan (Johan, 2026-10-30: the
 * routine can't look at pictures, so each spot was used once and the games stopped). Kept in Supabase `social_spots`;
 * scripts/social/render.mjs copies them to renders/spots.json on the social branch with the posts that used them,
 * which is what the routine reads.
 */
export interface Spot {
  id: number;
  card: string;
  kind: "zoom" | "find";
  /** [x, y, w, h] in the 600×825 scan, as the zoom and find slides take them */
  rect: [number, number, number, number];
  label: string | null;
  created_at: string;
}
type Rect = Spot["rect"];

const W = 600;
const H = 825;
/** what the find slide covers: the card's name, its attacks, the flavour text (render.mjs `find`), in % of the height */
const MASKS = [
  [2.2, 6.6],
  [59, 17],
  [84.5, 11],
] as const;
const BEST = new Set(["special", "illus", "secret"]);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const scan = (img: string, assets: string, size: "low" | "high") => `${img.startsWith("http") ? "" : assets}${img}/${size}.webp`;

/** ?dev (no sign-in, localhost): the spots stay on this device, Supabase would refuse the writes */
const DEV = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && /[?&]dev\b/.test(window.location.search);
const DEV_KEY = "nookdex:studio-spots-dev";
const devList = (): Spot[] => {
  try {
    return JSON.parse(localStorage.getItem(DEV_KEY) ?? "[]");
  } catch {
    return [];
  }
};
const devSave = (list: Spot[]) => {
  try {
    localStorage.setItem(DEV_KEY, JSON.stringify(list));
  } catch {}
};

export function Spots() {
  const assets = useSets((s) => s.assets);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [seed, setSeed] = useState(0);
  const [picked, setPicked] = useState<Row | null>(null);
  const [kind, setKind] = useState<Spot["kind"]>("zoom");
  const [rect, setRect] = useState<Rect | null>(null);
  const [label, setLabel] = useState("");
  const [spots, setSpots] = useState<Spot[]>(() => (DEV ? devList() : []));
  const [used, setUsed] = useState<Record<number, string[]>>({});
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void loadIndex("fr").then((list) => setRows(rowsOf(list)), () => setNote("index des cartes introuvable"));
    if (!DEV)
      void supabase
        .from("social_spots")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => (error ? setNote("zones illisibles : la table social_spots existe ?") : setSpots((data ?? []) as Spot[])));
    // which posts used them: written by the renders (a day late at most)
    fetch(`${SOCIAL_RENDERS}spots.json?t=${Date.now()}`)
      .then((r) => r.json())
      .then((j: { spots: { id: number; used: string[] }[] }) => setUsed(Object.fromEntries(j.spots.map((s) => [s.id, s.used]))))
      .catch(() => {});
  }, []);

  const byKey = useMemo(() => new Map((rows ?? []).map((r) => [r.key, r])), [rows]);
  /** a search, else a handful of beautiful recent cards drawn at random (🎲 draws others) */
  const shown = useMemo(() => {
    if (!rows) return [];
    if (q.trim()) return searchRows(rows, q, 400).sort((a, b) => b.rank - a.rank).slice(0, 24);
    // a game is « quel Pokémon ? »: no gold Energies
    const pool = rows.filter((r) => BEST.has(r.tier) && r.date >= "2023" && !r.name.startsWith("Énergie"));
    let s = seed * 9301 + 49297;
    const out: Row[] = [];
    for (let i = 0; i < 12 && pool.length; i++) {
      s = (s * 9301 + 49297) % 233280;
      out.push(pool[Math.floor((s / 233280) * pool.length)]);
    }
    return out;
  }, [rows, q, seed]);

  const say = (m: string) => {
    setNote(m);
    setTimeout(() => setNote((n) => (n === m ? null : n)), 2400);
  };

  const pick = (r: Row) => {
    sfx.flip();
    setPicked(r);
    setRect(null);
    setLabel("");
    window.scrollTo({ top: 0 });
  };

  const keep = async () => {
    if (!picked || !rect) return;
    const row = { card: picked.key, kind, rect: rect.map(Math.round) as Rect, label: label.trim() || null };
    if (DEV) {
      const spot = { ...row, id: Date.now(), created_at: new Date().toISOString() };
      devSave([spot, ...devList()]);
      setSpots((l) => [spot, ...l]);
    } else {
      const { data, error } = await supabase.from("social_spots").insert(row).select().single();
      if (error) return (sfx.locked(), say("pas enregistrée : " + error.message));
      setSpots((l) => [data as Spot, ...l]);
    }
    sfx.stamp();
    say("zone gardée ✓");
    setRect(null);
    setLabel("");
  };

  const drop = async (id: number) => {
    if (DEV) devSave(devList().filter((s) => s.id !== id));
    else {
      const { error } = await supabase.from("social_spots").delete().eq("id", id);
      if (error) return (sfx.locked(), say("pas supprimée"));
    }
    sfx.minus();
    setSpots((l) => l.filter((s) => s.id !== id));
  };

  return (
    <div className={styles.spots}>
      {picked ? (
        <section className={styles.editor}>
          <div className={styles.kinds}>
            {(["zoom", "find"] as const).map((k) => (
              <button
                key={k}
                className={kind === k ? styles.on : ""}
                onClick={() => {
                  sfx.click();
                  setKind(k);
                  setRect(null);
                }}
              >
                {k === "zoom" ? "🔍 Zoom" : "🫥 Pokémon flou"}
              </button>
            ))}
            <button className={styles.ghost} onClick={() => (sfx.click(), setPicked(null))}>
              ✕
            </button>
          </div>
          <p className={styles.hint}>
            {kind === "zoom" ? "Trace le carré du gros plan avec le doigt (jamais la tête : trop facile)." : "Entoure le Pokémon : il sera flouté, le nom et les attaques cachés."}
          </p>
          <Canvas src={scan(picked.img, assets, "high")} kind={kind} rect={rect} onRect={setRect} />
          {rect && (
            <div className={styles.keep}>
              {kind === "zoom" && <Crop src={scan(picked.img, assets, "high")} rect={rect} width={120} />}
              <div>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="indice pour la routine (ex. la queue)" maxLength={60} />
                <button className={styles.big} onClick={() => void keep()}>
                  Garder cette zone ✓
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section>
          <div className={styles.search}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="une carte : nom, numéro, set…" enterKeyHint="search" />
            <button onClick={() => (sfx.riffle(), setQ(""), setSeed((s) => s + 1))} aria-label="D'autres cartes au hasard">
              🎲
            </button>
          </div>
          {!rows && <p className={styles.hint}>chargement des cartes…</p>}
          <div className={styles.picks}>
            {shown.map((r, i) => (
              <button key={`${r.key}-${i}`} onClick={() => pick(r)} title={`${r.name} · ${r.setName}`}>
                <img src={scan(r.img, assets, "low")} alt={r.name} loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        </section>
      )}

      <h2 className={styles.spotsHead}>
        En réserve · {spots.filter((s) => !used[s.id]?.length).length} prête{spots.filter((s) => !used[s.id]?.length).length > 1 ? "s" : ""}
      </h2>
      <div className={styles.saved}>
        {spots.map((s) => {
          const r = byKey.get(s.card);
          const usedBy = used[s.id] ?? [];
          return (
            <figure key={s.id} className={usedBy.length ? styles.usedSpot : ""}>
              {r && (s.kind === "zoom" ? <Crop src={scan(r.img, assets, "low")} rect={s.rect} width={96} /> : <FindThumb src={scan(r.img, assets, "low")} rect={s.rect} />)}
              <figcaption>
                <b>{s.kind === "zoom" ? "🔍" : "🫥"} {r?.name ?? s.card}</b>
                <span>{usedBy.length ? `utilisée ${usedBy[0].slice(5, 10).split("-").reverse().join("/")}` : (s.label ?? "prête")}</span>
              </figcaption>
              <DropButton onDrop={() => void drop(s.id)} />
            </figure>
          );
        })}
      </div>
      {note && <p className={styles.toast}>{note}</p>}
    </div>
  );
}

/** The scan, a rectangle drawn on it with a finger or the mouse; dragging inside it moves it. */
function Canvas({ src, kind, rect, onRect }: { src: string; kind: Spot["kind"]; rect: Rect | null; onRect: (r: Rect | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "draw" | "move"; x: number; y: number; from: Rect | null } | null>(null);
  const [width, setWidth] = useState(360);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** a pointer's place in the 600×825 scan */
  const at = (e: React.PointerEvent) => {
    const b = box.current!.getBoundingClientRect();
    return { x: clamp(((e.clientX - b.left) / b.width) * W, 0, W), y: clamp(((e.clientY - b.top) / b.height) * H, 0, H) };
  };
  const down = (e: React.PointerEvent) => {
    const p = at(e);
    box.current!.setPointerCapture(e.pointerId);
    const inside = rect && p.x >= rect[0] && p.x <= rect[0] + rect[2] && p.y >= rect[1] && p.y <= rect[1] + rect[3];
    drag.current = { mode: inside ? "move" : "draw", x: p.x, y: p.y, from: rect };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = at(e);
    if (d.mode === "move" && d.from) {
      const [x, y, w, h] = d.from;
      return onRect([clamp(x + p.x - d.x, 0, W - w), clamp(y + p.y - d.y, 0, H - h), w, h]);
    }
    let dx = p.x - d.x;
    let dy = p.y - d.y;
    // a zoom fills the post's 4:5 picture: the drag sets the width, the height follows
    if (kind === "zoom") {
      const w = Math.max(Math.abs(dx), (Math.abs(dy) * 4) / 5);
      const room = Math.min(dx < 0 ? d.x : W - d.x, ((dy < 0 ? d.y : H - d.y) * 4) / 5);
      dx = Math.sign(dx || 1) * Math.min(w, room);
      dy = (Math.sign(dy || 1) * Math.abs(dx) * 5) / 4;
    }
    onRect([Math.min(d.x, d.x + dx), Math.min(d.y, d.y + dy), Math.abs(dx), Math.abs(dy)]);
  };
  const up = () => {
    drag.current = null;
    if (rect && (rect[2] < 40 || rect[3] < 40)) onRect(null);
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div ref={box} className={styles.canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <img src={src} alt="" draggable={false} />
      {kind === "find" &&
        MASKS.map(([top, h]) => (
          <span key={top} className={styles.mask} style={{ top: `${top}%`, height: `${h}%` }}>
            caché
          </span>
        ))}
      {rect && (
        <span
          className={kind === "zoom" ? styles.zoomRect : styles.findRect}
          style={{
            left: pct(rect[0], W),
            top: pct(rect[1], H),
            width: pct(rect[2], W),
            height: pct(rect[3], H),
            // the find slide's blur (9 px on its 843 px card), at this size
            backdropFilter: kind === "find" ? `blur(${(9 * width) / 843}px)` : undefined,
          }}
        />
      )}
    </div>
  );
}

/** What the zoom slide shows: the rectangle filling a 4:5 picture. */
function Crop({ src, rect, width }: { src: string; rect: Rect; width: number }) {
  const k = width / rect[2];
  return (
    <span
      className={styles.crop}
      style={{ width, height: (width * 5) / 4, backgroundImage: `url(${src})`, backgroundSize: `${W * k}px auto`, backgroundPosition: `-${rect[0] * k}px -${rect[1] * k}px` }}
    />
  );
}

function FindThumb({ src, rect }: { src: string; rect: Rect }) {
  return (
    <span className={styles.findThumb}>
      <img src={src} alt="" loading="lazy" />
      <span style={{ left: `${(rect[0] / W) * 100}%`, top: `${(rect[1] / H) * 100}%`, width: `${(rect[2] / W) * 100}%`, height: `${(rect[3] / H) * 100}%` }} />
    </span>
  );
}

/** ✕, then « sûr ? » for 3 s: a spot isn't lost by a slip of the thumb */
function DropButton({ onDrop }: { onDrop: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 3000);
    return () => clearTimeout(t);
  }, [sure]);
  return (
    <button className={styles.drop} onClick={() => (sure ? onDrop() : (sfx.click(), setSure(true)))}>
      {sure ? "sûr ?" : "✕"}
    </button>
  );
}
