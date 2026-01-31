import React, { useEffect, useState } from 'react';
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
} from 'date-fns';
import NetWorthCard from '../Components/dashboard/NetWorthCard';
import RecentTransactions from '../Components/dashboard/RecentTransactions';
import FloatingAddButton from '../Components/transactions/FloatingAddButton';
import { ensureStartingBalanceTransactions, useSessionState } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatAmount } from '@/utils';
import { Edit, Copy, Trash2 } from 'lucide-react';
import EditTransactionModal from '../Components/transactions/EditTransactionModal';
import EditTransferModal from '../Components/transactions/EditTransferModal';
import DuplicateTransactionModal from '../Components/transactions/DuplicateTransactionModal';

export default function Home() {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useSessionState('home.selectedPeriod', 'last30');
  const [showSearch, setShowSearch] = useState(false);
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

  const isSystemStarting = (t) =>
    (t.category || '').toLowerCase() === 'starting balance' ||
    (t.category || '').toLowerCase() === 'system - starting balance';

  const allTransactions = [
    ...expenses.map(e => ({ ...e, type: 'expense' })),
    ...income.map(i => ({ ...i, type: 'income' })),
    ...transfers.map(t => ({ ...t, type: 'transfer' }))
  ]
    .filter((t) => t.type === 'transfer' || !isSystemStarting(t))
    .filter((t) => t.projected !== true)
    .filter((t) => new Date(t.date) <= today)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const allSearchTransactions = [
    ...expenses.map(e => ({ ...e, type: 'expense' })),
    ...income.map(i => ({ ...i, type: 'income' })),
    ...transfers.map(t => ({ ...t, type: 'transfer' }))
  ]
    .filter((t) => t.type === 'transfer' || !isSystemStarting(t));

  const filteredSearchTransactions = allSearchTransactions.filter((t) => {
    if (searchFilters.query.trim()) {
      const q = searchFilters.query.trim().toLowerCase();
      const hay = `${t.category || ''} ${t.subcategory || ''} ${t.notes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (searchFilters.dateFrom && new Date(t.date) < new Date(searchFilters.dateFrom)) return false;
    if (searchFilters.dateTo && new Date(t.date) > new Date(searchFilters.dateTo)) return false;
    const amount = Number(t.amount) || 0;
    if (searchFilters.minAmount !== '' && amount < Number(searchFilters.minAmount)) return false;
    if (searchFilters.maxAmount !== '' && amount > Number(searchFilters.maxAmount)) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

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

          <RecentTransactions 
            transactions={allTransactions}
            onDelete={handleDelete}
            onUpdate={handleSuccess}
          />
        </div>
      </div>
      <Dialog open={showSearch} onOpenChange={setShowSearch}>
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>Search Transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Search category, subcategory, notes..."
                value={searchFilters.query}
                onChange={(e) => setSearchFilters((prev) => ({ ...prev, query: e.target.value }))}
              />
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
              {filteredSearchTransactions.length} transaction(s) found
            </div>

            <div className="space-y-2">
              {filteredSearchTransactions.map((transaction) => (
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
                      {transaction.type === 'transfer' ? '' : transaction.type === 'income' ? '+' : '-'}€{formatAmount(transaction.amount)}
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
              {filteredSearchTransactions.length === 0 && (
                <p className="text-sm text-slate-400">No transactions match your filters.</p>
              )}
            </div>
          </div>
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
