export default function TokenWarning() {
  return (
    <div className="tp-alert tp-alert-warn">
      <p className="font-semibold text-[var(--accent)]">
        Rolimons token only — never a Roblox cookie
      </p>
      <p className="mt-1 tp-muted">
        Copy <code className="tp-mono text-[var(--text)]">_RoliVerification</code> from
        rolimons.com cookies. Do not paste{" "}
        <code className="tp-mono text-[var(--text)]">.ROBLOSECURITY</code>.
      </p>
      <ol className="mt-2 list-decimal space-y-0.5 pl-4 tp-muted">
        <li>Log in on rolimons.com</li>
        <li>DevTools → Application → Cookies</li>
        <li>Copy _RoliVerification value</li>
      </ol>
    </div>
  );
}
