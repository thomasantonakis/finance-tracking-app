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

const STARTING_BALANCE_DATE = "1970-01-01";
const STARTING_BALANCE_CATEGORY = "starting balance";
const startingBalanceApplied = new Map();

export async function ensureStartingBalanceTransactions(accounts = [], queryClient) {
  if (!accounts.length) return;
  const [incomeList, expenseList] = await Promise.all([
    base44.entities.Income.list(),
    base44.entities.Expense.list(),
  ]);

  let mutated = false;

  for (const acc of accounts) {
    const amount = Number(acc.starting_balance) || 0;
    const absAmount = Math.abs(amount);
    const desiredType = amount > 0 ? "income" : "expense";

    const incomeMatches = incomeList.filter(
      (t) =>
        t.account_id === acc.id &&
        (t.category || "").toLowerCase() === STARTING_BALANCE_CATEGORY
    );
    const expenseMatches = expenseList.filter(
      (t) =>
        t.account_id === acc.id &&
        (t.category || "").toLowerCase() === STARTING_BALANCE_CATEGORY
    );

    const keepList = desiredType === "income" ? incomeMatches : expenseMatches;
    const removeList = desiredType === "income" ? expenseMatches : incomeMatches;

    const keep = keepList[0];
    const hasDuplicates = keepList.length > 1 || removeList.length > 0;
    const needsUpdate =
      !keep ||
      Number(keep.amount) !== absAmount ||
      keep.date !== STARTING_BALANCE_DATE ||
      keep.cleared !== true ||
      keep.projected !== true;

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
          date: STARTING_BALANCE_DATE,
          cleared: true,
          projected: true,
        });
      } else {
        await base44.entities.Expense.update(keep.id, {
          amount: absAmount,
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
}
