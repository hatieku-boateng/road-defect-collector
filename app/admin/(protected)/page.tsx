import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  DEFECT_TYPE_LABELS,
  DEFECT_TYPES,
  getDirectionsUrl,
  isValidGpsCoordinate,
  MAX_NOTE_LENGTH,
  PROGRESS_STAGE_LABELS,
  statusAllowsDirections,
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STATUSES,
  type DefectType,
  type ProgressImageStage,
  type WorkflowStatus,
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

export const metadata: Metadata = {
  title: "Administrator dashboard",
  description:
    "Triage field road defect submissions, verify privacy redaction, and track repair progress.",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type SortMode =
  | "newest"
  | "oldest"
  | "priority"
  | "accuracy"
  | "confidence";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

const METRIC_CARDS: ReadonlyArray<{
  key: "total" | "pending" | "verified" | "active" | "completed" | "rejected";
  label: string;
  statusFilter: string;
}> = [
  { key: "total", label: "Total in view", statusFilter: "" },
  { key: "pending", label: "Pending review", statusFilter: "pending" },
  { key: "verified", label: "Verified", statusFilter: "verified" },
  { key: "active", label: "In progress", statusFilter: "repair-in-progress" },
  { key: "completed", label: "Completed", statusFilter: "repair-completed" },
  { key: "rejected", label: "Rejected", statusFilter: "rejected" },
];

const PROGRESS_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "missing-submission": "The target submission could not be found.",
  "invalid-stage": "Select a valid repair stage (In progress or After repair).",
  "privacy-required":
    "Complete the privacy check on the progress photo before uploading.",
  "missing-image": "Select a repair progress photo before submitting.",
  "invalid-image-type":
    "Only valid JPG, PNG, and WebP progress photos are accepted.",
  "too-large": "The progress photo must be 10 MB or smaller.",
  "invalid-date": "The photo capture date is invalid or set in the future.",
  duplicate:
    "This exact progress photo has already been uploaded for this report.",
  failed:
    "The progress image could not be added. Check every field and try again.",
};

const PRIORITY_RANK: Readonly<Record<string, number>> = {
  pending: 0,
  verified: 1,
  "assigned-for-repair": 2,
  "repair-in-progress": 3,
  "repair-completed": 4,
  rejected: 5,
};

function getFilter(value: string | string[] | undefined): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }
  return "";
}

function normalizeSortMode(raw: string): SortMode {
  if (
    raw === "oldest" ||
    raw === "priority" ||
    raw === "accuracy" ||
    raw === "confidence"
  ) {
    return raw;
  }
  return "newest";
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

function getMaxDateTimeLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
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
  return isValidGpsCoordinate(submission.latitude, submission.longitude);
}

