export const ENDPOINTS = {
  itemDetails: "https://api.rolimons.com/items/v1/itemdetails",
  dealActivity: "https://api.rolimons.com/market/v1/dealactivity",
  playerInfo: "https://api.rolimons.com/players/v1/playerinfo/",
  playerAssets: "https://api.rolimons.com/players/v1/playerassets/",
  getRecentAds: "https://api.rolimons.com/tradeads/v1/getrecentads",
  createAd: "https://api.rolimons.com/tradeads/v1/createad",
} as const;

export const DEMANDS: Record<number, string> = {
  [-1]: "Unassigned",
  0: "Terrible",
  1: "Low",
  2: "Normal",
  3: "High",
  4: "Amazing",
};

export const TRENDS: Record<number, string> = {
  [-1]: "None",
  0: "Lowering",
  1: "Unstable",
  2: "Stable",
  3: "Raising",
  4: "Fluctuating",
};

export { REQUEST_TAGS, type RequestTag } from "@/lib/tags";
import type { RequestTag } from "@/lib/tags";

export type Item = {
  id: number;
  name: string;
  acronym: string;
  rap: number;
  value: number;
  defaultValue: number;
  demand: string;
  trend: string;
  projected: boolean;
  hyped: boolean;
  rare: boolean;
};

export type TradeAd = {
  username: string;
  offeringItems: number[];
  offeringRobux: number;
  requestingItems: number[];
  tags: string[];
};

export type CreateTradeAdParams = {
  playerId: number;
  offerItemIds: number[];
  requestItemIds: number[];
  requestTags: RequestTag[];
  offerRobux?: number;
  requestRobux?: number;
  roliVerification: string;
};

type RawItem = [
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0";

async function callEndpoint<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const raw = await res.text();
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseItem(id: string, item: RawItem): Item {
  return {
    id: Number(id),
    name: item[0],
    acronym: item[1],
    rap: item[2],
    value: item[3],
    defaultValue: item[4],
    demand: DEMANDS[item[5]] ?? "Unassigned",
    trend: TRENDS[item[6]] ?? "None",
    projected: item[7] !== -1,
    hyped: item[8] !== -1,
    rare: item[9] !== -1,
  };
}

export async function getItems(): Promise<Item[]> {
  const data = await callEndpoint<{
    success: boolean;
    items: Record<string, RawItem>;
  }>(ENDPOINTS.itemDetails);
  if (!data?.success || !data.items) return [];
  return Object.entries(data.items).map(([id, item]) => parseItem(id, item));
}

export async function getItemDetails(itemId: number): Promise<Item | null> {
  const data = await callEndpoint<{
    success: boolean;
    items: Record<string, RawItem>;
  }>(ENDPOINTS.itemDetails);
  if (!data?.success) return null;
  const raw = data.items[String(itemId)];
  if (!raw) return null;
  return parseItem(String(itemId), raw);
}

export async function getItemCount(): Promise<number | null> {
  const data = await callEndpoint<{ success: boolean; item_count: number }>(
    ENDPOINTS.itemDetails,
  );
  if (!data?.success) return null;
  return data.item_count;
}

export function calculateRapChange(oldPrice: number, newPrice: number) {
  const rap = Number(oldPrice);
  const price = Number(newPrice);
  if (price >= rap) {
    const gain = Math.floor((price - rap) / 10);
    const expectedRap = rap + gain;
    return {
      originalRap: rap,
      expectedRap,
      rapChange: gain,
      percentChange: Math.round(((100 * gain) / expectedRap) * 100) / 100,
      isGainingRap: true,
    };
  }
  const loss = Math.floor((rap - price) / 10);
  const expectedRap = rap - loss;
  return {
    originalRap: rap,
    expectedRap,
    rapChange: -loss,
    percentChange: -(Math.round(((100 * loss) / expectedRap) * 100) / 100),
    isGainingRap: false,
  };
}

export async function getRecentAds(): Promise<{
  tradeAdCount: number;
  tradeAds: TradeAd[];
} | null> {
  const data = await callEndpoint<{
    success: boolean;
    trade_ad_count: number;
    trade_ads: Array<
      [
        number,
        number,
        number,
        string,
        { items?: number[]; robux?: number },
        { items?: number[]; tags?: number[] },
      ]
    >;
  }>(ENDPOINTS.getRecentAds);
  if (!data?.success) return null;

  const tagMap: Record<number, string> = {
    1: "Demand",
    2: "Rares",
    3: "Robux",
    4: "Any",
    5: "Upgrading",
    6: "Downgrade",
    7: "RAP",
    8: "Wishlist",
    9: "Projecteds",
    10: "Adds",
  };

  return {
    tradeAdCount: data.trade_ad_count,
    tradeAds: data.trade_ads.map((ad) => ({
      username: ad[3],
      offeringItems: ad[4]?.items ?? [],
      offeringRobux: ad[4]?.robux ?? 0,
      requestingItems: ad[5]?.items ?? [],
      tags: (ad[5]?.tags ?? []).map((t) => tagMap[t] ?? String(t)),
    })),
  };
}

export async function getPlayerInfo(userId: number) {
  const data = await callEndpoint<{
    success: boolean;
    name: string;
    value: number;
    rap: number;
    rank: number;
    premium: boolean;
    privacy_enabled: boolean;
    terminated: boolean;
    stats_updated: number;
    last_scan: number;
    last_online: number;
    last_location: string;
    rolibadges: Record<string, unknown>;
  }>(`${ENDPOINTS.playerInfo}${userId}`);
  if (!data?.success) return null;
  return {
    name: data.name,
    value: data.value,
    rap: data.rap,
    rank: data.rank,
    premium: data.premium,
    privacyEnabled: data.privacy_enabled,
    terminated: data.terminated,
    statsUpdated: data.stats_updated,
    lastScan: data.last_scan,
    lastOnline: data.last_online,
    lastLocation: data.last_location,
    rolibadges: data.rolibadges,
  };
}

export async function getRecentDealActivity() {
  return callEndpoint(`${ENDPOINTS.dealActivity}`);
}

export async function getPlayerInventory(userId: number): Promise<{
  itemIds: number[];
  privated: boolean;
  terminated: boolean;
} | null> {
  const data = await callEndpoint<{
    success: boolean;
    playerPrivacyEnabled?: boolean;
    playerTerminated?: boolean;
    playerAssets?: Record<string, number[]>;
  }>(`${ENDPOINTS.playerAssets}${userId}`);

  if (!data?.success || !data.playerAssets) {
    return null;
  }

  return {
    itemIds: Object.keys(data.playerAssets).map(Number),
    privated: Boolean(data.playerPrivacyEnabled),
    terminated: Boolean(data.playerTerminated),
  };
}

export type CreateAdResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "cooldown"
        | "invalid_token"
        | "rate_limit"
        | "http_error"
        | "network";
      status?: number;
      message: string;
    };

