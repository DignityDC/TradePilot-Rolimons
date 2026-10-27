export const ROLIMONS_COOLDOWN_MS = 15 * 60 * 1000;

export function cooldownRemainingMs(
  lastPostedAt: Date | string | null | undefined,
) {
  if (!lastPostedAt) return 0;
  const at =
    typeof lastPostedAt === "string"
      ? new Date(lastPostedAt).getTime()
      : lastPostedAt.getTime();
  if (Number.isNaN(at)) return 0;
  return Math.max(0, at + ROLIMONS_COOLDOWN_MS - Date.now());
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
