import type { Metadata } from "next";
import Link from "next/link";
import DroneAnalyzer from "./drone-analyzer";

export const metadata: Metadata = {
  title: "Drone AI surveillance",
  description: "Analyse drone footage for possible potholes using open-source AI.",
};

export default function DronePage() {
  return (
    <main className="drone-page">
      <header className="site-header collection-header">
        <Link className="brand" href="/" aria-label="Return to project home">
          <span className="brand-mark" aria-hidden="true">GR</span>
          <span>
            <strong>Ghana Road Defect</strong>
            <small>Drone surveillance workspace</small>
          </span>
        </Link>
        <span className="status-badge"><span aria-hidden="true" /> AI pilot</span>
      </header>

      <section className="drone-shell">
        <div className="drone-intro">
          <p className="eyebrow">Automated surveillance</p>
          <h1>Find pothole candidates in drone footage.</h1>
          <p>
            The video remains on this device. Selected frames are analysed by an
            open-source model, and only candidates you approve are submitted for
            administrator review.
          </p>
          <div className="ai-caution">
            <strong>Human verification is mandatory.</strong>
            <span>AI confidence indicates visual similarity, not defect severity.</span>
          </div>
        </div>
        <DroneAnalyzer />
      </section>
    </main>
  );
}
