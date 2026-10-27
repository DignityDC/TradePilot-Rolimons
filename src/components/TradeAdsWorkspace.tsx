"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import TradeAdBuilder from "@/components/TradeAdBuilder";
import { formatCooldown, isCooldownMessage } from "@/lib/cooldown";
import { readJson } from "@/lib/http";

export type AdSummary = {
  id: string;
  name: string;
  offerItemIds: number[];
  requestItemIds: number[];
  requestTags: string[];
  offerRobux: number;
  requestRobux: number;
  enabled: boolean;
  sortOrder: number;
  postCount: number;
  successCount: number;
  failCount: number;
  lastPostedAt: string | null;
  lastPostStatus: string | null;
  lastPostError: string | null;
};

type WorkspaceState = {
  setupComplete: boolean;
  autoPostEnabled: boolean;
  rotationMode: "round_robin" | "random" | "single";
  activeAdId: string | null;
  lastPostedAt: string | null;
  lastPostStatus: string | null;
  lastPostError: string | null;
  lastPostedAdId: string | null;
  cooldownRemainingMs: number;
  nextAdId: string | null;
  nextAdName: string | null;
  ads: AdSummary[];
};

export default function TradeAdsWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownMs, setCooldownMs] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/ads");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await readJson<WorkspaceState & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setState(data);
      setCooldownMs(data.cooldownRemainingMs || 0);
      setSelectedId((prev) => {
        if (prev && data.ads.some((a: AdSummary) => a.id === prev)) return prev;
        return data.ads[0]?.id ?? null;
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (cooldownMs <= 0) return;
    const t = setInterval(() => {
      setCooldownMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownMs > 0]);

  const selected = useMemo(
    () => state?.ads.find((a) => a.id === selectedId) ?? null,
    [state, selectedId],
  );

  async function createAd(duplicateFromId?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(duplicateFromId ? { duplicateFromId } : {}),
      });
      const data = await readJson<{ error?: string; ad: AdSummary }>(res);
      if (!res.ok) throw new Error(data.error || "Could not create ad");
      await refresh();
      setSelectedId(data.ad.id);
      setMessage(duplicateFromId ? "Duplicated." : "Created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create ad");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAd(id: string) {
    if (!confirm("Delete this trade ad?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ads/${id}`, { method: "DELETE" });
      const data = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Could not delete ad");
      await refresh();
      setMessage("Deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete ad");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(ad: AdSummary) {
    const res = await fetch(`/api/ads/${ad.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !ad.enabled }),
    });
    if (res.ok) await refresh();
  }

  async function moveAd(id: string, direction: -1 | 1) {
    if (!state) return;
    const ids = state.ads.map((a) => a.id);
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    await fetch("/api/ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next }),
    });
    await refresh();
  }

  async function patchSettings(patch: Record<string, unknown>) {
    const res = await fetch("/api/ads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) await refresh();
  }

  async function postNext() {
    if (!state?.setupComplete) {
      setError("Set Roblox username + Rolimons token in Settings first.");
      return;
    }
    if (cooldownMs > 0) {
      setError(`Wait ${formatCooldown(cooldownMs)} — Rolimons 15-minute cooldown.`);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/ads/post-next", { method: "POST" });
      const data = await readJson<{
        error?: string;
        message?: string;
        adName?: string;
        cooldownRemainingMs?: number;
      }>(res);
      if (!res.ok) {
        if (typeof data.cooldownRemainingMs === "number") {
          setCooldownMs(data.cooldownRemainingMs);
        }
        throw new Error(data.error || data.message || "Post failed");
      }
      setMessage(`Posted “${data.adName}”.`);
      setCooldownMs(15 * 60 * 1000);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Post failed";
      setError(msg);
      try {
        await refresh();
      } catch {
        /* refresh already sets error */
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || !state) {
    return <p className="tp-muted text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {!state.setupComplete && (
        <div className="tp-alert tp-alert-warn">
          Finish{" "}
          <Link href="/settings" className="font-semibold underline">
            Settings
          </Link>{" "}
          (Roblox username + Rolimons token) before posting.
        </div>
      )}

      <div className="tp-panel flex flex-wrap items-center gap-3 px-3 py-2.5">
        <label className="flex items-center gap-2 text-sm">
          <span className="tp-muted">Mode</span>
          <select
            value={state.rotationMode}
            onChange={(e) =>
              patchSettings({
                rotationMode: e.target.value,
                ...(e.target.value === "single" && selectedId
                  ? { activeAdId: selectedId }
                  : {}),
              })
            }
            className="tp-input w-auto py-1.5"
          >
            <option value="round_robin">Round robin</option>
            <option value="random">Random</option>
            <option value="single">Single ad</option>
          </select>
        </label>

        {state.rotationMode === "single" && (
          <label className="flex items-center gap-2 text-sm">
            <span className="tp-muted">Lock</span>
            <select
              value={state.activeAdId || selectedId || ""}
              onChange={(e) => patchSettings({ activeAdId: e.target.value })}
              className="tp-input w-auto py-1.5"
            >
              {state.ads.map((ad) => (
                <option key={ad.id} value={ad.id}>
                  {ad.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.autoPostEnabled}
            onChange={(e) =>
              patchSettings({ autoPostEnabled: e.target.checked })
            }
            className="accent-[var(--accent)]"
          />
          Auto every 15m
        </label>

        <div className="tp-mono tp-muted ml-auto text-xs sm:text-sm">
          Next:{" "}
          <span className="text-[var(--text)]">
            {state.rotationMode === "random"
              ? "random"
              : state.nextAdName || "—"}
          </span>
          {" · "}
          {cooldownMs > 0 ? (
            <span className="text-[var(--accent)]">
              Cooldown {formatCooldown(cooldownMs)}
            </span>
          ) : (
            <span className="text-[var(--ok)]">Ready</span>
          )}
        </div>

        <button
          type="button"
          disabled={busy || cooldownMs > 0}
          onClick={postNext}
          className="tp-btn tp-btn-primary"
        >
          {cooldownMs > 0 ? `Wait ${formatCooldown(cooldownMs)}` : "Post next"}
        </button>
      </div>

      {message && <p className="tp-alert tp-alert-ok">{message}</p>}
      {error && !isCooldownMessage(error) && (
        <p className="tp-alert tp-alert-bad">
          <strong>Rolimons:</strong> {error}
        </p>
      )}
      {error && isCooldownMessage(error) && (
        <p className="tp-alert tp-alert-warn">{error}</p>
      )}
      {!error &&
        state.lastPostError &&
        !isCooldownMessage(state.lastPostError) && (
          <p className="tp-alert tp-alert-bad">
            <strong>Rolimons:</strong> {state.lastPostError}
          </p>
        )}

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="tp-panel">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
            <span className="text-sm font-semibold">Queue</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => createAd()}
              className="tp-btn py-1 text-xs"
            >
              + New
            </button>
          </div>
          <ul>
            {state.ads.map((ad, index) => {
              const active = ad.id === selectedId;
              const isNext = ad.id === state.nextAdId;
              return (
                <li
                  key={ad.id}
                  className={`border-b border-[var(--line)] last:border-b-0 ${
                    active ? "bg-[var(--surface-2)]" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(ad.id)}
                    className="w-full px-3 py-2.5 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 ${
                          ad.enabled ? "bg-[var(--ok)]" : "bg-[var(--muted)]"
                        }`}
                      />
                      <span className="truncate text-sm font-medium">
                        {ad.name}
                      </span>
                      {isNext && state.rotationMode === "round_robin" && (
                        <span className="tp-mono ml-auto text-[10px] text-[var(--accent)]">
                          NEXT
                        </span>
                      )}
                    </div>
                    <p className="tp-mono tp-muted mt-1 text-[11px]">
                      {ad.offerItemIds.length}o /{" "}
                      {ad.requestItemIds.length + ad.requestTags.length}r ·{" "}
                      {ad.successCount}/{ad.postCount}
                    </p>
                  </button>
                  <div className="flex flex-wrap gap-1 px-3 pb-2.5">
                    <button
                      type="button"
                      onClick={() => toggleEnabled(ad)}
                      className="tp-btn py-0.5 text-[11px]"
                    >
                      {ad.enabled ? "On" : "Off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAd(ad.id, -1)}
                      disabled={index === 0}
                      className="tp-btn py-0.5 text-[11px]"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAd(ad.id, 1)}
                      disabled={index === state.ads.length - 1}
                      className="tp-btn py-0.5 text-[11px]"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => createAd(ad.id)}
                      className="tp-btn py-0.5 text-[11px]"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAd(ad.id)}
                      className="tp-btn py-0.5 text-[11px] text-[var(--bad)]"
                    >
                      Del
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        <div>
          {selected ? (
            <TradeAdBuilder
              key={selected.id}
              adId={selected.id}
              initialName={selected.name}
              initialOffer={selected.offerItemIds}
              initialRequest={selected.requestItemIds}
              initialTags={selected.requestTags}
              initialOfferRobux={selected.offerRobux}
              initialRequestRobux={selected.requestRobux}
              setupComplete={state.setupComplete}
              lastPostedAt={selected.lastPostedAt}
              lastPostStatus={selected.lastPostStatus}
              lastPostError={selected.lastPostError}
              cooldownRemainingMs={cooldownMs}
              onSaved={refresh}
            />
          ) : (
            <p className="tp-muted text-sm">Create an ad to start.</p>
          )}
        </div>
      </div>
    </div>
  );
}
