"use client";

import { useEffect, useState } from "react";
import Wordmark from "./shell/Wordmark";
import Icon from "./ui/Icon";

interface PublicProfile {
  id: string;
  name: string;
  hasPassword: boolean;
}

/** The sign-in page: pick a profile, enter its password. `next` is already checked to be a path on this site. */
export default function Unlock({ next }: { next: string }) {
  const [profiles, setProfiles] = useState<PublicProfile[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/profiles")
      .then((r) => r.json())
      .then((d: { profiles?: PublicProfile[] }) => {
        if (cancelled) return;
        const usable = (d.profiles ?? []).filter((p) => p.hasPassword);
        setProfiles(usable);
        setChosen((current) => current ?? usable[0]?.id ?? null);
      })
      .catch(() => !cancelled && setError("Couldn't reach the server."));
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: chosen, password }),
      });
      if (res.ok) {
        window.location.assign(next);
        return;
      }
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't sign in.");
      setPassword("");
    } catch {
      setError("Couldn't reach the server.");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Wordmark />
      </div>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <Icon name="lock" /> Sign in
          </h1>
          <p className="mt-0.5 text-xs text-muted">Choose whose collection to open, then enter that profile&apos;s password.</p>
        </div>

        {profiles === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : profiles.length === 0 ? (
          <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
            No profiles have been set up on this site yet.
          </p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Profile" className="flex flex-wrap gap-2">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen === p.id}
                  onClick={() => {
                    setChosen(p.id);
                    setError(null);
                  }}
                  className={`btn ${chosen === p.id ? "border-accent bg-accent-soft text-accent-text" : ""}`}
                >
                  <Icon name="user" /> {p.name}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-bad">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy || !chosen || password === ""} className="btn btn-primary w-full">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </>
        )}
        {profiles !== null && profiles.length === 0 && error && <p className="text-sm text-bad">{error}</p>}
      </form>

      <p className="text-center text-xs text-subtle">You stay signed in on this device for about three months.</p>
      <p className="text-center text-xs text-subtle">An unofficial fan project, not affiliated with Nintendo, The Pokémon Company or TCGplayer.</p>
    </main>
  );
}
