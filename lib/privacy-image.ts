export type DetectionBox = {
  xmax: number;
  xmin: number;
  ymax: number;
  ymin: number;
};

export type ImageDetection = {
  box: DetectionBox;
  label: string;
  score: number;
};

export type BlurPrivacyOptions = {
  /** Output JPEG/WebP quality between 0.5 and 1.0 (default: 0.9) */
  quality?: number;
  /** Output MIME type (default: "image/jpeg") */
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  /** Maximum output dimension in pixels to prevent mobile canvas OOM crashes (default: 4096) */
  maxDimension?: number;
  /** Relative padding added around each detection box (default: 0.14) */
  paddingRatio?: number;
};

export type BlurPrivacyResult = {
  appliedCount: number;
  blob: Blob;
  dataUrl: string;
  height: number;
  width: number;
};

const DEFAULT_MAX_DIMENSION = 4096;
const DEFAULT_QUALITY = 0.9;
const DEFAULT_PADDING_RATIO = 0.14;
const IMAGE_LOAD_TIMEOUT_MS = 15_000;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (!source || typeof source !== "string") {
      reject(new Error("The selected image source is empty or invalid."));
      return;
    }

    const image = new Image();
    image.decoding = "async";

    // Only set crossOrigin for remote HTTP(S) URLs; data: and blob: URLs do not need CORS
    if (/^https?:\/\//i.test(source)) {
      image.crossOrigin = "anonymous";
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Loading the selected image timed out."));
    }, IMAGE_LOAD_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
    }

    image.onload = () => {
      cleanup();
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new Error("The selected image has invalid dimensions."));
        return;
      }
      resolve(image);
    };

    image.onerror = () => {
      cleanup();
      reject(new Error("The selected image could not be processed."));
    };

    image.src = source;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            resolve(blob);
          } else {
            reject(new Error("The privacy-safe image could not be created."));
          }
        },
        mimeType,
        quality,
      );
    } catch (error) {
      reject(
        error instanceof Error
          ? error
          : new Error("The privacy-safe image could not be created."),
      );
    }
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.length > 0) {
        resolve(reader.result);
      } else {
        reject(new Error("The processed image could not be encoded."));
      }
    };
    reader.onerror = () =>
      reject(new Error("The processed image could not be read."));
    reader.readAsDataURL(blob);
  });
}

export function fileDataUrl(file: Blob): Promise<string> {
  if (!(file instanceof Blob) || file.size <= 0) {
    return Promise.reject(new Error("The selected image could not be read."));
  }
  return blobToDataUrl(file);
}

/**
 * Normalizes a detection box into pixel coordinates on the target canvas.
 * Supports both pixel coordinates and normalized [0..1] coordinates.
 */
function resolveCanvasBox(
  rawBox: DetectionBox | undefined | null,
  naturalWidth: number,
  naturalHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  paddingRatio: number,
): { left: number; top: number; width: number; height: number } | null {
  if (!rawBox) return null;

  const { xmin, xmax, ymin, ymax } = rawBox;
  if (
    !Number.isFinite(xmin) ||
    !Number.isFinite(xmax) ||
    !Number.isFinite(ymin) ||
    !Number.isFinite(ymax)
  ) {
    return null;
  }

  let minX = Math.min(xmin, xmax);
  let maxX = Math.max(xmin, xmax);
  let minY = Math.min(ymin, ymax);
  let maxY = Math.max(ymin, ymax);

  // Detect normalized [0..1] coordinates and scale to natural image dimensions
  const isNormalized =
    minX >= 0 && maxX <= 1.001 && minY >= 0 && maxY <= 1.001 && maxX > 0 && maxY > 0;

  if (isNormalized) {
    minX *= naturalWidth;
    maxX *= naturalWidth;
    minY *= naturalHeight;
    maxY *= naturalHeight;
  }

  // Scale from natural image coordinates to canvas dimensions
  const scaleX = canvasWidth / naturalWidth;
  const scaleY = canvasHeight / naturalHeight;

  const scaledMinX = minX * scaleX;
  const scaledMaxX = maxX * scaleX;
  const scaledMinY = minY * scaleY;
  const scaledMaxY = maxY * scaleY;

  const rawWidth = Math.max(1, scaledMaxX - scaledMinX);
  const rawHeight = Math.max(1, scaledMaxY - scaledMinY);

  const paddingX = rawWidth * paddingRatio;
  const paddingY = rawHeight * paddingRatio;

  const left = Math.max(0, Math.floor(scaledMinX - paddingX));
  const top = Math.max(0, Math.floor(scaledMinY - paddingY));
  const right = Math.min(
    canvasWidth,
    Math.ceil(scaledMaxX + paddingX),
  );
  const bottom = Math.min(
    canvasHeight,
    Math.ceil(scaledMaxY + paddingY),
  );

  const width = right - left;
  const height = bottom - top;

  if (width < 2 || height < 2) {
    return null;
  }

  return { left, top, width, height };
}

