import type { Metadata } from "next";
import Link from "next/link";
import ImagePicker from "./image-picker";
import LocationCapture from "./location-capture";
import SubmissionControls from "./submission-controls";

export const metadata: Metadata = {
  title: "Collector Submission",
  description: "Submit a road image and its basic collection details.",
};

type CollectPageProps = {
  searchParams: Promise<{ submitted?: string }>;
};

export default async function CollectPage({ searchParams }: CollectPageProps) {
  const { submitted } = await searchParams;

  return (
    <main className="collection-page">
      <header className="site-header collection-header">
        <Link className="brand" href="/" aria-label="Return to project home">
          <span className="brand-mark" aria-hidden="true">
            GR
          </span>
          <span>
            <strong>Ghana Road Defect</strong>
            <small>Collector workspace</small>
          </span>
        </Link>

        <span className="status-badge">
          <span aria-hidden="true" /> Collection form
        </span>
      </header>

      <section className="collection-shell">
        <div className="collection-intro">
          <p className="eyebrow">Field data collection</p>
          <h1>Submit a road image.</h1>
          <p>
            Capture or upload one clear road image, attach its precise GPS
            location, and submit it securely. People and vehicles are detected
            and blurred on the device before the image is uploaded.
          </p>

          <div className="form-note">
            <span aria-hidden="true">1</span>
            <p>
              <strong>One record at a time</strong>
              Use this form for a single image and its collection details.
            </p>
          </div>
        </div>

        <form className="collection-form">
          {submitted ? (
            <div className="submission-success" role="status">
              <strong>Record submitted successfully.</strong>
              <span>Reference: {submitted}</span>
            </div>
          ) : null}
          <div className="form-heading">
            <div>
              <p className="eyebrow">New record</p>
              <h2>Image details</h2>
            </div>
            <span>Live collection</span>
          </div>

          <label className="field">
            <span>Collector ID</span>
            <input name="collectorId" placeholder="e.g. COL-001" required />
          </label>

          <ImagePicker />

          <label className="field">
            <span>Suspected defect type</span>
            <select defaultValue="" name="suspectedDefect" required>
              <option disabled value="">
                Select a defect type
              </option>
              <option value="pothole">Pothole</option>
              <option value="road-crack">Road crack</option>
              <option value="damaged-road-edge">Damaged road edge</option>
              <option value="unsure">Unsure</option>
            </select>
          </label>

          <label className="field">
            <span>Road or area name</span>
            <input
              name="areaName"
              placeholder="e.g. Spintex Road, Accra"
              required
            />
          </label>

          <LocationCapture />

          <SubmissionControls />
        </form>
      </section>
    </main>
  );
}
