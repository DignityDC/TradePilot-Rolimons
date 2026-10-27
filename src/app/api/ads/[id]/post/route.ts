import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hasRolimonsSetup } from "@/lib/session";
import { postTradeAdById } from "@/lib/trade";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
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

    const { id } = await ctx.params;
    const result = await postTradeAdById(session.userId, id, false);
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
