"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import {
  getDirectionsUrl,
  WORKFLOW_STATUS_LABELS,
} from "../../lib/config";
import type { PublicRoadSubmission } from "../../lib/submissions";

const statusColours = {
  assigned: "#3976a8",
  "inspection-scheduled": "#7966b5",
  pending: "#d18b18",
  rejected: "#b44a38",
  "repair-completed": "#157347",
  "repair-in-progress": "#287f91",
  verified: "#23845f",
};

export default function PublicReportsMap({
  submissions,
}: {
  submissions: PublicRoadSubmission[];
}) {
  const mappedSubmissions = submissions.filter(
    (submission): submission is PublicRoadSubmission & {
      latitude: number;
      longitude: number;
    } => submission.latitude !== null && submission.longitude !== null,
  );

  if (mappedSubmissions.length === 0) {
    return (
      <div className="map-loading">
        Verified road locations will appear here.
      </div>
    );
  }

  const centre: [number, number] = [
    mappedSubmissions.reduce((sum, item) => sum + item.latitude, 0) /
      mappedSubmissions.length,
    mappedSubmissions.reduce((sum, item) => sum + item.longitude, 0) /
      mappedSubmissions.length,
  ];

  return (
    <MapContainer center={centre} className="submission-map" scrollWheelZoom zoom={12}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mappedSubmissions.map((submission) => (
        <CircleMarker
          center={[submission.latitude, submission.longitude]}
          fillColor={statusColours[submission.workflow_status]}
          fillOpacity={0.85}
          key={submission.id}
          pathOptions={{ color: "#ffffff", weight: 2 }}
          radius={9}
        >
          <Popup>
            <strong>{submission.area_name}</strong>
            <br />
            {submission.suspected_defect.replaceAll("-", " ")}
            <br />
            {WORKFLOW_STATUS_LABELS[submission.workflow_status]}
            <br />
            <a
              href={getDirectionsUrl(submission.latitude, submission.longitude)}
              rel="noreferrer"
              target="_blank"
            >
              Show directions
            </a>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
