"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { homeFaq, translations, type Locale } from "@/data/landing";
import { SectionHeading } from "./sections";

export function Faq({ locale }: { locale: Locale }) {
  const [all, setAll] = useState(false);
  const t = translations[locale].faq;
  const shown = t.entries
    .map((item, i) => ({ ...item, i }))
    .filter(({ i }) => all || homeFaq.includes(i));
  return (
    <section id="faq" className="section section-alt" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" label={t.label} title={t.title} />
      <Accordion
        type="single"
        collapsible
        className="faq-list"
        defaultValue="question-0"
      >
        {shown.map(({ question, answer, i }) => (
          <AccordionItem value={`question-${i}`} key={i}>
            <AccordionTrigger>{question}</AccordionTrigger>
            <AccordionContent>{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {!all && (
        <button className="text-link" onClick={() => setAll(true)}>
          {t.more}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
