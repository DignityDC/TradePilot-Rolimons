import Link from "next/link";
import Nav from "@/components/Nav";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="flex flex-1 flex-col">
      <Nav username={session.username} />
      <section className="tp-shell flex flex-1 flex-col justify-center py-16">
        <p className="tp-display text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          TradePilot Rolimons
        </p>
        <h1 className="mt-3 max-w-2xl tp-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Post trade ads on a schedule. Rotate them. Done.
        </h1>
        <p className="tp-muted mt-4 max-w-xl text-base leading-relaxed">
          Site login is username/password — not Roblox. Link your Rolimons token
          once, build ads from inventory, auto-post every 15 minutes.
        </p>
        <div className="mt-5 max-w-xl tp-alert tp-alert-warn">
          Never enter your Roblox password or .ROBLOSECURITY cookie here.
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href={session.isLoggedIn ? "/dashboard" : "/signup"}
            className="tp-btn tp-btn-primary px-5 py-2.5"
          >
            {session.isLoggedIn ? "Open ads" : "Create account"}
          </Link>
          {!session.isLoggedIn ? (
            <Link href="/login" className="tp-btn px-5 py-2.5">
              Log in
            </Link>
          ) : (
            <Link href="/settings" className="tp-btn px-5 py-2.5">
              Settings
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
