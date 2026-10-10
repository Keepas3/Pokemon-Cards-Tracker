import { describe, it, expect } from "vitest";
import { parseDiscordWebhook, safeHref, safeHttpUrl, webhookHint } from "../urls";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd";
const hook = (host = "discord.com", tail = `/api/webhooks/123456789012345678/${TOKEN}`) => `https://${host}${tail}`;

describe("safeHttpUrl / safeHref", () => {
  it("accepts ordinary http and https links", () => {
    expect(safeHttpUrl("https://www.bestbuy.com/site/x/6567300.p")).toBe("https://www.bestbuy.com/site/x/6567300.p");
    expect(safeHttpUrl("  http://example.com/a?b=1 ")).toBe("http://example.com/a?b=1");
  });

  it("rejects script, data, file and other schemes", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd", "ftp://x.com/y", "vbscript:x"]) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
  });

  it("rejects relative links, junk, non-strings, embedded credentials and absurd lengths", () => {
    expect(safeHttpUrl("/relative")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
    expect(safeHttpUrl({ href: "https://x.com" })).toBeNull();
    expect(safeHttpUrl("https://user:pw@example.com/")).toBeNull();
    expect(safeHttpUrl(`https://example.com/${"a".repeat(3000)}`)).toBeNull();
  });

  it("safeHref gives undefined (no href) rather than a dangerous string", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref("https://example.com/")).toBe("https://example.com/");
  });
});

describe("parseDiscordWebhook", () => {
  it("accepts real Discord webhook addresses", () => {
    expect(parseDiscordWebhook(hook())).toBe(hook());
    expect(parseDiscordWebhook(hook("discordapp.com"))).not.toBeNull();
    expect(parseDiscordWebhook(hook("ptb.discord.com"))).not.toBeNull();
    expect(parseDiscordWebhook(hook("canary.discord.com", `/api/v10/webhooks/123456789012345678/${TOKEN}`))).not.toBeNull();
    expect(parseDiscordWebhook(`${hook()}?thread_id=123456789012&wait=true`)).not.toBeNull();
  });

  it("refuses internal addresses and other hosts — the app POSTs to this URL", () => {
    for (const bad of [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:3000/api/products",
      "https://127.0.0.1/api/webhooks/123456789012345678/" + TOKEN,
      "https://evil.example/api/webhooks/123456789012345678/" + TOKEN,
      "https://discord.com.evil.example/api/webhooks/123456789012345678/" + TOKEN,
      "https://evil.example/discord.com/api/webhooks/123456789012345678/" + TOKEN,
      "https://notdiscord.com/api/webhooks/123456789012345678/" + TOKEN,
    ]) {
      expect(parseDiscordWebhook(bad)).toBeNull();
    }
  });

  it("refuses plain http, odd ports, credentials, wrong paths and stray parameters", () => {
    expect(parseDiscordWebhook(hook().replace("https:", "http:"))).toBeNull();
    expect(parseDiscordWebhook(hook("discord.com:8443"))).toBeNull();
    expect(parseDiscordWebhook(`https://user:pw@discord.com/api/webhooks/123456789012345678/${TOKEN}`)).toBeNull();
    expect(parseDiscordWebhook(hook("discord.com", "/api/channels/123456789012345678/messages"))).toBeNull();
    expect(parseDiscordWebhook(hook("discord.com", `/api/webhooks/123456789012345678/${TOKEN}/../../x`))).toBeNull();
    expect(parseDiscordWebhook(`${hook()}?redirect=http://evil.example`)).toBeNull();
    expect(parseDiscordWebhook(`${hook()}#frag`)).toBeNull();
    expect(parseDiscordWebhook(null)).toBeNull();
    expect(parseDiscordWebhook("")).toBeNull();
  });
});

describe("webhookHint", () => {
  it("shows only the last four characters of the secret", () => {
    const hint = webhookHint(hook());
    expect(hint).toContain("abcd");
    expect(hint).not.toContain(TOKEN.slice(0, 20));
  });

  it("is null with no webhook, and flags a saved value that isn't a Discord webhook", () => {
    expect(webhookHint(null)).toBeNull();
    expect(webhookHint("http://169.254.169.254/")).toMatch(/replace/);
  });
});
