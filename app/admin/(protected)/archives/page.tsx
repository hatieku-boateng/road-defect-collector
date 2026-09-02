import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { WORKFLOW_STATUS_LABELS } from "../../../../lib/config";
import {
  listArchivedSubmissions,
  listProgressImages,
  type RoadProgressImage,
} from "../../../../lib/submissions";

export const metadata: Metadata = { title: "Submission archives" };

type ArchivesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ArchivesPage({ searchParams }: ArchivesPageProps) {
  const params = await searchParams;
  const restore = typeof params.restore === "string" ? params.restore : "";
  const submissions = await listArchivedSubmissions();
  let progressImages: RoadProgressImage[] = [];

  if (submissions.length > 0) progressImages = await listProgressImages(true);
  const progressBySubmission = new Map<string, RoadProgressImage[]>();
  for (const image of progressImages) {
    const images = progressBySubmission.get(image.submission_id) ?? [];
    images.push(image);
    progressBySubmission.set(image.submission_id, images);
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="brand" href="/admin">
          <span className="brand-mark" aria-hidden="true">GR</span>
          <span><strong>Road Data Archives</strong><small>Recoverable submissions</small></span>
        </Link>
        <Link className="button secondary" href="/admin">Back to dashboard</Link>
      </header>
      <section className="admin-content">
        <div className="admin-title-row">
          <div>
            <p className="eyebrow">Recoverable records</p>
            <h1>Submission archives.</h1>
          </div>
          <span className="archive-count">{submissions.length} archived</span>
        </div>
        {restore === "success" ? (
          <p className="status-update-message status-update-success">Submission restored successfully.</p>
        ) : null}
        {restore === "failed" ? (
          <p className="status-update-message status-update-failed">The submission could not be restored.</p>
        ) : null}
        <div className="archive-grid">
          {submissions.map((submission) => (
            <article className="archive-card" key={submission.id}>
              <div className="archive-gallery">
                <figure>
                  <span><Image alt={`Archived report from ${submission.area_name}`} fill sizes="320px" src={`/api/images/${submission.id}`} unoptimized /></span>
                  <figcaption>Before</figcaption>
                </figure>
                {progressBySubmission.get(submission.id)?.map((progress) => (
                  <figure key={progress.id}>
                    <span><Image alt={`${progress.stage} repair`} fill sizes="320px" src={`/api/progress-images/${progress.id}`} unoptimized /></span>
                    <figcaption>{progress.stage.replaceAll("-", " ")}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="archive-card-body">
                <span className={`review-badge-static review-${submission.workflow_status}`}>
                  {WORKFLOW_STATUS_LABELS[submission.workflow_status]}
                </span>
                <h2>{submission.area_name}</h2>
                <p>{submission.suspected_defect.replaceAll("-", " ")}</p>
                <dl>
                  <div><dt>Reported</dt><dd>{formatDate(submission.created_at)}</dd></div>
                  <div><dt>Archived</dt><dd>{formatDate(submission.archived_at!)}</dd></div>
                  {submission.archive_reason ? <div><dt>Reason</dt><dd>{submission.archive_reason}</dd></div> : null}
                </dl>
                <form action="/api/admin/submissions/restore" method="post">
                  <input name="id" type="hidden" value={submission.id} />
                  <button className="button primary" type="submit">Restore submission</button>
                </form>
              </div>
            </article>
          ))}
          {submissions.length === 0 ? <p className="empty-state">The archive is empty.</p> : null}
        </div>
      </section>
    </main>
  );
}
