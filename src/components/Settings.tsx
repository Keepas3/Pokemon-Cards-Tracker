"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { NotificationConfigDTO } from "@/lib/clientTypes";
import ThemeToggle from "./shell/ThemeToggle";
import PageHeader from "./ui/PageHeader";

function hourLabel(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${suffix}`;
}

/** A titled group of settings. */
function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, help, children }: { label: string; htmlFor?: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {help && <p className="text-xs text-subtle">{help}</p>}
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
      {children}
    </label>
  );
}

/** Change your own password; the current one is required. */
function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Password changed." });
        setCurrent("");
        setNext("");
      } else {
        setMsg({ ok: false, text: (await res.json().catch(() => ({}))).error ?? "Couldn't change it." });
      }
    } catch {
      setMsg({ ok: false, text: "Couldn't reach the server." });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Current password" htmlFor="pw-current">
        <input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="input w-full max-w-xs" />
      </Field>
      <Field label="New password" htmlFor="pw-new" help="At least 8 characters.">
        <input id="pw-new" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className="input w-full max-w-xs" />
      </Field>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !current || next.length < 8} className="btn">
          {busy ? "Changing…" : "Change password"}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}

/** Download your data as a backup file, or merge one back in (also how a collection moves between installs). */
function DataBackup() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function restore(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const body = JSON.parse(await file.text());
      const res = await fetch("/api/profile/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Couldn't restore that file." });
      } else {
        const r = data.result;
        const parts = [
          `${r.owned.added} card${r.owned.added === 1 ? "" : "s"} added`,
          r.owned.raised ? `${r.owned.raised} count${r.owned.raised === 1 ? "" : "s"} raised` : null,
          r.followedPokemon ? `${r.followedPokemon} Pokémon followed` : null,
          r.watchedCards ? `${r.watchedCards} watched card${r.watchedCards === 1 ? "" : "s"}` : null,
          r.alertRules.added ? `${r.alertRules.added} alert rule${r.alertRules.added === 1 ? "" : "s"}` : null,
        ].filter(Boolean);
        const left = [
          r.owned.unknownSet ? `${r.owned.unknownSet} card${r.owned.unknownSet === 1 ? "" : "s"} in sets this site doesn't have` : null,
          r.alertRules.skipped ? `${r.alertRules.skipped} alert rule${r.alertRules.skipped === 1 ? "" : "s"} already here or waiting on a set's prices` : null,
          r.unreadable.length ? `${r.unreadable.length} unreadable entr${r.unreadable.length === 1 ? "y" : "ies"}` : null,
        ].filter(Boolean);
        setMsg({ ok: true, text: `Restored: ${parts.join(", ") || "nothing new"}.${left.length ? ` Left out: ${left.join("; ")}.` : ""}` });
      }
    } catch {
      setMsg({ ok: false, text: "That file couldn't be read as a backup." });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/api/profile/export" download className="btn">
          Download my backup
        </a>
        <a href="/api/profile/export?format=csv" download className="btn" title="Every card you own with its set, number and quantity — opens in Excel or Google Sheets">
          Download cards as a spreadsheet
        </a>
        <label className={`btn cursor-pointer ${busy ? "opacity-50" : ""}`}>
          {busy ? "Restoring…" : "Restore from a backup"}
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void restore(file);
            }}
          />
        </label>
      </div>
      {msg && (
        <p role="status" className={`text-xs ${msg.ok ? "text-good" : "text-bad"}`}>
          {msg.text}
        </p>
      )}
      <p className="text-xs text-subtle">
        The file holds what you own, the Pokémon you follow, your watched cards and alert rules. Restoring only adds or raises counts — it never
        removes anything, so it&apos;s safe to repeat, and it&apos;s how you move a collection from another copy of this app. The site also keeps its own
        nightly copy of the whole database, but that stays on the same server, so an occasional download of yours is still worth it.
      </p>
    </div>
  );
}

