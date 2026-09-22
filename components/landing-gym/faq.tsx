"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { translations, type Locale } from "@/data/landing";
export function Faq({ locale }: { locale: Locale }) {
  const t = translations[locale].faq;
  return (
    <section
      id="faq"
      data-zone={20}
      className="shared-zone faq-section"
      aria-labelledby="faq-title"
    >
      <div className="shared-heading">
        <div className="zone-sign">{t.label}</div>
        <h2 className="font-display" id="faq-title">
          {t.title}
        </h2>
        <p>{t.copy}</p>
      </div>
      <Accordion
        type="single"
        collapsible
        className="faq-list"
        defaultValue="question-0"
      >
        {t.entries.map((item, i) => (
          <AccordionItem value={`question-${i}`} key={i}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
