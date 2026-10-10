// Password hashing with scrypt from Node's own crypto: salted, deliberately slow and
// memory-hard, compared in constant time. No dependency to keep up to date.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

// OWASP's scrypt guidance: N=2^15, r=8, p=3 (about 32 MB and a fraction of a second per check).
const DEFAULT_PARAMS: ScryptParams = { N: 2 ** 15, r: 8, p: 3 };
const KEY_LENGTH = 32;
const PREFIX = "scrypt";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      // scrypt needs about 128 * N * r bytes; allow double that.
      { N: params.N, r: params.r, p: params.p, maxmem: 256 * params.N * params.r },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

/** "scrypt$N$r$p$salt$hash" — everything needed to check a password later is in the string. */
export async function hashPassword(password: string, params: ScryptParams = DEFAULT_PARAMS): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, params);
  return [PREFIX, params.N, params.r, params.p, salt.toString("base64"), key.toString("base64")].join("$");
}

function parse(stored: string): { params: ScryptParams; salt: Buffer; key: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  // Bounds keep a damaged or crafted value from asking for absurd work or memory.
  if (![N, r, p].every(Number.isInteger) || N < 2 || N > 2 ** 20 || (N & (N - 1)) !== 0) return null;
  if (r < 1 || r > 32 || p < 1 || p > 16) return null;
  const salt = Buffer.from(parts[4], "base64");
  const key = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || key.length !== KEY_LENGTH) return null;
  return { params: { N, r, p }, salt, key };
}

/** True when `password` matches the stored hash. An empty, unset or malformed hash never matches. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = stored ? parse(stored) : null;
  if (!parsed) return false;
  const candidate = await derive(password, parsed.salt, parsed.params);
  return timingSafeEqual(candidate, parsed.key);
}

/** A reason the password isn't acceptable, or null. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string") return "password must be text";
  if (password.length < MIN_PASSWORD_LENGTH) return `password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password.length > MAX_PASSWORD_LENGTH) return `password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  return null;
}
