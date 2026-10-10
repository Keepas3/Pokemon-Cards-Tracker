-- Pokémon Center and Target checks are opt-in (off by default).
ALTER TABLE "NotificationConfig" ADD COLUMN "pokemonCenterEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationConfig" ADD COLUMN "targetEnabled" BOOLEAN NOT NULL DEFAULT false;
