"use client";

import Script from "next/script";
import { useCallback, useState } from "react";

declare global {
  interface Window {
    adblockDetector?: {
      init: (options: {
        debug?: boolean;
        found?: () => void;
        notFound?: () => void;
        complete?: (result: boolean) => void;
      }) => void;
    };
  }
}

export default function AdBlockGate() {
  const [blocked, setBlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  const runDetection = useCallback(() => {
    if (typeof window.adblockDetector === "undefined") {
      setBlocked(true);
      setChecked(true);
      return;
    }

    window.adblockDetector.init({
      debug: false,
      found: () => {
        setBlocked(true);
        setChecked(true);
      },
      notFound: () => {
        setBlocked(false);
        setChecked(true);
      },
      complete: (result) => {
        setBlocked(Boolean(result));
        setChecked(true);
      },
    });
  }, []);

  return (
    <>
      <Script
        src="/vendor/iab-abd.js"
        strategy="afterInteractive"
        onLoad={runDetection}
        onError={() => {
          setBlocked(true);
          setChecked(true);
        }}
      />

      {checked && blocked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0e1014]/95 p-4">
          <div className="tp-panel w-full max-w-md p-6 text-center">
            <p className="tp-display text-3xl font-bold text-[var(--accent)]">
              Ad blocker detected
            </p>
            <p className="tp-muted mt-3 text-sm leading-relaxed">
              TradePilot needs ad blocking turned off for this site. Pause your
              ad blocker (or allowlist this domain), then reload.
            </p>
            <button
              type="button"
              className="tp-btn tp-btn-primary mt-5 px-5 py-2.5"
              onClick={() => window.location.reload()}
            >
              I disabled it — reload
            </button>
          </div>
        </div>
      )}
    </>
  );
}
