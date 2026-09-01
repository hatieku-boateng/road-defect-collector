"use client";

import dynamic from "next/dynamic";
import type { RoadSubmission } from "../../../lib/submissions";

const SubmissionMap = dynamic(() => import("./submission-map"), {
  loading: () => <div className="map-loading">Loading collection map…</div>,
  ssr: false,
});

export default function MapShell({
  submissions,
}: {
  submissions: RoadSubmission[];
}) {
  return <SubmissionMap submissions={submissions} />;
}
