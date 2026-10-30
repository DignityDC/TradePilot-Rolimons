/** Rolimons' advertised cooldown. */
export const ROLIMONS_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Extra buffer so we don't hit Rolimons a few seconds early
 * (cron skew / server clock), which used to restart a full 15m wait.
 */
export const COOLDOWN_BUFFER_MS = 45 * 1000;

/** Local gate before attempting another createad. */
export const LOCAL_COOLDOWN_MS = ROLIMONS_COOLDOWN_MS + COOLDOWN_BUFFER_MS;

/** If Rolimons still says cooldown after our gate, retry after this — not another 15m. */
export const COOLDOWN_RETRY_MS = 75 * 1000;

export function cooldownRemainingMs(
  lastPostedAt: Date | string | null | undefined,
  durationMs: number = LOCAL_COOLDOWN_MS,
) {
  if (!lastPostedAt) return 0;
  const at =
    typeof lastPostedAt === "string"
      ? new Date(lastPostedAt).getTime()
      : lastPostedAt.getTime();
  if (Number.isNaN(at)) return 0;
  return Math.max(0, at + durationMs - Date.now());
}

/** Local wait after a successful post, or after Rolimons rejected with cooldown. */
export function activeCooldownRemainingMs(
  lastPostedAt: Date | string | null | undefined,
  lastPostStatus: string | null | undefined,
) {
  if (lastPostStatus !== "success" && lastPostStatus !== "cooldown") return 0;
  return cooldownRemainingMs(lastPostedAt);
}

export function isCooldownMessage(message: string | null | undefined) {
  if (!message) return false;
  return /cooldown|not elapsed|15\s*min/i.test(message);
}

export function formatCooldown(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Stamp lastPostedAt so remaining ≈ retryMs (without a full 15m restart). */
export function lastPostedAtForRetry(retryMs: number = COOLDOWN_RETRY_MS) {
  return new Date(Date.now() - LOCAL_COOLDOWN_MS + retryMs);
}
