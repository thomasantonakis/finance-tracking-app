import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfYear, endOfYear, eachMonthOfInterval, endOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ensureStartingBalanceTransactions, formatAmount, formatNumber, useSessionState } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Charts() {
  const [currentDate, setCurrentDate] = useSessionState('charts.currentDate', () => new Date());
  const [viewMode, setViewMode] = useSessionState('charts.viewMode', 'days'); // days, months, custom
  const [selectedAccount, setSelectedAccount] = useSessionState('charts.selectedAccount', 'all');
  const [chartType, setChartType] = useSessionState('charts.chartType', 'networth'); // networth, expense, income
  const [showCleared, setShowCleared] = useState(true);
  const [showProjected, setShowProjected] = useState(true);
  const [showCumulativeBars, setShowCumulativeBars] = useState(false);
  const [detailChartMode, setDetailChartMode] = useState('bars');
  const [pieModal, setPieModal] = useState({ open: false, type: 'expense' });
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedSubcategory, setExpandedSubcategory] = useState(null);
  const queryClient = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list(),
  });

  const { data: income = [] } = useQuery({
    queryKey: ['income'],
    queryFn: () => base44.entities.Income.list(),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => base44.entities.Transfer.list(),
  });

  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['ExpenseCategory'],
    queryFn: () => base44.entities.ExpenseCategory.list(),
  });

  const { data: incomeCategories = [] } = useQuery({
    queryKey: ['IncomeCategory'],
    queryFn: () => base44.entities.IncomeCategory.list(),
  });

  useEffect(() => {
    ensureStartingBalanceTransactions(accounts, queryClient);
  }, [accounts, queryClient]);

  const getCategoryColor = (categoryName, type) => {
    const categories = type === 'expense' ? expenseCategories : incomeCategories;
    const category = categories.find(c => c.name === categoryName);
    return category?.color || '#64748b';
  };

  const filterTransactions = (transactions) => {
    return transactions.filter(t => {
      const clearedMatch = showCleared || t.cleared !== false;
      const projectedMatch = showProjected || t.projected !== false;
      const isTransfer = t.from_account_id || t.to_account_id;
      const accountMatch = selectedAccount === 'all'
        ? true
        : isTransfer
          ? (t.from_account_id === selectedAccount || t.to_account_id === selectedAccount)
          : t.account_id === selectedAccount;
      return clearedMatch && projectedMatch && accountMatch;
    });
  };

  const filteredExpenses = filterTransactions(expenses);
  const filteredIncome = filterTransactions(income);
  const filteredTransfers = filterTransactions(transfers);

  const lineChartData = useMemo(() => {
    let periods = [];
    
    if (viewMode === 'days') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      periods = eachDayOfInterval({ start, end }).map(date => ({
        date,
        label: format(date, 'd'),
        fullLabel: format(date, 'MMM d')
      }));
    } else if (viewMode === 'months') {
      const start = startOfYear(currentDate);
      const end = endOfYear(currentDate);
      periods = eachMonthOfInterval({ start, end }).map(date => ({
        date,
        label: format(date, 'MMM'),
        fullLabel: format(date, 'MMMM yyyy')
      }));
    }

    const cumulativeBalance = 0;

    return periods.map((period, index) => {
      const periodEnd = viewMode === 'months' ? endOfMonth(period.date) : endOfDay(period.date);

      // Get all transactions up to and including this period
      const upToDateExpenses = filteredExpenses.filter(e => {
        const expenseDate = new Date(e.date);
        return expenseDate <= periodEnd;
      }).reduce((sum, e) => sum + e.amount, 0);

      const upToDateIncome = filteredIncome.filter(i => {
        const incomeDate = new Date(i.date);
        return incomeDate <= periodEnd;
      }).reduce((sum, i) => sum + i.amount, 0);

      const upToDateTransferNet = selectedAccount === 'all'
        ? 0
        : filteredTransfers.filter(t => {
            const transferDate = new Date(t.date);
            return transferDate <= periodEnd;
          }).reduce((sum, t) => {
            if (t.to_account_id === selectedAccount) return sum + t.amount;
            if (t.from_account_id === selectedAccount) return sum - t.amount;
            return sum;
          }, 0);

      // For period-specific data (for income/expense charts)
      const periodExpenses = filteredExpenses.filter(e => {
        const expenseDate = new Date(e.date);
        if (viewMode === 'days') {
          return format(expenseDate, 'yyyy-MM-dd') === format(period.date, 'yyyy-MM-dd');
        } else {
          return format(expenseDate, 'yyyy-MM') === format(period.date, 'yyyy-MM');
        }
      }).reduce((sum, e) => sum + e.amount, 0);

      const periodIncome = filteredIncome.filter(i => {
        const incomeDate = new Date(i.date);
        if (viewMode === 'days') {
          return format(incomeDate, 'yyyy-MM-dd') === format(period.date, 'yyyy-MM-dd');
        } else {
          return format(incomeDate, 'yyyy-MM') === format(period.date, 'yyyy-MM');
        }
      }).reduce((sum, i) => sum + i.amount, 0);

      // Calculate cumulative net worth (balance over time)
      const networth = cumulativeBalance + upToDateIncome - upToDateExpenses + upToDateTransferNet;

      return {
        name: period.label,
        fullName: period.fullLabel,
        income: periodIncome,
        expenses: periodExpenses,
        networth: networth
      };
    });
  }, [viewMode, currentDate, filteredExpenses, filteredIncome, filteredTransfers, accounts, selectedAccount]);

  const { periodStart, periodEnd } = useMemo(() => {
    if (viewMode === 'months') {
      return {
        periodStart: startOfYear(currentDate),
        periodEnd: endOfYear(currentDate),
      };
    }
    return {
      periodStart: startOfMonth(currentDate),
      periodEnd: endOfMonth(currentDate),
    };
  }, [viewMode, currentDate]);

  const expensesInPeriod = useMemo(() => {
    return filteredExpenses.filter((e) => {
      const d = new Date(e.date);
      return d >= periodStart && d <= periodEnd;
    });
  }, [filteredExpenses, periodStart, periodEnd]);

  const incomeInPeriod = useMemo(() => {
    return filteredIncome.filter((i) => {
      const d = new Date(i.date);
      return d >= periodStart && d <= periodEnd;
    });
  }, [filteredIncome, periodStart, periodEnd]);

  const barChartData = useMemo(() => {
    let cumIncome = 0;
    let cumExpenses = 0;
    return lineChartData.map((point) => {
      if (!showCumulativeBars) {
        return {
          ...point,
          income: point.income,
          expenses: point.expenses,
        };
      }
      cumIncome += point.income;
      cumExpenses += point.expenses;
      return {
        ...point,
        income: cumIncome,
        expenses: cumExpenses,
      };
    });
  }, [lineChartData, showCumulativeBars]);

  const expensePieData = useMemo(() => {
    const categoryTotals = {};
    expensesInPeriod.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1),
        rawName: name,
        value,
        color: getCategoryColor(name, 'expense')
      }))
      .sort((a, b) => b.value - a.value); // Sort descending by amount
  }, [expensesInPeriod, expenseCategories]);

  const incomePieData = useMemo(() => {
    const categoryTotals = {};
    incomeInPeriod.forEach(i => {
      categoryTotals[i.category] = (categoryTotals[i.category] || 0) + i.amount;
    });
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1),
        rawName: name,
        value,
        color: getCategoryColor(name, 'income')
      }))
      .sort((a, b) => b.value - a.value); // Sort descending by amount
  }, [incomeInPeriod, incomeCategories]);

  const totalExpenses = expensesInPeriod.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = incomeInPeriod.reduce((sum, i) => sum + i.amount, 0);

  const pieCategories = pieModal.type === 'expense' ? expensePieData : incomePieData;
  const pieTotal = pieModal.type === 'expense' ? totalExpenses : totalIncome;
  const pieTransactions = pieModal.type === 'expense' ? expensesInPeriod : incomeInPeriod;
  const selectedCategoryTransactions = expandedCategory
    ? pieTransactions.filter(
        (t) => (t.category || '').toLowerCase() === expandedCategory.toLowerCase()
      )
    : [];

  const subcategoryGroups = useMemo(() => {
    if (!expandedCategory) return [];
    const groups = {};
    selectedCategoryTransactions.forEach((t) => {
      const key = t.subcategory || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.entries(groups)
      .map(([name, items]) => ({
        name,
        total: items.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        items: items.sort((a, b) => new Date(b.date) - new Date(a.date)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [expandedCategory, selectedCategoryTransactions]);

  const navigatePeriod = (direction) => {
    if (viewMode === 'days') {
      const newDate = new Date(currentDate);
      newDate.setMonth(currentDate.getMonth() + direction);
      setCurrentDate(newDate);
    } else if (viewMode === 'months') {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() + direction);
      setCurrentDate(newDate);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-white rounded-2xl p-6 mb-6 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigatePeriod(-1)}
                  className="text-slate-600"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold text-slate-900">
                  {viewMode === 'days' ? format(currentDate, 'MMMM yyyy') : format(currentDate, 'yyyy')}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigatePeriod(1)}
                  className="text-slate-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" label="All Accounts">All Accounts</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id} label={account.name}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4 mb-6">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days in Month</SelectItem>
                  <SelectItem value="months">Months in Year</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-4 ml-auto">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showCleared}
                    onChange={(e) => setShowCleared(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-600">Cleared</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showProjected}
                    onChange={(e) => setShowProjected(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-600">Projected</span>
                </label>
              </div>
            </div>

            <div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatNumber(value, 1)} />
                  <Tooltip 
                    labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                    formatter={(value) => `€${formatAmount(value)}`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="networth" stroke="#10b981" strokeWidth={2} name="Net Worth" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

            <div className="bg-white rounded-2xl p-6 mb-6 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Income vs Expenses</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDetailChartMode((prev) => (prev === 'bars' ? 'line' : 'bars'))}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    detailChartMode === 'bars'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {detailChartMode === 'bars' ? 'Bars' : 'Lines'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCumulativeBars(!showCumulativeBars)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    showCumulativeBars
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {showCumulativeBars ? 'Cumulative' : 'Selective'}
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              {detailChartMode === 'bars' ? (
                <BarChart data={barChartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatNumber(value, 1)} />
                  <Tooltip
                    formatter={(value) => `€${formatAmount(value)}`}
                    labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                  />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" name="Income" />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                </BarChart>
              ) : (
                <LineChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatNumber(value, 1)} />
                  <Tooltip
                    formatter={(value) => `€${formatAmount(value)}`}
                    labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Expenses</h2>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-red-600 tabular-nums">€{formatAmount(totalExpenses)}</p>
              </div>
              {expensePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      startAngle={90}
                      endAngle={-270}
                      onClick={() => {
                        setPieModal({ open: true, type: 'expense' });
                        setExpandedCategory(null);
                        setExpandedSubcategory(null);
                      }}
                    >
                      {expensePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `€${formatAmount(value)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">No expenses data</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Income</h2>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-green-600 tabular-nums">€{formatAmount(totalIncome)}</p>
              </div>
              {incomePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={incomePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      startAngle={90}
                      endAngle={-270}
                      onClick={() => {
                        setPieModal({ open: true, type: 'income' });
                        setExpandedCategory(null);
                        setExpandedSubcategory(null);
                      }}
                    >
                      {incomePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `€${formatAmount(value)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">No income data</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      <Dialog open={pieModal.open} onOpenChange={(open) => !open && setPieModal({ open: false, type: pieModal.type })}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-300">
                  {pieModal.type === 'expense' ? 'Expenses' : 'Income'}
                </div>
                <DialogTitle className="text-xl font-semibold text-white">
                  {viewMode === 'days' ? format(currentDate, 'MMMM yyyy') : format(currentDate, 'yyyy')}
                </DialogTitle>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-300">Total</div>
                <div className="text-lg font-bold tabular-nums">
                  €{formatAmount(pieTotal || 0)}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-300">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
                pieModal.type === 'expense' ? 'bg-red-500/20 text-red-200' : 'bg-green-500/20 text-green-200'
              }`}>
                {pieModal.type === 'expense' ? 'Expense' : 'Income'}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {pieTransactions.length} transaction(s)
              </span>
              {expandedCategory && (
                <span className="rounded-full bg-white/10 px-3 py-1 capitalize">
                  {expandedCategory}
                </span>
              )}
            </div>
          </div>
          <div className="max-h-[70vh] overflow-auto p-5 space-y-4 bg-slate-50">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[1.6fr_0.7fr_0.6fr_1fr] gap-3 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div>Category</div>
                <div className="text-right">Amount</div>
                <div className="text-right">% Total</div>
                <div>Share</div>
              </div>
              <div className="divide-y divide-slate-100">
                {pieCategories.map((cat) => {
                  const percent = pieTotal ? (cat.value / pieTotal) * 100 : 0;
                  const isExpanded = expandedCategory === cat.rawName;
                  return (
                    <div key={cat.name}>
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedCategory(isExpanded ? null : cat.rawName);
                          setExpandedSubcategory(null);
                        }}
                        className={`w-full grid grid-cols-[1.6fr_0.7fr_0.6fr_1fr] gap-3 px-4 py-2 text-left text-sm ${
                          isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="font-medium text-slate-900 capitalize">{cat.name}</span>
                        </div>
                        <div className="text-right font-semibold text-slate-900 tabular-nums">
                          €{formatAmount(cat.value)}
                        </div>
                        <div className="text-right text-slate-500 tabular-nums">
                          {percent.toFixed(1)}%
                        </div>
                        <div className="flex items-center">
                          <div className="h-2 w-full rounded-full bg-slate-200">
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${percent}%`, backgroundColor: cat.color }}
                            />
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="bg-white px-4 pb-3">
                          {subcategoryGroups.length === 0 ? (
                            <p className="text-sm text-slate-400">No transactions.</p>
                          ) : (
                            <div className="space-y-2">
                              {subcategoryGroups.map((group) => {
                                const isSubExpanded = expandedSubcategory === group.name;
                                return (
                                  <div key={group.name} className="rounded-lg border border-slate-200">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedSubcategory(isSubExpanded ? null : group.name)
                                      }
                                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                                    >
                                      <span className="font-semibold text-slate-900">{group.name}</span>
                                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                                        €{formatAmount(group.total)}
                                      </span>
                                    </button>
                                    {isSubExpanded && (
                                      <div className="px-3 pb-2 space-y-1">
                                        {group.items.map((t) => (
                                          <div key={t.id} className="flex items-center justify-between text-sm text-slate-600">
                                            <div>
                                              {format(new Date(t.date), 'EEE, MMM d, yyyy')}
                                              {t.notes ? ` • ${t.notes}` : ''}
                                            </div>
                                            <div className="tabular-nums">€{formatAmount(t.amount)}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
