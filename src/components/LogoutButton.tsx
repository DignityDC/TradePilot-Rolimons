"use client";

export default function LogoutButton() {
  return (
    <button
      type="button"
      className="tp-btn tp-btn-ghost tp-muted"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
      }}
    >
      Log out
    </button>
  );
}
