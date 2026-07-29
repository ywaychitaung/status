import { argon2idAsync } from "@noble/hashes/argon2.js";
import { getSql } from "@/lib/db.ts";
import {
  blindIndex,
  decryptField,
  encryptField,
} from "@/lib/cryptoFields.ts";

const COOKIE_NAME = "status_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SETTINGS_SESSION_SECRET = "session_secret";

/** OWASP Argon2id (interactive) — fast enough for login without freezing Vite SSR. */
const ARGON2ID = {
  t: 2,
  m: 19456,
  p: 1,
  dkLen: 32,
} as const;

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa[i] ^ bb[i];
  return out === 0;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await argon2idAsync(password, salt, { ...ARGON2ID });
  return `argon2id$m=${ARGON2ID.m},t=${ARGON2ID.t},p=${ARGON2ID.p}$${
    bytesToHex(salt)
  }$${bytesToHex(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, params, saltHex, hashHex] = stored.split("$");
  if (algo !== "argon2id" || !params || !saltHex || !hashHex) return false;

  const m = Number(/m=(\d+)/.exec(params)?.[1]);
  const t = Number(/t=(\d+)/.exec(params)?.[1]);
  const p = Number(/p=(\d+)/.exec(params)?.[1]);
  if (![m, t, p].every((n) => Number.isFinite(n) && n > 0)) return false;

  const hash = await argon2idAsync(password, hexToBytes(saltHex), {
    m,
    t,
    p,
    dkLen: hashHex.length / 2,
  });
  return timingSafeEqual(bytesToHex(hash), hashHex);
}

async function getSessionSecret(): Promise<string> {
  const sql = await getSql();
  const rows = await sql<{ value: string }[]>`
    SELECT value FROM app_settings WHERE key = ${SETTINGS_SESSION_SECRET} LIMIT 1
  `;
  if (rows[0]?.value) return rows[0].value;

  const secret = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES (${SETTINGS_SESSION_SECRET}, ${secret})
    ON CONFLICT (key) DO NOTHING
  `;
  const again = await sql<{ value: string }[]>`
    SELECT value FROM app_settings WHERE key = ${SETTINGS_SESSION_SECRET} LIMIT 1
  `;
  return again[0]?.value ?? secret;
}

async function hmacSign(payload: string): Promise<string> {
  const secret = await getSessionSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToHex(sig);
}

export async function countUsers(): Promise<number> {
  const sql = await getSql();
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM users
  `;
  return Number(count);
}

export async function hasUsers(): Promise<boolean> {
  return (await countUsers()) > 0;
}

export async function createUser(input: {
  name: string;
  username: string;
  password: string;
}): Promise<void> {
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();
  if (!name) throw new Error("Name is required");
  if (!username) throw new Error("Username is required");
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const sql = await getSql();
  const passwordHash = await hashPassword(input.password);
  const usernameKey = await blindIndex(username);
  const usernameCipher = await encryptField(username);
  const nameCipher = await encryptField(name);

  try {
    await sql`
      INSERT INTO users (
        username, username_hash, password, name
      ) VALUES (
        ${usernameCipher}, ${usernameKey}, ${passwordHash}, ${nameCipher}
      )
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("users_username_hash_key") ||
      message.includes("duplicate key")
    ) {
      throw new Error("Username already exists");
    }
    throw error;
  }
}

export const SEED_ADMIN = {
  name: "Admin",
  username: "admin",
  password: "password",
} as const;

/** Insert default admin when the users table is empty. */
export async function seedAdminIfEmpty(): Promise<boolean> {
  if (await hasUsers()) return false;
  await createUser({ ...SEED_ADMIN });
  return true;
}

export async function getSessionUserId(req: Request): Promise<number | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const [userIdRaw, expiresRaw, sig] = decodeURIComponent(match[1]).split(".");
  const userId = Number(userIdRaw);
  const expiresAt = Number(expiresRaw);
  if (
    !Number.isFinite(userId) ||
    !Number.isFinite(expiresAt) ||
    Date.now() > expiresAt ||
    !sig
  ) {
    return null;
  }

  const expected = await hmacSign(`user:${userId}:${expiresAt}`);
  if (!timingSafeEqual(sig, expected)) return null;
  return userId;
}

