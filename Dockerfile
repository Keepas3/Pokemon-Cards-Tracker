# Builds and runs the app as one container (this is what Railway uses; see railway.json and docs/DEPLOY.md).
#
# The database is a SQLite file on a volume mounted at /data (DATABASE_URL=file:/data/app.db), the scheduler
# runs inside the same process, so run exactly ONE instance of this container.

FROM node:22-bookworm-slim

# Compilers are only a fallback: better-sqlite3 normally installs a prebuilt binary for this platform.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first, so a code-only change reuses this layer. Dev dependencies stay: the start command
# runs Prisma's migrations (which read prisma.config.ts and dotenv) and "npm run profile:set" uses tsx.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The generated Prisma client isn't committed; the build needs it. No database is needed to build.
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Apply any new migrations, then serve. PORT is set by the host. A failed migration stops the container
# (and the host restarts it) rather than serving a half-updated database.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
