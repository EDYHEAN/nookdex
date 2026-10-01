import type { Metadata } from "next";
import { serverLang } from "@/lib/serverLang";
import { LegalPage } from "@/components/LegalPage";
import { ContactForm } from "@/components/ContactForm";
import { SITE_NAME } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await serverLang()) === "en";
  return en ? { title: `Contact · ${SITE_NAME}`, alternates: { canonical: "/contact" } } : { title: `Contact · ${SITE_NAME}`, alternates: { canonical: "/contact" } };
}

function Fr() {
  return (
    <LegalPage path="/contact" title="Contact">
      <p>Une question, un bug, une idée, ou la suppression de ton compte ? Laisse un message, on te répond par e-mail.</p>
      <ContactForm />
    </LegalPage>
  );
}

function En() {
  return (
    <LegalPage path="/contact" title="Contact" en>
      <p>A question, a bug, an idea, or deleting your account? Leave a message, we&apos;ll answer by e-mail.</p>
      <ContactForm />
    </LegalPage>
  );
}

export default async function Contact() {
  return (await serverLang()) === "en" ? <En /> : <Fr />;
}
