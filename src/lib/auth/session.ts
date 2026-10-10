// The sign-in cookie. It holds which profiles this device has unlocked and which one is
// active, signed with HMAC-SHA256 so it can't be edited or forged without SESSION_SECRET.
// Pure apart from reading the environment, so the rules are tested.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "binder_session";
/** Signed in for about three months, so each device types its password rarely. */
export const SESSION_MAX_AGE_S = 90 * 24 * 60 * 60;
const MAX_UNLOCKED = 10;

export interface Session {
  /** The profile the pages show right now. Always one of `unlocked`. */
  active: string | null;
  /** Profiles whose password was entered on this device. */
  unlocked: string[];
  /** Expiry, epoch seconds. */
  exp: number;
}

const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

function mac(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function signSession(session: Session, secret: string): string {
  const payload = b64url(JSON.stringify(session));
  return `${payload}.${b64url(mac(payload, secret))}`;
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    (s.active === null || typeof s.active === "string") &&
    Array.isArray(s.unlocked) &&
    s.unlocked.length <= MAX_UNLOCKED &&
    s.unlocked.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64) &&
    typeof s.exp === "number" &&
    Number.isFinite(s.exp)
  );
}

/** The session in a cookie value, or null if it's missing, forged, damaged or expired. */
export function verifySession(token: string | undefined | null, secret: string, nowMs: number = Date.now()): Session | null {
  if (!token || token.length > 2048) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expected = mac(payload, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isSession(parsed) || parsed.exp * 1000 <= nowMs) return null;
  if (parsed.active !== null && !parsed.unlocked.includes(parsed.active)) return null;
  return parsed;
}

const expiry = (nowMs: number) => Math.floor(nowMs / 1000) + SESSION_MAX_AGE_S;

/** This device just entered `profileId`'s password: unlock it and make it the active one. */
export function unlockProfile(session: Session | null, profileId: string, nowMs: number = Date.now()): Session {
  const unlocked = [...new Set([...(session?.unlocked ?? []), profileId])].slice(-MAX_UNLOCKED);
  return { active: profileId, unlocked, exp: expiry(nowMs) };
}

/** Switch to a profile that is already unlocked here; null when it isn't (its password is needed). */
export function switchProfile(session: Session, profileId: string): Session | null {
  return session.unlocked.includes(profileId) ? { ...session, active: profileId } : null;
}

/** Lock one profile again. Null when nothing is left unlocked (the cookie should be cleared). */
export function lockProfile(session: Session, profileId: string): Session | null {
  const unlocked = session.unlocked.filter((id) => id !== profileId);
  if (unlocked.length === 0) return null;
  const active = session.active === profileId ? unlocked[0] : session.active;
  return { ...session, active, unlocked };
}

const g = globalThis as unknown as { __devSessionSecret?: string };

/**
 * The signing secret. In production it must be set (32+ characters) or every request fails
 * closed. Elsewhere a random one per process is used, so sign-ins reset when the dev server restarts.
 */
export function getSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  return (g.__devSessionSecret ??= randomBytes(32).toString("hex"));
}

/** Whether to mark the cookie Secure: true behind HTTPS (directly, or via a proxy that says so). */
export function isSecureRequest(url: string, forwardedProto: string | null): boolean {
  if (forwardedProto) return forwardedProto.split(",")[0].trim().toLowerCase() === "https";
  return url.startsWith("https:");
}

export function cookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: SESSION_MAX_AGE_S };
}