/**
 * Redacts a rectangular region using a dual-stage privacy pipeline:
 * 1. Downscale/upscale mosaic interpolation (works on 100% of browsers including iOS Safari).
 * 2. Gaussian canvas blur pass (when supported by the browser's 2D rendering context).
 */
function redactRegionOnCanvas(
  targetCtx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  scratchCanvas: HTMLCanvasElement,
  scratchCtx: CanvasRenderingContext2D,
  region: { left: number; top: number; width: number; height: number },
): void {
  const { left, top, width, height } = region;

  // Stage 1: Downscale to a coarse grid (10px–18px across) and upscale with smoothing
  // This guarantees irreversible anonymization even if `ctx.filter` is unsupported.
  const mosaicWidth = Math.max(6, Math.min(18, Math.round(width / 14)));
  const mosaicHeight = Math.max(6, Math.min(18, Math.round(height / 14)));

  scratchCanvas.width = mosaicWidth;
  scratchCanvas.height = mosaicHeight;

  scratchCtx.imageSmoothingEnabled = true;
  scratchCtx.imageSmoothingQuality = "medium";
  scratchCtx.clearRect(0, 0, mosaicWidth, mosaicHeight);

  // Sample the region from the current canvas into the tiny scratch buffer
  scratchCtx.drawImage(
    sourceCanvas,
    left,
    top,
    width,
    height,
    0,
    0,
    mosaicWidth,
    mosaicHeight,
  );

  const blurRadius = Math.max(
    16,
    Math.min(56, Math.round(Math.max(width, height) * 0.08)),
  );

  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.rect(left, top, width, height);
  targetCtx.clip();

  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";

  // Draw the mosaic pass first (universal fallback)
  targetCtx.drawImage(
    scratchCanvas,
    0,
    0,
    mosaicWidth,
    mosaicHeight,
    left,
    top,
    width,
    height,
  );

  // Stage 2: Apply smooth Gaussian blur over the region if supported
  if ("filter" in targetCtx) {
    targetCtx.filter = `blur(${blurRadius}px)`;
    targetCtx.drawImage(
      scratchCanvas,
      0,
      0,
      mosaicWidth,
      mosaicHeight,
      left - blurRadius,
      top - blurRadius,
      width + blurRadius * 2,
      height + blurRadius * 2,
    );
  }

  targetCtx.restore();
}

export async function blurSensitiveRegions(
  source: string,
  detections: ImageDetection[],
  options: BlurPrivacyOptions = {},
): Promise<BlurPrivacyResult> {
  const image = await loadImage(source);

  const maxDimension = Math.max(
    512,
    options.maxDimension ?? DEFAULT_MAX_DIMENSION,
  );
  const quality = Math.min(
    1,
    Math.max(0.5, options.quality ?? DEFAULT_QUALITY),
  );
  const mimeType = options.mimeType ?? "image/jpeg";
  const paddingRatio = Math.min(
    0.5,
    Math.max(0, options.paddingRatio ?? DEFAULT_PADDING_RATIO),
  );

  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const largestSide = Math.max(naturalWidth, naturalHeight);
  const scaleFactor =
    largestSide > maxDimension ? maxDimension / largestSide : 1;

  const canvasWidth = Math.max(1, Math.round(naturalWidth * scaleFactor));
  const canvasHeight = Math.max(1, Math.round(naturalHeight * scaleFactor));

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot create a privacy-safe image.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvasWidth, canvasHeight);

  const safeDetections = Array.isArray(detections) ? detections : [];
  let appliedCount = 0;

  if (safeDetections.length > 0) {
    const scratchCanvas = document.createElement("canvas");
    const scratchCtx = scratchCanvas.getContext("2d");

    if (!scratchCtx) {
      throw new Error("This browser cannot initialize the privacy blur buffer.");
    }

    for (const detection of safeDetections) {
      const region = resolveCanvasBox(
        detection?.box,
        naturalWidth,
        naturalHeight,
        canvasWidth,
        canvasHeight,
        paddingRatio,
      );

      if (!region) continue;

      redactRegionOnCanvas(context, canvas, scratchCanvas, scratchCtx, region);
      appliedCount++;
    }

    // Release scratch canvas memory immediately
    scratchCanvas.width = 0;
    scratchCanvas.height = 0;
  }

  const blob = await canvasToBlob(canvas, mimeType, quality);
  const dataUrl = await blobToDataUrl(blob);

  // Release primary canvas backing store memory
  canvas.width = 0;
  canvas.height = 0;

  return {
    appliedCount,
    blob,
    dataUrl,
    height: canvasHeight,
    width: canvasWidth,
  };
}