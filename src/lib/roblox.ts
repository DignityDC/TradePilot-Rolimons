export async function resolveRobloxUser(username: string): Promise<{
  id: number;
  name: string;
} | null> {
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: true,
      }),
    });
    if (!res.ok) return null;
    const raw = await res.text();
    if (!raw.trim()) return null;
    const data = JSON.parse(raw) as {
      data: Array<{ id: number; name: string; requestedUsername: string }>;
    };
    const match = data.data.find(
      (u) => u.requestedUsername.toLowerCase() === username.toLowerCase(),
    );
    if (!match) return null;
    return { id: match.id, name: match.name };
  } catch {
    return null;
  }
}

export async function getThumbnailMap(assetIds: number[]): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  if (assetIds.length === 0) return map;
  const chunks: number[][] = [];
  for (let i = 0; i < assetIds.length; i += 100) {
    chunks.push(assetIds.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    try {
      const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(",")}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const raw = await res.text();
      if (!raw.trim()) continue;
      const data = JSON.parse(raw) as {
        data: Array<{ targetId: number; imageUrl: string; state: string }>;
      };
      for (const row of data.data) {
        if (row.imageUrl) map[row.targetId] = row.imageUrl;
      }
    } catch {
      continue;
    }
  }
  return map;
}
