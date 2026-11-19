import type { ReactNode } from "react";

import { SITE } from "@/lib/site";
import { AppShell } from "./AppShell";

/** Shared layout for the legal pages: a readable column of text on a glass card. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AppShell title={title} subtitle={`Última atualização: ${SITE.legalUpdated}`}>
      <article className="glass mx-auto max-w-3xl space-y-6 rounded-3xl px-5 py-8 text-[15px] leading-relaxed text-foreground/90 sm:px-10 sm:py-10 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:pt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_section]:space-y-3 [&_ul]:space-y-1.5">
        {children}
      </article>
    </AppShell>
  );
}

export function ContactLink() {
  return <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;
}
