import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  DEFECT_TYPE_LABELS,
  DEFECT_TYPES,
  getDirectionsUrl,
  MAX_NOTE_LENGTH,
  PROGRESS_STAGE_LABELS,
  statusAllowsDirections,
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STATUSES,
  type DefectType,
  type ProgressImageStage,
} from "../../../lib/config";
import {
  listProgressImages,
  listSubmissions,
  type RoadProgressImage,
  type RoadSubmission,
  type SubmissionFilters,
} from "../../../lib/submissions";
import ImagePicker from "../../collect/image-picker";
import { logoutAction } from "../actions";
import MapShell from "./map-shell";
import PrivacyRecheck from "./privacy-recheck";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administrator dashboard" };

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

const METRIC_LABELS: Readonly<Record<string, string>> = {
  total: "Total in view",
  pending: "Pending review",
  verified: "Verified",
  active: "In progress",
  completed: "Completed",
  rejected: "Rejected",
};

const PROGRESS_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "missing-submission": "The target submission could not be found.",
  "invalid-stage": "Select a valid repair stage (In progress or After repair).",
  "privacy-required": "Complete the privacy check on the progress photo before uploading.",
  "missing-image": "Select a repair progress photo before submitting.",
  "invalid-image-type": "Only valid JPG, PNG, and WebP progress photos are accepted.",
  "too-large": "The progress photo must be 10 MB or smaller.",
  "invalid-date": "The photo capture date is invalid or set in the future.",
  duplicate: "This exact progress photo has already been uploaded for this report.",
  failed: "The progress image could not be added. Check every field and try again.",
};

function getFilter(value: string | string[] | undefined): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }
  return "";
}

function displayDefect(value: string): string {
  if (value in DEFECT_TYPE_LABELS) {
    return DEFECT_TYPE_LABELS[value as DefectType];
  }
  return value.replaceAll("-", " ");
}

