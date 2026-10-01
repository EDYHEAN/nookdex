"use client";

import { useState } from "react";
import styles from "./LegalPage.module.css";
import { useT } from "@/lib/lang";

// values as the contact route expects them (the e-mail to Johan is in French), labels in the visitor's language
const TOPICS = [
  ["Question", "Question"],
  ["Bug", "Bug"],
  ["Idée", "Idea"],
  ["Supprimer mon compte / mes données", "Delete my account / my data"],
] as const;

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const t = useT();
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

  if (state === "sent")
    return <p className={styles.notice}>{t("Message envoyé, merci ! Réponse par e-mail dès que possible.", "Message sent, thanks! We'll answer by e-mail as soon as we can.")}</p>;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void send(e.currentTarget);
      }}
    >
      <label>
        {t("Ton e-mail", "Your e-mail")}
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        {t("Sujet", "Subject")}
        <select name="topic" defaultValue={TOPICS[0][0]}>
          {TOPICS.map(([fr, en]) => (
            <option key={fr} value={fr}>
              {t(fr, en)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Message
        <textarea name="message" required rows={6} maxLength={4000} />
      </label>
      <input name="_honey" type="text" tabIndex={-1} autoComplete="off" className={styles.honey} aria-hidden />
      <button disabled={state === "sending"}>{state === "sending" ? t("Envoi…", "Sending…") : t("Envoyer", "Send")}</button>
      {state === "error" && (
        <p className={styles.notice}>
          {t("L'envoi a échoué. Réessaie dans un moment.", "Sending failed. Try again in a moment.")}
          {reason && (
            <>
              <br />
              <small>
                {t("Détail :", "Detail:")} {reason}
              </small>
            </>
          )}
        </p>
      )}
    </form>
  );
}
