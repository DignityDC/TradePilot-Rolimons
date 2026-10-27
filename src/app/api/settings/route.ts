import { NextResponse } from "next/server";
import { z } from "zod";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { resolveRobloxUser } from "@/lib/roblox";
import { getSession, hasRolimonsSetup } from "@/lib/session";

const bodySchema = z.object({
  robloxUsername: z.string().min(3).max(20),
  roliToken: z.string().min(10),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    username: user.username,
    robloxUsername: user.robloxUsername,
    robloxUserId: user.robloxUserId,
    hasToken: Boolean(user.roliTokenEnc),
    setupComplete: hasRolimonsSetup(user),
    autoPostEnabled: user.autoPostEnabled,
  });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const cleaned = parsed.data.roliToken
    .trim()
    .replace(/^_RoliVerification=/i, "");

  if (/_\|WARNING|ROBLOSECURITY|\.ROBLOSECURITY/i.test(cleaned)) {
    return NextResponse.json(
      {
        error:
          "That looks like a Roblox cookie. Use your Rolimons _RoliVerification token only.",
      },
      { status: 400 },
    );
  }

  const roblox = await resolveRobloxUser(parsed.data.robloxUsername);
  if (!roblox) {
    return NextResponse.json(
      { error: "Roblox username not found." },
      { status: 404 },
    );
  }

  const taken = await prisma.user.findFirst({
    where: {
      robloxUserId: roblox.id,
      NOT: { id: session.userId },
    },
  });
  if (taken) {
    return NextResponse.json(
      { error: "That Roblox account is already linked to another user." },
      { status: 409 },
    );
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: {
      robloxUsername: roblox.name,
      robloxUserId: roblox.id,
      roliTokenEnc: encrypt(cleaned),
    },
  });

  return NextResponse.json({
    ok: true,
    robloxUsername: user.robloxUsername,
    robloxUserId: user.robloxUserId,
    hasToken: true,
    setupComplete: true,
  });
}
