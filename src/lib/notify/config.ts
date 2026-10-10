import { prisma } from "@/lib/prisma";
import { isQuietHours } from "./quietHours";

/**
 * The Discord webhook to use for one person right now, or null if sending isn't allowed:
 * their notifications switched off, no webhook set, or inside their quiet hours. The daily
 * digest passes `ignoreQuietHours` — its hour is something they chose explicitly, so it
 * shouldn't be silenced by a window they set for pings.
 */
export async function allowedWebhook(
  profileId: string,
  opts: { ignoreQuietHours?: boolean; now?: Date } = {},
): Promise<string | null> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile?.notificationsEnabled || !profile.discordWebhookUrl) return null;
  if (!opts.ignoreQuietHours && isQuietHours(opts.now ?? new Date(), profile.quietHoursStart, profile.quietHoursEnd)) {
    return null;
  }
  return profile.discordWebhookUrl;
}
