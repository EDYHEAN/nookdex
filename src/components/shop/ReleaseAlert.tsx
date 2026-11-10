"use client";

import { useEffect, useState } from "react";
import s from "./Shop.module.css";

/**
 * « Préviens-moi à la prochaine sortie » (lib/releaseAlert): an e-mail, a button, then « check your inbox ». The
 * confirmation link comes back with ?alerte=ok (or lien / erreur): said here, in place of the form.
 */
export function ReleaseAlert({ lang, next }: { lang: "fr" | "en"; next?: string | null }) {
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error" | "ok" | "link">("idle");

  useEffect(() => {
    const back = new URLSearchParams(window.location.search).get("alerte");
    if (!back) return;
    // the page's own state comes from its address once: the confirmation link's way back
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(back === "ok" ? "ok" : back === "lien" ? "link" : "error");
    if (back === "ok") document.getElementById("alerte")?.scrollIntoView({ block: "center" });
  }, []);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const honeypot = (new FormData(e.currentTarget).get("website") as string) || "";
    setState("busy");
    const r = await fetch("/api/alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, lang, honeypot }) }).catch(() => null);
    setState(r?.ok ? "sent" : "error");
  }

  return (
    <section id="alerte" className={s.alert} aria-live="polite">
      <span className={s.alertIcon} aria-hidden>
        📬
      </span>
      {state === "ok" ? (
        <div>
          <b>{t("C'est noté !", "You're in!")}</b>
          <p>{t("Tu recevras un e-mail le jour de la prochaine sortie.", "You'll get an e-mail on the day the next set comes out.")}</p>
        </div>
      ) : state === "sent" ? (
        <div>
          <b>{t("Regarde ta boîte mail", "Check your inbox")}</b>
          <p>{t("Un e-mail de confirmation vient de partir : un clic dedans et c'est bon.", "A confirmation e-mail is on its way: one click in it and you're set.")}</p>
        </div>
      ) : (
        <div>
          <b>{t("Préviens-moi à la prochaine sortie", "Tell me when the next set is out")}</b>
          <p>
            {next
              ? t(`Un e-mail le jour où sort ${next}, pour demander ton invitation à temps. Rien d'autre.`, `One e-mail the day ${next} comes out, to get your invite in time. Nothing else.`)
              : t("Un e-mail le jour où sort une nouvelle extension, pour demander ton invitation à temps. Rien d'autre.", "One e-mail the day a new set comes out, to get your invite in time. Nothing else.")}
          </p>
          <form className={s.alertForm} onSubmit={send}>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder={t("ton@email.fr", "you@email.com")}
              aria-label={t("Ton e-mail", "Your e-mail")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {/* robots fill it, people don't see it */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className={s.hp} />
            <button type="submit" className={`${s.btn} ${s.green}`} disabled={state === "busy"}>
              {state === "busy" ? "…" : t("Préviens-moi", "Notify me")}
            </button>
          </form>
          {(state === "error" || state === "link") && (
            <p className={s.alertErr}>
              {state === "link" ? t("Ce lien n'est plus valable : redemande-le ici.", "That link isn't valid: ask again here.") : t("Oups, ça n'est pas parti. Réessaie ?", "Oops, it didn't go through. Try again?")}
            </p>
          )}
          <small>
            {t("Désinscription en un clic dans chaque e-mail.", "Unsubscribe in one click from any e-mail.")}{" "}
            <a href="/confidentialite">{t("Confidentialité", "Privacy")}</a>
          </small>
        </div>
      )}
    </section>
  );
}
