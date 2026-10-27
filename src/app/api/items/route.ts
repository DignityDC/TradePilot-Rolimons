import { NextResponse } from "next/server";
import { getItems } from "@/lib/rolimons";
import { getThumbnailMap } from "@/lib/roblox";

type CachedItem = {
  id: number;
  name: string;
  acronym: string;
  rap: number;
  value: number;
  demand: string;
  trend: string;
  rare: boolean;
  projected: boolean;
};

let cache: { at: number; items: CachedItem[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 24), 1), 100);
  const page = Math.max(Number(searchParams.get("page") || 1), 1);

  const now = Date.now();
  if (!cache || now - cache.at > CACHE_MS) {
    const items = await getItems();
    cache = {
      at: now,
      items: items
        .map((i) => ({
          id: i.id,
          name: i.name,
          acronym: i.acronym,
          rap: i.rap,
          value: i.value,
          demand: i.demand,
          trend: i.trend,
          rare: i.rare,
          projected: i.projected,
        }))
        .sort((a, b) => b.value - a.value),
    };
  }

  let list = cache.items;
  if (q) {
    list = list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.acronym.toLowerCase().includes(q) ||
        String(i.id).includes(q),
    );
  }

  const totalPages = Math.max(1, Math.ceil(list.length / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const pageItems = list.slice(start, start + limit);
  const thumbs = await getThumbnailMap(pageItems.map((i) => i.id));

  return NextResponse.json({
    count: list.length,
    page: safePage,
    pageSize: limit,
    totalPages,
    items: pageItems.map((i) => ({
      ...i,
      imageUrl: thumbs[i.id],
    })),
  });
}
