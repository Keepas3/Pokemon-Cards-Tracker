# What each data source's terms allow

Read live on **2026-10-09** by two research passes (provider terms pages, developer docs, robots.txt, licences), then summarised here in paraphrase. **This is research, not legal advice**, and terms change — each section names the page and the date it showed, so re-check before you share anything. Where a page was silent the verdict is **Unclear**, not a guess.

The scenarios:

| Code | Scenario |
|---|---|
| **Personal** | You run it on your own PC for yourself (how it works today). |
| **GitHub** | You publish the source code (no keys, database or images). |
| **Public** | You host it for friends or the public, using your keys. |
| **Visitor keys** | You host it and each visitor pastes their own keys. |
| **Monetized** | Ads, affiliate links, subscriptions or paid features. |

## How the app uses these now (two people, hosted)

The app was reshaped after this research was done. **The retailer checks (Best Buy, Pokémon Center, Target) and JustTCG
were removed**, so those sections below describe code that no longer exists; they're kept as the record of why. What's
left is:

| Source | Used for | The two-person hosted setup |
|---|---|---|
| **tcgapi.dev** | Prices and set contents | The one key. Free tier is for personal, non-commercial projects, and its Licensing page lists a **free, ad-free hobby project** as fine, so a private site for two friends is a judgement call that leans OK; the data is never offered as an API, feed or download to anyone, and the key stays on the server. Free tier allows caching "during an active subscription"; unclear on free. No ads, no affiliate links, no charging, or it needs Pro. |
| **TCGdex** | Card lists, logos, per-Pokémon cards, card art | MIT code/database, no API terms found, "be considerate". Everything is cached; card art is **hotlinked**, never copied (it's The Pokémon Company's). Set logos and tcgapi.dev's set icons (~380 small files) *are* saved in the site's private database; see the note below. |
| **PokeAPI** | The Pokémon names list | Fetched once into the repo (facts, not artwork). |
| **Discord** | Alerts and the digest | One webhook per profile, stored in the database, never in the repo and never sent back to the browser. |
| **Pokémon names, art, logos** | Display | Personal-scale fan use is the realistic reading; **don't make the site public, add ads, or sell anything.** The Settings page and sign-in page carry an "unofficial fan project" notice. |
| **TCGplayer** | Links only | Prices arrive through tcgapi.dev; the app doesn't scrape or call TCGplayer. Product links point at TCGplayer's pages. |

**What would change the picture:** making the site public, adding ads or affiliate links (tcgapi.dev then wants its Pro plan
and TCGplayer wants its own affiliate approval), letting visitors bring their own keys, or publishing the database, price
snapshots or card images. Any of those means re-reading the sections below first. (The database now also holds the saved set logos and icons, which is one more reason it must never be published.)

## At a glance

| Source | Personal | GitHub | Public | Visitor keys | Monetized |
|---|---|---|---|---|---|
| **tcgapi.dev** (prices, sets) | OK (100 req/day) | OK (no key) | Unclear, leans OK for a free, ad-free hobby site | Unclear | **No** on Free/Hobby/Starter; needs Pro or Business |
| **JustTCG** (card prices) | OK on the free tier — but see caching note | OK (no key) | **No** on free; needs a paid plan | Unclear | **No** on free; subscriptions OK on paid |
| **TCGdex** (card lists, logos, art) | OK | OK (MIT) | Unclear | n/a (no key) | Unclear |
| **Best Buy API** | OK with your own key, cache ≤ 72 h | OK (no key) | Unclear; attribution + logo required | Unclear | Unclear; get written approval |
| **Pokémon Center** (unofficial endpoint) | **Against its terms as written** | Unclear to no | **No** | **No** | **No** |
| **Target** (unofficial "redsky") | **Against its terms as written** | Unclear to no | **No** | **No** | **No** |
| **Discord webhook** | OK | OK if the URL isn't committed | OK if each person uses their own webhook | OK | Unclear |
| **Pokémon names, art, logos** | Plausibly tolerated | Code OK; don't commit images/logos | Unclear | Unclear | **No** |
| **TCGplayer** | Plain links OK; scraped prices not | Links OK | Links OK | Links OK | Affiliate links only via their program |

