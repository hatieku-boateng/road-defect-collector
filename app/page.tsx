import Link from "next/link";

const stages = [
  {
    number: "01",
    title: "Collect",
    text: "Capture clear road images and basic field information.",
  },
  {
    number: "02",
    title: "Review",
    text: "Check image quality before accepting it into the dataset.",
  },
  {
    number: "03",
    title: "Map",
    text: "Later, connect verified defects to their GPS locations.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Project home">
          <span className="brand-mark" aria-hidden="true">
            GR
          </span>
          <span>
            <strong>Ghana Road Defect</strong>
            <small>Monitoring Project</small>
          </span>
        </a>

        <span className="status-badge">
          <span aria-hidden="true" /> Foundation phase
        </span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Safer roads through better data</p>
          <h1>Building a clearer picture of Ghana&apos;s road conditions.</h1>
          <p className="intro">
            This project will help trained collectors document road defects,
            support quality review, and prepare reliable data for future AI
            detection and mapping.
          </p>

          <div className="hero-actions">
            <Link className="button primary" href="/collect">
              Open collection form
            </Link>
            <a className="button secondary" href="#process">
              View the workflow
            </a>
            <Link className="text-button" href="/admin/login">
              Administrator sign in
            </Link>
          </div>
        </div>

        <div className="road-visual" aria-label="Illustration of a monitored road">
          <div className="map-grid" />
          <span className="map-label label-one">Accra</span>
          <span className="map-label label-two">Field route</span>
          <div className="road">
            <span className="road-line line-one" />
            <span className="road-line line-two" />
            <span className="defect-marker">
              <i />
              Suspected defect
            </span>
          </div>
          <div className="visual-card">
            <span className="visual-icon" aria-hidden="true">✓</span>
            <span>
              <strong>Structured collection</strong>
              <small>Image • Location • Review</small>
            </span>
          </div>
        </div>
      </section>

      <section className="process" id="process">
        <div className="section-heading">
          <p className="eyebrow">Initial workflow</p>
          <h2>Start simple, then build steadily.</h2>
        </div>

        <div className="stage-grid">
          {stages.map((stage) => (
            <article className="stage-card" key={stage.number}>
              <span className="stage-number">{stage.number}</span>
              <h3>{stage.title}</h3>
              <p>{stage.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <p>Ghana Road Defect Monitoring Project</p>
        <p>Road image collection module • 2026</p>
      </footer>
    </main>
  );
}
