"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signInWithGoogle, supabase } from "@/lib/cloud";
import { SOCIAL_RENDERS, STUDIO_EMAIL_HASHES } from "@/lib/site";
import { sfx } from "@/lib/sound";
import { Spots } from "./Spots";
import styles from "./Studio.module.css";

/** instagram: the carousel; reels: the video as an Instagram Reel; tiktok: the video */
type Platform = "instagram" | "reels" | "tiktok";
interface Post {
  id: string;
  date: string;
  time: string | null;
  platforms: Platform[];
  kind: "news" | "fact" | "fun" | "feature" | null;
  format: "post" | "story" | "reel";
  title: string;
  note: string | null;
  caption: string;
  captionTiktok: string | null;
  prices: boolean;
  slides: string[];
  /** TikTok's photo mode: 9:16 pictures */
  photos?: string[];
  tiktokAs?: "photos" | "video";
  video: string | null;
  tiktok: string | null;
}

const KIND = { news: "news", fact: "chiffre", fun: "fun", feature: "NookDex" } as const;
const PLATFORM: Record<Platform, string> = { instagram: "Insta", reels: "Reel", tiktok: "TikTok" };
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const today = () => new Date().toLocaleDateString("sv");
/** the Monday of a date's week */
const monday = (d: string) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toLocaleDateString("sv");
};
/** 5 hashtags at most (Johan, 2026-10-16): the first five are kept, the others dropped, also in posts written before ("#1" is a rank) */
const MAX_TAGS = 5;
const fewerTags = (caption: string) => {
  let n = 0;
  return caption
    .replace(/(^|\s)#[\p{L}_][\p{L}\p{N}_]*/gu, (tag) => (++n <= MAX_TAGS ? tag : ""))
    .replace(/[ \t]+$/gm, "")
    .trimEnd();
};
const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toLowerCase())))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/**
 * What was posted, from Supabase (social_done, Johan only): read again whenever the page comes back in view, so a tick
 * made on the phone shows on the computer. Ticks made while it can't be reached wait on this device and are sent
 * as soon as it can.
 */
const PENDING = "nookdex:studio-pending";
const readPending = (): [string, boolean][] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING) ?? "[]");
  } catch {
    return [];
  }
};
const writePending = (p: [string, boolean][]) => {
  try {
    localStorage.setItem(PENDING, JSON.stringify(p));
  } catch {}
};
const save = (key: string, on: boolean) => {
  const [post_id, platform] = key.split("|");
  return on ? supabase.from("social_done").upsert({ post_id, platform }) : supabase.from("social_done").delete().match({ post_id, platform });
};

function useDone(on: boolean) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    const load = async () => {
      // the ticks of the first version, kept on the device only: sent once
      try {
        const old: string[] = JSON.parse(localStorage.getItem("nookdex:studio-done") ?? "[]");
        if (old.length) writePending([...readPending(), ...old.map((k): [string, boolean] => [k, true])]);
        localStorage.removeItem("nookdex:studio-done");
      } catch {}
      // the ticks made offline first, then the truth from the server
      const pending = readPending();
      const sent = await Promise.all(pending.map(([k, v]) => save(k, v).then(({ error }) => !error)));
      writePending(pending.filter((_, i) => !sent[i]));
      const { data, error } = await supabase.from("social_done").select("post_id, platform");
      if (!alive) return;
      setOnline(!error);
      if (error) return;
      const next = new Set((data ?? []).map((r) => `${r.post_id}|${r.platform}`));
      for (const [k, v] of readPending()) if (v) next.add(k);
      else next.delete(k);
      setDone(next);
    };
    void load();
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [on]);
  const toggle = (id: string, p: Platform) => {
    const key = `${id}|${p}`;
    const value = !done.has(key);
    const next = new Set(done);
    if (value) next.add(key);
    else next.delete(key);
    setDone(next);
    void save(key, value).then(({ error }) => {
      setOnline(!error);
      if (error) writePending([...readPending().filter(([k]) => k !== key), [key, value]]);
    });
  };
  return { done, toggle, online };
}

/** dev screenshots: ?dev opens it without signing in */
const DEV = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && /[?&]dev\b/.test(window.location.search);

