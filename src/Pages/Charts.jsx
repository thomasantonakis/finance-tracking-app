import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Charts() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('days'); // days, months, custom
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [chartType, setChartType] = useState('networth'); // networth, expense, income
  const [showCleared, setShowCleared] = useState(true);
  const [showProjected, setShowProjected] = useState(true);

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

  const getCategoryColor = (categoryName, type) => {
    const categories = type === 'expense' ? expenseCategories : incomeCategories;
    const category = categories.find(c => c.name === categoryName);
    return category?.color || '#64748b';
  };

  const filterTransactions = (transactions) => {
    return transactions.filter(t => {
      const clearedMatch = showCleared || !t.cleared;
      const projectedMatch = showProjected || !t.projected;
      const accountMatch = selectedAccount === 'all' || t.account_id === selectedAccount;
      return clearedMatch && projectedMatch && accountMatch;
    });
  };

  const filteredExpenses = filterTransactions(expenses);
  const filteredIncome = filterTransactions(income);

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

    // Calculate starting balance
    const selectedAcc = accounts.find(a => a.id === selectedAccount);
    let cumulativeBalance = selectedAccount === 'all' 
      ? accounts.reduce((sum, a) => sum + a.starting_balance, 0)
      : (selectedAcc?.starting_balance || 0);

    return periods.map((period, index) => {
      // Get all transactions up to and including this period
      const upToDateExpenses = filteredExpenses.filter(e => {
        const expenseDate = new Date(e.date);
        return expenseDate <= period.date;
      }).reduce((sum, e) => sum + e.amount, 0);

      const upToDateIncome = filteredIncome.filter(i => {
        const incomeDate = new Date(i.date);
        return incomeDate <= period.date;
      }).reduce((sum, i) => sum + i.amount, 0);

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
      const networth = cumulativeBalance + upToDateIncome - upToDateExpenses;

      return {
        name: period.label,
        fullName: period.fullLabel,
        income: periodIncome,
        expenses: periodExpenses,
        networth: networth
      };
    });
  }, [viewMode, currentDate, filteredExpenses, filteredIncome, accounts, selectedAccount]);

  const expensePieData = useMemo(() => {
    const categoryTotals = {};
    filteredExpenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1), 
        value,
        color: getCategoryColor(name, 'expense')
      }))
      .sort((a, b) => b.value - a.value); // Sort descending by amount
  }, [filteredExpenses, expenseCategories]);

  const incomePieData = useMemo(() => {
    const categoryTotals = {};
    filteredIncome.forEach(i => {
      categoryTotals[i.category] = (categoryTotals[i.category] || 0) + i.amount;
    });
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1), 
        value,
        color: getCategoryColor(name, 'income')
      }))
      .sort((a, b) => b.value - a.value); // Sort descending by amount
  }, [filteredIncome, incomeCategories]);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = filteredIncome.reduce((sum, i) => sum + i.amount, 0);

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
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4 mb-6">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-40">
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

            <Tabs value={chartType} onValueChange={setChartType} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="networth">Net Worth</TabsTrigger>
                <TabsTrigger value="expense">Expense</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
              </TabsList>

              <TabsContent value="networth">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                      formatter={(value) => `€${value.toFixed(2)}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="networth" stroke="#10b981" strokeWidth={2} name="Net Worth" />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="expense">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                      formatter={(value) => `€${value.toFixed(2)}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="income">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                      formatter={(value) => `€${value.toFixed(2)}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} name="Income" />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Expenses</h2>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-red-600 tabular-nums">€{totalExpenses.toFixed(2)}</p>
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
                    >
                      {expensePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">No expenses data</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Income</h2>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-green-600 tabular-nums">€{totalIncome.toFixed(2)}</p>
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
                    >
                      {incomePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">No income data</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