function messageFromRolimonsBody(
  data: Record<string, unknown> | null,
  raw: string,
  fallback: string,
) {
  if (!data) {
    if (raw.trim()) return raw.trim().slice(0, 400);
    return fallback;
  }
  const candidates = [
    data.message,
    data.error,
    data.Error,
    data.detail,
    data.details,
    data.reason,
    typeof data.msg === "string" ? data.msg : null,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  if (data.success === false && raw.length < 400) return raw;
  return fallback;
}

function isRolimonsCooldown(
  status: number,
  data: Record<string, unknown> | null,
  message: string,
) {
  // Rolimons code 7 = "Ad creation cooldown has not elapsed"
  if (data?.code === 7 || data?.code === "7") return true;
  if (/cooldown|not elapsed/i.test(message)) return true;
  // Empty 400 bodies are treated as cooldown (same as the official roli client).
  if (status === 400 && !message) return true;
  return false;
}

export async function createTradeAd(
  params: CreateTradeAdParams,
): Promise<CreateAdResult> {
  try {
    const res = await fetch(ENDPOINTS.createAd, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Connection: "keep-alive",
        "Content-Type": "application/json;charset=utf-8",
        Cookie: `_RoliVerification=${params.roliVerification}`,
      },
      body: JSON.stringify({
        player_id: params.playerId,
        offer_item_ids: params.offerItemIds,
        request_item_ids: params.requestItemIds,
        request_tags: params.requestTags,
        ...(params.offerRobux && params.offerRobux > 0
          ? { offer_robux: params.offerRobux }
          : {}),
        ...(params.requestRobux && params.requestRobux > 0
          ? { request_robux: params.requestRobux }
          : {}),
      }),
    });

    const raw = await res.text().catch(() => "");
    let data: Record<string, unknown> | null = null;
    if (raw) {
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        data = null;
      }
    }

    // Official Rolimons clients treat 201 as success; also accept explicit success:true.
    if (
      res.status === 201 ||
      (res.status === 200 && data?.success === true)
    ) {
      return { ok: true };
    }

    const message = messageFromRolimonsBody(
      data,
      raw,
      `Rolimons error (status ${res.status}).`,
    );

    if (isRolimonsCooldown(res.status, data, message)) {
      return {
        ok: false,
        code: "cooldown",
        status: res.status,
        message:
          message || "Ad creation cooldown has not elapsed",
      };
    }
    if (res.status === 422) {
      return {
        ok: false,
        code: "invalid_token",
        status: 422,
        message: message || "Rolimons token is invalid or expired.",
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        code: "rate_limit",
        status: 429,
        message: message || "Too many requests to Rolimons.",
      };
    }
    return {
      ok: false,
      code: "http_error",
      status: res.status,
      message,
    };
  } catch {
    return { ok: false, code: "network", message: "Network error posting ad." };
  }
}

export function itemThumbnailUrl(assetId: number) {
  return `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`;
}
