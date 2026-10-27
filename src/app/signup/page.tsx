"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      window.location.href = "/settings";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="tp-shell flex flex-1 flex-col py-10">
      <Link href="/" className="tp-muted mb-8 w-fit text-sm hover:text-[var(--text)]">
        ← Home
      </Link>
      <h1 className="tp-display text-4xl font-bold">
        Create account
      </h1>
      <p className="tp-muted mt-2 max-w-md text-sm">
        This is a TradePilot login — not Roblox. You&apos;ll add Rolimons details
        in Settings next.
      </p>
      <form onSubmit={onSubmit} className="mt-8 max-w-md space-y-4">
        <label className="block">
          <span className="tp-label">Username</span>
          <input
            required
            minLength={3}
            maxLength={24}
            pattern="[a-zA-Z0-9_]{3,24}"
            title="At least 3 letters, numbers, or underscores"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="tp-input"
            placeholder="At least 3 letters, numbers, or _"
            autoComplete="username"
          />
        </label>
        <label className="block">
          <span className="tp-label">Password</span>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="tp-input"
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </label>
        {error && <p className="tp-alert tp-alert-bad">{error}</p>}
        <button type="submit" disabled={loading} className="tp-btn tp-btn-primary w-full py-2.5">
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="tp-muted mt-5 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--accent)] hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
