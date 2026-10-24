"use client";

import { create } from "zustand";
import { supabase, useCloud } from "./cloud";
import { currentLang } from "./lang";

/**
 * « Le courrier du lundi » by e-mail (scripts/monday-mail.mjs): a yes is a row in Supabase mail_optin, the player's own
 * (RLS), never ticked for them. Asked in NookDex OS → Sauvegarde once signed in, or on the account card before it (kept
 * on this device until the sign-in lands, then written). The unsubscribe link in each mail removes the row.
 */

const WISH_KEY = "nookdex:mail-wish";

/** null: unknown (no account, or not read yet) */
export const useMailOptin = create<{ on: boolean | null; busy: boolean }>(() => ({ on: null, busy: false }));

const wished = () => {
  try {
    return localStorage.getItem(WISH_KEY) === "1";
  } catch {
    return false;
  }
};

/** The account card's box, before there's an account: written once signed in */
export function wishMailOptin(on: boolean) {
  try {
    if (on) localStorage.setItem(WISH_KEY, "1");
    else localStorage.removeItem(WISH_KEY);
  } catch {}
}

async function userId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Yes or no to the Monday mail (signed in): false when it couldn't be written */
export async function setMailOptin(on: boolean): Promise<boolean> {
  const id = await userId();
  if (!id) return false;
  useMailOptin.setState({ busy: true });
  const { error } = on
    ? await supabase.from("mail_optin").upsert({ user_id: id, lang: currentLang() }, { onConflict: "user_id" })
    : await supabase.from("mail_optin").delete().eq("user_id", id);
  useMailOptin.setState({ busy: false, ...(!error && { on }) });
  if (error) console.warn("[mail] optin", error.message);
  return !error;
}

async function refresh() {
  const id = await userId();
  if (!id) return useMailOptin.setState({ on: null });
  if (wished()) {
    // the yes given on the account card, before signing in
    if (await setMailOptin(true)) wishMailOptin(false);
    return;
  }
  const { data, error } = await supabase.from("mail_optin").select("user_id").eq("user_id", id).maybeSingle();
  useMailOptin.setState({ on: error ? null : !!data });
}

let started = false;
/** Follows the account: reads the player's answer once signed in (App mounts it, like startCloud) */
export function startMailOptin() {
  if (started) return;
  started = true;
  let email = useCloud.getState().email;
  if (email) void refresh();
  useCloud.subscribe((s) => {
    if (s.email === email) return;
    email = s.email;
    if (email) void refresh();
    else useMailOptin.setState({ on: null });
  });
}
