import { getSql } from "@/lib/db.ts";

const SETTINGS_ENCRYPTION_KEY = "encryption_key";

/** Ciphertext prefix for AES-256-GCM field encryption. */
const CIPHER_VERSION = "aes256gcm";

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * 32-byte (64 hex char) key for AES-256-GCM.
 * Prefer ENCRYPTION_KEY in .env; generate with: openssl rand -hex 32
 */
async function ensureEncryptionKeyHex(): Promise<string> {
  // Ensure .env is loaded before reading ENCRYPTION_KEY (Vite SSR path).
  const { loadEnvFile } = await import("@/lib/loadEnv.ts");
  loadEnvFile();

  const fromEnv = Deno.env.get("ENCRYPTION_KEY")?.trim();
  if (fromEnv) {
    if (!/^[0-9a-fA-F]{64}$/.test(fromEnv)) {
      throw new Error(
        "ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256. Generate with: openssl rand -hex 32",
      );
    }
    return fromEnv.toLowerCase();
  }

  const sql = await getSql();
  const rows = await sql<{ value: string }[]>`
    SELECT value FROM app_settings WHERE key = ${SETTINGS_ENCRYPTION_KEY} LIMIT 1
  `;
  if (rows[0]?.value && /^[0-9a-fA-F]{64}$/.test(rows[0].value)) {
    return rows[0].value.toLowerCase();
  }

  const generated = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES (${SETTINGS_ENCRYPTION_KEY}, ${generated})
    ON CONFLICT (key) DO NOTHING
  `;
  const again = await sql<{ value: string }[]>`
    SELECT value FROM app_settings WHERE key = ${SETTINGS_ENCRYPTION_KEY} LIMIT 1
  `;
  return (again[0]?.value ?? generated).toLowerCase();
}

async function getAes256Key(): Promise<CryptoKey> {
  const hex = await ensureEncryptionKeyHex();
  const raw = hexToBytes(hex);
  if (raw.byteLength !== 32) {
    throw new Error("AES-256 requires a 32-byte ENCRYPTION_KEY");
  }
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function getHmacKey(): Promise<CryptoKey> {
  const hex = await ensureEncryptionKeyHex();
  return await crypto.subtle.importKey(
    "raw",
    hexToBytes(hex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Deterministic blind index so encrypted values can still be looked up / uniqued. */
export async function blindIndex(value: string): Promise<string> {
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`blind:${value}`),
  );
  return bytesToHex(sig);
}

export function isEncryptedField(payload: string): boolean {
  return payload.startsWith(`${CIPHER_VERSION}$`) ||
    payload.startsWith("v1$");
}

/** Encrypt a field with AES-256-GCM. Stored as aes256gcm$iv$ciphertext. */
export async function encryptField(plaintext: string): Promise<string> {
  const key = await getAes256Key();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${CIPHER_VERSION}$${bytesToHex(iv)}$${bytesToHex(cipherBuf)}`;
}

export async function decryptField(payload: string): Promise<string> {
  const [version, ivHex, dataHex] = payload.split("$");
  if (
    (version !== CIPHER_VERSION && version !== "v1") ||
    !ivHex ||
    !dataHex
  ) {
    throw new Error("Invalid encrypted field");
  }
  const key = await getAes256Key();
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(ivHex) },
    key,
    hexToBytes(dataHex),
  );
  return new TextDecoder().decode(plainBuf);
}

/** Decrypt when ciphertext; pass through legacy plaintext. */
export async function decryptFieldMaybe(payload: string): Promise<string> {
  if (!isEncryptedField(payload)) return payload;
  return await decryptField(payload);
}

export async function encryptNullable(
  value: string | null,
): Promise<string | null> {
  if (value == null) return null;
  return await encryptField(value);
}

export async function decryptNullable(
  value: string | null,
): Promise<string | null> {
  if (value == null) return null;
  return await decryptFieldMaybe(value);
}
