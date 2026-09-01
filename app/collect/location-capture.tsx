"use client";

import { useState } from "react";

type LocationData = {
  accuracy: number;
  latitude: number;
  longitude: number;
  timestamp: string;
};

function getLocationError(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied. Allow location access and try again.";
    case error.POSITION_UNAVAILABLE:
      return "Your location is currently unavailable. Move to an open area and try again.";
    case error.TIMEOUT:
      return "Location capture took too long. Please try again.";
    default:
      return "The location could not be captured. Please try again.";
  }
}

export default function LocationCapture() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setError("This browser does not support GPS location capture.");
      return;
    }

    setError(null);
    setIsCapturing(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          accuracy: position.coords.accuracy,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date(position.timestamp).toISOString(),
        });
        setIsCapturing(false);
      },
      (positionError) => {
        setError(getLocationError(positionError));
        setIsCapturing(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  }

  return (
    <div className="location-field">
      <div className="location-copy">
        <span>GPS location</span>
        <small>
          {location
            ? "Location captured on this device."
            : "Allow precise location access when prompted."}
        </small>
      </div>

      <button disabled={isCapturing} onClick={captureLocation} type="button">
        {isCapturing
          ? "Capturing…"
          : location
            ? "Capture again"
            : "Capture GPS"}
      </button>

      {location ? (
        <dl className="location-result" aria-live="polite">
          <div>
            <dt>Latitude</dt>
            <dd>{location.latitude.toFixed(6)}</dd>
          </div>
          <div>
            <dt>Longitude</dt>
            <dd>{location.longitude.toFixed(6)}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd>±{Math.round(location.accuracy)} metres</dd>
          </div>
        </dl>
      ) : null}

      <p className="location-error" role="alert">
        {error}
      </p>

      <input
        name="latitude"
        type="hidden"
        value={location?.latitude ?? ""}
      />
      <input
        name="longitude"
        type="hidden"
        value={location?.longitude ?? ""}
      />
      <input
        name="gpsAccuracy"
        type="hidden"
        value={location?.accuracy ?? ""}
      />
      <input
        name="gpsTimestamp"
        type="hidden"
        value={location?.timestamp ?? ""}
      />
    </div>
  );
}
