"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { blurSensitiveRegions, fileDataUrl, type ImageDetection } from "../../../lib/privacy-image";

export default function PrivacyRecheck({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus("Loading the privacy detector…");
    try {
      const response = await fetch(`/api/images/${submissionId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The report image could not be loaded.");
      const sourceFile = new File([await response.blob()], "road-report.jpg", { type: "image/jpeg" });
      const dataUrl = await fileDataUrl(sourceFile);
      const detections = await new Promise<ImageDetection[]>((resolve, reject) => {
        const worker = workerRef.current ?? new Worker("/ai-worker.js", { type: "module" });
        workerRef.current = worker;
        const id = crypto.randomUUID();
        worker.onmessage = (event) => {
          if (event.data.kind === "progress") {
            setStatus("Downloading the privacy model…");
          } else if (event.data.id === id && event.data.kind === "result") {
            resolve(event.data.output as ImageDetection[]);
          } else if (event.data.id === id && event.data.kind === "error") {
            reject(new Error(event.data.message));
          }
        };
        worker.onerror = () => reject(new Error("The privacy detector could not run in this browser."));
        worker.postMessage({ id, image: dataUrl, task: "privacy-strict" });
      });
      setStatus(`Blurring ${detections.length} detected region${detections.length === 1 ? "" : "s"}…`);
      const safe = await blurSensitiveRegions(dataUrl, detections);
      const form = new FormData();
      form.append("id", submissionId);
      form.append("privacyBlurCount", String(detections.length));
      form.append("roadImage", new File([safe.blob], "admin-privacy-safe.jpg", { type: "image/jpeg" }));
      const saved = await fetch("/api/admin/submissions/privacy", { body: form, method: "POST" });
      if (!saved.ok) throw new Error("The privacy-safe replacement could not be saved.");
      setStatus(`${detections.length} region${detections.length === 1 ? "" : "s"} blurred. Review the image before verification.`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Privacy processing failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-privacy-recheck">
      <button className="button secondary" disabled={busy} onClick={() => void run()} type="button">
        {busy ? "Checking privacy…" : "Run privacy re-check"}
      </button>
      {status ? <small aria-live="polite">{status}</small> : null}
    </div>
  );
}
