import type { Profile } from "@/generated/prisma/client";
import type { NotificationConfigDTO } from "@/lib/clientTypes";
import { webhookHint } from "@/lib/security/urls";

/**
 * What the browser gets to see of one person's notification settings. The Discord webhook
 * URL is a secret (anyone holding it can post to the channel), so it only ever travels one
 * way — into the app. The page learns whether one is saved and its last characters.
 */
export function toConfigDTO(profile: Profile): NotificationConfigDTO {
  return {
    id: profile.id,
    name: profile.name,
    discordWebhookSet: Boolean(profile.discordWebhookUrl),
    discordWebhookHint: webhookHint(profile.discordWebhookUrl),
    enabled: profile.notificationsEnabled,
    quietHoursStart: profile.quietHoursStart,
    quietHoursEnd: profile.quietHoursEnd,
    digestEnabled: profile.digestEnabled,
    digestHour: profile.digestHour,
    lastDigestAt: profile.lastDigestAt?.toISOString() ?? null,
  };
}
