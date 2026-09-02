import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getDirectionsUrl,
  statusAllowsDirections,
  WORKFLOW_STATUS_LABELS,
} from "../../lib/config";
import {
  listPublicSubmissions,
  type PublicRoadSubmission,
} from "../../lib/submissions";
import MapShell from "./map-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Public road reports",
  description: "View reported road defects and their current maintenance status.",
};

function displayDefect(value: string) {
  return value.replaceAll("-", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default async function PublicReportsPage() {
  let submissions: PublicRoadSubmission[] = [];
  let loadingError = false;

  try {
    submissions = await listPublicSubmissions();
  } catch {
    loadingError = true;
  }

  const summary = submissions.reduce(
    (totals, submission) => {
      totals.total += 1;
      if (submission.workflow_status === "pending") totals.pending += 1;
      else if (submission.workflow_status === "repair-completed") totals.completed += 1;
      else if (submission.workflow_status === "verified") totals.verified += 1;
      else totals.active += 1;
      return totals;
    },
    { active: 0, completed: 0, pending: 0, total: 0, verified: 0 },
  );
  const mappedCount = submissions.filter(
    (submission) => submission.latitude !== null && submission.longitude !== null,
  ).length;

  return (
    <main className="public-reports-page">
      <header className="site-header collection-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">GR</span>
          <span>
            <strong>Ghana Road Defect</strong>
            <small>Public reporting dashboard</small>
          </span>
        </Link>
        <Link className="button primary compact-button" href="/collect">
          Report a road
        </Link>
      </header>

      <section className="public-dashboard">
        <div className="public-dashboard-hero">
          <div>
            <p className="eyebrow">Public road transparency</p>
            <h1>Reported road defects and their progress.</h1>
            <p>
              Follow road issues submitted by the public and see how each report
              moves from review to repair. Exact locations become public only
              after verification.
            </p>
          </div>
          <div className="public-privacy-note">
            <strong>Public and privacy-safe</strong>
            <span>
              People and vehicles are blurred. Collector IDs, device details,
              review notes and rejected reports are never shown here.
            </span>
          </div>
        </div>

        {loadingError ? (
          <p className="configuration-alert" role="alert">
            The public reports could not be loaded. Please try again shortly.
          </p>
        ) : null}

        <div className="metric-grid public-metrics">
          {Object.entries(summary).map(([label, value]) => (
            <article className={`metric-card metric-${label}`} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        <section className="dashboard-section">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">Verified locations</p>
              <h2>Road defect map</h2>
            </div>
            <span>{mappedCount} public location{mappedCount === 1 ? "" : "s"}</span>
          </div>
          <MapShell submissions={submissions} />
        </section>

        <section className="dashboard-section">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">Latest reports</p>
              <h2>Reported road defects</h2>
            </div>
            <span>{submissions.length} visible report{submissions.length === 1 ? "" : "s"}</span>
          </div>

          <div className="public-report-grid">
            {submissions.map((submission) => {
              const hasPublicLocation =
                submission.latitude !== null &&
                submission.longitude !== null &&
                statusAllowsDirections(submission.workflow_status);

              return (
                <article className="public-report-card" key={submission.id}>
                  <div className="public-report-image">
                    <Image
                      alt={`Road defect report from ${submission.area_name}`}
                      fill
                      sizes="(max-width: 720px) 100vw, (max-width: 1050px) 50vw, 33vw"
                      src={`/api/public/images/${submission.id}`}
                      unoptimized
                    />
                    <span className={`review-badge review-${submission.workflow_status}`}>
                      {WORKFLOW_STATUS_LABELS[submission.workflow_status]}
                    </span>
                  </div>
                  <div className="public-report-body">
                    <div>
                      <p className="public-report-defect">
                        {displayDefect(submission.suspected_defect)}
                      </p>
                      <h3>{submission.area_name}</h3>
                    </div>
                    <dl>
                      <div>
                        <dt>Reported</dt>
                        <dd>{formatDate(submission.created_at)}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{submission.source === "drone-ai" ? "Drone survey" : "Public photo"}</dd>
                      </div>
                    </dl>
                    {hasPublicLocation ? (
                      <a
                        className="directions-button"
                        href={getDirectionsUrl(submission.latitude!, submission.longitude!)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Show directions
                      </a>
                    ) : (
                      <p className="location-withheld">Location awaiting verification</p>
                    )}
                  </div>
                </article>
              );
            })}

            {!loadingError && submissions.length === 0 ? (
              <p className="empty-state public-empty-state">
                No public road reports are available yet.
              </p>
            ) : null}
          </div>
        </section>
      </section>

      <footer>
        <p>Ghana Road Defect Monitoring Project</p>
        <p>Public reporting dashboard • 2026</p>
      </footer>
    </main>
  );
}
