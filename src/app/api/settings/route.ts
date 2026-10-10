import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/current";
import { toConfigDTO } from "@/lib/notify/configDto";
import { parseDiscordWebhook } from "@/lib/security/urls";

/** The signed-in person's own notification settings. */
export async function GET() {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ config: toConfigDTO(auth.profile) });
}

interface SettingsBody {
  /** A string saves a new webhook, null (or "") removes it, and leaving it out keeps what's saved. */
  discordWebhookUrl?: string | null;
  enabled?: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  digestEnabled?: boolean;
  digestHour?: number;
}

const isHour = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 23;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function PUT(req: NextRequest) {
  const auth = await requireProfile();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as SettingsBody | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("expected a JSON object");

  for (const hour of [body.quietHoursStart, body.quietHoursEnd]) {
    if (hour != null && !isHour(hour)) return bad("quiet hours must be between 0 and 23");
  }
  if (body.digestHour != null && !isHour(body.digestHour)) return bad("digestHour must be a whole hour from 0 to 23");
  for (const flag of [body.enabled, body.digestEnabled]) {
    if (flag != null && typeof flag !== "boolean") return bad("on/off settings must be true or false");
  }

  // The app POSTs to this URL, so only a real Discord webhook is accepted.
  let webhook: string | null | undefined;
  if (body.discordWebhookUrl === undefined) {
    webhook = undefined;
  } else if (body.discordWebhookUrl === null || (typeof body.discordWebhookUrl === "string" && body.discordWebhookUrl.trim() === "")) {
    webhook = null;
  } else {
    webhook = parseDiscordWebhook(body.discordWebhookUrl);
    if (!webhook) return bad("That isn't a Discord webhook URL. It should look like https://discord.com/api/webhooks/123…/abc…");
  }

  // Only the fields this page owns — never `id`, `name`, the password or `lastDigestAt`.
  const profile = await prisma.profile.update({
    where: { id: auth.profile.id },
    data: {
      discordWebhookUrl: webhook,
      notificationsEnabled: body.enabled,
      quietHoursStart: body.quietHoursStart,
      quietHoursEnd: body.quietHoursEnd,
      digestEnabled: body.digestEnabled,
      digestHour: body.digestHour,
    },
  });
  return NextResponse.json({ config: toConfigDTO(profile) });
}
