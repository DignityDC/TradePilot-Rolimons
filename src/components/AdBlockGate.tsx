"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    __tpAdsAllowed?: boolean;
    adsbygoogle?: unknown;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Multi-signal detection — IAB bait alone misses modern blockers. */
async function detectAdBlock(): Promise<boolean> {
  // 1) EasyList-style bait element
  const bait = document.createElement("div");
  bait.className =
    "adsbox ad-banner adsbygoogle pub_300x250 pub_300x250m pub_728x90 textAd text_ad text_ads text-ad text-ads ad-placement adbanner ad-unit";
  bait.id = "ad-banner";
  bait.setAttribute("data-ad-slot", "1");
  bait.innerHTML = "&nbsp;";
  bait.style.cssText =
    "width:1px!important;height:1px!important;position:absolute!important;left:-9999px!important;top:-9999px!important;pointer-events:none!";
  document.body.appendChild(bait);
  await sleep(120);
  const style = window.getComputedStyle(bait);
  const baitBlocked =
    bait.offsetParent === null ||
    bait.offsetHeight === 0 ||
    bait.clientHeight === 0 ||
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0";
  bait.remove();
  if (baitBlocked) return true;

  // 2) Bait script path commonly blocked by EasyList
  const scriptBlocked = await new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = `/advertisement.js?t=${Date.now()}`;
    s.async = true;
    const done = (blocked: boolean) => {
      s.remove();
      resolve(blocked);
    };
    s.onload = () => done(!window.__tpAdsAllowed);
    s.onerror = () => done(true);
    document.head.appendChild(s);
    setTimeout(() => done(!window.__tpAdsAllowed), 2500);
  });
  if (scriptBlocked) return true;

  // 3) Google ads URL fetch — blockers usually make this fail
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    await fetch(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?t=${Date.now()}`,
      { method: "GET", mode: "no-cors", cache: "no-store", signal: ctrl.signal },
    );
    clearTimeout(timer);
  } catch {
    return true;
  }

  return false;
}

export default function AdBlockGate() {
  const [blocked, setBlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await detectAdBlock();
        if (!cancelled) {
          setBlocked(result);
          setChecked(true);
        }
      } catch {
        if (!cancelled) {
          setBlocked(true);
          setChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked || !blocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0e1014]/95 p-4">
      <div className="tp-panel w-full max-w-md p-6 text-center">
        <p className="tp-display text-3xl font-bold text-[var(--accent)]">
          Ad blocker detected
        </p>
        <p className="tp-muted mt-3 text-sm leading-relaxed">
          TradePilot needs ad blocking turned off for this site. Pause your ad
          blocker (or allowlist this domain), then reload.
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
  );
}
