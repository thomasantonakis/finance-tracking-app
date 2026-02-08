import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const sessionState = {};

export function useSessionState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    if (key in sessionState) return sessionState[key];
    return typeof defaultValue === "function" ? defaultValue() : defaultValue;
  });

  useEffect(() => {
    sessionState[key] = value;
  }, [key, value]);

  return [value, setValue];
}

export function createPageUrl(name) {
  if (!name) return "/";
  if (name.toLowerCase() === "home") return "/";
  return "/" + name.toLowerCase();
}

const DUPLICATE_DATE_KEY = "__base44_duplicate_date__";
const NUMBER_FORMAT_KEY = "__base44_number_format__";
const ACCOUNTS_ORDER_KEY = "__base44_accounts_order__";
const MAIN_CURRENCY_KEY = "__base44_main_currency__";
const USER_SETTINGS_KEY = "__base44_user_settings__";
const FX_RATES_KEY_PREFIX = "__base44_fx_rates__";
const FX_PROVIDER_KEY = "__base44_fx_provider__";

const DEFAULT_USER_SETTINGS = {
  number_format: "dot",
  main_currency: null,
  fx_provider: "exchangerate.host",
  accounts_order: [],
};

let userSettingsCache = null;
let userSettingsId = null;
let settingsWriteInFlight = Promise.resolve();

function readLegacyNumberFormat() {
  try {
    const stored = localStorage.getItem(NUMBER_FORMAT_KEY);
    if (stored === "dot" || stored === "comma") return stored;
    return null;
  } catch {
    return null;
  }
}

function readLegacyMainCurrency() {
  try {
    return localStorage.getItem(MAIN_CURRENCY_KEY);
  } catch {
    return null;
  }
}

function readLegacyFxProvider() {
  try {
    return localStorage.getItem(FX_PROVIDER_KEY);
  } catch {
    return null;
  }
}

function readLegacyAccountsOrder() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_ORDER_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
  } catch {
    return [];
  }
}

function getUserSettingsCache() {
  if (userSettingsCache) return userSettingsCache;
  try {
    const raw = localStorage.getItem(USER_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    userSettingsCache = { ...DEFAULT_USER_SETTINGS, ...parsed };
  } catch {
    userSettingsCache = { ...DEFAULT_USER_SETTINGS };
  }
  return userSettingsCache;
}

function setUserSettingsCache(next) {
  userSettingsCache = { ...DEFAULT_USER_SETTINGS, ...next };
  try {
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(userSettingsCache));
  } catch {
    // Ignore storage failures.
  }
}

function persistUserSettings(patch) {
  settingsWriteInFlight = settingsWriteInFlight.then(async () => {
    try {
      let id = userSettingsId;
      if (!id) {
        const existing = await base44.entities.UserSettings.list();
        if (existing.length > 0) {
          id = existing[0].id;
          userSettingsId = id;
        } else {
          const created = await base44.entities.UserSettings.create({
            ...getUserSettingsCache(),
            ...patch,
          });
          userSettingsId = created.id;
          return;
        }
      }
      await base44.entities.UserSettings.update(id, patch);
    } catch {
      // Ignore persistence failures; cache remains.
    }
  });
}

export async function bootstrapUserSettings() {
  try {
    const existing = await base44.entities.UserSettings.list();
    if (existing.length > 0) {
      userSettingsId = existing[0].id;
      setUserSettingsCache(existing[0]);
      return;
    }
    const seed = {
      number_format: readLegacyNumberFormat() || DEFAULT_USER_SETTINGS.number_format,
      main_currency: readLegacyMainCurrency(),
      fx_provider: readLegacyFxProvider() || DEFAULT_USER_SETTINGS.fx_provider,
      accounts_order: readLegacyAccountsOrder(),
    };
    const created = await base44.entities.UserSettings.create(seed);
    userSettingsId = created.id;
    setUserSettingsCache(created);
  } catch {
    // Ignore bootstrap failures; fall back to cache.
    getUserSettingsCache();
  }
}

export function getDuplicateDate() {
  try {
    return localStorage.getItem(DUPLICATE_DATE_KEY);
  } catch {
    return null;
  }
}

