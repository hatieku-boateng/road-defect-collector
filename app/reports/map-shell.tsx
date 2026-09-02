"use client";

import dynamic from "next/dynamic";
import type { PublicRoadSubmission } from "../../lib/submissions";

const PublicReportsMap = dynamic(() => import("./public-reports-map"), {
  loading: () => <div className="map-loading">Loading verified road locations…</div>,
  ssr: false,
});

export default function MapShell({
  submissions,
}: {
  submissions: PublicRoadSubmission[];
}) {
  return <PublicReportsMap submissions={submissions} />;
}
