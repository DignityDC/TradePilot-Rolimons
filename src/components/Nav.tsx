import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export default function Nav({ username }: { username?: string | null }) {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="tp-shell flex h-12 items-center justify-between gap-4">
        <Link
          href="/"
          className="tp-display text-xl font-bold tracking-wide text-[var(--text)]"
        >
          TradePilot <span className="text-[var(--accent)]">Rolimons</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {username ? (
            <>
              <span className="tp-muted mr-2 hidden sm:inline">{username}</span>
              <Link href="/dashboard" className="tp-btn tp-btn-ghost">
                Ads
              </Link>
              <Link href="/settings" className="tp-btn tp-btn-ghost">
                Settings
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="tp-btn tp-btn-ghost">
                Log in
              </Link>
              <Link href="/signup" className="tp-btn tp-btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
