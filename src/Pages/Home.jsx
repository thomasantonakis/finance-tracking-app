import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subDays } from 'date-fns';
import NetWorthCard from '../Components/dashboard/NetWorthCard';
import CategoryBreakdown from '../Components/dashboard/CategoryBreakdown';
import RecentTransactions from '../Components/dashboard/RecentTransactions';
import FloatingAddButton from '../Components/transactions/FloatingAddButton';
import AccountsBreakdown from '../Components/dashboard/AccountsBreakdown';

export default function Home() {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState('last30');

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

  const filterByPeriod = (items) => {
    const now = new Date();
    let startDate, endDate;

    if (selectedPeriod === 'last30') {
      // Days 1-30 back
      startDate = subDays(now, 30);
      endDate = now;
    } else if (selectedPeriod === 'thisMonth') {
      // Month to date
      startDate = startOfMonth(now);
      endDate = now;
    } else if (selectedPeriod === 'lastMonth') {
      // Full previous month
      const lastMonth = subMonths(now, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
    } else if (selectedPeriod === 'thisYear') {
      // Year to date
      startDate = startOfYear(now);
      endDate = now;
    }

    return items.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });
  };

  const filteredIncome = filterByPeriod(income);
  const filteredExpenses = filterByPeriod(expenses);

  const totalIncome = filteredIncome.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);

  const calculateNetWorthAtDate = (endDate) => {
    return accounts.reduce((sum, account) => {
      const accountIncome = income
        .filter(i => i.account_id === account.id && new Date(i.date) <= endDate && !i.projected)
        .reduce((s, i) => s + i.amount, 0);
      const accountExpenses = expenses
        .filter(e => e.account_id === account.id && new Date(e.date) <= endDate && !e.projected)
        .reduce((s, e) => s + e.amount, 0);
      const transfersOut = transfers
        .filter(t => t.from_account_id === account.id && new Date(t.date) <= endDate)
        .reduce((s, t) => s + t.amount, 0);
      const transfersIn = transfers
        .filter(t => t.to_account_id === account.id && new Date(t.date) <= endDate)
        .reduce((s, t) => s + t.amount, 0);
      return sum + account.starting_balance + accountIncome - accountExpenses - transfersOut + transfersIn;
    }, 0);
  };

  const currentNetWorth = calculateNetWorthAtDate(new Date());

  const getPreviousNetWorth = () => {
    const now = new Date();
    let compareDate;

    if (selectedPeriod === 'last30') {
      compareDate = subDays(now, 30);
    } else if (selectedPeriod === 'thisMonth') {
      const lastMonth = subMonths(now, 1);
      compareDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), now.getDate());
      if (compareDate > endOfMonth(lastMonth)) {
        compareDate = endOfMonth(lastMonth);
      }
    } else if (selectedPeriod === 'lastMonth') {
      const twoMonthsAgo = subMonths(now, 2);
      compareDate = endOfMonth(twoMonthsAgo);
    } else if (selectedPeriod === 'thisYear') {
      const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      compareDate = lastYear;
    }

    return calculateNetWorthAtDate(compareDate);
  };

  const previousNetWorth = getPreviousNetWorth();

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
    
    accountBalances[account.id] = account.starting_balance + accountIncome - accountExpenses - transfersOut + transfersIn;
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