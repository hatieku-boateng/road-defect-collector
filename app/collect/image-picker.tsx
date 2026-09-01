"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useRef, useState } from "react";

type Preview = {
  name: string;
  size: string;
  url: string;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImagePicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

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
      return;
    }

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
  }

  return (
    <div className="field image-field">
      <label htmlFor="road-image">Road image</label>
      <input
        accept="image/*"
        id="road-image"
        name="roadImage"
        onChange={handleImageChange}
        ref={inputRef}
        required
        type="file"
      />
      <small>Use a clear JPG, PNG, or HEIC image.</small>

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
