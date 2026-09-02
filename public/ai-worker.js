import {
  env,
  pipeline,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";

env.allowLocalModels = false;

const SENSITIVE_LABELS = new Set([
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "bus",
  "truck",
]);

let potholeDetectorPromise;
let privacyDetectorPromise;

function getPotholeDetector() {
  if (!potholeDetectorPromise) {
    potholeDetectorPromise = pipeline(
      "zero-shot-object-detection",
      "onnx-community/grounding-dino-tiny-ONNX",
      {
        dtype: "q8",
        progress_callback: (progress) => {
          self.postMessage({ kind: "progress", model: "pothole", progress });
        },
      },
    );
  }

  return potholeDetectorPromise;
}

function getPrivacyDetector() {
  if (!privacyDetectorPromise) {
    privacyDetectorPromise = pipeline(
      "object-detection",
      "Xenova/yolos-tiny",
      {
        dtype: "q8",
        progress_callback: (progress) => {
          self.postMessage({ kind: "progress", model: "privacy", progress });
        },
      },
    );
  }

  return privacyDetectorPromise;
}

self.onmessage = async (event) => {
  const { id, image, task } = event.data;

  try {
    if (task === "privacy") {
      const detector = await getPrivacyDetector();
      const output = await detector(image, { threshold: 0.35 });
      self.postMessage({
        id,
        kind: "result",
        output: output.filter((item) => SENSITIVE_LABELS.has(item.label)),
      });
      return;
    }

    if (task === "privacy-strict") {
      const detector = await getPotholeDetector();
      const output = await detector(image, [
        "a person.",
        "a face.",
        "a car.",
        "a bus.",
        "a truck.",
        "a motorcycle.",
        "a bicycle.",
        "a vehicle number plate.",
        "a shop sign.",
        "a storefront sign.",
      ], { threshold: 0.2 });
      self.postMessage({ id, kind: "result", output });
      return;
    }

    const detector = await getPotholeDetector();
    const output = await detector(image, ["a pothole."], { threshold: 0.22 });
    self.postMessage({ id, kind: "result", output });
  } catch (error) {
    if (task === "privacy") privacyDetectorPromise = undefined;
    else potholeDetectorPromise = undefined;
    self.postMessage({
      id,
      kind: "error",
      message: error instanceof Error ? error.message : "AI analysis failed.",
    });
  }
};