export function setDuplicateDate(dateValue) {
  try {
    if (!dateValue) return;
    localStorage.setItem(DUPLICATE_DATE_KEY, dateValue);
  } catch {
    // Ignore storage failures.
  }
}

export function getNumberFormat() {
  const cached = getUserSettingsCache();
  return cached.number_format || "dot";
}

export function setNumberFormat(value) {
  if (value !== "dot" && value !== "comma") return;
  const cached = getUserSettingsCache();
  setUserSettingsCache({ ...cached, number_format: value });
  persistUserSettings({ number_format: value });
}

export function getMainCurrency() {
  const cached = getUserSettingsCache();
  return cached.main_currency || null;
}

export function setMainCurrency(value) {
  if (!value) return;
  const cached = getUserSettingsCache();
  setUserSettingsCache({ ...cached, main_currency: value });
  persistUserSettings({ main_currency: value });
}

export function getFxRatesKey(baseCurrency) {
  return `${FX_RATES_KEY_PREFIX}_${baseCurrency || "EUR"}`;
}

export function readFxRates(baseCurrency) {
  try {
    const raw = localStorage.getItem(getFxRatesKey(baseCurrency));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeFxRates(baseCurrency, payload) {
  try {
    localStorage.setItem(getFxRatesKey(baseCurrency), JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

export function getFxProvider() {
  const cached = getUserSettingsCache();
  return cached.fx_provider || "exchangerate.host";
}

export function setFxProvider(value) {
  if (!value) return;
  const cached = getUserSettingsCache();
  setUserSettingsCache({ ...cached, fx_provider: value });
  persistUserSettings({ fx_provider: value });
}

export function formatAmount(value, decimals = 2) {
  const format = getNumberFormat();
  const locale = format === "dot" ? "de-DE" : "en-US";
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function formatPercent(value, decimals = 1) {
  const format = getNumberFormat();
  const locale = format === "dot" ? "de-DE" : "en-US";
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function formatNumber(value, maxDecimals = 1) {
  const format = getNumberFormat();
  const locale = format === "dot" ? "de-DE" : "en-US";
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(safe);
}

export function formatCurrency(value, currency = "EUR", decimals = 2) {
  const format = getNumberFormat();
  const locale = format === "dot" ? "de-DE" : "en-US";
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(safe);
  } catch {
    return `${currency} ${formatAmount(safe, decimals)}`;
  }
}

export function getCurrencySymbol(currency = "EUR") {
  const format = getNumberFormat();
  const locale = format === "dot" ? "de-DE" : "en-US";
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const currencyPart = parts.find((p) => p.type === "currency");
    return currencyPart?.value || currency;
  } catch {
    return currency;
  }
}

export function getAccountsOrder() {
  const cached = getUserSettingsCache();
  return Array.isArray(cached.accounts_order)
    ? cached.accounts_order.map((id) => String(id))
    : [];
}

export function setAccountsOrder(order) {
  if (!Array.isArray(order)) return;
  const normalized = order.map((id) => String(id));
  const cached = getUserSettingsCache();
  setUserSettingsCache({ ...cached, accounts_order: normalized });
  persistUserSettings({ accounts_order: normalized });
}

export function sortAccountsByOrder(accounts) {
  const order = getAccountsOrder();
  if (!order.length) return accounts;
  const byId = new Map(accounts.map((acc) => [String(acc.id), acc]));
  const ordered = order.map((id) => byId.get(String(id))).filter(Boolean);
  const remaining = accounts.filter((acc) => !order.includes(String(acc.id)));
  return [...ordered, ...remaining];
}

const STARTING_BALANCE_DATE = "1970-01-01";
const STARTING_BALANCE_CATEGORY = "SYSTEM - Starting Balance";
const STARTING_BALANCE_CATEGORIES = new Set([
  "starting balance",
  "system - starting balance",
]);
const startingBalanceApplied = new Map();
let ensureStartingBalanceInFlight = null;
let startingBalanceSyncEnabled = true;

export function setStartingBalanceSyncEnabled(enabled) {
  startingBalanceSyncEnabled = enabled;
}

export async function ensureStartingBalanceTransactions(accounts = [], queryClient) {
  if (!accounts.length) return;
  if (!startingBalanceSyncEnabled) return;
  if (ensureStartingBalanceInFlight) {
    await ensureStartingBalanceInFlight;
    return;
  }

  ensureStartingBalanceInFlight = (async () => {
    const [incomeList, expenseList] = await Promise.all([
      base44.entities.Income.list(),
      base44.entities.Expense.list(),
    ]);

    let mutated = false;

    for (const acc of accounts) {
      const amount = Number(acc.starting_balance) || 0;
      const absAmount = Math.abs(amount);
      const desiredType = amount > 0 ? "income" : "expense";

      const isStarting = (t) =>
        STARTING_BALANCE_CATEGORIES.has((t.category || "").trim().toLowerCase());

      const incomeMatches = incomeList.filter(
        (t) =>
          t.account_id === acc.id &&
          isStarting(t)
      );
      const expenseMatches = expenseList.filter(
        (t) =>
          t.account_id === acc.id &&
          isStarting(t)
      );

      if (absAmount === 0) {
        for (const item of incomeMatches) {
          await base44.entities.Income.delete(item.id);
        }
        for (const item of expenseMatches) {
          await base44.entities.Expense.delete(item.id);
        }
        if (incomeMatches.length || expenseMatches.length) {
          mutated = true;
        }
        startingBalanceApplied.set(acc.id, amount);
        continue;
      }

      const keepList = desiredType === "income" ? incomeMatches : expenseMatches;
      const removeList = desiredType === "income" ? expenseMatches : incomeMatches;

      const keep = keepList[0];
      const hasDuplicates = keepList.length > 1 || removeList.length > 0;
      const needsUpdate =
        !keep ||
        Number(keep.amount) !== absAmount ||
        keep.date !== STARTING_BALANCE_DATE ||
        keep.cleared !== true ||
        keep.projected !== true ||
        (keep.category || "") !== STARTING_BALANCE_CATEGORY;

      const lastApplied = startingBalanceApplied.get(acc.id);
      const shouldRun = hasDuplicates || needsUpdate || lastApplied !== amount;

      if (!shouldRun) {
        continue;
      }

      for (const item of removeList) {
        if (desiredType === "income") {
          await base44.entities.Expense.delete(item.id);
        } else {
          await base44.entities.Income.delete(item.id);
        }
        mutated = true;
      }

      if (keep) {
        if (desiredType === "income") {
          await base44.entities.Income.update(keep.id, {
            amount: absAmount,
            category: STARTING_BALANCE_CATEGORY,
            date: STARTING_BALANCE_DATE,
            cleared: true,
            projected: true,
          });
        } else {
          await base44.entities.Expense.update(keep.id, {
            amount: absAmount,
            category: STARTING_BALANCE_CATEGORY,
            date: STARTING_BALANCE_DATE,
            cleared: true,
            projected: true,
          });
        }
        if (keepList.length > 1) {
          for (const extra of keepList.slice(1)) {
            if (desiredType === "income") {
              await base44.entities.Income.delete(extra.id);
            } else {
              await base44.entities.Expense.delete(extra.id);
            }
          }
        }
        mutated = true;
      } else {
        if (desiredType === "income") {
          await base44.entities.Income.create({
            amount: absAmount,
            category: STARTING_BALANCE_CATEGORY,
            account_id: acc.id,
            date: STARTING_BALANCE_DATE,
            notes: "starting balance",
            cleared: true,
            projected: true,
          });
        } else {
          await base44.entities.Expense.create({
            amount: absAmount,
            category: STARTING_BALANCE_CATEGORY,
            account_id: acc.id,
            date: STARTING_BALANCE_DATE,
            notes: "starting balance",
            cleared: true,
            projected: true,
          });
        }
        mutated = true;
      }

      startingBalanceApplied.set(acc.id, amount);
    }

    if (mutated && queryClient) {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    }
  })();

  try {
    await ensureStartingBalanceInFlight;
  } finally {
    ensureStartingBalanceInFlight = null;
  }
}
