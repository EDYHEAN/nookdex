"use client";

import { useState } from "react";
import { CONTACT_ENDPOINT, SITE_NAME } from "@/lib/site";
import styles from "./LegalPage.module.css";

const TOPICS = ["Question", "Bug", "Idée", "Supprimer mon compte / mes données"];

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    if (data.get("_honey")) return; // robots fill the hidden field
    setState("sending");
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          sujet: data.get("topic"),
          message: data.get("message"),
          _subject: `${SITE_NAME} · ${data.get("topic")}`,
          _replyto: data.get("email"),
          _template: "box",
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: string | boolean } | null;
      if (!res.ok || String(json?.success) !== "true") throw new Error(`contact: ${res.status}`);
      setState("sent");
      form.reset();
    } catch (e) {
      console.warn(e);
      setState("error");
    }
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
      {state === "error" && <p className={styles.notice}>L&apos;envoi a échoué. Réessaie dans un moment.</p>}
    </form>
  );
}
