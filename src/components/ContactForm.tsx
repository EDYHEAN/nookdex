"use client";

import { useState } from "react";
import styles from "./LegalPage.module.css";

const TOPICS = ["Question", "Bug", "Idée", "Supprimer mon compte / mes données"];

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  /** Why the message could not be saved. */
  const [reason, setReason] = useState<string | null>(null);

  const send = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    setState("sending");
    setReason(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          topic: data.get("topic"),
          message: data.get("message"),
          honeypot: data.get("_honey"),
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setReason(json?.error ?? `erreur ${res.status}`);
        setState("error");
        return;
      }
      setState("sent");
      form.reset();
    } catch (e) {
      console.warn("[contact]", e);
      setReason("serveur injoignable");
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
