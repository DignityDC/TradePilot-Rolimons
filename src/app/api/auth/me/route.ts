import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hasRolimonsSetup } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    session.destroy();
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      robloxUsername: user.robloxUsername,
      robloxUserId: user.robloxUserId,
      hasToken: Boolean(user.roliTokenEnc),
      setupComplete: hasRolimonsSetup(user),
      autoPostEnabled: user.autoPostEnabled,
      rotationMode: user.rotationMode,
      lastPostedAt: user.lastPostedAt,
      lastPostStatus: user.lastPostStatus,
      lastPostError: user.lastPostError,
    },
  });
}