export function Studio() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [hashOk, setHashOk] = useState(false);
  const allowed = hashOk || (DEV && email === "dev");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [past, setPast] = useState(false);
  /** the zoom / find spots to draw (Spots.tsx) */
  const [zones, setZones] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { done, toggle, online } = useDone(allowed);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(DEV ? "dev" : (data.session?.user.email ?? null)));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!email || email === "dev") return;
    void sha256(email).then((h) => setHashOk(STUDIO_EMAIL_HASHES.includes(h)));
  }, [email]);
  useEffect(() => {
    if (!allowed) return;
    fetch(`${SOCIAL_RENDERS}index.json?t=${Date.now()}`)
      .then((r) => r.json())
      .then((j) => {
        setPosts((j.posts as Post[]).map((p) => ({ ...p, caption: fewerTags(p.caption), captionTiktok: p.captionTiktok && fewerTags(p.captionTiktok) })));
        // today's post (or the next one) opens by itself
        const next = (j.posts as Post[]).find((p) => p.date >= today());
        if (next) setOpen(next.id);
      })
      .catch(() => setFailed(true));
  }, [allowed]);

  const weeks = useMemo(() => {
    const list = (posts ?? []).filter((p) => (past ? p.date < today() : p.date >= today()));
    if (past) list.reverse();
    const out = new Map<string, Post[]>();
    for (const p of list) out.set(monday(p.date), [...(out.get(monday(p.date)) ?? []), p]);
    return [...out.entries()];
  }, [posts, past]);

  if (email === undefined) return <Shell />;
  if (!allowed)
    return (
      <Shell>
        <div className={styles.gate}>
          <h1>Studio</h1>
          <p>{email ? "Cette page est réservée à l'équipe de NookDex." : "Les posts Insta et TikTok de la semaine, prêts à partager."}</p>
          {!email && (
            <button
              className={styles.big}
              onClick={() => {
                sfx.click();
                void signInWithGoogle();
              }}
            >
              Se connecter avec Google
            </button>
          )}
        </div>
      </Shell>
    );

  const next = new Date(`${monday(today())}T12:00:00`);
  next.setDate(next.getDate() + 7);
  const todo = (posts ?? []).filter((p) => p.date >= today() && p.date < next.toLocaleDateString("sv")).length;
  return (
    <Shell>
      <header className={styles.head}>
        <h1>Studio</h1>
        <p>
          {posts ? `${todo} post${todo > 1 ? "s" : ""} cette semaine` : failed ? "Impossible de lire les posts." : "Chargement…"}
          {!online && posts && <span className={styles.warn}> · hors ligne : les coches partiront dès que possible</span>}
        </p>
        <div className={styles.tabs}>
          <button className={!past && !zones ? styles.on : ""} onClick={() => (setPast(false), setZones(false))}>
            À venir
          </button>
          <button className={past && !zones ? styles.on : ""} onClick={() => (setPast(true), setZones(false))}>
            Passés
          </button>
          <button className={zones ? styles.on : ""} onClick={() => setZones(true)}>
            Zones
          </button>
        </div>
      </header>
      {zones && <Spots />}
      {!zones && weeks.map(([week, list]) => (
        <section key={week} className={styles.week}>
          <h2>Semaine du {day(week).replace(/^\S+ /, "")}</h2>
          {list.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              open={open === p.id}
              onOpen={() => {
                sfx.click();
                setOpen(open === p.id ? null : p.id);
              }}
              done={done}
              onToggle={toggle}
            />
          ))}
        </section>
      ))}
    </Shell>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

/** The files of a post, downloaded once it opens: Safari only shares files it already holds when the button is tapped. */
function useFiles(urls: string[], on: boolean) {
  const [files, setFiles] = useState<File[] | null>(null);
  const key = urls.join("|");
  const started = useRef("");
  useEffect(() => {
    if (!on || !urls.length || started.current === key) return;
    started.current = key;
    void Promise.all(
      urls.map(async (u) => {
        const blob = await (await fetch(SOCIAL_RENDERS + u)).blob();
        const name = u.replace("/", "-");
        const type = name.endsWith(".mp4") ? "video/mp4" : "image/jpeg";
        return new File([blob], name, { type });
      }),
    )
      .then(setFiles)
      .catch(() => setFiles(null));
  }, [on, key, urls]);
  return files;
}

