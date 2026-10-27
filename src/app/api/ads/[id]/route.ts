import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { REQUEST_TAGS } from "@/lib/tags";
import { findAdForUser, serializeAd } from "@/lib/trade";

type Ctx = { params: Promise<{ id: string }> };

const saveSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  offerItemIds: z.array(z.number().int().positive()).max(4).optional(),
  requestItemIds: z.array(z.number().int().positive()).max(4).optional(),
  requestTags: z.array(z.enum(REQUEST_TAGS)).max(4).optional(),
  offerRobux: z.number().int().min(0).max(2_000_000_000).optional(),
  requestRobux: z.number().int().min(0).max(2_000_000_000).optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const ad = await findAdForUser(session.userId, id);
  if (!ad) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = saveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trade ad config." }, { status: 400 });
  }

  const data = parsed.data;
  if (
    data.offerItemIds &&
    data.requestItemIds &&
    data.requestTags &&
    data.offerItemIds.length < 1
  ) {
    return NextResponse.json(
      { error: "Select at least 1 offer item (max 4)." },
      { status: 400 },
    );
  }

  if (
    data.requestItemIds &&
    data.requestTags &&
    typeof data.requestRobux === "number" &&
    data.requestItemIds.length + data.requestTags.length < 1 &&
    data.requestRobux <= 0
  ) {
    return NextResponse.json(
      { error: "Select at least 1 request item, tag, or Robux." },
      { status: 400 },
    );
  }

  if (
    data.requestItemIds &&
    data.requestTags &&
    data.requestItemIds.length + data.requestTags.length > 4
  ) {
    return NextResponse.json(
      { error: "Request side allows max 4 items/tags combined." },
      { status: 400 },
    );
  }

  const updated = await prisma.tradeAd.update({
    where: { id: ad.id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.offerItemIds
        ? { offerItemIds: JSON.stringify(data.offerItemIds) }
        : {}),
      ...(data.requestItemIds
        ? { requestItemIds: JSON.stringify(data.requestItemIds) }
        : {}),
      ...(data.requestTags
        ? { requestTags: JSON.stringify(data.requestTags) }
        : {}),
      ...(typeof data.offerRobux === "number"
        ? { offerRobux: data.offerRobux }
        : {}),
      ...(typeof data.requestRobux === "number"
        ? { requestRobux: data.requestRobux }
        : {}),
      ...(typeof data.enabled === "boolean" ? { enabled: data.enabled } : {}),
    },
  });

  return NextResponse.json({ ok: true, ad: serializeAd(updated) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const count = await prisma.tradeAd.count({ where: { userId: session.userId } });
  if (count <= 1) {
    return NextResponse.json(
      { error: "Keep at least one trade ad." },
      { status: 400 },
    );
  }

  const ad = await prisma.tradeAd.findFirst({
    where: { id, userId: session.userId },
  });
  if (!ad) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.tradeAd.delete({ where: { id: ad.id } });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (user?.activeAdId === ad.id || user?.lastPostedAdId === ad.id) {
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        ...(user.activeAdId === ad.id ? { activeAdId: null } : {}),
        ...(user.lastPostedAdId === ad.id ? { lastPostedAdId: null } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
