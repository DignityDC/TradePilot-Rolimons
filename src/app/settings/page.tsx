"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import TokenWarning from "@/components/TokenWarning";

export default function SettingsPage() {
  const [robloxUsername, setRobloxUsername] = useState("");
  const [roliToken, setRoliToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [siteUsername, setSiteUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      setSiteUsername(data.username ?? "");
      setRobloxUsername(data.robloxUsername ?? "");
      setHasToken(Boolean(data.hasToken));
      setSetupComplete(Boolean(data.setupComplete));
      setLoading(false);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ robloxUsername, roliToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setHasToken(true);
      setSetupComplete(true);
      setRobloxUsername(data.robloxUsername ?? robloxUsername);
      setRoliToken("");
      setMessage("Saved. Ready to post trade ads.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 flex-col">
        <Nav username={siteUsername || null} />
        <div className="tp-shell py-10 tp-muted">Loading settings…</div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <Nav username={siteUsername} />
      <div className="tp-shell py-8">
        <h1 className="tp-display text-4xl font-bold">
          Settings
        </h1>
        <p className="tp-muted mt-2 max-w-xl text-sm">
          Link the Roblox account + Rolimons token used for posting. Separate from
          your TradePilot login.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm">
          Status:{" "}
          {setupComplete ? (
            <span className="text-[var(--ok)]">Ready</span>
          ) : (
            <span className="text-[var(--accent)]">Needs setup</span>
          )}
          {hasToken ? <span className="tp-muted">· token saved</span> : null}
        </div>

        <div className="mt-6 max-w-xl">
          <TokenWarning />
        </div>

        <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-4">
          <label className="block">
            <span className="tp-label">Roblox username</span>
            <input
              required
              value={robloxUsername}
              onChange={(e) => setRobloxUsername(e.target.value)}
              className="tp-input"
              placeholder="YourRobloxName"
            />
          </label>
          <label className="block">
            <span className="tp-label">Rolimons token (_RoliVerification)</span>
            <input
              required
              type="password"
              value={roliToken}
              onChange={(e) => setRoliToken(e.target.value)}
              className="tp-input"
              placeholder={
                hasToken
                  ? "Paste a new token to replace"
                  : "Paste token value only"
              }
              autoComplete="off"
            />
          </label>
          {message && <p className="tp-alert tp-alert-ok">{message}</p>}
          {error && <p className="tp-alert tp-alert-bad">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="tp-btn tp-btn-primary px-5 py-2.5"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <Link href="/dashboard" className="tp-btn px-5 py-2.5">
              Back to ads
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
