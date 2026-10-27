import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, hasRolimonsSetup } from "@/lib/session";
import { activeCooldownRemainingMs } from "@/lib/cooldown";
import { ensureDefaultAd, listAdsForUser, serializeAd } from "@/lib/trade";

const createSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  duplicateFromId: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureDefaultAd(session.userId);

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ads = await listAdsForUser(session.userId);

    const enabled = ads.filter((a) => a.enabled);
    const nextIndex =
      enabled.length === 0 ? 0 : (user.rotationIndex ?? 0) % enabled.length;
    const nextAd =
      user.rotationMode === "single"
        ? enabled.find((a) => a.id === user.activeAdId) || enabled[0] || null
        : user.rotationMode === "random"
          ? null
          : enabled[nextIndex] || null;

    const remaining = activeCooldownRemainingMs(
      user.lastPostedAt,
      user.lastPostStatus,
    );

    return NextResponse.json({
      setupComplete: hasRolimonsSetup(user),
      autoPostEnabled: user.autoPostEnabled,
      rotationMode: user.rotationMode,
      rotationIndex: user.rotationIndex,
      activeAdId: user.activeAdId,
      lastPostedAt: user.lastPostedAt,
      lastPostStatus: user.lastPostStatus,
      lastPostError:
        user.lastPostStatus === "error" &&
        user.lastPostError &&
        !/unexpected end of json|invalid json/i.test(user.lastPostError)
          ? user.lastPostError
          : null,
      lastPostedAdId: user.lastPostedAdId,
      cooldownRemainingMs: remaining,
      nextAdId: nextAd?.id ?? null,
      nextAdName: nextAd?.name ?? null,
      ads: ads.map(serializeAd),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load ads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const existing = await prisma.tradeAd.findMany({
    where: { userId: session.userId },
    orderBy: { sortOrder: "desc" },
  });

  if (existing.length >= 20) {
    return NextResponse.json(
      { error: "Max 20 trade ads per account." },
      { status: 400 },
    );
  }

  const nextOrder = (existing[0]?.sortOrder ?? -1) + 1;
  let data = {
    userId: session.userId,
    name: parsed.data.name?.trim() || `Ad #${existing.length + 1}`,
    sortOrder: nextOrder,
    offerItemIds: "[]",
    requestItemIds: "[]",
    requestTags: "[]",
    offerRobux: 0,
    requestRobux: 0,
    enabled: true,
  };

  if (parsed.data.duplicateFromId) {
    const source = existing.find((a) => a.id === parsed.data.duplicateFromId);
    if (!source) {
      return NextResponse.json({ error: "Source ad not found." }, { status: 404 });
    }
    data = {
      ...data,
      name: parsed.data.name?.trim() || `${source.name} copy`,
      offerItemIds: source.offerItemIds,
      requestItemIds: source.requestItemIds,
      requestTags: source.requestTags,
      offerRobux: source.offerRobux,
      requestRobux: source.requestRobux,
      enabled: source.enabled,
    };
  }

  const ad = await prisma.tradeAd.create({ data });
  return NextResponse.json({ ok: true, ad: serializeAd(ad) });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodySchema = z.object({
    autoPostEnabled: z.boolean().optional(),
    rotationMode: z.enum(["round_robin", "random", "single"]).optional(),
    activeAdId: z.string().nullable().optional(),
    orderedIds: z.array(z.string()).optional(),
  });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const { autoPostEnabled, rotationMode, activeAdId, orderedIds } = parsed.data;

  if (orderedIds) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.tradeAd.updateMany({
          where: { id, userId: session.userId },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: {
      ...(typeof autoPostEnabled === "boolean" ? { autoPostEnabled } : {}),
      ...(rotationMode ? { rotationMode } : {}),
      ...(activeAdId !== undefined ? { activeAdId } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    autoPostEnabled: user.autoPostEnabled,
    rotationMode: user.rotationMode,
    activeAdId: user.activeAdId,
  });
}
