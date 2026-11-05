"use client";

import dynamic from "next/dynamic";
import { Component, useMemo, type ReactNode } from "react";
import { isValidGpsCoordinate } from "../../../lib/config";
import type { RoadSubmission } from "../../../lib/submissions";

const SubmissionMap = dynamic(() => import("./submission-map"), {
  loading: () => (
    <div aria-busy="true" aria-live="polite" className="map-loading" role="status">
      Loading collection map…
    </div>
  ),
  ssr: false,
});

type MapErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type MapErrorBoundaryState = {
  hasError: boolean;
};

class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: MapErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="map-loading" role="alert">
          <p>The interactive map could not be displayed right now.</p>
          <button
            className="button secondary"
            onClick={() => this.setState({ hasError: false })}
            type="button"
          >
            Retry loading map
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function MapShell({
  submissions,
}: {
  submissions: RoadSubmission[];
}) {
  const validSubmissions = useMemo(() => {
    if (!Array.isArray(submissions)) return [];
    return submissions.filter((submission) =>
      isValidGpsCoordinate(submission.latitude, submission.longitude),
    );
  }, [submissions]);

  const resetKey = useMemo(
    () =>
      validSubmissions
        .slice(0, 25)
        .map((item) => `${item.id}:${item.workflow_status}`)
        .join("|"),
    [validSubmissions],
  );

  return (
    <MapErrorBoundary resetKey={resetKey}>
      <section aria-label="Road defect geographical map">
        <SubmissionMap submissions={validSubmissions} />
      </section>
    </MapErrorBoundary>
  );
}