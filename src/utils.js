import { useEffect, useState } from "react";

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
  try {
    const stored = localStorage.getItem(NUMBER_FORMAT_KEY);
    if (stored === "dot" || stored === "comma") return stored;
    localStorage.setItem(NUMBER_FORMAT_KEY, "dot");
    return "dot";
  } catch {
    return "dot";
  }
}

export function setNumberFormat(value) {
  if (value !== "dot" && value !== "comma") return;
  try {
    localStorage.setItem(NUMBER_FORMAT_KEY, value);
  } catch {
    // Ignore storage failures.
  }
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

export function getAccountsOrder() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_ORDER_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setAccountsOrder(order) {
  if (!Array.isArray(order)) return;
  try {
    localStorage.setItem(ACCOUNTS_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Ignore storage failures.
  }
}

export function sortAccountsByOrder(accounts) {
  const order = getAccountsOrder();
  if (!order.length) return accounts;
  const byId = new Map(accounts.map((acc) => [acc.id, acc]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);
  const remaining = accounts.filter((acc) => !order.includes(acc.id));
  return [...ordered, ...remaining];
}
