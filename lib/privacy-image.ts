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

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image could not be processed."));
    image.src = source;
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The privacy-safe image could not be created.")),
      "image/jpeg",
      0.9,
    );
  });
}

export async function blurSensitiveRegions(
  source: string,
  detections: ImageDetection[],
) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser cannot create a privacy-safe image.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const detection of detections) {
    const boxWidth = Math.max(1, detection.box.xmax - detection.box.xmin);
    const boxHeight = Math.max(1, detection.box.ymax - detection.box.ymin);
    const paddingX = boxWidth * 0.12;
    const paddingY = boxHeight * 0.12;
    const left = Math.max(0, detection.box.xmin - paddingX);
    const top = Math.max(0, detection.box.ymin - paddingY);
    const width = Math.min(canvas.width - left, boxWidth + paddingX * 2);
    const height = Math.min(canvas.height - top, boxHeight + paddingY * 2);
    const blurRadius = Math.max(24, Math.min(64, Math.max(width, height) * 0.09));

    context.save();
    context.beginPath();
    context.rect(left, top, width, height);
    context.clip();
    context.filter = `blur(${blurRadius}px)`;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.restore();
  }

  const blob = await canvasBlob(canvas);
  return {
    blob,
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
  };
}

export function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}