## tcgapi.dev
Pages: Terms (updated Feb 19, 2026), Licensing guidance (Aug 4, 2026), Pricing, Rate limits, Authentication.
- Data is licensed to you per plan, not sold. Commercial use is restricted on Free, Hobby and Starter; the Licensing page defines "commercial" as earning money directly **or indirectly**: ads, sponsorships, subscriptions, paid features and affiliate links all count. Pro ($49.99/month) or Business is needed for those.
- You may not resell or redistribute the data as a competing data service, scrape to build a competing dataset, or sublicense/transfer your key. Keep the key confidential.
- Showing it inside your own product is the point: a private backend serving your own app's users is explicitly fine. **An API, feed, dump or public download of their data is not allowed on any plan.** Derived analytics (valuations, charts, trends) are yours; republishing prices with trivial changes (rounding, renaming) is still redistribution.
- Caching in your own database is endorsed by their rate-limit page; the licence wording ties it to an "active subscription", so on the free tier it's Unclear. If you cancel, raw cached records should be deleted within 30 days.
- Attribution is appreciated, not required; don't imply endorsement. The artwork belongs to publishers and isn't licensed to you — assessing that is on you.
- Data comes primarily from TCGplayer (Cardmarket for EU); they're not affiliated with either.
- Free tier: 100 requests/day (resets UTC midnight), 429 with `Retry-After` when exceeded, 7 days of price history.

## JustTCG
Pages: Terms (updated 7/27/2026), commercial-use and rate-limit docs, pricing.
- The free tier is for **personal, non-commercial use only**: no business use, scraping or reselling; one account per person; don't share credentials.
- Terms §7.1: end-user display in a consumer app or site, derived analytics, **server-side caching and storing historical price points are rights of paid subscribers only** — the free tier "does not carry" them. §7.2: no maximum retention period, but storage is only for running your own app, and the right ends with the subscription.
- Every tier: no reselling/redistributing/sublicensing raw data or API access, no building a substitute pricing API.
- Their guidance: free is for side projects "you aren't shipping to users"; putting a product in front of other people needs a paid plan however few requests it makes. Paid plans may charge users; ads and affiliate links aren't addressed (ask them).
- Limits: 1,000/month, 100/day, 10/min, 20 cards per request. Free keys used from shared/serverless hosts (Vercel, Workers, Lambda) can be blocked for excessive free-tier usage. Starter is $19/month.
- **This app:** it caches JustTCG results and saves one set-value snapshot a day (`src/lib/digest/setMovers.ts`). On the free tier those storage rights aren't granted; nothing expressly prohibits personal storage, so it's Unclear rather than a violation — but it's the likeliest place the free tier doesn't match what the app does.

## TCGdex
Pages: tcgdex.dev home/FAQ/assets/markets-prices, GitHub `tcgdex/cards-database` (README, LICENSE), website terms (effective 2024-07-15, website only).
- Code and database are **MIT**; no API-specific terms of use were found. The README says it isn't affiliated with Nintendo or The Pokémon Company.
- No key. No published hard rate limit — "be considerate"; for bulk, cache locally or self-host the API (documented). This app caches the index for a week and a set's cards for 30 days.
- No attribution is required for API use (the MIT notice applies if you redistribute copies). Crediting them is good manners and the README does.
- Images are served from `assets.tcgdex.net`; the docs only describe the URL scheme. The website's terms say card information and images are licensed by The Pokémon Company, so the artwork isn't TCGdex's to grant. **Hotlinking is safer than re-hosting** (what the app does); don't commit images.
- Prices embedded in TCGdex card responses come from Cardmarket/TCGplayer; the app doesn't use them.
- **Saved set logos and icons.** To keep the pages working if a host drops a file, the app saves each set logo (TCGdex) and
  set icon (tcgapi.dev / TCGplayer's CDN) into its own database the first time it's needed, and serves it only to signed-in
  people, never publicly. Pokémon's terms bar downloading content "to a database", so this is a small, personal-scale
  judgement call (about 380 files of a few KB, the same images the site would otherwise load directly). Card art is not
  copied. To undo it, delete the rows of the `StoredImage` table and remove `imageTick` from `src/lib/scheduler.ts`; the
  pages then load the original addresses again.

## Best Buy Developer API
Pages: developer.bestbuy.com legal terms ("last updated Feb 23, 2021"), API documentation.
- Revocable licence for apps you develop or sites you operate in connection with selling Best Buy products. Games/CDs/DVDs are excluded unless you're an Affiliate (how a Pokémon TCG product is classified wasn't found).
- **Content may be cached only temporarily — at most 72 hours.** You must clearly attribute Best Buy as the source and show its logo (smaller than your own branding, at the bottom); don't put "Best Buy" in your app's name.
- Limits: 5 calls/second and 50,000/day per key (403 when exceeded); batching SKUs with `in` is recommended.
- Keys can't be sold, transferred or disclosed; no third-party access unless Best Buy authorises it; don't use the service for other retailers' benefit.
- **This app:** it checks Best Buy per SKU and records every stock/price change in its history (Today, "All activity", `StockEvent`). That history is kept indefinitely, which is longer than the 72-hour caching clause. For personal use that's a grey area worth knowing about; for anything public it would need changing.

