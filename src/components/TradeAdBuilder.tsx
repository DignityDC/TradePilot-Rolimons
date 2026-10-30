"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { REQUEST_TAGS, TAG_IMAGES, type RequestTag } from "@/lib/tags";
import {
  LOCAL_COOLDOWN_MS,
  formatCooldown,
  isCooldownMessage,
} from "@/lib/cooldown";
import { readJson } from "@/lib/http";

export type CatalogItem = {
  id: number;
  name: string;
  acronym: string;
  rap: number;
  value: number;
  demand?: string;
  imageUrl?: string;
};

type Props = {
  adId: string;
  initialName: string;
  initialOffer: number[];
  initialRequest: number[];
  initialTags: string[];
  initialOfferRobux?: number;
  initialRequestRobux?: number;
  setupComplete: boolean;
  lastPostedAt?: string | null;
  lastPostStatus?: string | null;
  lastPostError?: string | null;
  cooldownRemainingMs?: number;
  onSaved?: () => void | Promise<void>;
};

const PAGE_SIZE = 25;
const MAX_ROBUX = 2_000_000_000;

function clampRobux(n: number) {
  return Math.min(MAX_ROBUX, Math.max(0, Math.floor(n) || 0));
}

function formatNum(n: number) {
  if (!n || n < 0) return "—";
  return n.toLocaleString();
}

function statOrZero(n: number | undefined | null) {
  if (n == null || n < 0) return 0;
  return n;
}