function buildAdminFilterHref(
  current: {
    collector?: string;
    defect?: string;
    q?: string;
    sort?: string;
    source?: string;
    status?: string;
  },
  overrides: Partial<{
    collector: string;
    defect: string;
    q: string;
    sort: string;
    source: string;
    status: string;
  }>,
): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.status) params.set("status", merged.status);
  if (merged.defect) params.set("defect", merged.defect);
  if (merged.source) params.set("source", merged.source);
  if (merged.collector) params.set("collector", merged.collector);
  if (merged.q) params.set("q", merged.q);
  if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
  const queryString = params.toString();
  return queryString ? `/admin?${queryString}` : "/admin";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const updateResult = getFilter(params.update);
  const updateError = getFilter(params.error);
  const archiveResult = getFilter(params.archive);
  const restoreResult = getFilter(params.restore);
  const progressResult = getFilter(params.progress);
  const searchQuery = getFilter(params.q);
  const sortMode = normalizeSortMode(getFilter(params.sort));

  const filters: SubmissionFilters = {
    collector: getFilter(params.collector),
    defect: getFilter(params.defect),
    source: getFilter(params.source),
    status: getFilter(params.status),
  };

  const hasActiveFilters = Boolean(
    filters.collector ||
      filters.defect ||
      filters.source ||
      filters.status ||
      searchQuery ||
      sortMode !== "newest",
  );

  let rawSubmissions: RoadSubmission[] = [];
  let progressImages: RoadProgressImage[] = [];
  let configurationError = "";

  try {
    [rawSubmissions, progressImages] = await Promise.all([
      listSubmissions(filters),
      listProgressImages(),
    ]);
  } catch {
    configurationError =
      "Persistent storage is not configured yet. Connect Neon and Vercel Blob to activate the dashboard.";
  }

  // Apply keyword search & sorting
  const normalizedQuery = searchQuery.toLowerCase();
  const filteredSubmissions = normalizedQuery
    ? rawSubmissions.filter((submission) => {
        const haystack = [
          submission.id,
          submission.area_name,
          submission.collector_id,
          submission.suspected_defect,
          displayDefect(submission.suspected_defect),
          submission.review_note ?? "",
          submission.device_manufacturer ?? "",
          submission.device_model ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : rawSubmissions;

  const submissions = [...filteredSubmissions].sort((a, b) => {
    if (sortMode === "oldest") {
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    if (sortMode === "priority") {
      const rankDiff =
        (PRIORITY_RANK[a.workflow_status] ?? 99) -
        (PRIORITY_RANK[b.workflow_status] ?? 99);
      if (rankDiff !== 0) return rankDiff;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    if (sortMode === "accuracy") {
      const accA =
        typeof a.gps_accuracy === "number"
          ? a.gps_accuracy
          : Number.POSITIVE_INFINITY;
      const accB =
        typeof b.gps_accuracy === "number"
          ? b.gps_accuracy
          : Number.POSITIVE_INFINITY;
      return accA - accB;
    }
    if (sortMode === "confidence") {
      const confA =
        typeof a.ai_confidence === "number" ? a.ai_confidence : -1;
      const confB =
        typeof b.ai_confidence === "number" ? b.ai_confidence : -1;
      return confB - confA;
    }
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  // Operational metrics & telemetry
  const summary = submissions.reduce(
    (totals, submission) => {
      totals.total += 1;
      if (submission.workflow_status === "pending") totals.pending += 1;
      else if (submission.workflow_status === "verified") totals.verified += 1;
      else if (submission.workflow_status === "rejected") totals.rejected += 1;
      else if (submission.workflow_status === "repair-completed")
        totals.completed += 1;
      else totals.active += 1;

      if (submission.source === "drone-ai") totals.droneCount += 1;
      else totals.manualCount += 1;

      if (submission.privacy_processed) {
        totals.privacyProcessedCount += 1;
        totals.totalBlurredRegions += submission.privacy_blur_count ?? 0;
      }

      if (
        typeof submission.gps_accuracy === "number" &&
        Number.isFinite(submission.gps_accuracy)
      ) {
        totals.gpsAccuracySum += submission.gps_accuracy;
        totals.gpsAccuracyCount += 1;
      }

      if (
        typeof submission.ai_confidence === "number" &&
        Number.isFinite(submission.ai_confidence)
      ) {
        totals.aiConfidenceSum += submission.ai_confidence;
        totals.aiConfidenceCount += 1;
      }

      return totals;
    },
    {
      active: 0,
      aiConfidenceCount: 0,
      aiConfidenceSum: 0,
      completed: 0,
      droneCount: 0,
      gpsAccuracyCount: 0,
      gpsAccuracySum: 0,
      manualCount: 0,
      pending: 0,
      privacyProcessedCount: 0,
      rejected: 0,
      total: 0,
      totalBlurredRegions: 0,
      verified: 0,
    },
  );

  // Compute top defect hotspots by area name
  const areaCounts = new Map<string, number>();
  for (const sub of submissions) {
    const cleanArea = sub.area_name.trim();
    if (cleanArea) {
      areaCounts.set(cleanArea, (areaCounts.get(cleanArea) ?? 0) + 1);
    }
  }
  const topHotspots = [...areaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const progressBySubmission = new Map<string, RoadProgressImage[]>();
  for (const image of progressImages) {
    const images = progressBySubmission.get(image.submission_id) ?? [];
    images.push(image);
    progressBySubmission.set(image.submission_id, images);
  }

  const mappedLocationsCount = submissions.filter(hasValidCoordinates).length;
  const privacyComplianceRate =
    summary.total > 0
      ? Math.round((summary.privacyProcessedCount / summary.total) * 100)
      : 100;
  const averageGpsAccuracy =
    summary.gpsAccuracyCount > 0
      ? Math.round(summary.gpsAccuracySum / summary.gpsAccuracyCount)
      : null;
  const averageAiConfidence =
    summary.aiConfidenceCount > 0
      ? Math.round(
          (summary.aiConfidenceSum / summary.aiConfidenceCount) * 100,
        )
      : null;

  const filterState = {
    collector: filters.collector,
    defect: filters.defect,
    q: searchQuery,
    sort: sortMode,
    source: filters.source,
    status: filters.status,
  };
  const filterFormKey = `${filters.status}|${filters.defect}|${filters.source}|${filters.collector}|${searchQuery}|${sortMode}`;
  const maxDateTimeLocal = getMaxDateTimeLocal();

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            GR
          </span>
          <span>
            <strong>Road Data Review</strong>
            <small>Administrator dashboard</small>
          </span>
        </Link>

        <nav
          aria-label="Administrator navigation"
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <Link className="text-button" href="/">
            Public map
          </Link>
          <Link className="text-button" href="/admin/archives">
            Archives
          </Link>
          <Link className="text-button" href="/admin/login?switch=true">
            Admin login
          </Link>
          <form action={logoutAction} style={{ margin: 0 }}>
            <button className="text-button" type="submit">
              Sign out
            </button>
          </form>
        </nav>
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
            <Link className="button secondary" href="/admin/login?switch=true">
              Login page
            </Link>
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

        {/* Interactive Quick-Filter Metric Cards */}
        <div className="metric-grid" role="region" aria-label="Submission status summary">
          {METRIC_CARDS.map(({ key, label, statusFilter }) => {
            const isSelected = (filters.status ?? "") === statusFilter;
            return (
              <Link
                aria-current={isSelected ? "true" : undefined}
                className={`metric-card metric-${key}`}
                href={buildAdminFilterHref(filterState, {
                  status: isSelected && statusFilter !== "" ? "" : statusFilter,
                })}
                key={key}
                style={{
                  outline: isSelected ? "2px solid currentColor" : undefined,
                  textDecoration: "none",
                }}
                title={`Filter by ${label}`}
              >
                <span>{label}</span>
                <strong>{summary[key]}</strong>
              </Link>
            );
          })}
        </div>

        {/* Field Telemetry & Hotspot Insights */}
        {summary.total > 0 ? (
          <div
            aria-label="Operational telemetry"
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              marginBottom: "1.25rem",
            }}
          >
            <div className="metric-card">
              <span>Source split</span>
              <strong>
                {summary.manualCount} Manual · {summary.droneCount} Drone
              </strong>
            </div>
            <div className="metric-card">
              <span>Privacy shield</span>
              <strong>
                {privacyComplianceRate}% verified ({summary.totalBlurredRegions}{" "}
                blurred)
              </strong>
            </div>
            <div className="metric-card">
              <span>Signal precision</span>
              <strong>
                {averageGpsAccuracy !== null
                  ? `±${averageGpsAccuracy}m GPS`
                  : "No GPS"}
                {averageAiConfidence !== null
                  ? ` · ${averageAiConfidence}% AI`
                  : ""}
              </strong>
            </div>
            {topHotspots.length > 0 ? (
              <div className="metric-card">
                <span>Top hotspot corridors</span>
                <strong style={{ fontSize: "0.95rem" }}>
                  {topHotspots
                    .map(([area, count]) => `${area} (${count})`)
                    .join(" · ")}
                </strong>
              </div>
            ) : null}
          </div>
        ) : null}

        <form className="filter-bar" key={filterFormKey} method="get">
          <div className="filter-heading">
            <strong>Refine & sort records</strong>
            <span>
              Search by road name, report ID, collector, or filter the review
              queue.
            </span>
          </div>

          <label>
            <span>Keyword search</span>
            <input
              defaultValue={searchQuery}
              maxLength={80}
              name="q"
              placeholder="Area, report ID, or note…"
              type="search"
            />
          </label>

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

          <label>
            <span>Sort order</span>
            <select defaultValue={sortMode} name="sort">
              <option value="newest">Newest first</option>
              <option value="priority">Triage priority (Pending first)</option>
              <option value="oldest">Oldest first</option>
              <option value="accuracy">Best GPS accuracy</option>
              <option value="confidence">Highest AI confidence</option>
            </select>
          </label>

          <button className="button primary" type="submit">
            Apply filters
          </button>
          {hasActiveFilters ? (
            <Link className="text-button" href="/admin">
              Clear all
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
                WORKFLOW_STATUS_LABELS[
                  submission.workflow_status as WorkflowStatus
                ] ?? submission.workflow_status;
              const shortId = submission.id.slice(0, 8).toUpperCase();

              return (
                <article
                  className="submission-card"
                  id={`submission-${submission.id}`}
                  key={submission.id}
                >
                  <div className="submission-image">
                    <Image
                      alt={`Road submission from ${submission.area_name}`}
                      fill
                      sizes="(max-width: 820px) 100vw, 320px"
                      src={`/api/images/${encodeURIComponent(submission.id)}`}
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
                        <div
                          style={{
                            alignItems: "center",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                          }}
                        >
                          <h3>{submission.area_name}</h3>
                          <code style={{ fontSize: "0.78rem", opacity: 0.75 }}>
                            #{shortId}
                          </code>
                        </div>
                        <p>{displayDefect(submission.suspected_defect)}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <small style={{ display: "block" }}>
                          Reported: {formatDate(submission.created_at)}
                        </small>
                        {submission.reviewed_at ? (
                          <small style={{ display: "block", opacity: 0.8 }}>
                            Reviewed: {formatDate(submission.reviewed_at)}
                          </small>
                        ) : null}
                      </div>
                    </div>

                    <dl className="submission-meta">
                      <div>
                        <dt>Collector</dt>
                        <dd>
                          <Link
                            href={buildAdminFilterHref(filterState, {
                              collector: submission.collector_id,
                            })}
                            title="Filter by this collector"
                          >
                            {submission.collector_id}
                          </Link>
                        </dd>
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
                            : "Needs privacy scan"}
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

                    {submission.review_note ? (
                      <p
                        className="status-update-message"
                        style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}
                      >
                        <strong>Latest review note:</strong>{" "}
                        {submission.review_note}
                      </p>
                    ) : null}

                    <div
                      style={{
                        alignItems: "center",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                      }}
                    >
                      <PrivacyRecheck submissionId={submission.id} />

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
                    </div>

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
                                  src={`/api/progress-images/${encodeURIComponent(progress.id)}`}
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
                            <input
                              max={maxDateTimeLocal}
                              name="capturedAt"
                              type="datetime-local"
                            />
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
              <div className="empty-state">
                <p>No submissions match these filters.</p>
                {hasActiveFilters ? (
                  <Link className="button secondary" href="/admin">
                    Reset filters
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}