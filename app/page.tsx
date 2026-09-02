import Link from "next/link";

const stages = [
  {
    number: "01",
    title: "Collect",
    text: "Capture a GPS-backed field photo or analyse sampled drone frames.",
  },
  {
    number: "02",
    title: "Review",
    text: "Check image quality before accepting it into the dataset.",
  },
  {
    number: "03",
    title: "Map",
    text: "View collected road records at their GPS locations on the administrator map.",
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
          <span aria-hidden="true" /> Collection module live
        </span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Safer roads through better data</p>
          <h1>Report roads manually or survey them with AI.</h1>
          <p className="intro">
            Collectors can take GPS-backed road photographs, while reviewers can
            use open-source AI to find pothole candidates in drone footage. Every
            record still passes through human verification, with detected people
            and vehicles blurred before storage.
          </p>

          <div className="hero-actions">
            <Link className="button primary" href="/collect">
              Take or upload a photo
            </Link>
            <Link className="button secondary" href="/drone">
              Analyse drone footage
            </Link>
            <a className="button secondary" href="#process">
              View the workflow
            </a>
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
          <p className="eyebrow">Operational workflow</p>
          <h2>Collect, review, and map road evidence.</h2>
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
