import React, { useEffect } from 'react';
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
} from 'date-fns';
import NetWorthCard from '../Components/dashboard/NetWorthCard';
import CategoryBreakdown from '../Components/dashboard/CategoryBreakdown';
import RecentTransactions from '../Components/dashboard/RecentTransactions';
import FloatingAddButton from '../Components/transactions/FloatingAddButton';
import AccountsBreakdown from '../Components/dashboard/AccountsBreakdown';
import { ensureStartingBalanceTransactions, useSessionState } from '@/utils';

export default function Home() {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useSessionState('home.selectedPeriod', 'last30');

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

  useEffect(() => {
    ensureStartingBalanceTransactions(accounts, queryClient);
  }, [accounts, queryClient]);

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

  const handleDelete = (id, type) => {
    if (type === 'income') {
      deleteIncomeMutation.mutate(id);
    } else if (type === 'transfer') {
      deleteTransferMutation.mutate(id);
    } else {
      deleteExpenseMutation.mutate(id);
    }
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
  };

  const getPeriods = () => {
    const now = new Date();
    let reportStart;
    let reportEnd = endOfDay(now);
    let compareStart;
    let compareEnd;

    if (selectedPeriod === 'last30') {
      reportStart = startOfDay(subDays(now, 30));
      compareStart = startOfDay(subDays(now, 60));
      compareEnd = endOfDay(subDays(now, 31));
    } else if (selectedPeriod === 'last90') {
      reportStart = startOfDay(subDays(now, 90));
      compareStart = startOfDay(subDays(now, 180));
      compareEnd = endOfDay(subDays(now, 91));
    } else if (selectedPeriod === 'thisMonth') {
      reportStart = startOfMonth(now);
      reportEnd = endOfMonth(now);
      const lastMonth = subMonths(now, 1);
      compareStart = startOfMonth(lastMonth);
      compareEnd = endOfMonth(lastMonth);
    } else if (selectedPeriod === 'thisYear') {
      reportStart = startOfYear(now);
      reportEnd = endOfYear(now);
      const lastYear = subYears(now, 1);
      compareStart = startOfYear(lastYear);
      compareEnd = endOfYear(lastYear);
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

  const totalIncome = filteredIncome.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  const comparisonIncomeTotal = comparisonIncome.reduce((sum, item) => sum + (item.amount || 0), 0);
  const comparisonExpensesTotal = comparisonExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);

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

  const today = new Date();
  const netWorthEndDate =
    selectedPeriod === 'thisMonth'
      ? endOfMonth(today)
      : selectedPeriod === 'thisYear'
        ? endOfYear(today)
        : endOfDay(today);
  const currentNetWorth = sumUntilDate(income, netWorthEndDate, true) - sumUntilDate(expenses, netWorthEndDate, true);

  const getPreviousNetWorth = () => {
    let compareDate;
    let inclusive = true;

    if (selectedPeriod === 'last30') {
      compareDate = subDays(today, 30);
    } else if (selectedPeriod === 'last90') {
      compareDate = subDays(today, 90);
    } else if (selectedPeriod === 'thisMonth') {
      compareDate = startOfMonth(today);
      inclusive = false;
    } else if (selectedPeriod === 'thisYear') {
      compareDate = startOfYear(today);
      inclusive = false;
    }

    return sumUntilDate(income, compareDate, inclusive) - sumUntilDate(expenses, compareDate, inclusive);
  };

  const previousNetWorth = getPreviousNetWorth();
  const netWorthDelta = currentNetWorth - previousNetWorth;
  const percentBase = Math.abs(previousNetWorth);
  const netWorthDeltaPercent =
    percentBase === 0
      ? (netWorthDelta === 0 ? 0 : (netWorthDelta > 0 ? Infinity : -Infinity))
      : (netWorthDelta / percentBase) * 100;

  const accountBalances = {};
  accounts.forEach(account => {
    const accountIncome = income
      .filter(i => i.account_id === account.id)
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    
    const accountExpenses = expenses
      .filter(e => e.account_id === account.id)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const transfersOut = transfers
      .filter(t => t.from_account_id === account.id)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const transfersIn = transfers
      .filter(t => t.to_account_id === account.id)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    accountBalances[account.id] = accountIncome - accountExpenses - transfersOut + transfersIn;
  });

  const expensesByCategory = filteredExpenses.reduce((acc, expense) => {
    const cat = expense.category;
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += expense.amount || 0;
    return acc;
  }, {});

  const incomeByCategory = filteredIncome.reduce((acc, inc) => {
    const cat = inc.category;
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += inc.amount || 0;
    return acc;
  }, {});

  const expenseData = Object.entries(expensesByCategory)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const incomeData = Object.entries(incomeByCategory)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const allTransactions = [
    ...expenses.map(e => ({ ...e, type: 'expense' })),
    ...income.map(i => ({ ...i, type: 'income' })),
    ...transfers.map(t => ({ ...t, type: 'transfer' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  const isLoading = loadingExpenses || loadingIncome;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2 tracking-tight">
            Financial Dashboard
          </h1>
          <p className="text-slate-500">Track your income and expenses</p>
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

          <AccountsBreakdown 
            accounts={accounts}
            accountBalances={accountBalances}
          />

          <div className="grid lg:grid-cols-2 gap-6">
            <CategoryBreakdown 
              data={expenseData} 
              type="expense" 
              total={totalExpenses}
            />
            <CategoryBreakdown 
              data={incomeData} 
              type="income" 
              total={totalIncome}
            />
          </div>

          <RecentTransactions 
            transactions={allTransactions}
            onDelete={handleDelete}
            onUpdate={handleSuccess}
          />
        </div>
      </div>
    </div>
  );
}