export default function Settings() {
  const [config, setConfig] = useState<NotificationConfigDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // The saved webhook is a secret the server never sends back, so this is only what you type now.
  const [webhookInput, setWebhookInput] = useState("");
  const [removeWebhook, setRemoveWebhook] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setConfig(d.config));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const fields = {
      enabled: config.enabled,
      quietHoursStart: config.quietHoursStart,
      quietHoursEnd: config.quietHoursEnd,
      digestEnabled: config.digestEnabled,
      digestHour: config.digestHour,
    };
    const typed = webhookInput.trim();
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // Leave the webhook out unless you changed it, so saving other settings never touches it.
      body: JSON.stringify(typed ? { ...fields, discordWebhookUrl: typed } : removeWebhook ? { ...fields, discordWebhookUrl: null } : fields),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "failed to save");
      return;
    }
    const reply = await res.json().catch(() => null);
    if (reply?.config) setConfig(reply.config);
    setWebhookInput("");
    setRemoveWebhook(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/digest/send", { method: "POST" });
      const result = (await res.json()) as
        | { status: "sent"; sections: number }
        | { status: "nothing" }
        | { status: "no-webhook" }
        | { status: "error"; error: string };
      if (result.status === "sent") {
        setTestMsg({ ok: true, text: `Sent — check Discord (${result.sections} section${result.sections === 1 ? "" : "s"}).` });
      } else if (result.status === "nothing") {
        setTestMsg({ ok: false, text: "Nothing to report from the last 24 hours, so nothing was sent." });
      } else if (result.status === "no-webhook") {
        setTestMsg({ ok: false, text: "Turn notifications on and save a Discord webhook first." });
      } else {
        setTestMsg({ ok: false, text: `Discord didn't accept it: ${result.error}` });
      }
    } catch (err) {
      setTestMsg({ ok: false, text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }

  if (!config) {
    return (
      <>
        <PageHeader title="Settings" />
        <p className="text-sm text-muted">Loading…</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Settings" description="How the site looks, and how and when you get notified." />

      <div className="max-w-2xl space-y-5">
        <Section title="Appearance" description="Match your system, or pick a theme. Remembered on this device.">
          <ThemeToggle showLabels />
        </Section>

        <Section
          title={`Your profile${config.name ? ` · ${config.name}` : ""}`}
          description="Your collection, watched cards, alerts and the notification settings below belong to this profile. Switch profiles from the menu at the top of the sidebar."
        >
          <PasswordForm />
        </Section>

        <form onSubmit={save} className="space-y-5">
          <Section title="Notifications" description="Price and deal alerts go to a Discord channel (and your phone, if you use the Discord app).">
            <Check checked={config.enabled} onChange={(v) => setConfig({ ...config, enabled: v })}>
              Notifications enabled
            </Check>

            <Field
              label="Discord webhook URL"
              htmlFor="webhook"
              help="Server Settings → Integrations → Webhooks → New Webhook, then copy the URL."
            >
              <input
                id="webhook"
                type="url"
                autoComplete="off"
                value={webhookInput}
                onChange={(e) => {
                  setWebhookInput(e.target.value);
                  setRemoveWebhook(false);
                }}
                placeholder={
                  config.discordWebhookSet && !removeWebhook ? "Saved — paste a new URL to replace it" : "https://discord.com/api/webhooks/..."
                }
                className="input w-full"
              />
              {config.discordWebhookSet && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {removeWebhook ? "Will be removed when you save." : config.discordWebhookHint}
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveWebhook((r) => !r);
                      setWebhookInput("");
                    }}
                    className="link"
                  >
                    {removeWebhook ? "Keep it" : "Remove"}
                  </button>
                </p>
              )}
            </Field>

            <Field
              label="Quiet hours (optional)"
              help="Prices are still checked during quiet hours — you just won't get a Discord ping. Leave blank to always notify. Hours are in the server's time zone."
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  placeholder="start (0-23)"
                  aria-label="Quiet hours start"
                  value={config.quietHoursStart ?? ""}
                  onChange={(e) => setConfig({ ...config, quietHoursStart: e.target.value === "" ? null : Number(e.target.value) })}
                  className="input w-28"
                />
                <span className="text-sm text-subtle">to</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  placeholder="end (0-23)"
                  aria-label="Quiet hours end"
                  value={config.quietHoursEnd ?? ""}
                  onChange={(e) => setConfig({ ...config, quietHoursEnd: e.target.value === "" ? null : Number(e.target.value) })}
                  className="input w-28"
                />
              </div>
            </Field>
          </Section>

          <Section
            title="Morning digest"
            description="One Discord message a day with what happened since the last one: moves on cards you watch and new smart-alert matches."
          >
            <Check checked={config.digestEnabled} onChange={(v) => setConfig({ ...config, digestEnabled: v })}>
              Send the morning digest
            </Check>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="digest-hour" className="text-muted">
                Send at
              </label>
              <select
                id="digest-hour"
                value={config.digestHour}
                disabled={!config.digestEnabled}
                onChange={(e) => setConfig({ ...config, digestHour: Number(e.target.value) })}
                className="input"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
              <span className="text-subtle">(the server&apos;s time zone)</span>
            </div>
            <p className="text-xs text-subtle">
              A day with none of that sends nothing. It ignores quiet hours (you chose the time) but needs notifications on
              and a webhook, and the app has to be running at that time — if it was off, it goes out when you next start it,
              up to six hours late.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={sendTest} disabled={testing} className="btn">
                {testing ? "Sending…" : "Send test digest"}
              </button>
              {testMsg && <span className={`text-xs ${testMsg.ok ? "text-good" : "text-warn"}`}>{testMsg.text}</span>}
            </div>
            <p className="text-xs text-subtle">
              The test covers the last 24 hours and uses the webhook as last saved — save first if you just changed it.
            </p>
          </Section>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saved && <span className="text-xs text-good">Saved.</span>}
            {error && <span className="text-sm text-bad">{error}</span>}
          </div>
        </form>

        <Section title="Your data" description="A backup you can keep, and a way to bring one back.">
          <DataBackup />
        </Section>

        <Section title="About">
          <p className="text-sm text-muted">
            An unofficial fan project, not affiliated with or endorsed by Nintendo, Creatures, GAME FREAK, The Pokémon Company or TCGplayer. Pokémon
            and its characters and card art are their property. Prices come from tcgapi.dev (market data that originates with TCGplayer), and card
            lists, logos and artwork from TCGdex. It&apos;s a private site for two collectors, with no ads or sales.
          </p>
        </Section>
      </div>
    </>
  );
}