function Slot({
  item,
  tag,
  onClear,
}: {
  item?: CatalogItem | null;
  tag?: RequestTag | null;
  onClear?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden border border-[var(--line)] bg-[#12161e]"
      title={item?.name || tag || "Empty"}
    >
      {item?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : tag ? (
        <Image
          src={TAG_IMAGES[tag]}
          alt={tag}
          width={72}
          height={72}
          className="h-full w-full object-contain p-0.5"
        />
      ) : (
        <span className="tp-muted text-[10px] uppercase tracking-wide">+</span>
      )}
    </button>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const windowSize = 7;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="tp-btn py-1 text-xs"
      >
        Prev
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`tp-btn min-w-8 py-1 text-xs ${
            p === page ? "tp-btn-primary" : ""
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="tp-btn py-1 text-xs"
      >
        Next
      </button>
    </div>
  );
}

export default function TradeAdBuilder({
  adId,
  initialName,
  initialOffer,
  initialRequest,
  initialTags,
  initialOfferRobux = 0,
  initialRequestRobux = 0,
  setupComplete,
  lastPostedAt,
  lastPostStatus,
  lastPostError,
  cooldownRemainingMs = 0,
  onSaved,
}: Props) {
  const [cooldownMs, setCooldownMs] = useState(cooldownRemainingMs);
  const [name, setName] = useState(initialName);
  const [offerIds, setOfferIds] = useState<number[]>(initialOffer);
  const [requestIds, setRequestIds] = useState<number[]>(initialRequest);
  const [tags, setTags] = useState<RequestTag[]>(
    initialTags.filter((t): t is RequestTag =>
      (REQUEST_TAGS as readonly string[]).includes(t),
    ),
  );
  const [offerRobux, setOfferRobux] = useState(initialOfferRobux);
  const [requestRobux, setRequestRobux] = useState(initialRequestRobux);
  const [picker, setPicker] = useState<"offer" | "request">("offer");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [meta, setMeta] = useState<Record<number, CatalogItem>>({});
  const [loading, setLoading] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState({
    lastPostedAt,
    lastPostStatus,
    lastPostError,
  });

  useEffect(() => {
    setCooldownMs(cooldownRemainingMs);
  }, [cooldownRemainingMs]);

  useEffect(() => {
    if (cooldownMs <= 0) return;
    const t = setInterval(() => {
      setCooldownMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownMs > 0]);

  const remember = useCallback((item: CatalogItem) => {
    setMeta((prev) => ({ ...prev, [item.id]: item }));
  }, []);

  const requireSetup = useCallback(() => {
    if (setupComplete) return false;
    setShowSetupPrompt(true);
    return true;
  }, [setupComplete]);

  useEffect(() => {
    setPage(1);
  }, [query, picker]);

  useEffect(() => {
    if (!setupComplete) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setInvError(null);
      try {
        const url =
          picker === "offer"
            ? `/api/inventory?q=${encodeURIComponent(query)}`
            : `/api/items?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&page=${page}`;
        const res = await fetch(url);
        const data = await readJson<{
          error?: string;
          message?: string;
          privated?: boolean;
          items?: CatalogItem[];
          totalPages?: number;
        }>(res);
        if (cancelled) return;
        if (!res.ok) {
          if (data.error === "setup_required") {
            setShowSetupPrompt(true);
            setItems([]);
            return;
          }
          setInvError(data.message || data.error || "Failed to load items");
          setItems([]);
          return;
        }
        if (data.privated) {
          setInvError(data.message || "Inventory is private");
          setItems([]);
          return;
        }
        const list = (data.items ?? []) as CatalogItem[];
        setItems(list);
        setTotalPages(picker === "request" ? data.totalPages || 1 : 1);
        setMeta((prev) => {
          const next = { ...prev };
          for (const item of list) next[item.id] = item;
          return next;
        });
      } catch {
        if (!cancelled) setInvError("Failed to load items");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [picker, query, page, setupComplete]);

  useEffect(() => {
    const ids = Array.from(new Set([...offerIds, ...requestIds]));
    if (ids.length === 0 || !setupComplete) return;
    let cancelled = false;
    (async () => {
      const map: Record<number, CatalogItem> = {};
      await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/items?limit=5&page=1&q=${id}`);
          const data = await readJson<{ items?: CatalogItem[] }>(res);
          const item = data.items?.find((i) => i.id === id);
          if (item) map[id] = item;
        }),
      );
      if (!cancelled) setMeta((prev) => ({ ...prev, ...map }));
    })();
    return () => {
      cancelled = true;
    };
  }, [setupComplete, offerIds, requestIds]);

  const offerValue = useMemo(
    () => offerIds.reduce((sum, id) => sum + statOrZero(meta[id]?.value), 0),
    [offerIds, meta],
  );
  const offerRap = useMemo(
    () => offerIds.reduce((sum, id) => sum + statOrZero(meta[id]?.rap), 0),
    [offerIds, meta],
  );
  const requestValue = useMemo(
    () => requestIds.reduce((sum, id) => sum + statOrZero(meta[id]?.value), 0),
    [requestIds, meta],
  );
  const requestRap = useMemo(
    () => requestIds.reduce((sum, id) => sum + statOrZero(meta[id]?.rap), 0),
    [requestIds, meta],
  );

  function toggleOffer(item: CatalogItem) {
    if (requireSetup()) return;
    remember(item);
    setOfferIds((prev) =>
      prev.includes(item.id)
        ? prev.filter((id) => id !== item.id)
        : prev.length >= 4
          ? prev
          : [...prev, item.id],
    );
  }

  function toggleRequestItem(item: CatalogItem) {
    if (requireSetup()) return;
    remember(item);
    setRequestIds((prev) => {
      if (prev.includes(item.id)) return prev.filter((id) => id !== item.id);
      if (prev.length + tags.length >= 4) return prev;
      return [...prev, item.id];
    });
  }

  function toggleTag(tag: RequestTag) {
    if (requireSetup()) return;
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length + requestIds.length >= 4) return prev;
      return [...prev, tag];
    });
  }

  function payload() {
    return {
      name: name.trim() || "Untitled ad",
      offerItemIds: offerIds,
      requestItemIds: requestIds,
      requestTags: tags,
      offerRobux,
      requestRobux,
    };
  }

  async function save() {
    if (requireSetup()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/ads/${adId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await readJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || data.message || "Save failed");
      setMessage("Saved.");
      await onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function postNow() {
    if (requireSetup()) return;
    if (cooldownMs > 0) {
      setError(
        `Wait ${formatCooldown(cooldownMs)} before posting again (Rolimons 15-minute cooldown).`,
      );
      return;
    }
    setPosting(true);
    setError(null);
    setMessage(null);
    try {
      const saveRes = await fetch(`/api/ads/${adId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const saveData = await readJson<{ error?: string }>(saveRes);
      if (!saveRes.ok) throw new Error(saveData.error || "Save failed");

      const res = await fetch(`/api/ads/${adId}/post`, { method: "POST" });
      const data = await readJson<{
        error?: string;
        cooldownRemainingMs?: number;
      }>(res);
      if (!res.ok) {
        if (typeof data.cooldownRemainingMs === "number") {
          setCooldownMs(data.cooldownRemainingMs);
        }
        throw new Error(data.error || "Post failed");
      }
      setMessage("Posted to Rolimons.");
      setStatus({
        lastPostedAt: new Date().toISOString(),
        lastPostStatus: "success",
        lastPostError: null,
      });
      setCooldownMs(LOCAL_COOLDOWN_MS);
      await onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Post failed");
      await onSaved?.();
    } finally {
      setPosting(false);
    }
  }

  const offerSlots = Array.from({ length: 4 }, (_, i) => offerIds[i] ?? null);
  const requestSlots = [
    ...requestIds.map((id) => ({ type: "item" as const, id })),
    ...tags.map((tag) => ({ type: "tag" as const, tag })),
  ];
  while (requestSlots.length < 4) requestSlots.push({ type: "item", id: -1 });

  return (
    <div className="space-y-4">
      {showSetupPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="tp-panel w-full max-w-md p-5">
            <h3 className="tp-display text-2xl font-bold">
              Link Rolimons first
            </h3>
            <p className="tp-muted mt-2 text-sm">
              Set your Roblox username and Rolimons token in Settings before
              building ads.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/settings" className="tp-btn tp-btn-primary">
                Open Settings
              </Link>
              <button
                type="button"
                onClick={() => setShowSetupPrompt(false)}
                className="tp-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="tp-panel p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1">
            <span className="tp-label">Ad name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="tp-input"
              maxLength={40}
            />
          </label>
          <p className="tp-mono tp-muted pb-2 text-xs">
            Last:{" "}
            {status.lastPostedAt
              ? new Date(status.lastPostedAt).toLocaleString()
              : "never"}
            {status.lastPostStatus ? ` (${status.lastPostStatus})` : ""}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-start">
          <div>
            <p className="tp-label mb-2 text-center">Offer</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {offerSlots.map((id, idx) => (
                <Slot
                  key={`o-${idx}`}
                  item={id ? meta[id] : null}
                  onClear={
                    id
                      ? () => setOfferIds((prev) => prev.filter((x) => x !== id))
                      : () => {
                          if (requireSetup()) return;
                          setPicker("offer");
                        }
                  }
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="tp-muted text-xs">R$</span>
              <input
                type="number"
                min={0}
                value={offerRobux || ""}
                placeholder="0"
                onChange={(e) => {
                  if (requireSetup()) return;
                  setOfferRobux(clampRobux(Number(e.target.value)));
                }}
                className="tp-input w-28 py-1 text-sm"
              />
            </div>
            <div className="tp-mono tp-muted mt-2 space-y-0.5 text-center text-xs">
              <p>Value {formatNum(offerValue)}</p>
              <p>RAP {formatNum(offerRap)}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 pt-6">
            <button
              type="button"
              onClick={postNow}
              disabled={posting || cooldownMs > 0}
              className="tp-btn tp-btn-primary min-w-28"
            >
              {posting
                ? "…"
                : cooldownMs > 0
                  ? formatCooldown(cooldownMs)
                  : "Submit"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="tp-btn min-w-28"
            >
              {saving ? "…" : "Save"}
            </button>
          </div>

          <div>
            <p className="tp-label mb-2 text-center">Request</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {requestSlots.slice(0, 4).map((slot, idx) => {
                if (slot.type === "tag") {
                  return (
                    <Slot
                      key={`t-${slot.tag}-${idx}`}
                      tag={slot.tag}
                      onClear={() => toggleTag(slot.tag)}
                    />
                  );
                }
                const id = slot.id > 0 ? slot.id : null;
                return (
                  <Slot
                    key={`r-${idx}`}
                    item={id ? meta[id] : null}
                    onClear={
                      id
                        ? () =>
                            setRequestIds((prev) =>
                              prev.filter((x) => x !== id),
                            )
                        : () => {
                            if (requireSetup()) return;
                            setPicker("request");
                          }
                    }
                  />
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="tp-muted text-xs">R$</span>
              <input
                type="number"
                min={0}
                value={requestRobux || ""}
                placeholder="0"
                onChange={(e) => {
                  if (requireSetup()) return;
                  setRequestRobux(clampRobux(Number(e.target.value)));
                }}
                className="tp-input w-28 py-1 text-sm"
              />
            </div>
            <div className="tp-mono tp-muted mt-2 space-y-0.5 text-center text-xs">
              <p>Value {formatNum(requestValue)}</p>
              <p>RAP {formatNum(requestRap)}</p>
            </div>
          </div>
        </div>

        {message && <p className="tp-alert tp-alert-ok mt-4">{message}</p>}
        {error && isCooldownMessage(error) && (
          <p className="tp-alert tp-alert-warn mt-4">{error}</p>
        )}
        {error && !isCooldownMessage(error) && (
          <p className="tp-alert tp-alert-bad mt-4">
            <strong>Rolimons:</strong> {error}
          </p>
        )}
        {!error &&
          status.lastPostError &&
          !isCooldownMessage(status.lastPostError) && (
            <p className="tp-alert tp-alert-bad mt-4">
              <strong>Rolimons:</strong> {status.lastPostError}
            </p>
          )}
      </section>

      <section className="tp-panel">
        <div className="flex border-b border-[var(--line)]">
          <button
            type="button"
            onClick={() => {
              if (requireSetup()) return;
              setPicker("offer");
              setQuery("");
            }}
            className={`px-4 py-2.5 text-sm font-semibold ${
              picker === "offer"
                ? "border-b-2 border-[var(--accent)] text-[var(--text)]"
                : "tp-muted"
            }`}
          >
            Add to Offer
          </button>
          <button
            type="button"
            onClick={() => {
              if (requireSetup()) return;
              setPicker("request");
              setQuery("");
            }}
            className={`px-4 py-2.5 text-sm font-semibold ${
              picker === "request"
                ? "border-b-2 border-[var(--accent)] text-[var(--text)]"
                : "tp-muted"
            }`}
          >
            Add to Request
          </button>
        </div>

        <div className="p-3">
          {picker === "request" && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {REQUEST_TAGS.map((tag) => {
                const active = tags.includes(tag);
                const full = !active && requestIds.length + tags.length >= 4;
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={full}
                    onClick={() => toggleTag(tag)}
                    className={`h-14 w-14 overflow-hidden border ${
                      active
                        ? "border-[var(--accent)]"
                        : "border-[var(--line)] opacity-80"
                    } ${full ? "opacity-30" : ""}`}
                    title={tag}
                  >
                    <Image
                      src={TAG_IMAGES[tag]}
                      alt={tag}
                      width={56}
                      height={56}
                      className="h-full w-full object-contain"
                    />
                  </button>
                );
              })}
            </div>
          )}

          <input
            value={query}
            onChange={(e) => {
              if (requireSetup()) return;
              setQuery(e.target.value);
            }}
            placeholder={
              picker === "offer" ? "Search inventory" : "Search catalog"
            }
            className="tp-input mb-3 bg-white text-black"
          />

          {loading && <p className="tp-muted text-sm">Loading…</p>}
          {invError && <p className="mb-2 text-sm text-[var(--bad)]">{invError}</p>}

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => {
              const selected =
                picker === "offer"
                  ? offerIds.includes(item.id)
                  : requestIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    picker === "offer"
                      ? toggleOffer(item)
                      : toggleRequestItem(item)
                  }
                  className={`flex flex-col border text-left ${
                    selected
                      ? "border-[var(--accent)] bg-[#252a35]"
                      : "border-[var(--line)] bg-[#1a1f28] hover:border-[#3d4658]"
                  }`}
                >
                  <p
                    className="truncate px-2 pt-1.5 text-[11px] leading-tight text-[#c8ced8]"
                    title={item.name}
                  >
                    {item.name}
                  </p>
                  <div className="relative mx-2 mt-1 aspect-square overflow-hidden bg-[#12161e]">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : null}
                    {selected && (
                      <span className="absolute right-1 top-1 bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
                        SEL
                      </span>
                    )}
                  </div>
                  <div className="tp-mono space-y-0.5 px-2 py-1.5 text-[11px]">
                    <p className="flex justify-between gap-1">
                      <span className="tp-muted">RAP</span>
                      <span className="text-[#9eb4d8]">
                        {formatNum(item.rap)}
                      </span>
                    </p>
                    <p className="flex justify-between gap-1">
                      <span className="tp-muted">Value</span>
                      <span className="text-[#5ea8ff]">
                        {formatNum(item.value)}
                      </span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {picker === "request" && (
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          )}

          {!loading && setupComplete && items.length === 0 && (
            <p className="tp-muted mt-3 text-sm">
              {picker === "offer" ? "No inventory items." : "No catalog items."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
