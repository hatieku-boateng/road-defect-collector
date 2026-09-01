import type { Metadata } from "next";
import Link from "next/link";
import ImagePicker from "./image-picker";

export const metadata: Metadata = {
  title: "Collector Submission",
  description: "Submit a road image and its basic collection details.",
};

export default function CollectPage() {
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
            Add the basic details for one road image. Camera access, GPS capture,
            and database submission will be connected in later stages.
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
          <div className="form-heading">
            <div>
              <p className="eyebrow">New record</p>
              <h2>Image details</h2>
            </div>
            <span>Draft interface</span>
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

          <div className="location-field">
            <div>
              <span>GPS location</span>
              <small>Location capture will be connected next.</small>
            </div>
            <button disabled type="button">
              Capture GPS
            </button>
          </div>

          <button className="submit-button" disabled type="submit">
            Submit record
          </button>
          <p className="form-status">
            Submission is disabled until storage and validation are connected.
          </p>
        </form>
      </section>
    </main>
  );
}
