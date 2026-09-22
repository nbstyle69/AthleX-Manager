import { testimonials, translations, type Locale } from "@/data/landing";
export function Testimonial({
  quote,
  name,
  role,
}: {
  quote: string;
  name: string;
  role: string;
}) {
  return (
    <figure className="testimonial-card">
      <blockquote>{quote}</blockquote>
      <figcaption>
        <strong>{name}</strong>
        <span>{role}</span>
      </figcaption>
    </figure>
  );
}
export function Testimonials({ locale }: { locale: Locale }) {
  const entries = testimonials.filter((entry) => entry.quote.trim());
  if (!entries.length) return null;
  const t = translations[locale].testimonials;
  return (
    <section
      id="zone-18"
      data-zone={18}
      className="shared-zone"
      aria-labelledby="testimonials-title"
    >
      <div className="shared-heading">
        <div className="zone-sign">
          <span>18</span>
          {t.label}
        </div>
        <h2 className="font-display" id="testimonials-title">
          {t.title}
        </h2>
      </div>
      <div className="testimonial-grid">
        {entries.map((entry, i) => (
          <Testimonial key={i} {...entry} />
        ))}
      </div>
    </section>
  );
}
