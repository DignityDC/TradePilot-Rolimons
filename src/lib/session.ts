import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  userId?: string;
  username?: string;
  isLoggedIn: boolean;
};

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "complex_password_at_least_32_characters_long",
  cookieName: "rolimons_bot_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export function hasRolimonsSetup(user: {
  robloxUsername: string | null;
  robloxUserId: number | null;
  roliTokenEnc: string | null;
}) {
  return Boolean(
    user.robloxUsername && user.robloxUserId && user.roliTokenEnc,
  );
}