export async function getUserById(
  id: number,
): Promise<{ id: number; username: string; name: string } | null> {
  const sql = await getSql();
  const rows = await sql<{
    id: number;
    username: string;
    name: string;
  }[]>`
    SELECT id, username, name
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    username: await decryptField(row.username),
    name: await decryptField(row.name),
  };
}

export async function updateUserAccount(
  userId: number,
  input: {
    name: string;
    username: string;
  },
): Promise<{ id: number; username: string; name: string }> {
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();

  if (!name) throw new Error("Name is required");
  if (!username) throw new Error("Username is required");

  const sql = await getSql();
  const existing = await sql<{ id: number }[]>`
    SELECT id FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (!existing[0]) throw new Error("User not found");

  const usernameKey = await blindIndex(username);
  const usernameCipher = await encryptField(username);
  const nameCipher = await encryptField(name);

  try {
    await sql`
      UPDATE users
      SET username_hash = ${usernameKey},
          username = ${usernameCipher},
          name = ${nameCipher},
          updated_at = NOW()
      WHERE id = ${userId}
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("users_username_hash_key") ||
      message.includes("duplicate key")
    ) {
      throw new Error("Username already exists");
    }
    throw error;
  }

  return { id: userId, username, name };
}

export async function changeUserPassword(
  userId: number,
  input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
): Promise<void> {
  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;
  const confirmPassword = input.confirmPassword;

  if (!currentPassword) throw new Error("Current password is required");
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("New password and confirmation do not match");
  }
  if (newPassword === currentPassword) {
    throw new Error("New password must be different from the current one");
  }

  const sql = await getSql();
  const rows = await sql<{ password: string }[]>`
    SELECT password FROM users WHERE id = ${userId} LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error("User not found");

  if (!(await verifyPassword(currentPassword, row.password))) {
    throw new Error("Current password is incorrect");
  }

  const passwordHash = await hashPassword(newPassword);
  await sql`
    UPDATE users
    SET password = ${passwordHash},
        updated_at = NOW()
    WHERE id = ${userId}
  `;
}

export async function getCurrentUser(
  req: Request,
): Promise<{ id: number; username: string; name: string } | null> {
  const userId = await getSessionUserId(req);
  if (userId === null) return null;
  return await getUserById(userId);
}

export async function verifyUserLogin(
  username: string,
  password: string,
): Promise<{ id: number; username: string; name: string } | null> {
  const result = await attemptUserLogin(username, password);
  return result.ok ? result.user : null;
}

export type LoginFailureReason =
  | "empty_username"
  | "empty_password"
  | "unknown_user"
  | "bad_password";

export type LoginAttemptResult =
  | { ok: true; user: { id: number; username: string; name: string } }
  | { ok: false; reason: LoginFailureReason; message: string };

export async function attemptUserLogin(
  username: string,
  password: string,
): Promise<LoginAttemptResult> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    return {
      ok: false,
      reason: "empty_username",
      message: "Username is required",
    };
  }
  if (!password) {
    return {
      ok: false,
      reason: "empty_password",
      message: "Password is required",
    };
  }

  const sql = await getSql();
  const usernameKey = await blindIndex(normalized);
  const rows = await sql<{
    id: number;
    username: string;
    name: string;
    password: string;
  }[]>`
    SELECT id, username, name, password
    FROM users
    WHERE username_hash = ${usernameKey}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) {
    return {
      ok: false,
      reason: "unknown_user",
      message: "Unknown username",
    };
  }
  if (!(await verifyPassword(password, user.password))) {
    return {
      ok: false,
      reason: "bad_password",
      message: "Incorrect password",
    };
  }

  return {
    ok: true,
    user: {
      id: Number(user.id),
      username: await decryptField(user.username),
      name: await decryptField(user.name),
    },
  };
}

export async function createAdminSessionCookie(
  userId: number,
): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `user:${userId}:${expiresAt}`;
  const sig = await hmacSign(payload);
  const value = `${userId}.${expiresAt}.${sig}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    Math.floor(SESSION_TTL_MS / 1000)
  }`;
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function isAdminAuthenticated(req: Request): Promise<boolean> {
  const userId = await getSessionUserId(req);
  if (userId === null) return false;

  const sql = await getSql();
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM users WHERE id = ${userId} LIMIT 1
  `;
  return rows.length > 0;
}