function displayProgressStage(stage: string): string {
  if (stage in PROGRESS_STAGE_LABELS) {
    return PROGRESS_STAGE_LABELS[stage as ProgressImageStage];
  }
  return stage.replaceAll("-", " ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return DATE_TIME_FORMATTER.format(parsed);
}

function formatDeviceName(
  manufacturer: string | null | undefined,
  model: string | null | undefined,
): string {
  const cleanMake = manufacturer?.trim() ?? "";
  const cleanModel = model?.trim() ?? "";
  if (cleanMake && cleanModel) {
    return cleanModel.toLowerCase().startsWith(cleanMake.toLowerCase())
      ? cleanModel
      : `${cleanMake} ${cleanModel}`;
  }
  return cleanMake || cleanModel || "Unavailable";
}

function hasValidCoordinates(
  submission: Pick<RoadSubmission, "latitude" | "longitude">,
): submission is Pick<RoadSubmission, "latitude" | "longitude"> & {
  latitude: number;
  longitude: number;
} {
  return (
    typeof submission.latitude === "number" &&
    typeof submission.longitude === "number" &&
    Number.isFinite(submission.latitude) &&
    Number.isFinite(submission.longitude)
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const updateResult = getFilter(params.update);
  const updateError = getFilter(params.error);
  const archiveResult = getFilter(params.archive);
  const restoreResult = getFilter(params.restore);
  const progressResult = getFilter(params.progress);

  const filters: SubmissionFilters = {
    collector: getFilter(params.collector),
    defect: getFilter(params.defect),
    source: getFilter(params.source),
    status: getFilter(params.status),
  };

  const hasActiveFilters = Boolean(
    filters.collector || filters.defect || filters.source || filters.status,
  );

  let submissions: RoadSubmission[] = [];
  let progressImages: RoadProgressImage[] = [];
  let configurationError = "";

  try {
    [submissions, progressImages] = await Promise.all([
      listSubmissions(filters),
      listProgressImages(),
    ]);
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
      else if (submission.workflow_status === "repair-completed")
        totals.completed += 1;
      else totals.active += 1;
      return totals;
    },
    { active: 0, completed: 0, pending: 0, rejected: 0, total: 0, verified: 0 },
  );

  const progressBySubmission = new Map<string, RoadProgressImage[]>();
  for (const image of progressImages) {
    const images = progressBySubmission.get(image.submission_id) ?? [];
    images.push(image);
    progressBySubmission.set(image.submission_id, images);
  }

  const mappedLocationsCount = submissions.filter(hasValidCoordinates).length;
  const filterFormKey = `${filters.status}|${filters.defect}|${filters.source}|${filters.collector}`;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            GR
          </span>
          <span>
            <strong>Road Data Review</strong>
            <small>Administrator dashboard</small>
          </span>
        </Link>
        <form action={logoutAction}>
          <button className="text-button" type="submit">
            Sign out
          </button>
        </form>
      </header>

      <section className="admin-content">
        <div className="admin-title-row">
          <div>
            <p className="eyebrow">Collection overview</p>
            <h1>Review field submissions.</h1>
            <p className="admin-title-summary">
              Triage new road evidence, validate privacy processing, and keep
              public maintenance records current.
            </p>
          </div>
          <div className="admin-title-actions">
            <Link className="button secondary" href="/admin/archives">
              Archives
            </Link>
            <Link className="button secondary" href="/drone">
              Drone AI
            </Link>
            <Link className="button primary" href="/collect">
              Manual photo
            </Link>
          </div>
        </div>

        {configurationError ? (
          <p className="configuration-alert" role="alert">
            {configurationError}
          </p>
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

        {archiveResult === "success" ? (
          <p className="status-update-message status-update-success" role="status">
            Submission moved to the archives.
          </p>
        ) : null}

        {archiveResult && archiveResult !== "success" ? (
          <p className="status-update-message status-update-failed" role="alert">
            The submission could not be archived. Please reload and try again.
          </p>
        ) : null}

        {restoreResult === "success" ? (
          <p className="status-update-message status-update-success" role="status">
            Submission restored from archives.
          </p>
        ) : null}

        {progressResult === "success" ? (
          <p className="status-update-message status-update-success" role="status">
            Repair progress image added successfully.
          </p>
        ) : null}

        {progressResult && progressResult !== "success" ? (
          <p className="status-update-message status-update-failed" role="alert">
            {PROGRESS_ERROR_MESSAGES[progressResult] ??
              PROGRESS_ERROR_MESSAGES.failed}
          </p>
        ) : null}

        <div className="metric-grid">
          {(
            ["total", "pending", "verified", "active", "completed", "rejected"] as const
          ).map((key) => (
            <article className={`metric-card metric-${key}`} key={key}>
              <span>{METRIC_LABELS[key] ?? key}</span>
              <strong>{summary[key]}</strong>
            </article>
          ))}
        </div>

        <form className="filter-bar" key={filterFormKey} method="get">
          <div className="filter-heading">
            <strong>Refine records</strong>
            <span>Use one or more filters to focus the review queue.</span>
          </div>
          <label>
            <span>Status</span>
            <select defaultValue={filters.status} name="status">
              <option value="">All statuses</option>
              {WORKFLOW_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {WORKFLOW_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Defect</span>
            <select defaultValue={filters.defect} name="defect">
              <option value="">All defects</option>
              {DEFECT_TYPES.map((defect) => (
                <option key={defect} value={defect}>
                  {displayDefect(defect)}
                </option>
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
            <input
              defaultValue={filters.collector}
              maxLength={64}
              name="collector"
              placeholder="Collector or Operator ID"
            />
          </label>
          <button className="button primary" type="submit">
            Apply filters
          </button>
          {hasActiveFilters ? (
            <Link className="text-button" href="/admin">
              Clear
            </Link>
          ) : null}
        </form>

        <section className="dashboard-section">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">Geographical coverage</p>
              <h2>Submission map</h2>
            </div>
            <span>
              {mappedLocationsCount} visible location
              {mappedLocationsCount === 1 ? "" : "s"}
            </span>
          </div>
          <MapShell submissions={submissions} />
        </section>

        <section className="dashboard-section">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">Quality review</p>
              <h2>Submitted records</h2>
            </div>
            <span>
              {submissions.length} record{submissions.length === 1 ? "" : "s"} in
              view
            </span>
          </div>

          <div className="submission-list">
            {submissions.map((submission) => {
              const submissionProgress =
                progressBySubmission.get(submission.id) ?? [];
              const coordsAvailable = hasValidCoordinates(submission);
              const statusLabel =
                WORKFLOW_STATUS_LABELS[submission.workflow_status] ??
                submission.workflow_status;

              return (
                <article className="submission-card" key={submission.id}>
                  <div className="submission-image">
                    <Image
                      alt={`Road submission from ${submission.area_name}`}
                      fill
                      sizes="(max-width: 820px) 100vw, 320px"
                      src={`/api/images/${submission.id}`}
                      unoptimized
                    />
                    <span
                      className={`review-badge review-${submission.workflow_status}`}
                    >
                      {statusLabel}
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
                      <div>
                        <dt>Collector</dt>
                        <dd>{submission.collector_id}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>
                          {submission.source === "drone-ai"
                            ? "Drone AI"
                            : "Manual photo"}
                        </dd>
                      </div>
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
                          <div>
                            <dt>Video time</dt>
                            <dd>
                              {typeof submission.video_timestamp === "number"
                                ? `${submission.video_timestamp.toFixed(1)} s`
                                : "Unavailable"}
                            </dd>
                          </div>
                          <div>
                            <dt>AI confidence</dt>
                            <dd>
                              {typeof submission.ai_confidence === "number"
                                ? `${Math.round(submission.ai_confidence * 100)}%`
                                : "Unavailable"}
                            </dd>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <dt>Device</dt>
                            <dd>
                              {formatDeviceName(
                                submission.device_manufacturer,
                                submission.device_model,
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>GPS accuracy</dt>
                            <dd>
                              {typeof submission.gps_accuracy === "number"
                                ? `±${Math.round(submission.gps_accuracy)} m`
                                : "Unavailable"}
                            </dd>
                          </div>
                          <div>
                            <dt>Coordinates</dt>
                            <dd>
                              {coordsAvailable
                                ? `${submission.latitude.toFixed(5)}, ${submission.longitude.toFixed(5)}`
                                : "Unavailable"}
                            </dd>
                          </div>
                        </>
                      )}
                    </dl>

                    <PrivacyRecheck submissionId={submission.id} />

                    {submissionProgress.length > 0 ? (
                      <div className="admin-progress-gallery">
                        <h4>Repair progress ({submissionProgress.length})</h4>
                        <div>
                          {submissionProgress.map((progress) => (
                            <figure key={progress.id}>
                              <span className="admin-progress-image">
                                <Image
                                  alt={`${displayProgressStage(progress.stage)} road repair`}
                                  fill
                                  sizes="180px"
                                  src={`/api/progress-images/${progress.id}`}
                                  unoptimized
                                />
                              </span>
                              <figcaption>
                                <strong>
                                  {displayProgressStage(progress.stage)}
                                </strong>
                                <small>
                                  {formatDate(
                                    progress.captured_at ?? progress.created_at,
                                  )}
                                </small>
                                {progress.note ? (
                                  <span>{progress.note}</span>
                                ) : null}
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {coordsAvailable &&
                    statusAllowsDirections(submission.workflow_status) ? (
                      <a
                        className="directions-button"
                        href={getDirectionsUrl(
                          submission.latitude,
                          submission.longitude,
                        )}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Show directions
                      </a>
                    ) : null}

                    <form
                      action="/api/admin/submissions/status"
                      className="review-form"
                      key={`${submission.id}-${submission.workflow_status}-${submission.reviewed_at ?? ""}`}
                      method="post"
                    >
                      <input name="id" type="hidden" value={submission.id} />
                      <label>
                        <span>Submission status</span>
                        <select
                          defaultValue={submission.workflow_status}
                          name="status"
                        >
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
                          maxLength={MAX_NOTE_LENGTH}
                          name="note"
                          placeholder="Optional reason or correction note"
                          rows={2}
                        />
                      </label>
                      <div>
                        <button type="submit">Update status</button>
                      </div>
                    </form>

                    <details className="progress-upload-panel">
                      <summary>Add repair progress image</summary>
                      <form
                        action="/api/admin/submissions/progress"
                        encType="multipart/form-data"
                        method="post"
                      >
                        <input
                          name="submissionId"
                          type="hidden"
                          value={submission.id}
                        />
                        <div className="progress-fields">
                          <label>
                            <span>Repair stage</span>
                            <select
                              defaultValue="in-progress"
                              name="stage"
                              required
                            >
                              <option value="in-progress">In progress</option>
                              <option value="after">After repair</option>
                            </select>
                          </label>
                          <label>
                            <span>Photo date and time</span>
                            <input name="capturedAt" type="datetime-local" />
                          </label>
                          <label className="progress-note-field">
                            <span>Public progress note</span>
                            <textarea
                              maxLength={MAX_NOTE_LENGTH}
                              name="note"
                              placeholder="Optional update about the repair"
                            />
                          </label>
                        </div>
                        <ImagePicker />
                        <button className="button primary" type="submit">
                          Add progress image
                        </button>
                      </form>
                    </details>

                    <details className="archive-panel">
                      <summary>Archive this submission</summary>
                      <form
                        action="/api/admin/submissions/archive"
                        method="post"
                      >
                        <input name="id" type="hidden" value={submission.id} />
                        <label>
                          <span>Archive reason</span>
                          <textarea
                            maxLength={MAX_NOTE_LENGTH}
                            name="reason"
                            placeholder="Optional internal reason"
                          />
                        </label>
                        <p>
                          The report and all its images will leave the public
                          dashboard but remain available in Archives.
                        </p>
                        <button type="submit">Move to archives</button>
                      </form>
                    </details>
                  </div>
                </article>
              );
            })}

            {!configurationError && submissions.length === 0 ? (
              <p className="empty-state">No submissions match these filters.</p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}