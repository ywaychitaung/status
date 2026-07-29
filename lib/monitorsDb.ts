import { getSql, notifyStatusUpdate } from "@/lib/db.ts";
import {
  blindIndex,
  decryptFieldMaybe,
  encryptField,
} from "@/lib/cryptoFields.ts";
import {
  type MonitorTarget,
  newMonitorId,
  normalizeMonitorUrl,
} from "@/lib/monitor.ts";

type MonitorRow = {
  id: string;
  name: string;
  url: string;
  url_hash: string;
  sort_order: number;
  is_active: boolean;
};

async function rowToMonitor(row: MonitorRow): Promise<MonitorTarget> {
  return {
    id: row.id,
    name: await decryptFieldMaybe(row.name),
    url: await decryptFieldMaybe(row.url),
    sortOrder: Number(row.sort_order),
    isActive: Boolean(row.is_active),
  };
}

function parseSortOrder(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Order must be a whole number of 1 or greater");
  }
  return value;
}

/** Active monitors only, ordered for public + admin + checks. */
export async function listMonitors(): Promise<MonitorTarget[]> {
  const sql = await getSql();
  const rows = await sql<MonitorRow[]>`
    SELECT id, name, url, url_hash, sort_order, is_active
    FROM monitors
    WHERE is_active = TRUE
    ORDER BY sort_order ASC, id ASC
  `;
  return await Promise.all(rows.map((row) => rowToMonitor(row)));
}

/** Soft-deleted monitors for the admin inactive list. */
export async function listInactiveMonitors(): Promise<MonitorTarget[]> {
  const sql = await getSql();
  const rows = await sql<MonitorRow[]>`
    SELECT id, name, url, url_hash, sort_order, is_active
    FROM monitors
    WHERE is_active = FALSE
    ORDER BY updated_at DESC, id ASC
  `;
  return await Promise.all(rows.map((row) => rowToMonitor(row)));
}

export async function getMonitor(id: string): Promise<MonitorTarget | null> {
  const sql = await getSql();
  const rows = await sql<MonitorRow[]>`
    SELECT id, name, url, url_hash, sort_order, is_active
    FROM monitors
    WHERE id = ${id}
      AND is_active = TRUE
    LIMIT 1
  `;
  return rows[0] ? await rowToMonitor(rows[0]) : null;
}

async function nextSortOrder(
  sql: Awaited<ReturnType<typeof getSql>>,
): Promise<number> {
  const rows = await sql<{ next: number | null }[]>`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
    FROM monitors
    WHERE is_active = TRUE
  `;
  return Number(rows[0]?.next ?? 1);
}

export async function createMonitor(input: {
  name: string;
  url: string;
}): Promise<MonitorTarget> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const url = normalizeMonitorUrl(input.url);
  const id = newMonitorId();
  const urlHash = await blindIndex(url);
  const nameCipher = await encryptField(name);
  const urlCipher = await encryptField(url);

  const sql = await getSql();
  try {
    const sortOrder = await nextSortOrder(sql);
    const rows = await sql<MonitorRow[]>`
      INSERT INTO monitors (id, name, url, url_hash, sort_order, is_active)
      VALUES (
        ${id},
        ${nameCipher},
        ${urlCipher},
        ${urlHash},
        ${sortOrder},
        TRUE
      )
      RETURNING id, name, url, url_hash, sort_order, is_active
    `;
    await notifyStatusUpdate();
    return await rowToMonitor(rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("monitors_url_hash_active_uidx") ||
      message.includes("monitors_url_active_uidx") ||
      message.includes("monitors_url_key") ||
      message.includes("duplicate key")
    ) {
      throw new Error("A monitor with this URL already exists");
    }
    throw error;
  }
}

