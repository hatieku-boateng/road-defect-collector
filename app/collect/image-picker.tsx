"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useRef, useState } from "react";

type Preview = {
  name: string;
  size: string;
  url: string;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setPreview(null);
      setError(null);
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
    setPreview({
      name: file.name,
      size: formatFileSize(file.size),
      url: URL.createObjectURL(file),
    });
  }

  function clearImage() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setPreview(null);
    setError(null);
  }

  return (
    <div className="field image-field">
      <label htmlFor="road-image">Road image</label>
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-describedby="road-image-guidance road-image-error"
        aria-invalid={Boolean(error)}
        id="road-image"
        name="roadImage"
        onChange={handleImageChange}
        ref={inputRef}
        required
        type="file"
      />
      <small id="road-image-guidance">
        JPG, PNG, or WebP only. Maximum size: 10 MB.
      </small>

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
              <span>{preview.size} • Ready for review</span>
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
    </div>
  );
}
