"use client";

import { useEffect, useState } from "react";

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }>;
    mobile: boolean;
    platform: string;
  };
};

type DeviceIdentity = {
  collectorId: string;
  manufacturer: string;
  model: string;
};

const STORAGE_KEY = "grdm.collector-identity.v1";
const UNAVAILABLE = "Not provided by browser";

function createNumericId() {
  const values = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(values, (value, index) =>
    String(index === 0 ? (value % 9) + 1 : value % 10),
  ).join("");
}

function getStoredCollectorId() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as
      | { collectorId?: unknown }
      | null;
    if (typeof stored?.collectorId === "string" && /^\d{12}$/.test(stored.collectorId)) {
      return stored.collectorId;
    }
  } catch {
    // A new identifier is created if storage is unavailable or contains invalid data.
  }

  const collectorId = createNumericId();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ collectorId }));
  } catch {
    // The identifier remains usable for the current page session.
  }
  return collectorId;
}

function inferManufacturer(model: string, userAgent: string) {
  const value = `${model} ${userAgent}`.toLowerCase();
  if (/iphone|ipad|ipod/.test(value)) return "Apple";
  if (/\bsm-|samsung/.test(value)) return "Samsung";
  if (/pixel/.test(value)) return "Google";
  if (/tecno/.test(value)) return "Tecno";
  if (/infinix/.test(value)) return "Infinix";
  if (/\bitel\b/.test(value)) return "Itel";
  if (/huawei/.test(value)) return "Huawei";
  if (/honor/.test(value)) return "Honor";
  if (/redmi|xiaomi/.test(value)) return "Xiaomi";
  if (/oneplus/.test(value)) return "OnePlus";
  if (/oppo|\bcph\d/.test(value)) return "Oppo";
  if (/nokia/.test(value)) return "Nokia";
  return UNAVAILABLE;
}

async function readDeviceIdentity(): Promise<DeviceIdentity> {
  const browserNavigator = navigator as NavigatorWithUserAgentData;
  let model = "";

  try {
    const values = await browserNavigator.userAgentData?.getHighEntropyValues?.(["model"]);
    model = values?.model?.trim() ?? "";
  } catch {
    // Some browsers deliberately withhold high-entropy device information.
  }

  if (!model) {
    if (/iPad/i.test(navigator.userAgent)) model = "iPad";
    else if (/iPhone/i.test(navigator.userAgent)) model = "iPhone";
  }

  return {
    collectorId: getStoredCollectorId(),
    manufacturer: inferManufacturer(model, navigator.userAgent),
    model: model || UNAVAILABLE,
  };
}

export default function DeviceIdentityField() {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);

  useEffect(() => {
    void readDeviceIdentity().then(setIdentity);
  }, []);

  return (
    <div className="device-identity">
      <label className="field">
        <span>Collector ID</span>
        <input
          aria-describedby="collector-id-guidance"
          name="collectorId"
          placeholder="Generating device ID…"
          readOnly
          required
          value={identity?.collectorId ?? ""}
        />
      </label>
      <input name="deviceManufacturer" type="hidden" value={identity?.manufacturer ?? ""} />
      <input name="deviceModel" type="hidden" value={identity?.model ?? ""} />
      <small id="collector-id-guidance">
        {identity
          ? `Linked to ${identity.manufacturer} • ${identity.model}. The ID is retained in this browser.`
          : "Reading the device information available to this browser…"}
      </small>
    </div>
  );
}
