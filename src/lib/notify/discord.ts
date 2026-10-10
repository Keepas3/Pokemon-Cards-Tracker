import { parseDiscordWebhook } from "@/lib/security/urls";

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  footer?: { text: string };
}

export interface DiscordPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

/** POSTs a message to a Discord incoming webhook. */
export async function postDiscord(
  webhookUrl: string,
  payload: DiscordPayload,
): Promise<{ ok: boolean; error?: string }> {
  // Whatever is saved gets a POST, so refuse anything that isn't a Discord webhook (and never follow a redirect off one).
  const target = parseDiscordWebhook(webhookUrl);
  if (!target) return { ok: false, error: "The saved webhook isn't a Discord webhook URL — save it again in Settings." };
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
    });
    if (!res.ok) {
      return { ok: false, error: `Discord webhook returned ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function sendDiscordEmbed(
  webhookUrl: string,
  content: string,
  embed: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  return postDiscord(webhookUrl, { content, embeds: [embed as DiscordEmbed] });
}

interface CardAlertParams {
  cardName: string;
  setName: string;
  variant: string | null;
  provider: string;
  url: string;
  priceCents: number | null;
  thresholdCents: number;
  imageUrl?: string | null;
}

/** Sends a card-singles price-threshold alert (market price dropped to/below the user's target). */
export async function sendDiscordCardPriceAlert(
  webhookUrl: string,
  params: CardAlertParams,
): Promise<{ ok: boolean; error?: string }> {
  const price = params.priceCents != null ? `$${(params.priceCents / 100).toFixed(2)}` : "price unknown";
  const threshold = `$${(params.thresholdCents / 100).toFixed(2)}`;
  const providerLabel = params.provider.replace(/_/g, " ");
  const label = `${params.cardName} (${params.setName})${params.variant ? ` — ${params.variant}` : ""}`;

  const embed: Record<string, unknown> = {
    title: `💰 Price drop: ${label}`,
    description: `**${providerLabel}** — ${price} (your threshold: ${threshold})`,
    url: params.url,
    color: 0xf59e0b,
  };
  if (params.imageUrl) embed.thumbnail = { url: params.imageUrl };

  return sendDiscordEmbed(
    webhookUrl,
    `**${label}** just dropped to ${price} per ${providerLabel} (at or below your ${threshold} threshold)\n${params.url}`,
    embed,
  );
}
