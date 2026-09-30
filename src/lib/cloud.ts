"use client";

import { createClient, type User } from "@supabase/supabase-js";
import { create } from "zustand";
import { loadSets, neededSets } from "./catalog";
import { type Backup, isBackup, makeBackup, useStore } from "./store";

// Public values (the table is guarded by row level security): env vars override them.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xwqhucccldraieyiycvt.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_Fn4KmAAhKl7crl-R_ZCHWw_OkFukB2i";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export type CloudStatus = "off" | "loading" | "synced" | "saving" | "error" | "conflict";

interface CloudState {
  /** The stored session was read: until then nobody knows if the player is signed in. */
  ready: boolean;
  email: string | null;
  /** First name given by Google, to suggest a nickname. */
  firstName: string | null;
  status: CloudStatus;
  /** The save found online when both it and this browser changed since the last sync. */
  conflict: Backup | null;
  savedAt: number | null;
  /** Bumped when the online save replaced the local one (the welcome screen can go). */
  restored: number;
}

export const useCloud = create<CloudState>(() => ({ ready: false, email: null, firstName: null, status: "off", conflict: null, savedAt: null, restored: 0 }));

type Synced = Pick<Backup, "profile" | "binders" | "collection">;

/** Stable JSON: Postgres jsonb does not keep key order. */
const canon = (x: unknown): string => {
  if (Array.isArray(x)) return `[${x.map(canon).join(",")}]`;
  if (x && typeof x === "object")
    return `{${Object.keys(x)
      .filter((k) => (x as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon((x as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(x ?? null);
};

const fingerprint = (s: Synced) => canon({ profile: s.profile ?? null, binders: s.binders ?? [], collection: s.collection });

/** What was last in agreement with the server, per account: tells who changed since. */
const baseKey = (userId: string) => `nookdex:cloud-base:${userId}`;
const readBase = (userId: string) => {
  try {
    return localStorage.getItem(baseKey(userId));
  } catch {
    return null;
  }
};
const writeBase = (userId: string, fp: string) => {
  try {
    localStorage.setItem(baseKey(userId), fp);
  } catch {}
};

let user: User | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let pending = false;

async function push() {
  clearTimeout(timer);
  pending = false;
  if (!user) return;
  const u = user;
  const backup = makeBackup(useStore.getState());
  const fp = fingerprint(backup);
  if (fp === readBase(u.id) && useCloud.getState().status === "synced") return;
  useCloud.setState({ status: "saving" });
  const { error } = await supabase.from("saves").upsert({ user_id: u.id, data: backup, updated_at: new Date().toISOString() });
  if (user?.id !== u.id) return;
  if (error) {
    console.warn("[cloud] save failed", error);
    useCloud.setState({ status: "error" });
    return;
  }
  writeBase(u.id, fp);
  useCloud.setState({ status: "synced", savedAt: Date.now() });
}

async function applyRemote(remote: Backup) {
  useStore.getState().importBackup(remote);
  if (user) writeBase(user.id, fingerprint(remote));
  useCloud.setState((c) => ({ status: "synced", conflict: null, savedAt: Date.now(), restored: c.restored + 1 }));
  const s = useStore.getState();
  await loadSets(neededSets(s.binders, s.collection));
}

/** Compares the online save with this browser, and with what both agreed on last time. */
async function pull() {
  if (!user) return;
  const u = user;
  if (useCloud.getState().status === "off") useCloud.setState({ status: "loading" });
  const { data, error } = await supabase.from("saves").select("data").eq("user_id", u.id).maybeSingle();
  if (user?.id !== u.id) return;
  if (error) {
    console.warn("[cloud] load failed", error);
    useCloud.setState({ status: "error" });
    return;
  }
  const remote = isBackup(data?.data) ? (data.data as Backup) : null;
  const local = useStore.getState();
  const localFp = fingerprint(local);
  if (!remote) return push();
  const remoteFp = fingerprint(remote);
  const base = readBase(u.id);
  const localEmpty = !local.binders.length && !Object.keys(local.collection).length;

  if (remoteFp === localFp) {
    writeBase(u.id, localFp);
    useCloud.setState({ status: "synced", conflict: null });
  } else if (localEmpty || localFp === base) await applyRemote(remote);
  else if (remoteFp === base) await push();
  else useCloud.setState({ status: "conflict", conflict: remote });
}

/** After a conflict: keep the online save, or overwrite it with this browser's. */
export async function resolveConflict(keep: "cloud" | "local") {
  const remote = useCloud.getState().conflict;
  if (keep === "cloud" && remote) await applyRemote(remote);
  else {
    useCloud.setState({ conflict: null });
    await push();
  }
}

export async function signIn(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  return error?.message ?? null;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  return error?.message ?? null;
}

export async function signOut() {
  await supabase.auth.signOut();
}

let started = false;

/** Listens to the account, then saves every change of the collection online (debounced). */
export function startCloud() {
  if (started) return;
  started = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user ?? null;
    if (!useCloud.getState().ready) useCloud.setState({ ready: true });
    if (next?.id === user?.id) return;
    user = next;
    clearTimeout(timer);
    pending = false;
    const meta = next?.user_metadata as { full_name?: string; name?: string } | undefined;
    const firstName = (meta?.full_name ?? meta?.name ?? "").trim().split(/\s+/)[0] || null;
    useCloud.setState({ email: next?.email ?? null, firstName, status: next ? "loading" : "off", conflict: null, savedAt: null });
    // Supabase calls from inside this callback deadlock: run them just after.
    if (next) setTimeout(() => void pull(), 0);
  });

  useStore.subscribe((s, prev) => {
    if (!user || (s.collection === prev.collection && s.binders === prev.binders && s.profile === prev.profile)) return;
    const status = useCloud.getState().status;
    if (status === "loading" || status === "conflict") return;
    clearTimeout(timer);
    pending = true;
    timer = setTimeout(() => void push(), 1500);
  });

  // Back on the tab: another device may have saved meanwhile.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !user) return;
    if (useCloud.getState().status === "synced") void pull();
  });
  // Leaving with a change still waiting: send it now.
  window.addEventListener("pagehide", () => {
    if (pending) void push();
  });
}
