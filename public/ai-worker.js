import {
  env,
  pipeline,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";

env.allowLocalModels = false;

let detectorPromise;

function getDetector() {
  if (!detectorPromise) {
    detectorPromise = pipeline(
      "zero-shot-object-detection",
      "onnx-community/grounding-dino-tiny-ONNX",
      {
        dtype: "q8",
        progress_callback: (progress) => {
          self.postMessage({ kind: "progress", progress });
        },
      },
    );
  }

  return detectorPromise;
}

self.onmessage = async (event) => {
  const { id, image } = event.data;

  try {
    const detector = await getDetector();
    const output = await detector(image, ["a pothole."], { threshold: 0.22 });
    self.postMessage({ id, kind: "result", output });
  } catch (error) {
    detectorPromise = undefined;
    self.postMessage({
      id,
      kind: "error",
      message: error instanceof Error ? error.message : "AI analysis failed.",
    });
  }
};
