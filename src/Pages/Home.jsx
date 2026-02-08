import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  subYears,
  format,
  parseISO,
} from 'date-fns';
import NetWorthCard from '../Components/dashboard/NetWorthCard';
import RecentTransactions from '../Components/dashboard/RecentTransactions';
import FloatingAddButton from '../Components/transactions/FloatingAddButton';
import { ensureStartingBalanceTransactions, useSessionState, getMainCurrency, readFxRates } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatAmount, formatCurrency } from '@/utils';
import { Edit, Copy, Trash2 } from 'lucide-react';
import EditTransactionModal from '../Components/transactions/EditTransactionModal';
import EditTransferModal from '../Components/transactions/EditTransferModal';
import DuplicateTransactionModal from '../Components/transactions/DuplicateTransactionModal';

export default function Home() {
  const queryClient = useQueryClient();
  const [dayKey, setDayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedPeriod, setSelectedPeriod] = useSessionState('home.selectedPeriod', 'last30');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState(null);
  const [duplicatingType, setDuplicatingType] = useState(null);
  const [searchFilters, setSearchFilters] = useSessionState('home.searchFilters', {
    query: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
  });
  const [searchAppliedFilters, setSearchAppliedFilters] = useState(searchFilters);

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date'),
  });

  const { data: income = [], isLoading: loadingIncome } = useQuery({
    queryKey: ['income'],
    queryFn: () => base44.entities.Income.list('-date'),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => base44.entities.Transfer.list('-date'),
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('-created_at'),
  });

  useEffect(() => {
    ensureStartingBalanceTransactions(accounts, queryClient);
  }, [accounts, queryClient]);

  const getAccountCurrency = (accountId) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.currency || 'EUR';
  };

  useEffect(() => {
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0);
      const timeout = next.getTime() - now.getTime();
      const id = setTimeout(() => {
        setDayKey(format(new Date(), 'yyyy-MM-dd'));
        scheduleNext();
      }, timeout);
      return () => clearTimeout(id);
    };
    return scheduleNext();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const nextKey = format(new Date(), 'yyyy-MM-dd');
      setDayKey((prev) => (prev === nextKey ? prev : nextKey));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: (id) => base44.entities.Income.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Income deleted');
    },
  });

  const deleteTransferMutation = useMutation({
    mutationFn: (id) => base44.entities.Transfer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast.success('Transfer deleted');
    },
  });

  const pendingDeletesRef = useRef(new Map());

  const undoDelete = (key) => {
    const pending = pendingDeletesRef.current.get(key);
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    queryClient.setQueryData(pending.queryKey, pending.previous);
    pendingDeletesRef.current.delete(key);
    toast.success('Deletion undone');
  };

  const scheduleDelete = (id, type) => {
    const typeKey = type === 'income' ? 'income' : type === 'transfer' ? 'transfers' : 'expenses';
    const queryKey = [typeKey];
    const previous = queryClient.getQueryData(queryKey) || [];
    const item = previous.find((t) => t.id === id);
    if (!item) {
      if (type === 'income') deleteIncomeMutation.mutate(id);
      else if (type === 'transfer') deleteTransferMutation.mutate(id);
      else deleteExpenseMutation.mutate(id);
      return;
    }
    const key = `${type}:${id}`;
    if (pendingDeletesRef.current.has(key)) return;
    queryClient.setQueryData(queryKey, previous.filter((t) => t.id !== id));
    const timeoutId = setTimeout(() => {
      pendingDeletesRef.current.delete(key);
      if (type === 'income') deleteIncomeMutation.mutate(id);
      else if (type === 'transfer') deleteTransferMutation.mutate(id);
      else deleteExpenseMutation.mutate(id);
    }, 8000);
    pendingDeletesRef.current.set(key, { previous, queryKey, timeoutId });
    toast.success('Transaction deleted', {
      action: {
        label: 'Undo',
        onClick: () => undoDelete(key),
      },
    });
  };

  const handleDelete = (id, type) => {
    scheduleDelete(id, type);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
  };

  const getClampedPrevMonthDate = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const prevMonth = new Date(year, month - 1, 1);
    const daysInPrev = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
    const clamped = Math.min(day, daysInPrev);
    return new Date(prevMonth.getFullYear(), prevMonth.getMonth(), clamped);
  };

  const getClampedPrevYearDate = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const prevYearMonth = new Date(year - 1, month, 1);
    const daysInPrev = new Date(prevYearMonth.getFullYear(), prevYearMonth.getMonth() + 1, 0).getDate();
    const clamped = Math.min(day, daysInPrev);
    return new Date(prevYearMonth.getFullYear(), prevYearMonth.getMonth(), clamped);
  };

  const getPeriods = () => {
    const now = new Date();
    let reportStart;
    let reportEnd = endOfDay(now);
    let compareStart;
    let compareEnd;

    if (selectedPeriod === 'last30') {
      reportStart = startOfDay(subDays(now, 29));
      compareStart = startOfDay(subDays(now, 59));
      compareEnd = endOfDay(subDays(now, 30));
    } else if (selectedPeriod === 'last90') {
      reportStart = startOfDay(subDays(now, 89));
      compareStart = startOfDay(subDays(now, 179));
      compareEnd = endOfDay(subDays(now, 90));
    } else if (selectedPeriod === 'thisMonth') {
      reportStart = startOfMonth(now);
      const lastMonth = subMonths(now, 1);
      compareStart = startOfMonth(lastMonth);
      compareEnd = endOfDay(getClampedPrevMonthDate(now));
    } else if (selectedPeriod === 'thisYear') {
      reportStart = startOfYear(now);
      const lastYear = subYears(now, 1);
      compareStart = startOfYear(lastYear);
      compareEnd = endOfDay(getClampedPrevYearDate(now));
    }

    return { reportStart, reportEnd, compareStart, compareEnd };
  };

  const filterByRange = (items, startDate, endDate) => {
    return items.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });
  };

  const { reportStart, reportEnd, compareStart, compareEnd } = getPeriods();

  const filteredIncome = filterByRange(income, reportStart, reportEnd);
  const filteredExpenses = filterByRange(expenses, reportStart, reportEnd);
  const comparisonIncome = filterByRange(income, compareStart, compareEnd);
  const comparisonExpenses = filterByRange(expenses, compareStart, compareEnd);

  const today = useMemo(() => new Date(), [dayKey]);
  const mainCurrency = getMainCurrency() || 'EUR';
  const fxRates = readFxRates(mainCurrency);
  const netWorthEndDate = endOfDay(today);
  const accountCurrencyMap = useMemo(
    () => new Map(accounts.map((acc) => [acc.id, acc.currency || 'EUR'])),
    [accounts]
  );

  const convertToMain = (amount, currency) => {
    if (currency === mainCurrency) return amount;
    const rate = fxRates?.rates?.[currency];
    if (!rate) return null;
    return amount / rate;
  };

  const sumByAccountInRange = (items, startDate, endDate) => {
    const map = new Map();
    items.forEach((item) => {
      const itemDate = new Date(item.date);
      if (itemDate < startDate || itemDate > endDate) return;
      const current = map.get(item.account_id) || 0;
      map.set(item.account_id, current + (Number(item.amount) || 0));
    });
    return map;
  };

  const sumConvertedByAccount = (map) => {
    let total = 0;
    accounts.forEach((acc) => {
      const amount = map.get(acc.id) || 0;
      const currency = accountCurrencyMap.get(acc.id) || 'EUR';
      const converted = convertToMain(amount, currency);
      if (converted === null) return;
      total += converted;
    });
    return total;
  };

  const reportIncomeMap = sumByAccountInRange(income, reportStart, reportEnd);
  const reportExpenseMap = sumByAccountInRange(expenses, reportStart, reportEnd);
  const compareIncomeMap = sumByAccountInRange(income, compareStart, compareEnd);
  const compareExpenseMap = sumByAccountInRange(expenses, compareStart, compareEnd);

  const totalIncome = sumConvertedByAccount(reportIncomeMap);
  const totalExpenses = sumConvertedByAccount(reportExpenseMap);
  const comparisonIncomeTotal = sumConvertedByAccount(compareIncomeMap);
  const comparisonExpensesTotal = sumConvertedByAccount(compareExpenseMap);

  const incomeDelta = totalIncome - comparisonIncomeTotal;
  const expenseDelta = totalExpenses - comparisonExpensesTotal;
  const incomeDeltaPercent =
    comparisonIncomeTotal === 0
      ? (incomeDelta === 0 ? 0 : (incomeDelta > 0 ? Infinity : -Infinity))
      : (incomeDelta / Math.abs(comparisonIncomeTotal)) * 100;
  const expenseDeltaPercent =
    comparisonExpensesTotal === 0
      ? (expenseDelta === 0 ? 0 : (expenseDelta > 0 ? Infinity : -Infinity))
      : (expenseDelta / Math.abs(comparisonExpensesTotal)) * 100;

  const sumUntilDate = (items, endDate, inclusive = true) => {
    return items.reduce((sum, item) => {
      const itemDate = new Date(item.date);
      const isInRange = inclusive ? itemDate <= endDate : itemDate < endDate;
      if (!isInRange) return sum;
      return sum + (item.amount || 0);
    }, 0);
  };

  const computeAccountBalanceAt = (accountId, endDate) => {
    let balance = 0;
    income.forEach((t) => {
      if (t.account_id !== accountId) return;
      if (new Date(t.date) <= endDate) balance += Number(t.amount) || 0;
    });
    expenses.forEach((t) => {
      if (t.account_id !== accountId) return;
      if (new Date(t.date) <= endDate) balance -= Number(t.amount) || 0;
    });
    transfers.forEach((t) => {
      if (new Date(t.date) > endDate) return;
      const outAmount = Number(t.amount) || 0;
      const inAmount = Number(t.amount_to) || outAmount;
      if (t.from_account_id === accountId) balance -= outAmount;
      if (t.to_account_id === accountId) balance += inAmount;
    });
    return balance;
  };

  const computeNetWorthAt = (endDate) => {
    let total = 0;
    accounts.forEach((acc) => {
      const localBalance = computeAccountBalanceAt(acc.id, endDate);
      const currency = accountCurrencyMap.get(acc.id) || 'EUR';
      const converted = convertToMain(localBalance, currency);
      if (converted === null) return;
      total += converted;
    });
    return total;
  };

  const currentNetWorth = computeNetWorthAt(netWorthEndDate);

  const getPreviousNetWorth = () => {
    let compareDate;

    if (selectedPeriod === 'last30') {
      compareDate = subDays(today, 30);
    } else if (selectedPeriod === 'last90') {
      compareDate = subDays(today, 90);
    } else if (selectedPeriod === 'thisMonth') {
      compareDate = getClampedPrevMonthDate(today);
    } else if (selectedPeriod === 'thisYear') {
      compareDate = getClampedPrevYearDate(today);
    }

    return computeNetWorthAt(compareDate);
  };

  const previousNetWorth = getPreviousNetWorth();
  const netWorthDelta = currentNetWorth - previousNetWorth;
  const percentBase = Math.abs(previousNetWorth);
  const netWorthDeltaPercent =
    percentBase === 0
      ? (netWorthDelta === 0 ? 0 : (netWorthDelta > 0 ? Infinity : -Infinity))
      : (netWorthDelta / percentBase) * 100;

  const isSystemStarting = (t) => {
    const category = (t.category || '').trim().toLowerCase();
    return category === 'starting balance' || category === 'system - starting balance';
  };

  const goalsThisMonth = useMemo(() => {
    const monthKey = format(today, 'yyyy-MM');
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    return goals
      .filter((g) => g.start_month <= monthKey && g.end_month >= monthKey)
      .filter((g) => (g.currency || mainCurrency) === mainCurrency)
      .map((g) => {
        const goalCategory = (g.category || '').trim().toLowerCase();
        const spent = expenses
          .filter((e) => {
            const date = new Date(e.date);
            return (
              date >= monthStart &&
              date <= monthEnd &&
              (e.category || '').trim().toLowerCase() === goalCategory
            );
          })
          .reduce((sum, e) => sum + e.amount, 0);
        const progress = g.amount > 0 ? Math.min(100, (spent / g.amount) * 100) : 0;
        return {
          ...g,
          spent,
          progress,
        };
      });
  }, [goals, expenses, dayKey, mainCurrency]);

  const allTransactions = [
    ...expenses.map(e => ({ ...e, type: 'expense' })),
    ...income.map(i => ({ ...i, type: 'income' })),
    ...transfers.map(t => ({ ...t, type: 'transfer' }))
  ]
    .filter((t) => t.type === 'transfer' || !isSystemStarting(t))
    .filter((t) => t.projected !== true)
    .filter((t) => {
      if (!t.date) return false;
      const localDateKey = format(parseISO(t.date), 'yyyy-MM-dd');
      return localDateKey <= dayKey;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  useEffect(() => {
    if (!showSearch) return;
    setSearchAppliedFilters({
      query: '',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
    });
  }, [showSearch]);

  useEffect(() => {
    if (!showSearch) return;
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select?.();
    });
    return () => cancelAnimationFrame(id);
  }, [showSearch]);

  const hasSearchCriteria = Boolean(
    searchAppliedFilters.query.trim() ||
    searchAppliedFilters.dateFrom ||
    searchAppliedFilters.dateTo ||
    searchAppliedFilters.minAmount !== '' ||
    searchAppliedFilters.maxAmount !== ''
  );

  const allSearchTransactions = useMemo(() => {
    if (!showSearch) return [];
    return [
      ...expenses.map(e => ({ ...e, type: 'expense' })),
      ...income.map(i => ({ ...i, type: 'income' })),
      ...transfers.map(t => ({ ...t, type: 'transfer' }))
    ].filter((t) => t.type === 'transfer' || !isSystemStarting(t));
  }, [showSearch, expenses, income, transfers]);

  const filteredSearchTransactions = useMemo(() => {
    if (!hasSearchCriteria) return [];
    return allSearchTransactions.filter((t) => {
      if (searchAppliedFilters.query.trim()) {
        const q = searchAppliedFilters.query.trim().toLowerCase();
        const hay = `${t.category || ''} ${t.subcategory || ''} ${t.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (searchAppliedFilters.dateFrom && new Date(t.date) < new Date(searchAppliedFilters.dateFrom)) return false;
      if (searchAppliedFilters.dateTo && new Date(t.date) > new Date(searchAppliedFilters.dateTo)) return false;
      const amount = Number(t.amount) || 0;
      if (searchAppliedFilters.minAmount !== '' && amount < Number(searchAppliedFilters.minAmount)) return false;
      if (searchAppliedFilters.maxAmount !== '' && amount > Number(searchAppliedFilters.maxAmount)) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [hasSearchCriteria, allSearchTransactions, searchAppliedFilters]);

  const isLoading = loadingExpenses || loadingIncome;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2 tracking-tight">
                Financial Dashboard
              </h1>
              <p className="text-slate-500">Track your income and expenses</p>
            </div>
            <Button
              variant="outline"
              className="border-slate-300"
              onClick={() => setShowSearch(true)}
            >
              Search Transactions
            </Button>
          </div>
        </motion.div>

        <div className="space-y-6">
          <NetWorthCard 
            totalIncome={totalIncome} 
            totalExpenses={totalExpenses}
            currentNetWorth={currentNetWorth}
            previousNetWorth={previousNetWorth}
            netWorthDelta={netWorthDelta}
            netWorthDeltaPercent={netWorthDeltaPercent}
            incomeDelta={incomeDelta}
            incomeDeltaPercent={incomeDeltaPercent}
            expenseDelta={expenseDelta}
            expenseDeltaPercent={expenseDeltaPercent}
            period={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />

          <FloatingAddButton onSuccess={handleSuccess} />

          {goalsThisMonth.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Monthly Goals</h2>
                <p className="text-sm text-slate-500">{format(new Date(), 'MMMM yyyy')}</p>
              </div>
              <div className="space-y-4">
                {goalsThisMonth.map((goal) => {
                  const remaining = goal.amount - goal.spent;
                  const progressClass =
                    goal.progress >= 100 ? 'bg-red-500' : goal.progress >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-900">{goal.category}</span>
                        <span className="text-slate-600 tabular-nums">
                          €{formatAmount(goal.spent)} / €{formatAmount(goal.amount)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full ${progressClass}`}
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500">
                        {remaining >= 0
                          ? `€${formatAmount(remaining)} remaining`
                          : `€${formatAmount(Math.abs(remaining))} over goal`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <RecentTransactions 
            transactions={allTransactions}
            onDelete={handleDelete}
            onUpdate={handleSuccess}
          />
        </div>
      </div>
      <Dialog
        open={showSearch}
        onOpenChange={(open) => {
          setShowSearch(open);
          if (!open) {
            setSearchFilters({
              query: '',
              dateFrom: '',
              dateTo: '',
              minAmount: '',
              maxAmount: '',
            });
            setSearchAppliedFilters({
              query: '',
              dateFrom: '',
              dateTo: '',
              minAmount: '',
              maxAmount: '',
            });
          }
        }}
      >
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>Search Transactions</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 max-h-[70vh] overflow-auto pr-1"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchAppliedFilters(searchFilters);
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                ref={searchInputRef}
                placeholder="Search category, subcategory, notes..."
                value={searchFilters.query}
                onChange={(e) => setSearchFilters((prev) => ({ ...prev, query: e.target.value }))}
              />
              <div className="flex items-center justify-end gap-2 md:justify-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchFilters({
                      query: '',
                      dateFrom: '',
                      dateTo: '',
                      minAmount: '',
                      maxAmount: '',
                    });
                    setSearchAppliedFilters({
                      query: '',
                      dateFrom: '',
                      dateTo: '',
                      minAmount: '',
                      maxAmount: '',
                    });
                  }}
                >
                  Clear
                </Button>
                <Button type="submit">Search</Button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:col-span-2">
                <Input
                  type="date"
                  value={searchFilters.dateFrom}
                  onChange={(e) => setSearchFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                />
                <Input
                  type="date"
                  value={searchFilters.dateTo}
                  onChange={(e) => setSearchFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 md:col-span-2">
                <Input
                  type="number"
                  placeholder="Min amount"
                  value={searchFilters.minAmount}
                  onChange={(e) => setSearchFilters((prev) => ({ ...prev, minAmount: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Max amount"
                  value={searchFilters.maxAmount}
                  onChange={(e) => setSearchFilters((prev) => ({ ...prev, maxAmount: e.target.value }))}
                />
              </div>
            </div>

            <div className="text-sm text-slate-500">
              {hasSearchCriteria
                ? `${filteredSearchTransactions.length} transaction(s) found`
                : 'Set at least one filter, then click Search.'}
            </div>

            <div className="space-y-2">
              {hasSearchCriteria && filteredSearchTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {transaction.type === 'transfer' ? (
                        <>
                          <p className="font-medium text-slate-900">Transfer</p>
                          <span className="text-slate-300">•</span>
                          <p className="text-sm text-slate-500 truncate">
                            {accounts.find((a) => a.id === transaction.from_account_id)?.name || 'Unknown'} → {accounts.find((a) => a.id === transaction.to_account_id)?.name || 'Unknown'}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-slate-900 capitalize">
                            {transaction.category}
                          </p>
                          {transaction.subcategory && (
                            <>
                              <span className="text-slate-300">•</span>
                              <p className="text-sm text-slate-500 truncate">
                                {transaction.subcategory}
                              </p>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {format(new Date(transaction.date), 'MMM d, yyyy')}
                      {transaction.notes ? ` • ${transaction.notes}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">
                      {transaction.type === 'transfer'
                        ? accounts.find((a) => a.id === transaction.from_account_id)?.name || ''
                        : accounts.find((a) => a.id === transaction.account_id)?.name || ''}
                    </p>
                    <p className={`text-base font-bold tabular-nums ${
                      transaction.type === 'income'
                        ? 'text-green-600'
                        : transaction.type === 'transfer'
                        ? 'text-blue-600'
                        : 'text-red-600'
                    }`}>
                      {transaction.type === 'transfer' ? '' : transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(
                        transaction.amount,
                        getAccountCurrency(
                          transaction.type === 'transfer'
                            ? transaction.from_account_id
                            : transaction.account_id
                        )
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 bg-blue-50 text-blue-600 hover:bg-blue-100"
                      onClick={() => {
                        setEditingTransaction(transaction);
                        setEditingType(transaction.type);
                      }}
                    >
                      <Edit className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 bg-amber-50 text-amber-600 hover:bg-amber-100"
                      onClick={() => {
                        setDuplicatingTransaction(transaction);
                        setDuplicatingType(transaction.type);
                      }}
                    >
                      <Copy className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 bg-red-50 text-red-600 hover:bg-red-100"
                      onClick={() => handleDelete(transaction.id, transaction.type)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}
              {hasSearchCriteria && filteredSearchTransactions.length === 0 && (
                <p className="text-sm text-slate-400">No transactions match your filters.</p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {editingTransaction && editingType !== 'transfer' && (
        <EditTransactionModal
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          transaction={editingTransaction}
          type={editingType}
          onSuccess={handleSuccess}
        />
      )}

      {editingTransaction && editingType === 'transfer' && (
        <EditTransferModal
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          transfer={editingTransaction}
          onSuccess={handleSuccess}
        />
      )}

      {duplicatingTransaction && duplicatingType && (
        <DuplicateTransactionModal
          open={!!duplicatingTransaction}
          onOpenChange={(open) => {
            if (!open) {
              setDuplicatingTransaction(null);
              setDuplicatingType(null);
            }
          }}
          transaction={duplicatingTransaction}
          type={duplicatingType}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
