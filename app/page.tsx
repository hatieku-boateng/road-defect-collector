import type { Metadata } from "next";
import Link from "next/link";
import "./landing.css";

export const metadata: Metadata = {
  title: "Ghana Road Defect Monitoring Project",
  description:
    "Capture GPS-backed road photographs, analyse drone footage with AI, redact sensitive personal data, and map verified road defects.",
};

const stages = [
  {
    actionHref: "/collect",
    actionLabel: "Open field collector →",
    number: "01",
    title: "Collect",
    text: "Capture a GPS-backed field photo or analyse sampled drone frames.",
  },
  {
    actionHref: "/admin",
    actionLabel: "Open administrator review →",
    number: "02",
    title: "Review",
    text: "Check image quality before accepting it into the dataset.",
  },
  {
    actionHref: "/reports",
    actionLabel: "Explore public map →",
    number: "03",
    title: "Map",
    text: "View collected road records at their GPS locations on the administrator map.",
  },
];

const highlights = [
  {
    icon: "shield",
    label: "Privacy-first",
    detail: "Automatic blurring of people and vehicles before storage.",
  },
  {
    icon: "pin",
    label: "GPS-grounded",
    detail: "Each accepted record includes precise location coordinates.",
  },
  {
    icon: "check",
    label: "Human-verified",
    detail: "AI suggestions are reviewed by administrators before publication.",
  },
];

function Icon({ name }: { name: string }) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    height: 24,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.9,
    viewBox: "0 0 24 24",
    width: 24,
  };
  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg {...common}>
        <path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.5" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="lp">
      <header className="lp-header">
        <div className="lp-header-inner">
          <a aria-label="Project home" className="lp-brand" href="#top">
            <span aria-hidden="true" className="lp-brand-mark">
              GR
            </span>
            <span>
              <strong>Ghana Road Defect</strong>
              <small>Monitoring Project</small>
            </span>
          </a>

          <nav aria-label="Main" className="lp-nav">
            <a href="#process">How it works</a>
            <Link href="/reports">Public dashboard</Link>
            <Link href="/collect">Collect</Link>
            <Link href="/drone">Drone AI</Link>
            <Link className="lp-nav-cta" href="/admin">
              Admin review
            </Link>
          </nav>

          <span className="lp-status">
            <i aria-hidden="true" /> Collection module live
          </span>
        </div>
      </header>

      <section className="lp-hero" id="top">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">Safer roads through better data</p>
          <h1>
            Report roads manually or survey them <em>with AI.</em>
          </h1>
          <p className="lp-intro">
            Collectors can take GPS-backed road photographs, while reviewers can
            use open-source AI to find pothole candidates in drone footage. Every
            record still passes through human verification, with detected people
            and vehicles blurred before storage.
          </p>

          <div className="lp-actions">
            <Link className="lp-btn lp-btn-primary" href="/collect">
              Take or upload a photo
            </Link>
            <Link className="lp-btn lp-btn-outline" href="/drone">
              Analyse drone footage
            </Link>
          </div>
          <div className="lp-links">
            <Link href="/reports">View public dashboard</Link>
            <Link href="/admin">Administrator portal</Link>
            <a href="#process">View the workflow</a>
          </div>
        </div>

        <div
          aria-label="Illustration of a monitored road"
          className="lp-visual"
          role="img"
        >
          <div className="lp-card lp-card-back" />
          <div className="lp-card lp-card-front">
            <div className="lp-map-canvas">
              <div className="lp-visual-grid" />
              <span className="lp-chip lp-chip-one">Accra</span>
              <span className="lp-chip lp-chip-two">Field route</span>

              <div className="lp-road">
                <span className="lp-defect">
                  <i />
                  <b>Suspected defect</b>
                </span>
              </div>

              <div className="lp-float-card">
                <span aria-hidden="true" className="lp-float-icon">
                  ✓
                </span>
                <span>
                  <strong>Structured collection</strong>
                  <small>
                    <em>Image</em>
                    <em>Location</em>
                    <em>Review</em>
                  </small>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Platform highlights" className="lp-wrap">
        <div className="lp-trust">
          {highlights.map((item) => (
            <article className="lp-trust-item" key={item.label}>
              <span className="lp-trust-icon">
                <Icon name={item.icon} />
              </span>
              <div>
                <h3>{item.label}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-process" id="process">
        <div className="lp-wrap">
          <div className="lp-section-heading">
            <p className="lp-eyebrow">Operational workflow</p>
            <h2>Collect, review, and map road evidence.</h2>
          </div>

          <div className="lp-stages">
            {stages.map((stage) => (
              <article className="lp-stage" key={stage.number}>
                <span className="lp-stage-number">{stage.number}</span>
                <h3>{stage.title}</h3>
                <p>{stage.text}</p>
                <Link className="lp-stage-link" href={stage.actionHref}>
                  {stage.actionLabel}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-wrap">
        <div className="lp-cta">
          <div>
            <h2>Help keep your roads on the map.</h2>
            <p>
              Every photo you add gives reviewers the evidence they need to
              prioritise repairs.
            </p>
          </div>
          <div className="lp-cta-actions">
            <Link className="lp-btn lp-btn-gold" href="/collect">
              Take or upload a photo
            </Link>
            <Link className="lp-btn lp-btn-ghost" href="/reports">
              View public dashboard
            </Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <p>Ghana Road Defect Monitoring Project</p>
          <p>
            <Link href="/reports">View reported road defects</Link>
            <span aria-hidden="true"> / </span>
            <Link href="/admin">Admin review</Link>
            <span aria-hidden="true"> / </span>
            2026
          </p>
        </div>
      </footer>
    </main>
  );
}