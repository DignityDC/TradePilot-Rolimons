import { decrypt } from "@/lib/crypto";
import {
  ROLIMONS_COOLDOWN_MS,
  activeCooldownRemainingMs,
  cooldownRemainingMs,
  formatCooldown,
  isCooldownMessage,
} from "@/lib/cooldown";
import { prisma } from "@/lib/db";
import { createTradeAd, type RequestTag } from "@/lib/rolimons";
import { hasRolimonsSetup } from "@/lib/session";

export type RotationMode = "round_robin" | "random" | "single";

export {
  ROLIMONS_COOLDOWN_MS,
  activeCooldownRemainingMs,
  cooldownRemainingMs,
  formatCooldown,
  isCooldownMessage,
} from "@/lib/cooldown";

export function parseJsonArray<T = number | string>(value: string): T[] {
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeAd(ad: {
  id: string;
  name: string;
  offerItemIds: string;
  requestItemIds: string;
  requestTags: string;
  offerRobux: number;
  requestRobux: number;
  enabled: boolean;
  sortOrder: number;
  postCount: number;
  successCount: number;
  failCount: number;
  lastPostedAt: Date | null;
  lastPostStatus: string | null;
  lastPostError: string | null;
}) {
  return {
    id: ad.id,
    name: ad.name,
    offerItemIds: parseJsonArray<number>(ad.offerItemIds),
    requestItemIds: parseJsonArray<number>(ad.requestItemIds),
    requestTags: parseJsonArray<string>(ad.requestTags),
    offerRobux: ad.offerRobux,
    requestRobux: ad.requestRobux,
    enabled: ad.enabled,
    sortOrder: ad.sortOrder,
    postCount: ad.postCount,
    successCount: ad.successCount,
    failCount: ad.failCount,
    lastPostedAt: ad.lastPostedAt?.toISOString() ?? null,
    lastPostStatus: ad.lastPostStatus,
    lastPostError: ad.lastPostError,
  };
}

async function pickNextAd(userId: string, mode: RotationMode, preferredId?: string | null) {
  const ads = await prisma.tradeAd.findMany({
    where: { userId, enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (ads.length === 0) return null;

  if (mode === "single") {
    if (preferredId) {
      const preferred = ads.find((a) => a.id === preferredId);
      if (preferred) return preferred;
    }
    return ads[0];
  }

  if (mode === "random") {
    return ads[Math.floor(Math.random() * ads.length)];
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const index = (user?.rotationIndex ?? 0) % ads.length;
  return ads[index];
}

async function advanceRotation(userId: string, postedAdId: string) {
  const ads = await prisma.tradeAd.findMany({
    where: { userId, enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (ads.length === 0) return;
  const current = ads.findIndex((a) => a.id === postedAdId);
  const nextIndex = current >= 0 ? (current + 1) % ads.length : 0;
  await prisma.user.update({
    where: { id: userId },
    data: { rotationIndex: nextIndex },
  });
}

export async function postTradeAdById(userId: string, adId: string, advance = false) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false as const, message: "User not found" };

  if (!hasRolimonsSetup(user) || !user.robloxUserId || !user.roliTokenEnc) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastPostStatus: "error",
        lastPostError: "Set your Roblox username and Rolimons token in Settings.",
      },
    });
    return {
      ok: false as const,
      message: "Set your Roblox username and Rolimons token in Settings first.",
      code: "needs_setup" as const,
    };
  }

  const ad = await findAdForUser(userId, adId);
  if (!ad) return { ok: false as const, message: "Trade ad not found." };

  const offerItemIds = parseJsonArray<number>(ad.offerItemIds);
  const requestItemIds = parseJsonArray<number>(ad.requestItemIds);
  let requestTags = parseJsonArray<string>(ad.requestTags) as RequestTag[];
  const offerRobux = Math.max(0, ad.offerRobux || 0);
  const requestRobux = Math.max(0, ad.requestRobux || 0);

  if (offerItemIds.length === 0) {
    await prisma.tradeAd.update({
      where: { id: ad.id },
      data: {
        lastPostStatus: "error",
        lastPostError: "No offer items configured.",
        failCount: { increment: 1 },
        postCount: { increment: 1 },
      },
    });
    return { ok: false as const, message: "No offer items configured." };
  }

  if (requestRobux > 0 && !requestTags.includes("robux")) {
    if (requestItemIds.length + requestTags.length < 4) {
      requestTags = [...requestTags, "robux"];
    }
  }

  if (requestItemIds.length + requestTags.length === 0 && requestRobux <= 0) {
    await prisma.tradeAd.update({
      where: { id: ad.id },
      data: {
        lastPostStatus: "error",
        lastPostError: "Add request items, tags, or Robux.",
        failCount: { increment: 1 },
        postCount: { increment: 1 },
      },
    });
    return { ok: false as const, message: "Add request items, tags, or Robux." };
  }

  const remaining = activeCooldownRemainingMs(
    user.lastPostedAt,
    user.lastPostStatus,
  );
  if (remaining > 0) {
    return {
      ok: false as const,
      message: `Wait ${formatCooldown(remaining)} before posting again (Rolimons 15-minute cooldown).`,
      code: "cooldown" as const,
      adId: ad.id,
      adName: ad.name,
      cooldownRemainingMs: remaining,
    };
  }

  let token: string;
  try {
    token = decrypt(user.roliTokenEnc);
  } catch {
    return { ok: false as const, message: "Failed to decrypt Rolimons token." };
  }

  const result = await createTradeAd({
    playerId: user.robloxUserId,
    offerItemIds,
    requestItemIds,
    requestTags,
    offerRobux,
    requestRobux,
    roliVerification: token,
  });

  const now = new Date();

  if (result.ok) {
    await prisma.$transaction([
      prisma.tradeAd.update({
        where: { id: ad.id },
        data: {
          lastPostedAt: now,
          lastPostStatus: "success",
          lastPostError: null,
          postCount: { increment: 1 },
          successCount: { increment: 1 },
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          lastPostedAt: now,
          lastPostStatus: "success",
          lastPostError: null,
          lastPostedAdId: ad.id,
        },
      }),
    ]);
    if (advance && user.rotationMode === "round_robin") {
      await advanceRotation(user.id, ad.id);
    }
    return { ok: true as const, adId: ad.id, adName: ad.name };
  }

  const cooldown =
    result.code === "cooldown" || isCooldownMessage(result.message);

  // Start a local 15m timer once when Rolimons says cooldown (e.g. ad was
  // posted on the site). Never reset an already-running timer on retries.
  const existingRemaining = cooldownRemainingMs(user.lastPostedAt);
  const startCooldownClock = cooldown && existingRemaining <= 0;

  await prisma.$transaction([
    prisma.tradeAd.update({
      where: { id: ad.id },
      data: {
        lastPostStatus: cooldown ? "cooldown" : "error",
        lastPostError: result.message,
        ...(startCooldownClock ? { lastPostedAt: now } : {}),
        ...(cooldown
          ? {}
          : { postCount: { increment: 1 }, failCount: { increment: 1 } }),
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        lastPostStatus: cooldown ? "cooldown" : "error",
        lastPostError: result.message,
        lastPostedAdId: ad.id,
        ...(startCooldownClock ? { lastPostedAt: now } : {}),
      },
    }),
  ]);

  const waitMs = cooldown
    ? startCooldownClock
      ? ROLIMONS_COOLDOWN_MS
      : existingRemaining
    : 0;

  return {
    ok: false as const,
    message: cooldown
      ? `Wait ${formatCooldown(waitMs)} before posting again (Rolimons 15-minute cooldown).`
      : result.message,
    code: cooldown ? ("cooldown" as const) : result.code,
    adId: ad.id,
    adName: ad.name,
    cooldownRemainingMs: waitMs || undefined,
  };
}

export async function postNextRotatedAd(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false as const, message: "User not found" };

  const mode = (user.rotationMode || "round_robin") as RotationMode;
  const ad = await pickNextAd(userId, mode, user.activeAdId);
  if (!ad) {
    return {
      ok: false as const,
      message: "No enabled trade ads. Create one and turn it on for rotation.",
    };
  }

  return postTradeAdById(userId, ad.id, true);
}

export async function postAllEnabledAds() {
  const users = await prisma.user.findMany({
    where: {
      autoPostEnabled: true,
      roliTokenEnc: { not: null },
      robloxUserId: { not: null },
    },
    select: { id: true, lastPostedAt: true, lastPostStatus: true },
  });

  const results: Array<{
    userId: string;
    ok: boolean;
    message?: string;
    adName?: string;
  }> = [];
  for (const user of users) {
    const remaining = activeCooldownRemainingMs(
      user.lastPostedAt,
      user.lastPostStatus,
    );
    if (remaining > 0) {
      results.push({
        userId: user.id,
        ok: false,
        message: `Skipped (cooldown ${formatCooldown(remaining)})`,
      });
      continue;
    }
    const result = await postNextRotatedAd(user.id);
    results.push({
      userId: user.id,
      ok: result.ok,
      message: result.ok ? undefined : result.message,
      adName: "adName" in result ? result.adName : undefined,
    });
  }

  return results;
}

export async function ensureDefaultAd(userId: string) {
  const count = await prisma.tradeAd.count({ where: { userId } });
  if (count > 0) return;
  await prisma.tradeAd.create({
    data: {
      userId,
      name: "Ad #1",
      sortOrder: 0,
    },
  });
}

/** Reset Robux values that overflow Prisma Int (≤ 2_000_000_000). */
export async function repairRobuxOverflow() {
  await prisma.$executeRawUnsafe(
    `UPDATE "TradeAd" SET "offerRobux" = 0 WHERE "offerRobux" > 2000000000 OR "offerRobux" < 0`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "TradeAd" SET "requestRobux" = 0 WHERE "requestRobux" > 2000000000 OR "requestRobux" < 0`,
  );
}

export async function listAdsForUser(userId: string) {
  try {
    return await prisma.tradeAd.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  } catch {
    await repairRobuxOverflow();
    return prisma.tradeAd.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }
}

export async function findAdForUser(userId: string, adId: string) {
  try {
    return await prisma.tradeAd.findFirst({ where: { id: adId, userId } });
  } catch {
    await repairRobuxOverflow();
    return prisma.tradeAd.findFirst({ where: { id: adId, userId } });
  }
}
