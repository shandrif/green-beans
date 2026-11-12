import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Role, User } from "../shared/workflow";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  /** One-time key required to create the first admin (set with `wrangler secret put SETUP_KEY`). */
  SETUP_KEY?: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: User } };

const SESSION_COOKIE = "gb_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const { hash: candidate } = await hashPassword(password, salt);
  return timingSafeEqualHex(candidate, hash);
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

export async function createSession(c: Context<AppEnv>, userId: number) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await c.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, expires.toISOString())
    .run();
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    expires,
  });
}

export async function destroySession(c: Context<AppEnv>) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export function rowToUser(r: Record<string, unknown>): User {
  return {
    id: r.id as number,
    email: r.email as string,
    name: r.name as string,
    role: r.role as Role,
    lang: (r.lang as "en" | "ar") ?? "en",
    active: !!r.active,
    must_change_password: !!r.must_change_password,
    created_at: r.created_at as string | undefined,
  };
}

/** Loads the signed-in user, or answers 401. */
export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const row = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.active = 1`,
  )
    .bind(await sha256(token), new Date().toISOString())
    .first();
  if (!row) {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("user", rowToUser(row));
  await next();
}

export function requireRole(...roles: Role[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) return c.json({ error: "forbidden" }, 403);
    await next();
  };
}

/** Blocks cross-site form posts: every state-changing call must come from our own fetch(). */
export async function csrfGuard(c: Context<AppEnv>, next: Next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    if (c.req.header("x-requested-with") !== "green-beans") return c.json({ error: "bad_request" }, 400);
  }
  await next();
}

// Simple failed-login throttle kept in D1 (no KV needed).
export async function tooManyAttempts(db: D1Database, email: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const r = await db
    .prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'login_failed' AND message = ? AND created_at > ?")
    .bind(email.toLowerCase(), since)
    .first<{ n: number }>();
  return (r?.n ?? 0) >= 8;
}
