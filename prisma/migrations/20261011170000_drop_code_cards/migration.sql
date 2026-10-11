-- Online-game code cards are never shown any more (see isCodeCard in lib/sets/classify.ts); remove the ones already saved.
DELETE FROM "SetItem" WHERE lower(coalesce("rarity", '')) LIKE '%code card%' OR lower("name") LIKE 'code card%';