export async function updateMonitor(
  id: string,
  input: { name: string; url: string; sortOrder: number },
): Promise<MonitorTarget> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const url = normalizeMonitorUrl(input.url);
  const sortOrder = parseSortOrder(input.sortOrder);
  const urlHash = await blindIndex(url);
  const nameCipher = await encryptField(name);
  const urlCipher = await encryptField(url);

  const sql = await getSql();
  try {
    const rows = await sql.begin(async (tx) => {
      const currentRows = await tx<MonitorRow[]>`
        SELECT id, name, url, url_hash, sort_order, is_active
        FROM monitors
        WHERE id = ${id}
          AND is_active = TRUE
        LIMIT 1
        FOR UPDATE
      `;
      const current = currentRows[0];
      if (!current) throw new Error("Monitor not found");

      const oldOrder = Number(current.sort_order);

      if (oldOrder === sortOrder) {
        return await tx<MonitorRow[]>`
          UPDATE monitors
          SET name = ${nameCipher},
              url = ${urlCipher},
              url_hash = ${urlHash},
              updated_at = NOW()
          WHERE id = ${id}
            AND is_active = TRUE
          RETURNING id, name, url, url_hash, sort_order, is_active
        `;
      }

      const occupantRows = await tx<MonitorRow[]>`
        SELECT id, name, url, url_hash, sort_order, is_active
        FROM monitors
        WHERE sort_order = ${sortOrder}
          AND is_active = TRUE
          AND id <> ${id}
        LIMIT 1
        FOR UPDATE
      `;
      const occupant = occupantRows[0];

      if (occupant) {
        const parkOrder = -Math.abs(oldOrder === 0 ? 1 : oldOrder);
        await tx`
          UPDATE monitors
          SET sort_order = ${parkOrder},
              updated_at = NOW()
          WHERE id = ${id}
        `;
        await tx`
          UPDATE monitors
          SET sort_order = ${oldOrder},
              updated_at = NOW()
          WHERE id = ${occupant.id}
        `;
        return await tx<MonitorRow[]>`
          UPDATE monitors
          SET name = ${nameCipher},
              url = ${urlCipher},
              url_hash = ${urlHash},
              sort_order = ${sortOrder},
              updated_at = NOW()
          WHERE id = ${id}
          RETURNING id, name, url, url_hash, sort_order, is_active
        `;
      }

      return await tx<MonitorRow[]>`
        UPDATE monitors
        SET name = ${nameCipher},
            url = ${urlCipher},
            url_hash = ${urlHash},
            sort_order = ${sortOrder},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, name, url, url_hash, sort_order, is_active
      `;
    });

    if (!rows[0]) throw new Error("Monitor not found");
    await notifyStatusUpdate();
    return await rowToMonitor(rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message === "Monitor not found") {
      throw error;
    }
    if (
      error instanceof Error &&
      error.message.startsWith("Order must be")
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("monitors_url_hash_active_uidx") ||
      message.includes("monitors_url_active_uidx") ||
      message.includes("monitors_url_key") ||
      message.includes("duplicate key")
    ) {
      throw new Error("A monitor with this URL already exists");
    }
    throw error;
  }
}

/** Soft-delete: mark inactive instead of removing the row. */
export async function deleteMonitor(id: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ id: string }[]>`
    UPDATE monitors
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE id = ${id}
      AND is_active = TRUE
    RETURNING id
  `;
  if (rows.length === 0) return false;
  await notifyStatusUpdate();
  return true;
}

/** Restore a soft-deleted monitor and place it at the end of the active order. */
export async function reactivateMonitor(id: string): Promise<MonitorTarget> {
  const sql = await getSql();
  try {
    const rows = await sql.begin(async (tx) => {
      const currentRows = await tx<MonitorRow[]>`
        SELECT id, name, url, url_hash, sort_order, is_active
        FROM monitors
        WHERE id = ${id}
          AND is_active = FALSE
        LIMIT 1
        FOR UPDATE
      `;
      const current = currentRows[0];
      if (!current) throw new Error("Deleted website not found");

      const urlClash = await tx<{ id: string }[]>`
        SELECT id FROM monitors
        WHERE url_hash = ${current.url_hash}
          AND is_active = TRUE
          AND id <> ${id}
        LIMIT 1
      `;
      if (urlClash[0]) {
        throw new Error(
          "An active website already uses this URL. Change or remove it first.",
        );
      }

      const nextRows = await tx<{ next: number | null }[]>`
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
        FROM monitors
        WHERE is_active = TRUE
      `;
      const sortOrder = Number(nextRows[0]?.next ?? 1);

      return await tx<MonitorRow[]>`
        UPDATE monitors
        SET is_active = TRUE,
            sort_order = ${sortOrder},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, name, url, url_hash, sort_order, is_active
      `;
    });

    await notifyStatusUpdate();
    return await rowToMonitor(rows[0]);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Deleted website not found" ||
        error.message.startsWith("An active website already"))
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("monitors_url_hash_active_uidx") ||
      message.includes("duplicate key")
    ) {
      throw new Error(
        "An active website already uses this URL. Change or remove it first.",
      );
    }
    throw error;
  }
}

