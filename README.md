# Binder

**A private hub for two Pokémon collectors.** Browse every set with prices, track what each of you owns (by set and by
Pokémon), see cards you're missing that are listed well under market price, and get Discord alerts. Each person has their
own profile and password; prices and card lists are shared.

Not affiliated with Nintendo, The Pokémon Company or TCGplayer. Product description, including what it deliberately is
not: [docs/PRODUCT.md](docs/PRODUCT.md). Putting it online: [docs/DEPLOY.md](docs/DEPLOY.md). What each data source's terms
allow: [docs/API-TERMS.md](docs/API-TERMS.md).

## What's in it

- **Today**: deals on packs, tins and boxes under market, deals on cards you're missing, new alert matches, price moves
  on cards you watch.
- **Browse**: every set with its cards and sealed products and a price range per set; **Open or hold?** on every sealed
  product. A set opens on its Products tab, cheapest first.
- **Collection**:
  - **Sets**: full official card lists as an image grid; click a card to see it larger, press **I own this** to mark it.
    Drag the grip in a tile's corner to rearrange the sets in a series (saved per profile), and filter by started /
    finished / not finished.
  - **Pokémon**: every card of one Pokémon across all sets, in Pokédex order. Anything you own a card of is listed with its
    progress; the bookmark keeps a Pokémon on your list.
  - **Deals**: cards you're missing that are far under market, or packs, tins and boxes under market.
