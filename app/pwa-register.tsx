"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "road-collector-install-dismissed";

export default function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      window.addEventListener("load", register, { once: true });
      if (document.readyState === "complete") register();
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const stateTimer = window.setTimeout(() => {
      setIsIOS(iosDevice && !standalone);
      setDismissed(standalone || localStorage.getItem(DISMISS_KEY) === "true");
    }, 0);

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setDismissed(false);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(stateTimer);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowIOSHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  if (dismissed || (!installPrompt && !isIOS)) return null;

  return (
    <aside className="install-app-banner" aria-label="Install mobile application">
      <span className="install-app-icon" aria-hidden="true">GR</span>
      <div>
        <strong>Install Road Collector</strong>
        <p>
          {showIOSHelp
            ? "In Safari, tap Share, then choose Add to Home Screen."
            : "Add the collector to your phone for quick, full-screen access."}
        </p>
      </div>
      {!showIOSHelp ? <button onClick={install} type="button">Install</button> : null}
      <button aria-label="Dismiss installation message" className="install-dismiss" onClick={dismiss} type="button">×</button>
    </aside>
  );
}
