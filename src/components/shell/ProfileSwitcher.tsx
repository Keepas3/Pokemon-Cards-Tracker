"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";

interface Me {
  active: string | null;
  profiles: { id: string; name: string; unlocked: boolean }[];
}

/**
 * Whose collection this is. Switching to a profile already unlocked on this device is one tap;
 * a locked one asks for its password first. The page reloads afterwards so nothing from the
 * previous profile is left on screen.
 */
export default function ProfileSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Me | null) => !cancelled && d && setMe(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!me || !me.active) return null;
  const active = me.profiles.find((p) => p.id === me.active);

  async function post(url: string, body: unknown): Promise<Response> {
    setBusy(true);
    setError(null);
    try {
      return await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } finally {
      setBusy(false);
    }
  }

  async function choose(id: string, unlocked: boolean) {
    if (id === me?.active) return setOpen(false);
    if (!unlocked) {
      setAsking(id);
      setPassword("");
      return;
    }
    const res = await post("/api/auth/switch", { profileId: id });
    if (res.ok) window.location.reload();
    else setError((await res.json().catch(() => ({}))).error ?? "Couldn't switch.");
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!asking) return;
    const res = await post("/api/auth/unlock", { profileId: asking, password });
    if (res.ok) window.location.reload();
    else {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't sign in.");
      setPassword("");
    }
  }

  async function signOut() {
    await post("/api/auth/lock", {});
    router.push("/unlock");
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-left text-sm font-medium hover:border-line-strong"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text" aria-hidden="true">
          {(active?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate">{active?.name}</span>
        <Icon name="chevron" className={`h-3.5 w-3.5 text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="card absolute left-0 right-0 top-full z-40 mt-1.5 space-y-1 p-1.5 shadow-lg">
          {me.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void choose(p.id, p.unlocked)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${p.id === me.active ? "font-semibold text-accent-text" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.id === me.active ? <Icon name="check" className="h-3.5 w-3.5" /> : !p.unlocked && <Icon name="lock" className="h-3.5 w-3.5 text-subtle" />}
            </button>
          ))}

          {asking && (
            <form onSubmit={unlock} className="space-y-1.5 border-t border-line px-1 pt-2">
              <label htmlFor="switch-password" className="block text-xs text-muted">
                Password for {me.profiles.find((p) => p.id === asking)?.name}
              </label>
              <input
                id="switch-password"
                type="password"
                autoComplete="off"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
              />
              <button type="submit" disabled={busy || password === ""} className="btn btn-primary btn-sm w-full">
                Unlock
              </button>
            </form>
          )}

          {error && (
            <p role="alert" className="px-2 py-1 text-xs text-bad">
              {error}
            </p>
          )}

          <button type="button" role="menuitem" onClick={() => void signOut()} className="w-full rounded-md border-t border-line px-2 py-1.5 text-left text-xs text-subtle hover:bg-surface-2 hover:text-fg">
            Sign out of this device
          </button>
        </div>
      )}
    </div>
  );
}
