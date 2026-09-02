"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewData = {
  areaName: string;
  collectorId: string;
  defect: string;
  fileName: string;
  gpsAccuracy: string;
  latitude: string;
  longitude: string;
  privacyBlurCount: string;
};

function readForm(form: HTMLFormElement) {
  const formData = new FormData(form);
  const image = formData.get("roadImage");

  return {
    formData,
    review: {
      areaName: String(formData.get("areaName") ?? ""),
      collectorId: String(formData.get("collectorId") ?? ""),
      defect: String(formData.get("suspectedDefect") ?? "").replaceAll("-", " "),
      fileName: image instanceof File ? image.name : "",
      gpsAccuracy: String(formData.get("gpsAccuracy") ?? ""),
      latitude: String(formData.get("latitude") ?? ""),
      longitude: String(formData.get("longitude") ?? ""),
      privacyBlurCount: String(formData.get("privacyBlurCount") ?? "0"),
    },
  };
}

export default function SubmissionControls() {
  const router = useRouter();
  const [review, setReview] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openReview(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;

    setError("");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const { formData, review: reviewData } = readForm(form);
    if (String(formData.get("privacyProcessed") ?? "") !== "true") {
      setError("Wait for the privacy check to finish before reviewing this record.");
      return;
    }
    if (!reviewData.latitude || !reviewData.longitude || !reviewData.gpsAccuracy) {
      setError("Capture the GPS location before reviewing this record.");
      return;
    }

    setReview(reviewData);
  }

  async function submitRecord(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;

    setError("");
    setIsSubmitting(true);

    try {
      const { formData } = readForm(form);
      const response = await fetch("/api/submissions", {
        body: formData,
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; id?: string };

      if (!response.ok || !result.id) {
        setError(result.error ?? "The record could not be submitted.");
        setReview(null);
        return;
      }

      router.push(`/collect?submitted=${encodeURIComponent(result.id)}`);
      router.refresh();
    } catch {
      setError("The network request failed. Check your connection and try again.");
      setReview(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button className="submit-button" onClick={openReview} type="button">
        Review record
      </button>
      <p className="submission-error" role="alert">{error}</p>

      {review ? (
        <div aria-labelledby="review-title" aria-modal="true" className="review-overlay" role="dialog">
          <section className="review-dialog">
            <div className="review-dialog-heading">
              <div>
                <p className="eyebrow">Final check</p>
                <h2 id="review-title">Review this record</h2>
              </div>
              <button aria-label="Close review" onClick={() => setReview(null)} type="button">×</button>
            </div>
            <dl>
              <div><dt>Collector</dt><dd>{review.collectorId}</dd></div>
              <div><dt>Area</dt><dd>{review.areaName}</dd></div>
              <div><dt>Suspected defect</dt><dd>{review.defect}</dd></div>
              <div><dt>Image</dt><dd>{review.fileName}</dd></div>
              <div><dt>Latitude</dt><dd>{Number(review.latitude).toFixed(6)}</dd></div>
              <div><dt>Longitude</dt><dd>{Number(review.longitude).toFixed(6)}</dd></div>
              <div><dt>GPS accuracy</dt><dd>±{Math.round(Number(review.gpsAccuracy))} metres</dd></div>
              <div><dt>Privacy protection</dt><dd>{review.privacyBlurCount} region{review.privacyBlurCount === "1" ? "" : "s"} blurred</dd></div>
            </dl>
            <p>
              The suspected defect is provisional. An administrator will verify the image later.
            </p>
            <div className="review-actions">
              <button disabled={isSubmitting} onClick={() => setReview(null)} type="button">
                Go back
              </button>
              <button disabled={isSubmitting} onClick={submitRecord} type="button">
                {isSubmitting ? "Submitting…" : "Submit record"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
