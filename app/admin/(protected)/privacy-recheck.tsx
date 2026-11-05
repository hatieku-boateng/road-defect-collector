"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  blurSensitiveRegions,
  fileDataUrl,
  type ImageDetection,
} from "../../../lib/privacy-image";
const WORKER_TIMEOUT_MS = 60_000;
const UPLOAD_TIMEOUT_MS = 30_000;

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function resolveOutputMime(
  rawType: string | null,
): "image/jpeg" | "image/png" | "image/webp" {
  const cleaned = (rawType ?? "").split(";")[0].trim().toLowerCase();
  if (cleaned === "image/png") return "image/png";
  if (cleaned === "image/webp") return "image/webp";
  return "image/jpeg";
}

function extensionForMime(
  mime: "image/jpeg" | "image/png" | "image/webp",
): "jpg" | "png" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export default function PrivacyRecheck({
  submissionId,
}: {
  submissionId: string;
}) {
  const router = useRouter();
  const workerRef = useRef<Worker | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  function runWorkerDetection(imageDataUrl: string): Promise<ImageDetection[]> {
    return new Promise<ImageDetection[]>((resolve, reject) => {
      let worker = workerRef.current;
      if (!worker) {
        try {
          worker = new Worker("/ai-worker.js", { type: "module" });
          workerRef.current = worker;
        } catch {
          reject(
            new Error("The privacy detector could not start in this browser."),
          );
          return;
        }
      }

      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => {
        cleanup();
        // Reset stalled worker instance
        worker?.terminate();
        if (workerRef.current === worker) {
          workerRef.current = null;
        }
        reject(new Error("The privacy scan timed out. Please try again."));
      }, WORKER_TIMEOUT_MS);

      function handleMessage(event: MessageEvent) {
        const payload = event.data as {
          id?: string;
          kind?: string;
          message?: string;
          output?: unknown;
        } | null;

        if (!payload || typeof payload !== "object") return;

        if (payload.kind === "progress") {
          if (mountedRef.current) {
            setStatus("Downloading the privacy model…");
          }
          return;
        }

        if (payload.id !== requestId) return;

        if (payload.kind === "result") {
          cleanup();
          resolve(
            Array.isArray(payload.output)
              ? (payload.output as ImageDetection[])
              : [],
          );
        } else if (payload.kind === "error") {
          cleanup();
          reject(
            new Error(payload.message || "The privacy detector encountered an error."),
          );
        }
      }

      function handleError() {
        cleanup();
        worker?.terminate();
        if (workerRef.current === worker) {
          workerRef.current = null;
        }
        reject(
          new Error("The privacy detector could not run in this browser."),
        );
      }

      function cleanup() {
        clearTimeout(timer);
        worker?.removeEventListener("message", handleMessage);
        worker?.removeEventListener("error", handleError);
      }

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.postMessage({
        id: requestId,
        image: imageDataUrl,
        task: "privacy-strict",
      });
    });
  }

  async function run() {
    if (busy || !submissionId) return;

    setBusy(true);
    setIsError(false);
    setStatus("Loading the report image…");

    try {
      const response = await fetch(
        `/api/images/${encodeURIComponent(submissionId)}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("The report image could not be loaded.");
      }

      const sourceBlob = await response.blob();
      if (sourceBlob.size <= 0) {
        throw new Error("The report image is empty.");
      }

      const outputMime = resolveOutputMime(
        ALLOWED_MIMES.has(sourceBlob.type)
          ? sourceBlob.type
          : response.headers.get("content-type"),
      );
      const ext = extensionForMime(outputMime);

      const dataUrl = await fileDataUrl(sourceBlob);
      if (!mountedRef.current) return;

      setStatus("Scanning image for faces and license plates…");
      const detections = await runWorkerDetection(dataUrl);
      if (!mountedRef.current) return;

      setStatus(
        detections.length > 0
          ? `Blurring ${detections.length} detected region${detections.length === 1 ? "" : "s"}…`
          : "Applying privacy-safe verification…",
      );

      const safe = await blurSensitiveRegions(dataUrl, detections, {
        mimeType: outputMime,
        quality: 0.9,
      });
      if (!mountedRef.current) return;

      const appliedCount =
        typeof safe.appliedCount === "number"
          ? safe.appliedCount
          : detections.length;

      setStatus("Saving privacy-safe replacement…");

      const form = new FormData();
      form.append("id", submissionId);
      form.append("privacyBlurCount", String(appliedCount));
      form.append(
        "roadImage",
        new File([safe.blob], `admin-privacy-safe.${ext}`, {
          type: outputMime,
        }),
      );

      const controller = new AbortController();
      const uploadTimer = setTimeout(
        () => controller.abort(),
        UPLOAD_TIMEOUT_MS,
      );

      let saved: Response;
      try {
        saved = await fetch("/api/admin/submissions/privacy", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(uploadTimer);
      }

      const body = (await saved.json().catch(() => ({}))) as {
        error?: string;
        privacyBlurCount?: number;
      };

      if (!saved.ok) {
        throw new Error(
          body.error || "The privacy-safe replacement could not be saved.",
        );
      }

      const finalBlurCount =
        typeof body.privacyBlurCount === "number"
          ? body.privacyBlurCount
          : appliedCount;

      if (mountedRef.current) {
        setIsError(false);
        setStatus(
          `${finalBlurCount} region${finalBlurCount === 1 ? "" : "s"} blurred. Review the updated image before verification.`,
        );
        router.refresh();
      }
    } catch (error) {
      if (mountedRef.current) {
        setIsError(true);
        setStatus(
          error instanceof Error && error.name === "AbortError"
            ? "Saving the privacy-safe image timed out. Please try again."
            : error instanceof Error
              ? error.message
              : "Privacy processing failed.",
        );
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  }

  return (
    <div className="admin-privacy-recheck">
      <button
        aria-busy={busy}
        className="button secondary"
        disabled={busy}
        onClick={() => void run()}
        type="button"
      >
        {busy ? "Checking privacy…" : "Run privacy re-check"}
      </button>
      {status ? (
        <small
          aria-live="polite"
          role={isError ? "alert" : "status"}
        >
          {status}
        </small>
      ) : null}
    </div>
  );
}