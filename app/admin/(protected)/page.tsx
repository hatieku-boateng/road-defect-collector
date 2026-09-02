import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  DEFECT_TYPES,
  getDirectionsUrl,
  statusAllowsDirections,
  WORKFLOW_STATUSES,
  WORKFLOW_STATUS_LABELS,
} from "../../../lib/config";
import {
  listSubmissions,
  type RoadSubmission,
  type SubmissionFilters,
} from "../../../lib/submissions";
import { logoutAction } from "../actions";
import MapShell from "./map-shell";

export const metadata: Metadata = { title: "Administrator dashboard" };

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFilter(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function displayDefect(value: string) {
  return value.replaceAll("-", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const updateResult = getFilter(params.update);
  const updateError = getFilter(params.error);
  const filters: SubmissionFilters = {
    collector: getFilter(params.collector),
    defect: getFilter(params.defect),
    source: getFilter(params.source),
    status: getFilter(params.status),
  };
  let submissions: RoadSubmission[] = [];
  let configurationError = "";

  try {
    submissions = await listSubmissions(filters);
  } catch {
    configurationError =
      "Persistent storage is not configured yet. Connect Neon and Vercel Blob to activate the dashboard.";
  }

  const summary = submissions.reduce(
    (totals, submission) => {
      totals.total += 1;
      if (submission.workflow_status === "pending") totals.pending += 1;
      else if (submission.workflow_status === "verified") totals.verified += 1;
      else if (submission.workflow_status === "rejected") totals.rejected += 1;
      else if (submission.workflow_status === "repair-completed") totals.completed += 1;
      else totals.active += 1;
      return totals;
    },
    { active: 0, completed: 0, pending: 0, rejected: 0, total: 0, verified: 0 },
  );

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">GR</span>
          <span>
            <strong>Road Data Review</strong>
            <small>Administrator dashboard</small>
          </span>
        </Link>
        <form action={logoutAction}>
          <button className="text-button" type="submit">Sign out</button>
        </form>
      </header>

      <section className="admin-content">
        <div className="admin-title-row">
          <div>
            <p className="eyebrow">Collection overview</p>
            <h1>Review field submissions.</h1>
          </div>
          <div className="admin-title-actions">
            <Link className="button secondary" href="/drone">Drone AI</Link>
            <Link className="button primary" href="/collect">Manual photo</Link>
          </div>
        </div>

        {configurationError ? (
          <p className="configuration-alert">{configurationError}</p>
        ) : null}

        {updateResult === "success" ? (
          <p className="status-update-message status-update-success" role="status">
            Submission status updated successfully.
          </p>
        ) : null}
        {updateResult === "failed" ? (
          <p className="status-update-message status-update-failed" role="alert">
            The status could not be updated. Please reload and try again.
            {updateError ? ` Error reference: ${updateError}.` : ""}
          </p>
        ) : null}

        <div className="metric-grid">
          {Object.entries(summary).map(([label, value]) => (
            <article className={`metric-card metric-${label}`} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        <form className="filter-bar">
          <label>
            <span>Status</span>
            <select defaultValue={filters.status} name="status">
              <option value="">All statuses</option>
              {WORKFLOW_STATUSES.map((status) => (
                <option key={status} value={status}>{WORKFLOW_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Defect</span>
            <select defaultValue={filters.defect} name="defect">
              <option value="">All defects</option>
              {DEFECT_TYPES.map((defect) => (
                <option key={defect} value={defect}>{displayDefect(defect)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Source</span>
            <select defaultValue={filters.source} name="source">
              <option value="">All sources</option>
              <option value="manual">Manual photo</option>
              <option value="drone-ai">Drone AI</option>
            </select>
          </label>
          <label>
            <span>Collector</span>
            <input defaultValue={filters.collector} name="collector" placeholder="Collector ID" />
          </label>
          <button className="button primary" type="submit">Apply filters</button>
          <Link className="text-button" href="/admin">Clear</Link>
        </form>

        <section className="dashboard-section">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">Geographical coverage</p>
              <h2>Submission map</h2>
            </div>
            <span>{submissions.filter((item) => item.latitude !== null).length} visible locations</span>
          </div>
          <MapShell submissions={submissions} />
        </section>

        <section className="dashboard-section">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">Quality review</p>
              <h2>Submitted records</h2>
            </div>
          </div>

          <div className="submission-list">
            {submissions.map((submission) => (
              <article className="submission-card" key={submission.id}>
                <div className="submission-image">
                  <Image
                    alt={`Road submission from ${submission.area_name}`}
                    fill
                    sizes="(max-width: 820px) 100vw, 320px"
                    src={`/api/images/${submission.id}`}
                    unoptimized
                  />
                  <span className={`review-badge review-${submission.workflow_status}`}>
                    {WORKFLOW_STATUS_LABELS[submission.workflow_status]}
                  </span>
                </div>
                <div className="submission-body">
                  <div className="submission-title">
                    <div>
                      <h3>{submission.area_name}</h3>
                      <p>{displayDefect(submission.suspected_defect)}</p>
                    </div>
                    <small>{formatDate(submission.created_at)}</small>
                  </div>
                  <dl className="submission-meta">
                    <div><dt>Collector</dt><dd>{submission.collector_id}</dd></div>
                    <div><dt>Source</dt><dd>{submission.source === "drone-ai" ? "Drone AI" : "Manual photo"}</dd></div>
                    <div>
                      <dt>Privacy</dt>
                      <dd>
                        {submission.privacy_processed
                          ? `${submission.privacy_blur_count} region${submission.privacy_blur_count === 1 ? "" : "s"} blurred`
                          : "Legacy record"}
                      </dd>
                    </div>
                    {submission.source === "drone-ai" ? (
                      <>
                        <div><dt>Video time</dt><dd>{submission.video_timestamp?.toFixed(1)} s</dd></div>
                        <div><dt>AI confidence</dt><dd>{Math.round((submission.ai_confidence ?? 0) * 100)}%</dd></div>
                      </>
                    ) : (
                      <>
                        <div><dt>Device</dt><dd>{submission.device_manufacturer ?? "Unavailable"} • {submission.device_model ?? "Unavailable"}</dd></div>
                        <div><dt>GPS accuracy</dt><dd>±{Math.round(submission.gps_accuracy ?? 0)} m</dd></div>
                        <div><dt>Coordinates</dt><dd>{submission.latitude?.toFixed(5)}, {submission.longitude?.toFixed(5)}</dd></div>
                      </>
                    )}
                  </dl>
                  {submission.latitude !== null && submission.longitude !== null &&
                  statusAllowsDirections(submission.workflow_status) ? (
                    <a
                      className="directions-button"
                      href={getDirectionsUrl(submission.latitude, submission.longitude)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Show directions
                    </a>
                  ) : null}
                  <form action="/api/admin/submissions/status" className="review-form" method="post">
                    <input name="id" type="hidden" value={submission.id} />
                    <label>
                      <span>Submission status</span>
                      <select defaultValue={submission.workflow_status} name="status">
                        {WORKFLOW_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {WORKFLOW_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Review note</span>
                      <textarea
                        defaultValue={submission.review_note ?? ""}
                        maxLength={500}
                        name="note"
                        placeholder="Optional reason or correction note"
                        rows={2}
                      />
                    </label>
                    <div>
                      <button type="submit">Update status</button>
                    </div>
                  </form>
                </div>
              </article>
            ))}

            {!configurationError && submissions.length === 0 ? (
              <p className="empty-state">No submissions match these filters.</p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
