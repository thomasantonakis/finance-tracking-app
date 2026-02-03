/**
 * Local dev stub for Base44 client.
 * Goal: make the UI run locally without Base44 infra.
 * Data persists in localStorage.
 */

const sleep = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function lsKey(entityName) {
  return `__base44_stub__${entityName}`;
}

function readAll(entityName) {
  try {
    return JSON.parse(localStorage.getItem(lsKey(entityName)) || "[]");
  } catch {
    return [];
  }
}

function writeAll(entityName, rows) {
  localStorage.setItem(lsKey(entityName), JSON.stringify(rows));
}

function genId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const aDate = Date.parse(a);
  const bDate = Date.parse(b);
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) return aDate - bDate;
  return String(a).localeCompare(String(b));
}

function normalizeSort(sort) {
  if (typeof sort === "string") return sort;
  if (sort && typeof sort === "object") {
    return sort.orderBy || sort.sort || sort.field || null;
  }
  return null;
}

function makeEntity(entityName) {
  return {
    async list(sort) {
      await sleep();
      const rows = readAll(entityName);
      const sortKey = normalizeSort(sort);
      if (!sortKey) return rows;
      const desc = sortKey.startsWith("-");
      const field = desc ? sortKey.slice(1) : sortKey;
      return [...rows].sort((a, b) => {
        const order = compareValues(a?.[field], b?.[field]);
        return desc ? -order : order;
      });
    },

    async get(id) {
      await sleep();
      return readAll(entityName).find((r) => r.id === id) ?? null;
    },

    async create(payload) {
      await sleep();
      const rows = readAll(entityName);
      const row = { id: genId(), created_at: new Date().toISOString(), ...payload };
      rows.unshift(row);
      writeAll(entityName, rows);
      return row;
    },

    async createMany(payloads) {
      await sleep();
      const rows = readAll(entityName);
      const now = new Date().toISOString();
      const created = payloads.map((payload) => ({
        id: genId(),
        created_at: now,
        ...payload,
      }));
      rows.unshift(...created);
      writeAll(entityName, rows);
      return created;
    },

    async update(id, patch) {
      await sleep();
      const rows = readAll(entityName);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`${entityName}.update: not found id=${id}`);
      rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
      writeAll(entityName, rows);
      return rows[idx];
    },

    async updateMany(patches) {
      await sleep();
      const rows = readAll(entityName);
      const now = new Date().toISOString();
      const patchMap = new Map(patches.map((patch) => [patch.id, patch]));
      const updated = [];
      const next = rows.map((row) => {
        const patch = patchMap.get(row.id);
        if (!patch) return row;
        const merged = { ...row, ...patch, updated_at: now };
        updated.push(merged);
        return merged;
      });
      writeAll(entityName, next);
      return updated;
    },

    async delete(id) {
      await sleep();
      const rows = readAll(entityName);
      const next = rows.filter((r) => r.id !== id);
      writeAll(entityName, next);
      return { ok: true };
    },

    async deleteMany(ids) {
      await sleep();
      const rows = readAll(entityName);
      const idSet = new Set(ids);
      const next = rows.filter((r) => !idSet.has(r.id));
      writeAll(entityName, next);
      return { ok: true };
    },
  };
}

// Add entities your UI uses.
// If the UI complains "Cannot read properties of undefined (reading 'X')",
// we just add X here.
export const base44 = {
  entities: {
    Account: makeEntity("Account"),
    Expense: makeEntity("Expense"),
    Income: makeEntity("Income"),
    Transfer: makeEntity("Transfer"),
    ExpenseCategory: makeEntity("ExpenseCategory"),
    IncomeCategory: makeEntity("IncomeCategory"),
    RecurringRule: makeEntity("RecurringRule"),
    Goal: makeEntity("Goal"),
  },
};
