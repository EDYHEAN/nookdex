"use client";

import { useState } from "react";
import { supabase } from "@/lib/cloud";
import { CONTACT_ENDPOINT, SITE_NAME } from "@/lib/site";
import styles from "./LegalPage.module.css";

const TOPICS = ["Question", "Bug", "Idée", "Supprimer mon compte / mes données"];

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  /** Why the message could not be saved. */
  const [reason, setReason] = useState<string | null>(null);

  const send = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    if (data.get("_honey")) return; // robots fill the hidden field
    setState("sending");
    setReason(null);
    const msg = {
      email: String(data.get("email") ?? "").trim(),
      topic: String(data.get("topic") ?? ""),
      message: String(data.get("message") ?? "").trim(),
    };

    // 1. Kept in the Supabase table "contact_messages" (read from the dashboard): the message is never lost.
    const { error } = await supabase.from("contact_messages").insert(msg);
    if (error) {
      console.warn("[contact]", error);
      setReason(error.message);
      setState("error");
      return;
    }
    setState("sent");
    form.reset();

    // 2. Also forwarded by e-mail when FormSubmit answers (best effort: the message is already saved).
    fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email: msg.email,
        sujet: msg.topic,
        message: msg.message,
        _subject: `${SITE_NAME} · ${msg.topic}`,
        _replyto: msg.email,
        _template: "box",
      }),
    }).catch((e) => console.warn("[contact] e-mail copy", e));
  };

  if (state === "sent") return <p className={styles.notice}>Message envoyé, merci ! Réponse par e-mail dès que possible.</p>;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void send(e.currentTarget);
      }}
    >
      <label>
        Ton e-mail
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        Sujet
        <select name="topic" defaultValue={TOPICS[0]}>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Message
        <textarea name="message" required rows={6} maxLength={4000} />
      </label>
      <input name="_honey" type="text" tabIndex={-1} autoComplete="off" className={styles.honey} aria-hidden />
      <button disabled={state === "sending"}>{state === "sending" ? "Envoi…" : "Envoyer"}</button>
      {state === "error" && (
        <p className={styles.notice}>
          L&apos;envoi a échoué. Réessaie dans un moment.
          {reason && (
            <>
              <br />
              <small>Détail : {reason}</small>
            </>
          )}
        </p>
      )}
    </form>
  );
}
