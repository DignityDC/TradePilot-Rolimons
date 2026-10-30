import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getItems, getPlayerInventory } from "@/lib/rolimons";
import { getAssetNameMap, getThumbnailMap } from "@/lib/roblox";
import { getSession, hasRolimonsSetup } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!hasRolimonsSetup(user) || !user.robloxUserId) {
    return NextResponse.json(
      {
        error: "setup_required",
        message:
          "Set your Roblox username and Rolimons token in Settings before viewing inventory.",
      },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const inventory = await getPlayerInventory(user.robloxUserId);
  if (!inventory) {
    return NextResponse.json(
      { error: "Could not load inventory from Rolimons." },
      { status: 502 },
    );
  }

  if (inventory.privated) {
    return NextResponse.json({
      privated: true,
      items: [],
      message: "This Roblox inventory is private on Rolimons.",
    });
  }

  const catalog = await getItems();
  const byId = new Map(catalog.map((i) => [i.id, i]));
  const missingIds = inventory.itemIds.filter((id) => !byId.has(id));
  const names = missingIds.length ? await getAssetNameMap(missingIds) : {};

  // Keep assets even if Rolimons catalog lags — show Roblox name + unknown value.
  let items = inventory.itemIds
    .map((id) => {
      const i = byId.get(id);
      if (i) {
        return {
          id: i.id,
          name: i.name,
          acronym: i.acronym,
          rap: i.rap,
          value: i.value,
          demand: i.demand,
          trend: i.trend,
          rare: i.rare,
          projected: i.projected,
        };
      }
      return {
        id,
        name: names[id] || `Item ${id}`,
        acronym: "",
        rap: -1,
        value: -1,
        demand: "Unassigned",
        trend: "None",
        rare: false,
        projected: false,
      };
    })
    .sort((a, b) => (b.value < 0 ? 0 : b.value) - (a.value < 0 ? 0 : a.value));

  if (q) {
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.acronym.toLowerCase().includes(q) ||
        String(i.id).includes(q),
    );
  }

  const thumbs = await getThumbnailMap(items.map((i) => i.id));

  return NextResponse.json({
    privated: false,
    count: items.length,
    items: items.map((i) => ({ ...i, imageUrl: thumbs[i.id] })),
  });
}