- **Watchlist**: cards to be pinged about when the price drops, and set-wide smart alerts ("any Special Illustration Rare in
  this set under $40").
- **Settings**: Discord webhook, quiet hours, a morning digest, password, and **Your data**: a full backup (JSON), a
  spreadsheet of the cards you own (CSV, opens in Excel or Google Sheets), and restore.

## Where the data comes from

| Source | What for | Notes |
|---|---|---|
| [tcgapi.dev](https://tcgapi.dev/) | Set lists and contents, market and lowest-listing prices | Free key, ~100 requests/day, non-commercial free tier. **The only key you need.** |
| [TCGdex](https://tcgdex.dev/) | Series, logos, release dates, official card lists, each Pokémon's cards, card art | Free, no key, community-run. Please credit it if you share the app. |
| [PokeAPI](https://pokeapi.co/) | Pokémon names (`src/lib/pokedex/species.ts`) | Fetched once and saved in the repo. |
| TCGplayer pull-rate studies | Open-or-hold hit rates | Copied into `src/lib/openOrHold/profiles.ts` with citations. |

Set logos and set icons (a few KB each) are saved in the database the first time they're needed, so the pages keep working
if the original host drops a file. Card art is **not** copied: it's loaded from its source each time.

TCGplayer's own API is closed to new developers, so market prices come through tcgapi.dev. Nothing here scrapes anything.
(It used to watch Pokémon Center, Target and Best Buy for restocks; that was removed. See the product doc.)

## Run it on your own computer

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `TCGAPI_DEV_API_KEY`: your free key from tcgapi.dev (set pages need it).
- `SESSION_SECRET`: optional locally (without it, you're signed out each time the dev server restarts), required when hosted.

Create the profiles (names and passwords of your choice, 8+ characters). Either set `BOOTSTRAP_PROFILES` in `.env`, e.g.
`BOOTSTRAP_PROFILES="Sam:a-long-password,Alex:another-password"`, or run, once per person:

```bash
npm run profile:set -- "Sam" "a long password"
```

If you used an earlier single-person version, **the first name takes over the collection you already had**.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, go to **Collection** and start marking cards (the first visit
loads the set index from TCGdex, which takes a few seconds). The scheduler starts with the server; see "Background jobs".

After pulling new code that changes the database, apply it with `npx prisma migrate deploy` and restart `npm run dev`.

## Settings (environment variables)

Put these in `.env` on your computer, or in the host's variables when deployed. `.env.example` has the same list.

| Variable | What it does |
|---|---|
| `TCGAPI_DEV_API_KEY` | Your free key from [tcgapi.dev](https://tcgapi.dev/). Without it, prices can't load (the site says so and keeps working with what's saved). |
| `DATABASE_URL` | The SQLite file. Locally `file:./prisma/dev.db`; on a host with a volume, e.g. `file:/data/app.db`. |
| `SESSION_SECRET` | 32+ random characters that sign the "stay signed in" cookie. Required when hosted; changing it signs everyone out. Make one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `BOOTSTRAP_PROFILES` | `"Name:password,Name2:password2"`. Creates missing profiles at startup; never replaces a password that's already set. |
| `BOOTSTRAP_OVERWRITE` | `1` for one deploy to let `BOOTSTRAP_PROFILES` replace saved passwords (a forgotten one). Remove it afterwards. |
| `ALLOWED_HOSTS` | Extra host names the site answers to, comma-separated (your Railway domain). Localhost is always allowed. |
| `TZ` | The time zone the server's clock uses, e.g. `America/New_York`. The morning digest hour and quiet hours are read in it. Hosts run UTC unless you set this. |
| `DISABLE_SCHEDULER` | `1` for a second copy of the app that shouldn't run the background jobs. |

## The daily request budget

tcgapi.dev's free tier allows about **100 requests a day**, shared by everyone on the site. Browse shows "requests left
today" so you can see it. How it's spent:

- A set's prices cost about one request per 100 items (most sets: 1 to 3). Opening a set loads it once, then reuses it for
  12 hours. **Refresh** on a set or on the set list can be used once an hour.
- **Load more now** on Browse fetches up to 10 sets at once. Don't if you want to keep the day's requests for alerts.
- The background fill loads one set every 15 minutes, and only while at least 50 requests remain (15 for a set with an
  alert), so there is always room for the things you do by hand. Sets someone is collecting go first.
- Opening a set on the Collection page loads it only if it has no saved prices and its card art would otherwise be missing.
- Card art, logos, card lists, Pokémon lists, deals and the Pokémon page cost **no** tcgapi.dev requests (they use TCGdex or
  what's already saved).

## Everyday tasks

- **Add a person:** `npm run profile:set -- "Name" "a long password"`, or add them to `BOOTSTRAP_PROFILES` and redeploy.
- **Forgot a password:** run `profile:set` again on your own computer, or on the host set `BOOTSTRAP_OVERWRITE=1` for one
  deploy. **Change it while signed in:** Settings → your profile.
- **Back up:** Settings → Your data → *Download my backup* (everything of yours, restorable) and *Download cards as a
  spreadsheet* (names, sets, numbers, quantities; a record you can read anywhere). The host also keeps a nightly copy of the
  whole database, but on the same volume, so keep a download too.
- **Move your collection online:** download a backup from your local site, sign in on the hosted one, Settings → Restore.
- **After pulling new code:** `npx prisma migrate deploy`, then restart. Hosted, this happens by itself at startup.
- **Change the order of sets:** drag a tile's grip on Collection → Sets (arrow keys work when it's focused).

## Troubleshooting

| You see | Usually |
|---|---|
| "Price data isn't set up on this site" | `TCGAPI_DEV_API_KEY` is missing or wrong. The server log says which. |
| "Sign-in isn't set up on this site yet" | `SESSION_SECRET` is missing or under 32 characters. |
| "No profiles have been set up" on the sign-in page | Run `profile:set` or set `BOOTSTRAP_PROFILES`, then reload. |
| A set has no prices or art | Its prices haven't loaded yet. Open it in Browse, or wait for the background fill; check the "requests left today" line. |
| Prices look old | They're up to 12 hours old by design. A set's Refresh button re-fetches (once an hour). |
| A card can't be ticked off on a Pokémon's page | Its set isn't paired with a price-data set yet (some promos, digital-only cards). |
| The site is blank or errors after an update | Run `npx prisma migrate deploy` and restart. |

## Background jobs

Started by `src/instrumentation.ts` when the server starts (set `DISABLE_SCHEDULER=1` for a second instance that shouldn't
run them):

- fills in set prices, one set per 15 minutes, only while at least 50 of the day's requests remain; sets someone is
  collecting, and sets with an alert, first;
- checks watched cards' prices every 4 hours and sends their alerts;
- sends each person's morning digest at their chosen hour;
- saves a snapshot of the whole database once a night (the last seven are kept);
- saves copies of set logos and icons a few dozen at a time until every one is stored.

They only run while the app is running, which is why it's meant to live on an always-on host.

## Security model

- **Everything needs a sign-in** except the sign-in page, the profile-name list it shows, the unlock call and a health
  check. The sign-in is a signed, HTTP-only cookie (about three months), checked in `src/proxy.ts` for every page and API
  call; which profile a request acts as is decided in each route (`src/lib/auth/current.ts`), and every query for
  personal data is filtered by it. Passwords are scrypt-hashed; wrong guesses are rate-limited.
- **No cross-site requests, no outside host names.** The API refuses requests that don't come from this site itself, or that
  arrive under a name not in `ALLOWED_HOSTS` (default: localhost only), which stops other web pages and DNS-rebinding tricks.
- **Secrets stay server-side.** The Discord webhook is write-only in the UI, only real `discord.com` webhook URLs are
  accepted, links are limited to http(s), and API keys live in `.env` or the host's variables.
- Without a `SESSION_SECRET` in production the app refuses to sign anyone in and serves no data (the health check still answers).
- `npm run dev` / `npm start` bind to `127.0.0.1`; only the container's start command binds all interfaces.

It's a gate for two people who know each other, not a hardened multi-tenant system. See [docs/DEPLOY.md](docs/DEPLOY.md)
before putting it on the internet.

## Project structure

- `src/proxy.ts`: the front door (host and cross-site checks, sign-in required).
- `src/lib/auth/`: passwords (scrypt), signed session cookie, rate limiting, profiles and bootstrap, "who is this request".
- `src/lib/collection/`: ownership by set and card number, completion, the pull logger's matching; `setData.ts` joins a set's
  card list, prices and what you own.
- `src/lib/official/`: the TCGdex catalog: parsing, pairing TCGdex sets with tcgapi.dev sets, the set index and card lists.
- `src/lib/pokedex/`: collecting by Pokémon: species names, TCGdex's per-Pokémon card lists, assembling them with prices and ownership.
- `src/lib/deals/`: what counts as a deal, ranking, and what the digest has already told someone.
- `src/lib/sets/`: browse-by-set: fetching and caching tcgapi.dev sets, classifying rows into cards / sealed / other,
  freshness and the background fill order.
- `src/lib/smartWatch/`, `src/lib/cards/`, `src/lib/cardPoller.ts`, `src/lib/cardPricing/`: alert rules, tracked cards
  (shared price checks, per-person alerts) and their price checks.
- `src/lib/openOrHold/`: the open-or-hold calculator and its cited pull rates.
- `src/lib/digest/`, `src/lib/notify/`: the morning digest and Discord sending.
- `src/lib/backup/`: per-person backup/restore files, the spreadsheet export and the nightly database snapshot.
- `src/lib/images/`: the saved copies of set logos and icons: which hosts are allowed, what counts as an image, and the
  `/api/img` route that serves them.
- `src/lib/security/`: URL checks (links, Discord webhooks) and the request guard.
- `src/lib/scheduler.ts`, `src/instrumentation.ts`: the in-process background loop and startup (creates profiles).
- `src/app/api/`: the routes; `src/app/`, `src/components/`: the pages and UI. `src/components/shell/` is the sidebar/tab bar,
  profile switcher and theme toggle; `src/components/ui/` the shared pieces.
- `prisma/schema.prisma` and `prisma/migrations/`: the SQLite schema. `Product`, `RetailerLink`, `WatchlistEntry`,
  `StockEvent` and `NotificationConfig` are **legacy** tables from earlier versions, kept so no data is dropped.
- **Theming:** every color comes from the tokens at the top of `src/app/globals.css` (light, and dark following the system or
  the toggle), exposed to Tailwind as `bg-surface`, `text-muted`, `border-line`… Don't use raw Tailwind palette colors:
  `src/lib/__tests__/theme.test.ts` fails if you do, and it checks the tokens stay readable in both themes.

## Development

```bash
npm test            # vitest (unit tests, plus database tests against a throwaway SQLite file)
npx tsc --noEmit    # types
npx eslint .        # lint
npm run build       # production build
```

To check a change against a copy of your real data without touching it, copy `prisma/dev.db` to `prisma/verify.db`, run
with `DATABASE_URL="file:./prisma/verify.db" DISABLE_SCHEDULER=1`, then delete the copy. GitHub Actions runs the same four
checks on every push (`.github/workflows/ci.yml`).

This project uses a recent Next.js whose conventions differ from older versions (for instance `proxy.ts` replaced
`middleware.ts`): the docs in `node_modules/next/dist/docs/` are the reference.

## Known limitations

- Prices are only as fresh as the last fetch (up to 12 hours), and the free tier's ~100 requests/day is shared by both of
  you. A "deal" is the lowest listing in any condition against the market price: a lead, not a promise.
- Completion counts card numbers in any printing; it doesn't track finish (normal vs reverse holo), condition or grading.
- About three in four sets pair with a TCGdex set automatically; the rest, and anything TCGdex doesn't have yet (very new
  sets, some promos), show with the cards tcgapi.dev lists. Digital-only (TCG Pocket) cards can't be marked as owned.
- Smart alerts are only as current as their set's saved prices and are for one set each.
- Packs, tins and boxes under market are judged the same way as cards (lowest listing against market price) with a lower bar
  (10%, $1.50), and cases and displays are left out. Online-game code cards are never saved.
- Your order of sets is saved in the database but isn't part of the JSON backup.
- The card-singles price checks and sealed Open-or-hold run on tcgapi.dev data alone; Open or hold uses published pull-rate
  studies that cover eight sets so far, and asks you to enter rates for a set with none.
- Hosting isn't tested end to end here (no Docker or Railway account on the dev machine); see the note in the deploy guide.
