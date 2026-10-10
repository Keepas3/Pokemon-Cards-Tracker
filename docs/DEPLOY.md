# Putting it online (GitHub + Railway)

The app runs as **one always-on container** with its database in a **SQLite file on a volume**. Because the background
jobs (price refresh, alerts, the morning digest) live inside that process, it must run continuously, as exactly one
copy: no "sleep when idle", no second replica. Both are set up by `railway.json` and the `Dockerfile` in this repo.

> I couldn't build the Docker image or deploy to Railway from the machine this was written on (no Docker, no account),
> so the container setup is written to Railway's documented behaviour but **hasn't been run end to end**. The same
> commands the container runs (`prisma migrate deploy`, `next start -H 0.0.0.0`) were tested locally, including
> sign-in behind a simulated HTTPS proxy. The first deploy is the real test: watch its logs.

## What you need

- A GitHub account, and a **private** repository for the code. Keep it private: the data providers' terms assume a
  personal project ([API-TERMS.md](API-TERMS.md)), and the repository is the one place a mistake could leak a key.
- A Railway account.
- Your tcgapi.dev key (free).
- A name and password (8+ characters) for each of the two profiles.

## 1. Put the code on GitHub

Nothing in `.gitignore`d files should ever be committed: `.env` (your keys), `prisma/*.db` (your data), `.next`,
`src/generated` (rebuilt on deploy). Check what you're about to commit before the first push:

```bash
git status
git add -A
git status   # .env and *.db must not be listed
```

Then create the private repository on GitHub and push `main` to it. The workflow in `.github/workflows/ci.yml` then runs
the type check, lint, tests and a build on every push and pull request.

## 2. Create the Railway service

1. In Railway: **New Project → Deploy from GitHub repo**, and pick the repository. (Railway needs access to the repo;
   it'll ask you to install its GitHub app.)
2. It finds `railway.json` and builds the `Dockerfile`. The first build takes a few minutes. Don't worry that the first
   deploy fails its health check: it needs the variables and volume below first.
3. **Add a volume** to the service and mount it at **`/data`**. This is where the database lives; without it every
   redeploy starts from an empty database.
4. Under **Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `file:/data/app.db` |
| `TCGAPI_DEV_API_KEY` | your tcgapi.dev key |
| `SESSION_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BOOTSTRAP_PROFILES` | `Sam:their-password,Alex:their-password` (use your own names and passwords; passwords can't contain commas, or use the JSON form shown in `.env.example`) |
| `ALLOWED_HOSTS` | the site's address without `https://`, e.g. `my-binder.up.railway.app` (add your own domain too if you attach one) |

   Don't set `PORT` (Railway does) or `DISABLE_SCHEDULER`.
5. Under **Settings → Networking**, **generate a domain**. Put that exact host in `ALLOWED_HOSTS` and redeploy. If you
   forget, every page works but the API answers `403 Blocked: unexpected Host`.
6. Redeploy. When the health check (`/api/health`) goes green, open the address.

If the service has a **Wait for CI** option, turn it on so a push to `main` only deploys once the checks pass.

## 3. First sign-in

Open the site; you land on the sign-in page with both names. Sign in as yourself. **The first name in
`BOOTSTRAP_PROFILES` takes over the collection that existed before profiles did** (on a brand-new database there's
nothing yet). Everyone else gets a fresh profile.

Then, in each profile's **Settings**: add the Discord webhook, turn on the morning digest, and change the password to one
only you know (it was visible to whoever set the variables).

## Moving the collection you already have

On your own computer's copy: **Settings → Your data → Download my backup**. On the hosted site, signed in as the same
person: **Restore from a backup**. It adds what's missing and never removes anything, so it's safe to do twice.
Your tracked cards and alert rules come along; sets whose prices haven't been loaded yet on the new site will skip their
alert rules (restore again once the sets have loaded, or recreate them).

## Day to day

- **Updating the app:** push to `main`. Railway builds, runs any new migrations on start (`prisma migrate deploy`), and
  swaps the container. Because the database is on a volume, a deploy has a short gap rather than zero downtime.
- **Backups:** every night after 03:00 server time the app saves a snapshot of the whole database next to it
  (`/data/backups/binder-YYYY-MM-DD.db`, the last seven). That's protection against mistakes and bad deploys, **not**
  against losing the volume, so each of you should download your own backup now and then.
- **Restoring a snapshot:** get the file off the volume (Railway's volume tools or the Railway CLI's shell access; check its current
  docs), and replace `/data/app.db` with it while the service is stopped.
- **Logs:** Railway's deploy logs show lines like `[auth] …`, `[scheduler] …` and any `[auth] couldn't set up profiles`.

## Forgotten password

If you can reach a shell on the machine running the app: `npm run profile:set -- "Name" "new password"`.
On Railway without a shell: set `BOOTSTRAP_PROFILES` to `Name:the-new-password`, add the variable
`BOOTSTRAP_OVERWRITE=1`, redeploy, **then remove `BOOTSTRAP_OVERWRITE`**. (Without that flag the startup step never
replaces an existing password, so editing `BOOTSTRAP_PROFILES` later can't lock anyone out.) Signed-in devices stay signed
in; changing `SESSION_SECRET` signs everyone out.

## Troubleshooting

| You see | Likely cause |
|---|---|
| Health check fails on the first deploy | The volume or variables aren't set yet; check the deploy logs for the real error. |
| "The server isn't configured for sign-in (SESSION_SECRET)" | `SESSION_SECRET` is missing or under 32 characters. |
| "No profiles are set up yet" on the sign-in page | `BOOTSTRAP_PROFILES` is missing or has no valid entries (a name, and a password of 8+ characters). |
| `403 Blocked: unexpected Host` | The site's address isn't in `ALLOWED_HOSTS`. |
| `403 Blocked: cross-site request` | Something other than the site itself sent the request (a bookmarklet, another origin). Use the site normally. |
| Prices are empty | `TCGAPI_DEV_API_KEY` missing, or the daily 100-request limit was used up; it resets at midnight UTC. |
| Everything is empty after a deploy | The volume isn't mounted at `/data`, or `DATABASE_URL` points somewhere else. |

## Costs and limits

Railway's plans and prices change, so check them. What this app needs is small: one container running all the time and
a volume of a few hundred megabytes at most. The free tier of tcgapi.dev (about 100 requests a day) is shared by both of
you; opening sets you collect refreshes them first.

## Before inviting anyone else

This is built for **two people who know each other**. The passwords stop strangers and casual snooping; it is not a
multi-tenant system. The data providers' free tiers also assume a personal project; read [API-TERMS.md](API-TERMS.md)
before widening it, and don't make the repository or the site public.
