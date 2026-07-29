import type postgres from "postgres";
import {
  blindIndex,
  decryptFieldMaybe,
  encryptField,
  isEncryptedField,
} from "@/lib/cryptoFields.ts";

type Sql = ReturnType<typeof postgres>;

/**
 * One-time / idempotent: encrypt sensitive plaintext columns in place.
 * Leaves ids, booleans, numbers, and timestamps untouched.
 */
export async function backfillEncryptedSensitiveFields(
  sql: Sql,
): Promise<void> {
  const monitors = await sql<{
    id: string;
    name: string;
    url: string;
    url_hash: string | null;
  }[]>`
    SELECT id, name, url, url_hash FROM monitors
  `;

  for (const row of monitors) {
    const namePlain = await decryptFieldMaybe(row.name);
    const urlPlain = await decryptFieldMaybe(row.url);
    const nameCipher = isEncryptedField(row.name)
      ? row.name
      : await encryptField(namePlain);
    const urlCipher = isEncryptedField(row.url)
      ? row.url
      : await encryptField(urlPlain);
    const urlHash = row.url_hash && row.url_hash.length > 0
      ? row.url_hash
      : await blindIndex(urlPlain);

    if (
      nameCipher !== row.name ||
      urlCipher !== row.url ||
      urlHash !== row.url_hash
    ) {
      await sql`
        UPDATE monitors
        SET name = ${nameCipher},
            url = ${urlCipher},
            url_hash = ${urlHash}
        WHERE id = ${row.id}
      `;
    }
  }

  const statuses = await sql<{
    monitor_id: string;
    name: string;
    url: string;
    error: string | null;
  }[]>`
    SELECT monitor_id, name, url, error FROM monitor_statuses
  `;

  for (const row of statuses) {
    const namePlain = await decryptFieldMaybe(row.name);
    const urlPlain = await decryptFieldMaybe(row.url);
    const nameCipher = isEncryptedField(row.name)
      ? row.name
      : await encryptField(namePlain);
    const urlCipher = isEncryptedField(row.url)
      ? row.url
      : await encryptField(urlPlain);
    let errorCipher = row.error;
    if (row.error != null && !isEncryptedField(row.error)) {
      errorCipher = await encryptField(row.error);
    }

    if (
      nameCipher !== row.name ||
      urlCipher !== row.url ||
      errorCipher !== row.error
    ) {
      await sql`
        UPDATE monitor_statuses
        SET name = ${nameCipher},
            url = ${urlCipher},
            error = ${errorCipher}
        WHERE monitor_id = ${row.monitor_id}
      `;
    }
  }

  const incidents = await sql<{
    id: string;
    name: string;
    url: string;
    error: string | null;
  }[]>`
    SELECT id, name, url, error FROM incidents
  `;

  for (const row of incidents) {
    const namePlain = await decryptFieldMaybe(row.name);
    const urlPlain = await decryptFieldMaybe(row.url);
    const nameCipher = isEncryptedField(row.name)
      ? row.name
      : await encryptField(namePlain);
    const urlCipher = isEncryptedField(row.url)
      ? row.url
      : await encryptField(urlPlain);
    let errorCipher = row.error;
    if (row.error != null && !isEncryptedField(row.error)) {
      errorCipher = await encryptField(row.error);
    }

    if (
      nameCipher !== row.name ||
      urlCipher !== row.url ||
      errorCipher !== row.error
    ) {
      await sql`
        UPDATE incidents
        SET name = ${nameCipher},
            url = ${urlCipher},
            error = ${errorCipher}
        WHERE id = ${row.id}
      `;
    }
  }
}
