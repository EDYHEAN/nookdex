import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { ContactForm } from "@/components/ContactForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact · ${SITE_NAME}`,
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <LegalPage path="/contact" title="Contact">
      <p>Une question, un bug, une idée, ou la suppression de ton compte ? Laisse un message, on te répond par e-mail.</p>
      <ContactForm />
    </LegalPage>
  );
}