function PostCard({ post, open, onOpen, done, onToggle }: { post: Post; open: boolean; onOpen: () => void; done: Set<string>; onToggle: (id: string, p: Platform) => void }) {
  const slides = useFiles(post.slides, open);
  const photos = useFiles(post.photos ?? [], open);
  const [wantVideo, setWantVideo] = useState(false);
  const video = useFiles(post.tiktok ? [post.tiktok] : [], open && wantVideo);
  // GitHub serves videos as plain bytes, which a <video> won't play: shown from the downloaded file
  const videoUrl = useMemo(() => (video ? URL.createObjectURL(video[0]) : null), [video]);
  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);
  // the videos of a carousel, played from the downloaded files too
  const slideUrls = useMemo(() => slides?.map((f) => (f.type === "video/mp4" ? URL.createObjectURL(f) : null)) ?? [], [slides]);
  useEffect(() => () => slideUrls.forEach((u) => u && URL.revokeObjectURL(u)), [slideUrls]);
  const [note, setNote] = useState<string | null>(null);
  const isToday = post.date === today();
  const allDone = post.platforms.every((p) => done.has(`${post.id}|${p}`));

  const say = (m: string) => {
    setNote(m);
    setTimeout(() => setNote((n) => (n === m ? null : n)), 2200);
  };
  const copy = async (text: string, msg = "légende copiée ✓") => {
    try {
      await navigator.clipboard.writeText(text);
      sfx.pop();
      say(msg);
    } catch {
      say("copie impossible");
    }
  };
  /** shares the files (the phone's sheet: save, Instagram, TikTok…); the caption is copied first, apps drop shared text */
  const share = async (files: File[] | null, caption: string) => {
    if (!files) return;
    if (caption) void navigator.clipboard?.writeText(caption).catch(() => {});
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files });
        sfx.coin();
      } catch {}
      return;
    }
    // a computer: each file downloaded
    for (const f of files) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    say("téléchargé ✓");
  };

  return (
    <article className={`${styles.post} ${isToday ? styles.today : ""} ${allDone ? styles.done : ""}`}>
      <button className={styles.row} onClick={onOpen} aria-expanded={open}>
        {post.slides[0] || post.photos?.[0] || post.video || post.tiktok ? (
          post.slides[0] || post.photos?.[0] ? (
            <img className={styles.thumb} src={SOCIAL_RENDERS + (post.slides[0] ?? post.photos![0])} alt="" loading="lazy" />
          ) : (
            <span className={`${styles.thumb} ${styles.thumbVideo}`}>▶</span>
          )
        ) : (
          <span className={styles.thumb} />
        )}
        <span className={styles.info}>
          <span className={styles.date}>
            {isToday ? "aujourd'hui" : day(post.date)}
            {post.time && ` · ${post.time}`}
            {post.kind && <i className={styles[`k_${post.kind}`]}>{KIND[post.kind]}</i>}
            {post.format !== "post" && <i className={styles.k_format}>{post.format}</i>}
          </span>
          <b>{post.title}</b>
        </span>
      </button>
      <div className={styles.status}>
        {post.platforms.map((p) => {
          const on = done.has(`${post.id}|${p}`);
          return (
            <button
              key={p}
              className={on ? styles.posted : ""}
              onClick={() => {
                sfx[on ? "minus" : "plus"]();
                onToggle(post.id, p);
              }}
            >
              {on ? "✓" : "○"} {PLATFORM[p]}
            </button>
          );
        })}
      </div>

      {open && (
        <div className={styles.body}>
          {post.note && <p className={styles.note}>{post.note}</p>}
          {post.slides.length > 0 && (
            <div className={`${styles.slides} ${post.format === "story" ? styles.story : ""}`}>
              {post.slides.map((s, i) =>
                s.endsWith(".mp4") ? (
                  slideUrls[i] ? (
                    <video key={s} src={slideUrls[i]!} autoPlay muted loop playsInline />
                  ) : (
                    <span key={s} className={styles.slideVideo}>
                      ▶
                    </span>
                  )
                ) : (
                  <img key={s} src={SOCIAL_RENDERS + s} alt="" loading="lazy" />
                ),
              )}
            </div>
          )}
          {(post.photos?.length ?? 0) > 0 && (
            <div className={`${styles.slides} ${styles.story}`}>
              {post.photos!.map((s) => (
                <img key={s} src={SOCIAL_RENDERS + s} alt="" loading="lazy" />
              ))}
            </div>
          )}
          {videoUrl && <video className={styles.video} src={videoUrl} controls playsInline />}

          <div className={styles.actions}>
            {post.platforms.includes("instagram") && post.slides.length > 0 && (
              <button className={styles.big} disabled={!slides} onClick={() => void share(slides, post.caption)}>
                {slides ? `📲 ${post.slides.length > 1 ? `Les ${post.slides.length} slides` : "L'image"} → Insta` : "préparation…"}
              </button>
            )}
            {(post.photos?.length ?? 0) > 0 && (
              <button className={styles.big} disabled={!photos} onClick={() => void share(photos, post.captionTiktok ?? post.caption)}>
                {photos ? `📲 Les ${post.photos!.length} photos → TikTok` : "préparation…"}
              </button>
            )}
            {post.tiktok &&
              (wantVideo ? (
                <button className={styles.big} disabled={!video} onClick={() => void share(video, post.captionTiktok ?? post.caption)}>
                  {video ? `🎵 La vidéo → ${(post.platforms.includes("reels") || post.video ? (post.platforms.includes("tiktok") && post.tiktokAs !== "photos" ? "Reel / TikTok" : "Reel") : "TikTok")}` : "téléchargement de la vidéo…"}
                </button>
              ) : (
                <button
                  className={styles.big}
                  onClick={() => {
                    sfx.click();
                    setWantVideo(true);
                  }}
                >
                  🎵 Préparer la vidéo → {(post.platforms.includes("reels") || post.video ? (post.platforms.includes("tiktok") && post.tiktokAs !== "photos" ? "Reel / TikTok" : "Reel") : "TikTok")}
                </button>
              ))}
          </div>
          <p className={styles.hint}>La légende est copiée en même temps : colle-la dans l&apos;appli.</p>

          {post.caption && (
            <div className={styles.caption}>
              <pre>{post.caption}</pre>
              <button onClick={() => void copy(post.caption)}>Copier la légende</button>
              {post.captionTiktok && <button onClick={() => void copy(post.captionTiktok!, "légende TikTok copiée ✓")}>Copier la légende TikTok</button>}
            </div>
          )}
          {note && <p className={styles.toast}>{note}</p>}
        </div>
      )}
    </article>
  );
}
