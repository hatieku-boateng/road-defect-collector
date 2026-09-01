"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { RoadSubmission } from "../../../lib/submissions";

const statusColours = {
  approved: "#23845f",
  pending: "#d18b18",
  rejected: "#b44a38",
};

export default function SubmissionMap({
  submissions,
}: {
  submissions: RoadSubmission[];
}) {
  if (submissions.length === 0) {
    return <div className="map-loading">No locations match the current filters.</div>;
  }

  const centre: [number, number] = [
    submissions.reduce((sum, item) => sum + item.latitude, 0) /
      submissions.length,
    submissions.reduce((sum, item) => sum + item.longitude, 0) /
      submissions.length,
  ];

  return (
    <MapContainer center={centre} className="submission-map" scrollWheelZoom zoom={12}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {submissions.map((submission) => (
        <CircleMarker
          center={[submission.latitude, submission.longitude]}
          fillColor={statusColours[submission.status]}
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
            Collector: {submission.collector_id}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
