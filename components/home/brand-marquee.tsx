const message =
  "CASES THAT LOOK BETTER. FEEL BETTER. LAST LONGER. MADE FOR YOU.";

function MarqueeGroup() {
  return (
    <span className="brand-marquee-group" aria-hidden="true">
      <span>{message}</span>
      <span className="brand-marquee-dot">•</span>
      <span>{message}</span>
      <span className="brand-marquee-dot">•</span>
    </span>
  );
}

export function BrandMarquee() {
  return (
    <section className="brand-marquee" aria-label={message}>
      <div className="brand-marquee-track">
        <MarqueeGroup />
        <MarqueeGroup />
      </div>
      <p className="brand-marquee-static">{message}</p>
    </section>
  );
}
