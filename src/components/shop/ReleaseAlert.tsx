"use client";

import { useEffect, useRef, useState } from "react";
import s from "./Shop.module.css";

/** the letter: a Poké Ball seal and a green « 1 » like a new mail, a « ✓ » once confirmed */
function Letter({ done }: { done: boolean }) {
  return (
    <svg className={s.alertIcon} viewBox="0 0 64 56" aria-hidden>
      <rect x="3" y="14" width="54" height="38" rx="5" fill="#fffaf0" stroke="#2b2230" strokeWidth="3" />
      <path d="M5 50 L23 33 M55 50 L37 33" stroke="#2b2230" strokeWidth="2.5" opacity=".3" />
      <path d="M5 17 L30 36 L55 17" fill="none" stroke="#2b2230" strokeWidth="3" strokeLinejoin="round" />
      <path d="M22.5 36a7.5 7.5 0 0 1 15 0z" fill="#e0533f" />
      <path d="M22.5 36a7.5 7.5 0 0 0 15 0z" fill="#fff" />
      <circle cx="30" cy="36" r="7.5" fill="none" stroke="#2b2230" strokeWidth="2.5" />
      <path d="M22.5 36h15" stroke="#2b2230" strokeWidth="2" />
      <circle cx="30" cy="36" r="2.4" fill="#fff" stroke="#2b2230" strokeWidth="2" />
      <circle cx="54" cy="12" r="9" fill="#8fdc7a" stroke="#2b2230" strokeWidth="3" />
      {done ? (
        <path d="M50 12 l3 3.2 l5.5 -6.4" fill="none" stroke="#2b2230" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <text x="54" y="12.5" textAnchor="middle" dominantBaseline="central" style={{ font: "9px var(--font-press), monospace" }} fill="#2b2230">
          1
        </text>
      )}
    </svg>
  );
}

/**
 * « Préviens-moi à la prochaine sortie » (lib/releaseAlert): an e-mail, a button, then « check your inbox ». The
 * confirmation link comes back with ?alerte=ok (or lien / erreur): said here, in place of the form. A night note under
 * the lamp so it stands out on the paper; its button green (NookDex's own ask, never Amazon's yellow).
 */
export function ReleaseAlert({ lang, next, when }: { lang: "fr" | "en"; next?: string | null; when?: string | null }) {
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error" | "ok" | "link">("idle");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const back = new URLSearchParams(window.location.search).get("alerte");
    if (!back) return;
    // the page's own state comes from its address once: the confirmation link's way back
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(back === "ok" ? "ok" : back === "lien" ? "link" : "error");
    if (back === "ok") document.getElementById("alerte")?.scrollIntoView({ block: "center" });
  }, []);

  // the hero's « ↓ » link: the field ready to type in, one tap less
  useEffect(() => {
    const go = () => {
      if (window.location.hash === "#alerte") field.current?.focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const honeypot = (new FormData(e.currentTarget).get("website") as string) || "";
    setState("busy");
    const r = await fetch("/api/alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, lang, honeypot }) }).catch(() => null);
    setState(r?.ok ? "sent" : "error");
  }

  const set = next ? (
    <>
      <b>{next}</b>
      {when && ` (${when})`}
    </>
  ) : (
    t("une nouvelle extension", "a new set")
  );

  return (
    // data-sticky-stop: the phone's Amazon bar steps aside while the form is on screen (StickyBuy)
    <section id="alerte" className={s.alert} data-state={state} data-sticky-stop aria-live="polite">
      <Letter done={state === "ok"} />
      {state === "ok" ? (
        <div className={s.alertHead}>
          <p className={s.alertEye}>{t("Alerte sortie", "Release alert")}</p>
          <h2 className={s.alertTitle}>{t("C'est noté !", "You're in!")}</h2>
          <p>
            {next ? (
              fr ? (
                <>
                  Rendez-vous le jour où sort <b>{next}</b>.
                </>
              ) : (
                <>
                  See you the day <b>{next}</b> comes out.
                </>
              )
            ) : (
              t("Rendez-vous le jour de la prochaine sortie.", "See you the day the next set comes out.")
            )}
          </p>
          <p className={s.alertSmall}>
            {t("Ajoute contact@nookdex.com à tes contacts : il n'ira pas dans les spams.", "Add contact@nookdex.com to your contacts so it skips spam.")}
          </p>
        </div>
      ) : state === "sent" ? (
        <div className={s.alertHead}>
          <p className={s.alertEye}>{t("Plus qu'un clic", "One click left")}</p>
          <h2 className={s.alertTitle}>{t("Regarde ta boîte mail", "Check your inbox")}</h2>
          <p>
            {t("Clique le lien de l'e-mail envoyé à ", "Click the link in the e-mail sent to ")}
            <b>{email}</b>.
          </p>
          <p className={s.alertSmall}>
            {t("Rien reçu ? Regarde les spams.", "Nothing? Check spam.")}{" "}
            <button type="button" className={s.alertRetry} onClick={() => setState("idle")}>
              {t("Changer d'adresse", "Change address")}
            </button>
          </p>
        </div>
      ) : (
        <>
          <div className={s.alertHead}>
            <p className={s.alertEye}>{t("Alerte sortie · gratuite", "Release alert · free")}</p>
            <h2 className={s.alertTitle}>{t("Préviens-moi à la prochaine sortie", "Tell me when the next set is out")}</h2>
            <p>
              {fr ? (
                <>Un e-mail le jour où sort {set}, pour demander ton invitation à temps.</>
              ) : (
                <>One e-mail the day {set} comes out, to get your invite in time.</>
              )}
            </p>
          </div>
          <form className={s.alertForm} onSubmit={send}>
            <input
              ref={field}
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
          {state === "error" || state === "link" ? (
            <p className={s.alertErr}>
              {state === "link"
                ? t("Ce lien n'est plus valable : redemande-le ici.", "That link isn't valid: ask again here.")
                : t("Oups, ça n'est pas parti. Réessaie ?", "Oops, it didn't go through. Try again?")}
            </p>
          ) : (
            <ul className={s.alertPerks}>
              <li>{t("1 e-mail par sortie", "1 e-mail per set")}</li>
              <li>{t("Zéro pub", "No ads")}</li>
              <li>{t("Désinscription en 1 clic", "1-click unsubscribe")}</li>
              <li className={s.alertNoTick}>
                <a href="/confidentialite">{t("Confidentialité", "Privacy")}</a>
              </li>
            </ul>
          )}
        </>
      )}
    </section>
  );
}
