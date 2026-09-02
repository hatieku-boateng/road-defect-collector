"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  blurSensitiveRegions,
  type ImageDetection,
} from "../../lib/privacy-image";

type Candidate = {
  detections: ImageDetection[];
  id: string;
  image: string;
  imageHeight: number;
  imageWidth: number;
  privacyCount: number;
  saved: boolean;
  selected: boolean;
  time: number;
};
type PendingRequest = {
  reject: (reason: Error) => void;
  resolve: (value: ImageDetection[]) => void;
};

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const SAMPLE_INTERVAL = 2;
const MAX_FRAMES = 12;

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function waitForEvent(target: HTMLMediaElement, name: "loadedmetadata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    const handleEvent = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(() => {
      target.removeEventListener(name, handleEvent);
      reject(new Error("The video could not be read."));
    }, 15000);
    target.addEventListener(name, handleEvent, { once: true });
  });
}

async function frameAt(video: HTMLVideoElement, canvas: HTMLCanvasElement, time: number) {
  video.currentTime = time;
  await waitForEvent(video, "seeked");

  const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser cannot extract video frames.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return {
    height: canvas.height,
    image: canvas.toDataURL("image/jpeg", 0.86),
    width: canvas.width,
  };
}

export default function DroneAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestsRef = useRef(new Map<string, PendingRequest>());
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [status, setStatus] = useState("Choose a short drone video to begin.");
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [areaName, setAreaName] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const requests = requestsRef.current;
    return () => {
      workerRef.current?.terminate();
      requests.forEach(({ reject }) => reject(new Error("Analysis was cancelled.")));
      requests.clear();
    };
  }, []);

  function getWorker() {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker("/ai-worker.js", { type: "module" });
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.kind === "progress") {
        const percent = Number(message.progress?.progress ?? 0);
        const suffix = Number.isFinite(percent) && percent > 0 ? ` ${Math.round(percent)}%` : "";
        setStatus(message.model === "privacy"
          ? `Loading the privacy detector…${suffix}`
          : `Loading the pothole detector…${suffix}`);
        return;
      }
      const pending = requestsRef.current.get(message.id);
      if (!pending) return;
      requestsRef.current.delete(message.id);
      if (message.kind === "error") pending.reject(new Error(message.message));
      else pending.resolve(message.output as ImageDetection[]);
    };
    worker.onerror = () => {
      const error = new Error("The AI model could not start in this browser.");
      requestsRef.current.forEach(({ reject }) => reject(error));
      requestsRef.current.clear();
      worker.terminate();
      workerRef.current = null;
      setStatus(error.message);
    };
    workerRef.current = worker;
    return worker;
  }

  function detect(image: string, task: "pothole" | "privacy") {
    return new Promise<ImageDetection[]>((resolve, reject) => {
      const id = crypto.randomUUID();
      requestsRef.current.set(id, { reject, resolve });
      getWorker().postMessage({ id, image, task });
    });
  }

  function chooseVideo(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setCandidates([]);
    setSaveError("");
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.type.startsWith("video/")) {
      event.target.value = "";
      setFile(null);
      setFileError("Choose a valid video file.");
      return;
    }
    if (selected.size > MAX_VIDEO_SIZE) {
      event.target.value = "";
      setFile(null);
      setFileError("Choose a video smaller than 500 MB for this pilot.");
      return;
    }
    setFileError("");
    setFile(selected);
    setStatus(`${selected.name} is ready for local analysis.`);
  }

  async function analyseVideo() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!file || !video || !canvas) return;
    setIsAnalysing(true);
    setCandidates([]);
    setSaveError("");
    const objectUrl = URL.createObjectURL(file);

    try {
      video.src = objectUrl;
      await waitForEvent(video, "loadedmetadata");
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        throw new Error("The selected video has no readable duration.");
      }

      const times: number[] = [];
      for (let time = Math.min(0.2, video.duration / 2); time < video.duration && times.length < MAX_FRAMES; time += SAMPLE_INTERVAL) {
        times.push(time);
      }

      const found: Candidate[] = [];
      for (let index = 0; index < times.length; index += 1) {
        setStatus(`Extracting and analysing frame ${index + 1} of ${times.length}…`);
        const frame = await frameAt(video, canvas, times[index]);
        const detections = await detect(frame.image, "pothole");
        if (detections.length > 0) {
          setStatus(`Applying privacy protection to candidate ${found.length + 1}…`);
          const sensitiveObjects = await detect(frame.image, "privacy");
          const privacySafeFrame = await blurSensitiveRegions(frame.image, sensitiveObjects);
          found.push({
            detections,
            id: crypto.randomUUID(),
            image: privacySafeFrame.dataUrl,
            imageHeight: frame.height,
            imageWidth: frame.width,
            privacyCount: sensitiveObjects.length,
            saved: false,
            selected: true,
            time: times[index],
          });
          setCandidates([...found]);
        }
      }
      setStatus(found.length > 0
        ? `${found.length} candidate frame${found.length === 1 ? "" : "s"} found. Review them below.`
        : "No pothole candidates were found in the sampled frames.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The footage could not be analysed.");
    } finally {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      setIsAnalysing(false);
    }
  }

  function toggleCandidate(id: string) {
    setCandidates((items) => items.map((item) =>
      item.id === id && !item.saved ? { ...item, selected: !item.selected } : item));
  }

  async function saveCandidates() {
    const selected = candidates.filter((item) => item.selected && !item.saved);
    setSaveError("");
    if (!/^[a-z0-9][a-z0-9_-]{2,49}$/i.test(operatorId)) {
      setSaveError("Enter a valid operator ID using 3–50 letters, numbers, hyphens or underscores.");
      return;
    }
    if (areaName.trim().length < 3 || areaName.trim().length > 160) {
      setSaveError("Enter a road or area name between 3 and 160 characters.");
      return;
    }
    if (selected.length === 0) {
      setSaveError("Select at least one unsaved candidate.");
      return;
    }

    setIsSaving(true);
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const candidate = selected[index];
        setStatus(`Saving candidate ${index + 1} of ${selected.length}…`);
        const imageBlob = await fetch(candidate.image).then((response) => response.blob());
        const bestConfidence = Math.max(...candidate.detections.map((item) => item.score));
        const formData = new FormData();
        formData.set("collectorId", operatorId.trim());
        formData.set("areaName", areaName.trim());
        formData.set("suspectedDefect", "pothole");
        formData.set("source", "drone-ai");
        formData.set("videoTimestamp", String(candidate.time));
        formData.set("aiConfidence", String(bestConfidence));
        formData.set("privacyProcessed", "true");
        formData.set("privacyBlurCount", String(candidate.privacyCount));
        formData.set("roadImage", imageBlob, `drone-frame-${candidate.time.toFixed(1)}.jpg`);

        const response = await fetch("/api/submissions", { body: formData, method: "POST" });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "A candidate could not be saved.");
        setCandidates((items) => items.map((item) =>
          item.id === candidate.id ? { ...item, saved: true, selected: false } : item));
      }
      setStatus(`${selected.length} candidate${selected.length === 1 ? "" : "s"} submitted for human verification.`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The candidates could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCount = candidates.filter((item) => item.selected && !item.saved).length;

  return (
    <section className="drone-workspace">
      <div className="form-heading">
        <div><p className="eyebrow">New analysis</p><h2>Drone footage</h2></div>
        <span>Runs locally</span>
      </div>

      <label className="field">
        <span>Drone video</span>
        <input accept="video/*" disabled={isAnalysing} onChange={chooseVideo} type="file" />
        <small>MP4, WebM, or another browser-supported format. Maximum 500 MB.</small>
        <span className="field-error" role="alert">{fileError}</span>
      </label>

      <button className="submit-button" disabled={!file || isAnalysing || isSaving} onClick={analyseVideo} type="button">
        {isAnalysing ? "Analysing footage…" : "Analyse for potholes"}
      </button>
      <p className="ai-status" aria-live="polite">{status}</p>

      <video className="analysis-media" muted playsInline preload="metadata" ref={videoRef} />
      <canvas className="analysis-media" ref={canvasRef} />

      {candidates.length > 0 ? (
        <div className="candidate-review">
          <div className="candidate-heading">
            <div><p className="eyebrow">Human review</p><h3>Select genuine candidates</h3></div>
            <span>{selectedCount} selected</span>
          </div>
          <div className="candidate-grid">
            {candidates.map((candidate) => (
              <button
                aria-pressed={candidate.selected}
                className={`candidate-card ${candidate.selected ? "candidate-selected" : ""} ${candidate.saved ? "candidate-saved" : ""}`}
                disabled={candidate.saved || isSaving}
                key={candidate.id}
                onClick={() => toggleCandidate(candidate.id)}
                type="button"
              >
                <span
                  className="candidate-image"
                  style={{ aspectRatio: `${candidate.imageWidth} / ${candidate.imageHeight}` }}
                >
                  {/* Data URLs are generated locally from the selected video. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={`Drone frame at ${formatTime(candidate.time)}`} src={candidate.image} />
                  {candidate.detections.map((detection, index) => (
                    <i
                      className="detection-box"
                      key={`${candidate.id}-${index}`}
                      style={{
                        height: `${Math.max(0, detection.box.ymax - detection.box.ymin) / candidate.imageHeight * 100}%`,
                        left: `${detection.box.xmin / candidate.imageWidth * 100}%`,
                        top: `${detection.box.ymin / candidate.imageHeight * 100}%`,
                        width: `${Math.max(0, detection.box.xmax - detection.box.xmin) / candidate.imageWidth * 100}%`,
                      }}
                    />
                  ))}
                </span>
                <span className="candidate-details">
                  <strong>{candidate.saved ? "Submitted" : candidate.selected ? "Selected" : "Not selected"}</strong>
                  <small>
                    {formatTime(candidate.time)} • Confidence {Math.round(Math.max(...candidate.detections.map((item) => item.score)) * 100)}% • {candidate.privacyCount} blurred
                  </small>
                </span>
              </button>
            ))}
          </div>

          <div className="candidate-submit">
            <label className="field"><span>Drone operator ID</span><input maxLength={50} onChange={(event) => setOperatorId(event.target.value)} placeholder="e.g. DRONE-001" value={operatorId} /></label>
            <label className="field"><span>Road or surveillance area</span><input maxLength={160} onChange={(event) => setAreaName(event.target.value)} placeholder="e.g. Tema Motorway" value={areaName} /></label>
            <button className="submit-button" disabled={selectedCount === 0 || isSaving} onClick={saveCandidates} type="button">
              {isSaving ? "Submitting candidates…" : `Submit ${selectedCount} selected candidate${selectedCount === 1 ? "" : "s"}`}
            </button>
            <p className="submission-error" role="alert">{saveError}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
