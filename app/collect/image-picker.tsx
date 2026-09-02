"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  blurSensitiveRegions,
  fileDataUrl,
  type ImageDetection,
} from "../../lib/privacy-image";

type Preview = {
  name: string;
  size: string;
  url: string;
  privacyCount: number;
};

type PendingRequest = {
  reject: (reason: Error) => void;
  resolve: (value: ImageDetection[]) => void;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImagePicker() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const processedInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestsRef = useRef(new Map<string, PendingRequest>());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [privacyStatus, setPrivacyStatus] = useState("Privacy check will run before upload.");

  useEffect(() => {
    const requests = requestsRef.current;
    return () => {
      workerRef.current?.terminate();
      requests.forEach(({ reject }) => reject(new Error("Privacy processing was cancelled.")));
      requests.clear();
    };
  }, []);

  function getWorker() {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker("/ai-worker.js", { type: "module" });
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.kind === "progress" && message.model === "privacy") {
        const percent = Number(message.progress?.progress ?? 0);
        const suffix = Number.isFinite(percent) && percent > 0
          ? ` ${Math.round(percent)}%`
          : "";
        setPrivacyStatus(`Loading privacy detector…${suffix}`);
        return;
      }

      const pending = requestsRef.current.get(message.id);
      if (!pending) return;
      requestsRef.current.delete(message.id);
      if (message.kind === "error") pending.reject(new Error(message.message));
      else pending.resolve(message.output as ImageDetection[]);
    };
    worker.onerror = () => {
      const workerError = new Error("The privacy detector could not start in this browser.");
      requestsRef.current.forEach(({ reject }) => reject(workerError));
      requestsRef.current.clear();
      worker.terminate();
      workerRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  }

  function detectSensitiveObjects(image: string) {
    return new Promise<ImageDetection[]>((resolve, reject) => {
      const id = crypto.randomUUID();
      requestsRef.current.set(id, { reject, resolve });
      getWorker().postMessage({ id, image, task: "privacy" });
    });
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setPreview(null);
      setError(null);
      setPrivacyStatus("Privacy check will run before upload.");
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      event.target.value = "";
      setPreview(null);
      setError("Please choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      event.target.value = "";
      setPreview(null);
      setError("This image is larger than 10 MB. Please choose a smaller file.");
      return;
    }

    setError(null);
    setPreview(null);
    setIsProcessing(true);
    setPrivacyStatus("Checking the image for people and vehicles…");

    try {
      const originalDataUrl = await fileDataUrl(file);
      const detections = await detectSensitiveObjects(originalDataUrl);
      setPrivacyStatus(detections.length > 0
        ? `Blurring ${detections.length} sensitive region${detections.length === 1 ? "" : "s"}…`
        : "No people or vehicles detected. Privacy check complete.");
      const processed = await blurSensitiveRegions(originalDataUrl, detections);
      const safeName = file.name.replace(/\.[^.]+$/, "") || "road-image";
      const safeFile = new File([processed.blob], `${safeName}-privacy-safe.jpg`, {
        type: "image/jpeg",
      });
      const transfer = new DataTransfer();
      transfer.items.add(safeFile);
      if (processedInputRef.current) processedInputRef.current.files = transfer.files;

      setPreview({
        name: safeFile.name,
        privacyCount: detections.length,
        size: formatFileSize(safeFile.size),
        url: processed.dataUrl,
      });
      setPrivacyStatus(detections.length > 0
        ? `${detections.length} sensitive region${detections.length === 1 ? "" : "s"} blurred. Privacy check complete.`
        : "Privacy check complete. The image is ready.");
    } catch (processingError) {
      event.target.value = "";
      setPreview(null);
      setError(processingError instanceof Error
        ? processingError.message
        : "The image could not be made privacy-safe.");
      setPrivacyStatus("The image was not uploaded. Choose it again to retry.");
    } finally {
      setIsProcessing(false);
    }
  }

  function clearImage() {
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (processedInputRef.current) processedInputRef.current.value = "";

    setPreview(null);
    setError(null);
    setPrivacyStatus("Privacy check will run before upload.");
  }

  return (
    <div className="field image-field">
      <label>Road image</label>
      <div className="image-source-actions">
        <button
          disabled={isProcessing}
          onClick={() => cameraInputRef.current?.click()}
          type="button"
        >
          <span aria-hidden="true">◎</span>
          Take a photo
        </button>
        <button
          disabled={isProcessing}
          onClick={() => uploadInputRef.current?.click()}
          type="button"
        >
          <span aria-hidden="true">↑</span>
          Choose existing photo
        </button>
      </div>
      <input
        accept="image/*"
        aria-label="Take a road photo with this device"
        aria-describedby="road-image-guidance road-image-error"
        aria-invalid={Boolean(error)}
        capture="environment"
        disabled={isProcessing}
        onChange={handleImageChange}
        ref={cameraInputRef}
        type="file"
        hidden
      />
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose an existing road photo"
        aria-describedby="road-image-guidance road-image-error"
        aria-invalid={Boolean(error)}
        disabled={isProcessing}
        onChange={handleImageChange}
        ref={uploadInputRef}
        type="file"
        hidden
      />
      <input
        aria-hidden="true"
        name="roadImage"
        ref={processedInputRef}
        tabIndex={-1}
        type="file"
        hidden
      />
      <small id="road-image-guidance">
        Use the rear camera on a phone or tablet, or choose a JPG, PNG, or WebP image up to 10 MB.
        People and vehicles are blurred locally before upload.
      </small>

      <input name="privacyProcessed" type="hidden" value={preview ? "true" : ""} />
      <input name="privacyBlurCount" type="hidden" value={preview?.privacyCount ?? ""} />

      <p className="field-error" id="road-image-error" role="alert">
        {error}
      </p>

      {preview ? (
        <div className="image-preview">
          <div className="preview-frame">
            <Image
              alt="Preview of the selected road image"
              fill
              sizes="(max-width: 820px) 100vw, 480px"
              src={preview.url}
              unoptimized
            />
          </div>
          <div className="preview-details">
            <p>
              <strong>{preview.name}</strong>
              <span>
                {preview.size} • Privacy-safe • {preview.privacyCount} region{preview.privacyCount === 1 ? "" : "s"} blurred
              </span>
            </p>
            <button onClick={clearImage} type="button">
              Remove image
            </button>
          </div>
        </div>
      ) : (
        <div className="preview-placeholder">
          <span aria-hidden="true">+</span>
          <p>Your selected image preview will appear here.</p>
        </div>
      )}
      <p className="privacy-status" aria-live="polite">
        {isProcessing ? "Please wait. " : ""}{privacyStatus}
      </p>
    </div>
  );
}
