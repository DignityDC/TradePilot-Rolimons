import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hasRolimonsSetup } from "@/lib/session";
import { postNextRotatedAd } from "@/lib/trade";

export async function POST() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!hasRolimonsSetup(user)) {
      return NextResponse.json(
        {
          error: "setup_required",
          message:
            "Set your Roblox username and Rolimons token in Settings before posting.",
        },
        { status: 400 },
      );
    }

    const result = await postNextRotatedAd(session.userId);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.message,
          code: "code" in result ? result.code : undefined,
          cooldownRemainingMs:
            "cooldownRemainingMs" in result
              ? result.cooldownRemainingMs
              : undefined,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      adId: result.adId,
      adName: result.adName,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Post failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
