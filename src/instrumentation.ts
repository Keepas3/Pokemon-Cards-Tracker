// Next.js calls `register()` once when the server process starts. This is
// where we boot the background scheduler (watched card prices, set price fill,
// morning digest), so it runs alongside `next dev` / `next start` without a
// separate process.
//
// Set DISABLE_SCHEDULER=1 for a second instance of the app (e.g. a production
// build on another port next to `next dev`) so the two don't both refresh
// prices and spend the same API budget.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Sign-in needs at least one profile with a password. This creates or claims the ones
    // named in BOOTSTRAP_PROFILES (and never replaces a password that's already set).
    try {
      const { bootstrapFromEnv } = await import("@/lib/auth/profiles");
      await bootstrapFromEnv();
    } catch (err) {
      console.error("[auth] couldn't set up profiles from BOOTSTRAP_PROFILES:", (err as Error).message);
    }
  }

  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DISABLE_SCHEDULER !== "1") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
