"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  DEFECT_TYPE_LABELS,
  getDirectionsUrl,
  isValidGpsCoordinate,
  statusAllowsDirections,
  WORKFLOW_STATUS_LABELS,
  type DefectType,
  type WorkflowStatus,
} from "../../../lib/config";
import type { RoadSubmission } from "../../../lib/submissions";

type MappedSubmission = RoadSubmission & {
  latitude: number;
  longitude: number;
};

const STATUS_COLOURS: Readonly<Record<string, string>> = {
  assigned: "#3976a8",
  "assigned-for-repair": "#3976a8",
  "inspection-scheduled": "#7966b5",
  pending: "#d18b18",
  rejected: "#b44a38",
  "repair-completed": "#157347",
  "repair-in-progress": "#287f91",
  verified: "#23845f",
};

const DEFAULT_MARKER_COLOUR = "#475569";

const POPUP_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDefectLabel(defect: string): string {
  if (defect in DEFECT_TYPE_LABELS) {
    return DEFECT_TYPE_LABELS[defect as DefectType];
  }
  return defect.replaceAll("-", " ");
}

function formatStatusLabel(status: string): string {
  if (status in WORKFLOW_STATUS_LABELS) {
    return WORKFLOW_STATUS_LABELS[status as WorkflowStatus];
  }
  return status.replaceAll("-", " ");
}

function formatPopupDate(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return POPUP_DATE_FORMATTER.format(parsed);
}

function MapViewportSync({
  submissions,
}: {
  submissions: MappedSubmission[];
}) {
  const map = useMap();

  const boundsSignature = useMemo(
    () =>
      submissions
        .map(
          (item) =>
            `${item.id}:${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`,
        )
        .join("|"),
    [submissions],
  );

  useEffect(() => {
    if (submissions.length === 0) return;

    if (submissions.length === 1) {
      const [only] = submissions;
      map.setView([only.latitude, only.longitude], 15, { animate: true });
      return;
    }

    const points: [number, number][] = submissions.map((item) => [
      item.latitude,
      item.longitude,
    ]);

    try {
      map.fitBounds(points, {
        animate: true,
        maxZoom: 16,
        padding: [36, 36],
      });
    } catch {
      // Fallback if fitBounds fails on identical coordinates
      const [first] = submissions;
      map.setView([first.latitude, first.longitude], 13);
    }
  }, [boundsSignature, map, submissions]);

  return null;
}

export default function SubmissionMap({
  submissions,
}: {
  submissions: RoadSubmission[];
}) {
  const mappedSubmissions = useMemo(
    () =>
      submissions.filter((submission): submission is MappedSubmission =>
        isValidGpsCoordinate(submission.latitude, submission.longitude),
      ),
    [submissions],
  );

  if (mappedSubmissions.length === 0) {
    return (
      <div className="map-loading" role="status">
        No mapped locations match the current filters.
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
    <MapContainer
      center={centre}
      className="submission-map"
      scrollWheelZoom
      zoom={12}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapViewportSync submissions={mappedSubmissions} />

      {mappedSubmissions.map((submission) => {
        const fillColour =
          STATUS_COLOURS[submission.workflow_status] ?? DEFAULT_MARKER_COLOUR;
        const statusLabel = formatStatusLabel(submission.workflow_status);
        const defectLabel = formatDefectLabel(submission.suspected_defect);
        const shortId = submission.id.slice(0, 8).toUpperCase();

        return (
          <CircleMarker
            center={[submission.latitude, submission.longitude]}
            key={`${submission.id}-${submission.workflow_status}`}
            pathOptions={{
              color: "#ffffff",
              fillColor: fillColour,
              fillOpacity: 0.88,
              weight: 2,
            }}
            radius={9}
          >
            <Popup>
              <div style={{ lineHeight: 1.45, minWidth: "190px" }}>
                <strong>{submission.area_name}</strong>{" "}
                <code style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                  #{shortId}
                </code>
                <br />
                <span>
                  {defectLabel} · <strong>{statusLabel}</strong>
                </span>
                <br />
                <small>
                  Collector: {submission.collector_id} (
                  {submission.source === "drone-ai" ? "Drone AI" : "Manual"})
                </small>
                <br />
                <small>
                  Coordinates: {submission.latitude.toFixed(5)},{" "}
                  {submission.longitude.toFixed(5)}
                  {typeof submission.gps_accuracy === "number"
                    ? ` (±${Math.round(submission.gps_accuracy)}m)`
                    : ""}
                </small>
                <br />
                <small>Reported: {formatPopupDate(submission.created_at)}</small>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.65rem",
                    marginTop: "0.45rem",
                  }}
                >
                  <a href={`#submission-${submission.id}`}>
                    Jump to review card
                  </a>
                  {statusAllowsDirections(submission.workflow_status) ? (
                    <a
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
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}