## Pokémon Center
Pages: pokemoncenter.com Terms of Use ("Last Update: October 6, 2026"), robots.txt.
- Personal, non-commercial use only. Banned: reselling or commercial use; bypassing access limits; **"applications that interact with our Services without our prior written consent"**; and robots or similar methods designed to scrape or extract data. Their images and logos may not be copied or used elsewhere without written consent, and linking to the site needs prior written consent.
- robots.txt disallows many paths (availabilities, items, prices, offers, carts…); the `/tpci-ecommweb-api/` path the app uses isn't listed. robots rules don't override the Terms.
- No official API and no personal-monitoring carve-out was found.
- Realistic consequence found: blocking or an IP ban; no enforcement history was found.
- **This app:** polls their search JSON every ~30 minutes with a polite User-Agent. As written, that falls under the "applications that interact" and data-gathering clauses even for personal use.

## Target
Pages: target.com Terms & Conditions ("Last updated September 10, 2026"), target.com and `redsky.target.com` robots.txt. (The final ~36k characters of the Terms weren't read.)
- Noncommercial personal use only. Banned: data extraction, scraping, mining or other data-gathering tools; systematically downloading or storing content to build a database; collecting product listings, descriptions, prices or images; bots and "intelligent agents" other than Target's own tools, normal browsers and listed approved agents.
- `redsky.target.com/robots.txt` disallows everything for all agents (with a crawl-delay of 1).
- No clause about the embedded public key itself, and no public Target API, was found.
- **This app:** checks stock via the `redsky` endpoint using the public key Target's own website ships (`src/lib/adapters/target.ts`), at a polite interval. As written, that's against the Terms even for personal use.

## Discord
Pages: Developer Terms and Developer Policy (both effective July 8, 2024), rate-limit and webhook docs.
- Webhooks need no authentication, so the URL token is effectively the credential. Rate limits are tracked per webhook; obey 429 headers; stop calling a webhook that returns 404 (more than 10,000 invalid requests in 10 minutes can trigger a temporary ban).
- Developer Terms say credentials are for your own app, shouldn't be embedded in open-source projects and should be stored encrypted. Whether a webhook URL counts is unclear — **treat it as a credential** (the app now never sends it back to the browser).
- Policy: no automated messages meant to fake server activity, no unsolicited DMs or marketing. Alerts to your own server aren't that.

## Pokémon names, card art and logos
Pages: pokemon.com legal information and Terms of Use (June 15, 2023), pokemon.co.jp/rules.
- The names are trademarks (Nintendo); the artwork and logos belong to Pokémon. Their terms limit use to personal, noncommercial, home use and bar derivative works, suggesting association with other brands, ads or sponsorships, downloading content "to a database", and bots/scripts that automate the service.
- **No fan-site policy, image licence or required disclaimer wording was found**, so there's nothing that grants a public fan site permission. "Unofficial, not affiliated" notices are common practice, not a licence.

## TCGplayer
Pages: Terms of Service (Sept 27, 2023), API Terms (June 8, 2022), Partner Guidelines (Apr 14, 2025), docs.
- Pricing information and card databases are TCGplayer's property; no crawling or scraping without permission. The API is **closed to new developers**. API licensees must display a "not endorsed or certified by TCGplayer" notice and link to the product page when showing pricing.
- Plain links to TCGplayer product pages are fine. Affiliate links go through their Impact program with approval and disclosure.
- **This app** shows prices that arrive through tcgapi.dev (which says its data is primarily TCGplayer's but that it isn't affiliated with TCGplayer). Whether that satisfies TCGplayer's own terms wasn't researched; tcgapi.dev's licence is the document you rely on.

## What to do if you want to share it
Safest path, from the research:
1. Publish the **code only**: no `.env`, no webhook, no database or price snapshots, no images or logos. (`.env` and every `*.db` file, including snapshots and the saved logos inside them, are already git-ignored.)
2. Keep the Pokémon Center and Target adapters **out of anything public** (off by default or removed); they're the part that conflicts with their owners' terms.
3. Don't host it publicly or monetize without the right plans: JustTCG paid, tcgapi.dev Pro for anything earning money, Best Buy attribution + logo, and written permission from Pokémon Center / Target if their data stays in.
4. Add a plain "unofficial fan project, not affiliated with Nintendo, The Pokémon Company, TCGplayer, Best Buy…" notice.

## What I couldn't read or verify
Pokémon Center and pokemon.com served bot-check pages to simple fetches and were read in a normal browser pane after its automatic check; no CAPTCHA was solved. Not read: the tail of Target's Terms, Discord's Monetization Terms, the Impact and Best Buy affiliate agreements, an English version of pokemon.co.jp/rules, any TCGdex terms page (none seems to exist), the providers' privacy policies, TCGplayer's and Cardmarket's own API terms for the upstream data, JustTCG's partner program. Pages were read as text, so dynamically loaded content could be missing.
