# What this site is

**A private hub for two Pokémon collectors.** It shows every set and card with prices, tracks what each of you owns
(by set and by Pokémon), points out cards you're missing that are listed well under market price, and tells you on
Discord when something you care about moves.

It is **not** a TCGplayer replacement. Looking up a price is something TCGplayer does better than any free-API app can:
its prices are live and it has every seller's listing, while ours are up to 12 hours old. This site earns its place a
different way: it knows *your* collection, so it can say "this is the card you're missing, and it's 40% under market".

## The loop

1. **Browse** the sets: every card and sealed product, with prices.
2. **Collect**: mark what you own, by set or by Pokémon, and watch the completion and the cost to finish.
3. **Spot deals**: cards you're missing, and packs, tins and boxes, whose lowest listing is below market.
4. **Decide**: for sealed product, *open or hold* (is it worth more sealed or opened?).
5. **Get told**: a Discord message when an alert hits, plus one morning digest.

## Who it's for

Two people who collect, sharing one site. Each has their own **profile** with a password: your own collection,
watched cards, alert rules and Discord settings. Prices, sets and card lists are shared, so one price check serves both.

## What it deliberately is not

- **Not a marketplace.** There is no buying, selling or purchase automation, and no ads or affiliate links.
- **No retail stock tracking.** It used to watch Pokémon Center, Target and Best Buy for restocks. That was removed:
  the first two have no public API (their terms don't allow automated tools), and the app is about *collecting*, not
  restock-hunting. Market prices come from tcgapi.dev instead.
- **No per-listing seller data.** The free price API doesn't have it. A "deal" is the lowest listing against the
  market price; you still have to look at the condition, the seller and shipping.
- **Not live.** Prices are as fresh as the last time each set was fetched (shown on the page).
- **Not a social site.** Two passwords, two collections, nothing public.

## Pages

| Page | What it's for |
|---|---|
| **Today** | What happened since yesterday: deals on packs, tins and boxes, deals on cards you're missing, new alert matches, moves on watched cards. The same ideas as the morning digest (which mentions card deals only). |
| **Browse** | Every Pokémon set with its cards and sealed products, filters, a price range per set, and an **Open or hold?** panel on every sealed product. Each card has a counter for the copies you own. |
| **Watchlist** | Cards you want to hear about when their price drops, and set-wide smart alerts. |
| **Collection → Sets** | Every set by series with its logo and your progress. Open one for its full card list as an image grid; tap a card to see it larger, press "I own this" to mark it. Drag a tile's grip to rearrange the sets in a series (saved per profile); filter by started and finished. |
| **Collection → Pokémon** | Every Pokémon in Pokédex order. Open one (Charizard is #6) to see every card ever printed of it, across all sets, and tick off which you own. |
| **Collection → Deals** | Cards you're missing that are listed well under market, or (second view) packs, tins and boxes under market, cheapest first. |
| **Settings** | Your Discord webhook, quiet hours and morning digest; password; backup and restore; theme. |

The sidebar's profile menu switches between the two collections. You stay signed in on a device for about three
months; opening the other person's profile asks for their password.

## Collecting

**Completion counts card numbers, in any printing.** Owning the Normal 025/088 completes it whether or not you also have
the Reverse Holofoil, and any pattern variant completes its number. The total is the official card count, secret rares
included (Perfect Order is 124, not 88).

- **Cost to finish** is the sum of each missing card's *cheapest* printing at market price. Cards with no price yet are
  counted separately instead of being treated as free.
- **Worth** is each owned card at its cheapest market price.
- A set's **Products** tab holds everything that isn't a card (booster packs, boxes, collection boxes). They have
  prices but can't be owned and never count toward completion. Online-game code cards are not saved at all.
- **Log a pull** is the quick way after opening packs: type a card number ("25", "025/088") or part of a name and press
  Enter. If an entry could mean several cards it lists them to pick from, and the last add has an Undo.

**By Pokémon.** The same ownership data, grouped differently: owning a card on a set page counts on its Pokémon's page,
and the other way round. Follow the Pokémon you chase to keep them on your list with progress bars; ticking a card off
on a Pokémon's page follows it automatically. A card in a TCGdex set we haven't paired with a price-data set (some
promos, and digital-only sets) is listed for reference but can't be ticked off.

**Where the lists come from.** [TCGdex](https://tcgdex.dev) (free, no key) supplies the series, logos, release dates,
card lists and each Pokémon's cards. About three in four sets are paired with a tcgapi.dev set automatically (a
hand-checked alias table covers awkward names); the rest show under **Other sets** using the cards tcgapi.dev lists.

## Deals on cards you're missing

A deal is a card you don't own whose **lowest listing** is at least 25% under its **market price** and saves at least
$2. The list looks at the sets you've started and the Pokémon you follow (or "Everything").

- Several printings of one card: the one with the biggest saving counts.
- Sets you've already started get a small boost in the ranking.
- A gap above 70% is flagged **unusually low**: on real prices those are nearly always a damaged copy, a mislabeled
  card or a typo, so they're listed after every believable deal and are left out of the Discord digest.
- **I got it** marks the card owned and takes it off the list.

The list is only as fresh as the saved prices. The background job refreshes the sets people are collecting first.

**Packs, tins and boxes.** The Deals page has a second view for sealed products, and Today shows the best few, cheapest
first. Nothing is "missing" there, so every sealed product in the sets you've started or the Pokémon you follow counts
(or everything, on request). The bar is lower than for cards, because a tin at 10% under market is still worth a look:
at least 10% and $1.50 under the market price. Cases and displays (a shop's stock, not a pickup) are left out, and the
same "unusually low" flag applies above 70%. They aren't in the Discord digest.

## Smart alerts

A *smart alert* is a rule about a set, not a single card: **"tell me when any Special Illustration Rare in this set is
$40 or less."** You build it on a set page from the filters you're already using (rarity, cards or sealed, name/number
search) plus a price.

- You're alerted when a card *newly* matches, not every day it stays under your price.
- If the price rises back above your limit and later dips again, you're alerted again.
- When you create a rule, the cards that already match are shown but not alerted; alerts are for what changes.
- A rule can be limited to **cards you don't own yet**: judged against *your* collection, not the other person's.
- Rules need a specific set. An "any set" rule would mean re-fetching every set daily, which the free tier can't pay for.

## The morning digest

Once a day, at the hour you choose in Settings, one Discord message goes to *your* webhook: moves on cards you watch,
new smart-alert matches, and new deals on cards you're missing (a deal is mentioned once, and again only if it gets
10% cheaper or two weeks pass). Empty sections are left out, and if everything is empty nothing is sent. It ignores
quiet hours (you picked the time), needs notifications on and a webhook, and needs the app to be running: if it was off
at the chosen hour it goes out on the next start, up to six hours late, then that day is skipped. **Settings → Send test
digest** sends one immediately without using up the day's.

## Open or hold

On any sealed product (a set page's sealed rows) the **Open or hold?** panel answers: *is this worth more sealed, or
opened and sold as singles?*

- **Hold** = the sealed market price, less selling fees. **Open** = the expected value of the cards you'd pull, less
  fees and ignoring bulk.
- It also gives the **chance an opened product beats the sealed value**, from a seeded simulation (20,000 products, the
  same answer every time). The average alone misleads: in a set where three cards carry most of the value, a high
  average can still mean most boxes lose. When average and typical outcome disagree, the verdict is "Toss-up".
- It shows **how wrong the hit rates could be**: the answer at 50% lower and 50% higher rates, and the multiplier at
  which opening would break even.

**Where the pull rates come from.** The Pokémon Company doesn't publish them. The defaults are TCGplayer's own
measurements from opening thousands of packs (the Authentication Center studies, by Peter Day), per rarity, per pack,
with the pack position each rarity lands in. Covered today: Mega Evolution, Phantasmal Flames, Perfect Order, Chaos
Rising, Pitch Black, Ascended Heroes, 30th Celebration, and Scarlet & Violet 151. Each is cited in
`src/lib/openOrHold/profiles.ts` with its URL, date and sample size, and the panel links to the article. For a set with
no study the panel says so and asks you to enter rates; nothing is invented.

**What it deliberately leaves out, and says so on the panel:** rarities with no published rate; box extras like promo
cards and sleeves; bulk (cards under $1 are valued at $0 by default); and selling costs beyond the fee.

**Assumptions you can change:** selling fees (13% to start, an assumption rather than a sourced figure), the bulk
cut-off ($1), bulk value per pack ($0), packs per product, and any pull rate. These are shared between both profiles.

## Your data

Each profile can **download a backup** (a JSON file: what you own, the Pokémon you follow, your watched cards and alert
rules) and **restore** one. Restoring only adds or raises counts and never deletes, so it's safe to repeat; it is also how
a collection moves from one copy of the app to another. The site additionally keeps a **nightly snapshot** of the whole
database (the last seven, on the same volume), which protects against mistakes and bad deploys but not against losing the
server, so an occasional download of your own is worth it.

## Budget

Everything is designed around tcgapi.dev's free tier (about 100 requests a day, shared by everything, both people included).

- Browsing reuses saved data; a set's prices are re-fetched after 12 hours.
- A background job fills in set prices one set every 15 minutes, only while at least 50 of the day's requests would
  remain unspent. **Sets anyone is collecting, and sets with an alert, go first** (with a smaller reserve, 15), because
  deals and alerts are judged on those prices.
- Watched-card price checks run every 4 hours.
- TCGdex has no key and no quota, but it's a community service, so everything from it is cached (set index a week, a set's
  cards a month, a Pokémon's cards a week).

## Data sources and their limits

| Source | Used for | Limit |
|---|---|---|
| tcgapi.dev | Set lists, set contents, market and lowest-listing prices | ~100 requests/day on the free tier; free tier is for non-commercial use ([API-TERMS.md](API-TERMS.md)) |
| TCGdex | Series, logos, release dates, card lists, each Pokémon's cards, card art | No key; "be considerate". Card art belongs to The Pokémon Company and is hotlinked, not copied; set logos and icons are saved once in the site's own database |
| PokeAPI | The list of Pokémon names, fetched once and saved in the repo | One-off; regenerate when a new generation appears |
| TCGplayer pull-rate studies | Open-or-hold hit rates | Published articles, copied into the code with citations; new sets need adding by hand |
| Discord webhooks | Alerts and the digest | One webhook per profile |

## What's built vs. planned

Built: profiles with passwords, collection by set and by Pokémon, deals on missing cards and on packs, tins and boxes,
set browsing with price ranges, background price fill, watched cards and smart alerts with Discord, the morning digest,
Open or hold, backup and restore (JSON and a spreadsheet), nightly snapshots, rearranging sets, saved set logos,
Railway/GitHub deployment files.

Not started: completion by printing/finish (a "master set" mode); condition and grading; a wishlist with target prices
for specific missing cards (watched cards cover the alert part); selling duplicates and trade lists.
