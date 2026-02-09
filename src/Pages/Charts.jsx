import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfYear, endOfYear, eachMonthOfInterval, endOfDay, addYears, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area, ComposedChart } from 'recharts';
import { ensureStartingBalanceTransactions, formatAmount, formatNumber, getNumberFormat, getMainCurrency, useSessionState } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Charts() {
  const [currentDate, setCurrentDate] = useSessionState('charts.currentDate', () => new Date());
  const [viewMode, setViewMode] = useSessionState('charts.viewMode', 'days'); // days, months, custom
  const [chartCurrency, setChartCurrency] = useSessionState(
    'charts.currency',
    getMainCurrency() || 'EUR'
  );
  const [selectedAccount, setSelectedAccount] = useSessionState('charts.selectedAccount', 'all');
  const [chartType, setChartType] = useSessionState('charts.chartType', 'networth'); // networth, expense, income
  const [showCleared, setShowCleared] = useState(true);
  const [showProjected, setShowProjected] = useState(true);
  const [showCumulativeBars, setShowCumulativeBars] = useState(false);
  const [detailChartMode, setDetailChartMode] = useState('bars');
  const [showCumulativeMonthlyCategories, setShowCumulativeMonthlyCategories] = useState(false);
  const [monthlyCategoryView, setMonthlyCategoryView] = useState('column');
  const [showCumulativeYearlyCategories, setShowCumulativeYearlyCategories] = useState(false);
  const [yearlyCategoryView, setYearlyCategoryView] = useState('column');
  const [yearRangeStart, setYearRangeStart] = useState('2015');
  const [yearRangeEnd, setYearRangeEnd] = useState(() => String(new Date().getFullYear() - 1));
  const [goalsPerformanceView, setGoalsPerformanceView] = useState('column');
  const [showCumulativeGoalsPerformance, setShowCumulativeGoalsPerformance] = useState(false);
  const [selectedGoalCategories, setSelectedGoalCategories] = useState([]);
  const [pieModal, setPieModal] = useState({ open: false, type: 'expense' });
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedSubcategories, setExpandedSubcategories] = useState([]);
  const chartCacheRef = useRef(new Map());
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

  const availableCurrencies = useMemo(() => {
    const codes = new Set(accounts.map((acc) => acc.currency || 'EUR'));
    const main = getMainCurrency();
    if (main) codes.add(main);
    if (codes.size === 0) codes.add('EUR');
    return Array.from(codes);
  }, [accounts]);

  useEffect(() => {
    if (!availableCurrencies.length) return;
    if (!availableCurrencies.includes(chartCurrency)) {
      setChartCurrency(availableCurrencies[0]);
    }
  }, [availableCurrencies, chartCurrency, setChartCurrency]);

  useEffect(() => {
    const syncMain = () => {
      const main = getMainCurrency();
      if (main && main !== chartCurrency) {
        setChartCurrency(main);
      }
    };
    const id = setInterval(syncMain, 1000);
    return () => clearInterval(id);
  }, [chartCurrency, setChartCurrency]);

  const accountCurrencyMap = useMemo(() => {
    return new Map(accounts.map((acc) => [acc.id, acc.currency || 'EUR']));
  }, [accounts]);

  const getAccountCurrency = (accountId) => accountCurrencyMap.get(accountId) || 'EUR';
  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('-created_at'),
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

  const lightenColor = (hex, amount = 0.35) => {
    if (!hex || typeof hex !== 'string') return '#cbd5f5';
    const cleaned = hex.replace('#', '');
    if (cleaned.length !== 6) return hex;
    const num = parseInt(cleaned, 16);
    const r = Math.min(255, Math.round(((num >> 16) & 0xff) * (1 - amount) + 255 * amount));
    const g = Math.min(255, Math.round(((num >> 8) & 0xff) * (1 - amount) + 255 * amount));
    const b = Math.min(255, Math.round((num & 0xff) * (1 - amount) + 255 * amount));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  const filterTransactions = (transactions) => {
    return transactions.filter(t => {
      const clearedMatch = showCleared || t.cleared !== false;
      const projectedMatch = showProjected || t.projected !== true;
      const isTransfer = t.from_account_id || t.to_account_id;
      const accountMatch = selectedAccount === 'all'
        ? true
        : isTransfer
          ? (t.from_account_id === selectedAccount || t.to_account_id === selectedAccount)
          : t.account_id === selectedAccount;
      const currencyMatch = isTransfer
        ? getAccountCurrency(t.from_account_id) === chartCurrency &&
          getAccountCurrency(t.to_account_id) === chartCurrency
        : getAccountCurrency(t.account_id) === chartCurrency;
      return clearedMatch && projectedMatch && accountMatch && currencyMatch;
    });
  };

  const formatDeltaPercent = (current, last) => {
    if (!last) return current === 0 ? '0.0%' : '∞%';
    return `${formatNumber((current / last - 1) * 100, 1)}%`;
  };

  const formatCompactNumber = (value) => {
    const num = Number(value) || 0;
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}${Math.round(abs / 1_000_000_000)}B`;
    if (abs >= 1_000_000) return `${sign}${Math.round(abs / 1_000_000)}M`;
    if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;
    return `${sign}${Math.round(abs)}`;
  };

  const filteredExpenses = filterTransactions(expenses);
  const filteredIncome = filterTransactions(income);
  const filteredTransfers = filterTransactions(transfers);

  const buildPeriods = (mode, targetDate) => {
    if (mode === 'days') {
      const start = startOfMonth(targetDate);
      const end = endOfMonth(targetDate);
      return eachDayOfInterval({ start, end }).map(date => ({
        date,
        label: format(date, 'd'),
        fullLabel: format(date, 'MMM d')
      }));
    }
    const start = startOfYear(targetDate);
    const end = endOfYear(targetDate);
    return eachMonthOfInterval({ start, end }).map(date => ({
      date,
      label: format(date, 'MMM'),
      fullLabel: format(date, 'MMMM yyyy')
    }));
  };

  const aggregateKey = (mode, date) => (mode === 'days' ? format(date, 'yyyy-MM-dd') : format(date, 'yyyy-MM'));

  const aggregates = useMemo(() => {
    const daily = new Map();
    const monthly = new Map();

    const addToMap = (map, key, data) => {
      const current = map.get(key) || {
        income: 0,
        expenses: 0,
        incomeImportant: 0,
        incomeOther: 0,
        expensesImportant: 0,
        expensesOther: 0,
        transferNet: 0,
      };
      map.set(key, {
        income: current.income + data.income,
        expenses: current.expenses + data.expenses,
        incomeImportant: current.incomeImportant + data.incomeImportant,
        incomeOther: current.incomeOther + data.incomeOther,
        expensesImportant: current.expensesImportant + data.expensesImportant,
        expensesOther: current.expensesOther + data.expensesOther,
        transferNet: current.transferNet + data.transferNet,
      });
    };

    filteredIncome.forEach((i) => {
      const date = new Date(i.date);
      const keyDay = format(date, 'yyyy-MM-dd');
      const keyMonth = format(date, 'yyyy-MM');
      const important = i.important === true;
      addToMap(daily, keyDay, {
        income: i.amount,
        expenses: 0,
        incomeImportant: important ? i.amount : 0,
        incomeOther: important ? 0 : i.amount,
        expensesImportant: 0,
        expensesOther: 0,
        transferNet: 0,
      });
      addToMap(monthly, keyMonth, {
        income: i.amount,
        expenses: 0,
        incomeImportant: important ? i.amount : 0,
        incomeOther: important ? 0 : i.amount,
        expensesImportant: 0,
        expensesOther: 0,
        transferNet: 0,
      });
    });

    filteredExpenses.forEach((e) => {
      const date = new Date(e.date);
      const keyDay = format(date, 'yyyy-MM-dd');
      const keyMonth = format(date, 'yyyy-MM');
      const important = e.important === true;
      addToMap(daily, keyDay, {
        income: 0,
        expenses: e.amount,
        incomeImportant: 0,
        incomeOther: 0,
        expensesImportant: important ? e.amount : 0,
        expensesOther: important ? 0 : e.amount,
        transferNet: 0,
      });
      addToMap(monthly, keyMonth, {
        income: 0,
        expenses: e.amount,
        incomeImportant: 0,
        incomeOther: 0,
        expensesImportant: important ? e.amount : 0,
        expensesOther: important ? 0 : e.amount,
        transferNet: 0,
      });
    });

    if (selectedAccount !== 'all') {
      filteredTransfers.forEach((t) => {
        const date = new Date(t.date);
        const keyDay = format(date, 'yyyy-MM-dd');
        const keyMonth = format(date, 'yyyy-MM');
        let net = 0;
        const outAmount = Number(t.amount) || 0;
        const inAmount = Number(t.amount_to) || outAmount;
        if (t.to_account_id === selectedAccount) net = inAmount;
        if (t.from_account_id === selectedAccount) net = -outAmount;
        if (net !== 0) {
          addToMap(daily, keyDay, {
            income: 0,
            expenses: 0,
            incomeImportant: 0,
            incomeOther: 0,
            expensesImportant: 0,
            expensesOther: 0,
            transferNet: net,
          });
          addToMap(monthly, keyMonth, {
            income: 0,
            expenses: 0,
            incomeImportant: 0,
            incomeOther: 0,
            expensesImportant: 0,
            expensesOther: 0,
            transferNet: net,
          });
        }
      });
    }

    const buildCumulativeMap = (map, mode) => {
      const entries = Array.from(map.entries()).sort((a, b) => {
        const aDate = new Date(mode === 'days' ? a[0] : `${a[0]}-01`);
        const bDate = new Date(mode === 'days' ? b[0] : `${b[0]}-01`);
        return aDate - bDate;
      });
      const cumulative = new Map();
      let cumIncome = 0;
      let cumExpenses = 0;
      let cumTransfer = 0;
      entries.forEach(([key, data]) => {
        cumIncome += data.income;
        cumExpenses += data.expenses;
        cumTransfer += data.transferNet;
        cumulative.set(key, cumIncome - cumExpenses + cumTransfer);
      });
      return cumulative;
    };

    const cumulativeDaily = buildCumulativeMap(daily, 'days');
    const cumulativeMonthly = buildCumulativeMap(monthly, 'months');

    return { daily, monthly, cumulativeDaily, cumulativeMonthly };
  }, [filteredIncome, filteredExpenses, filteredTransfers, selectedAccount]);

  const buildLineChartData = (mode, targetDate) => {
    const periods = buildPeriods(mode, targetDate);
    const map = mode === 'days' ? aggregates.daily : aggregates.monthly;
    const cumulativeOverall = mode === 'days' ? aggregates.cumulativeDaily : aggregates.cumulativeMonthly;

    let lastNetworth = 0;
    let lastNetworthLastYear = 0;
    return periods.map((period) => {
      const key = aggregateKey(mode, period.date);
      const data = map.get(key) || {
        income: 0,
        expenses: 0,
        incomeImportant: 0,
        incomeOther: 0,
        expensesImportant: 0,
        expensesOther: 0,
        transferNet: 0,
      };
      const networthFromMap = cumulativeOverall.get(key);
      const networth = networthFromMap !== undefined ? networthFromMap : lastNetworth;
      lastNetworth = networth;
      const lastKey = aggregateKey(mode, addYears(period.date, -1));
      const networthLastYearFromMap = cumulativeOverall.get(lastKey);
      const networthLastYear =
        networthLastYearFromMap !== undefined ? networthLastYearFromMap : lastNetworthLastYear;
      lastNetworthLastYear = networthLastYear;
      return {
        name: period.label,
        fullName: period.fullLabel,
        income: data.income,
        expenses: data.expenses,
        incomeImportant: data.incomeImportant,
        incomeOther: data.incomeOther,
        expensesImportant: data.expensesImportant,
        expensesOther: data.expensesOther,
        networth,
        networthLastYear,
      };
    });
  };

  const cacheKey = (mode, date) => {
    const period = mode === 'days' ? format(date, 'yyyy-MM') : format(date, 'yyyy');
    return `${mode}:${period}:${selectedAccount}:${showCleared ? '1' : '0'}:${showProjected ? '1' : '0'}`;
  };

  useEffect(() => {
    chartCacheRef.current.clear();
  }, [expenses, income, transfers, selectedAccount, showCleared, showProjected]);

  useEffect(() => {
    if (!filteredExpenses || !filteredIncome || !filteredTransfers) return;
    const monthsToCache = 3;
    for (let i = 0; i <= monthsToCache; i += 1) {
      const target = subMonths(currentDate, i);
      const key = cacheKey('days', target);
      if (!chartCacheRef.current.has(key)) {
        chartCacheRef.current.set(key, buildLineChartData('days', target));
      }
    }
    const currentYearKey = cacheKey('months', currentDate);
    if (!chartCacheRef.current.has(currentYearKey)) {
      chartCacheRef.current.set(currentYearKey, buildLineChartData('months', currentDate));
    }
    const prevYear = addYears(currentDate, -1);
    const prevYearKey = cacheKey('months', prevYear);
    if (!chartCacheRef.current.has(prevYearKey)) {
      chartCacheRef.current.set(prevYearKey, buildLineChartData('months', prevYear));
    }
  }, [currentDate, filteredExpenses, filteredIncome, filteredTransfers, selectedAccount, showCleared, showProjected]);

  const lineChartData = useMemo(() => {
    const key = cacheKey(viewMode, currentDate);
    const cached = chartCacheRef.current.get(key);
    if (cached) return cached;
    const computed = buildLineChartData(viewMode, currentDate);
    chartCacheRef.current.set(key, computed);
    return computed;
  }, [viewMode, currentDate, filteredExpenses, filteredIncome, filteredTransfers, selectedAccount, showCleared, showProjected]);

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

  const monthlyExpenseByCategory = useMemo(() => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    const monthLabels = months.map((date) => ({
      key: format(date, 'yyyy-MM'),
      label: format(date, 'MMM'),
      date,
    }));

    const totalsByCategory = {};
    const byMonthCategory = {};

    filteredExpenses.forEach((e) => {
      const d = new Date(e.date);
      if (d < yearStart || d > yearEnd) return;
      const monthKey = format(d, 'yyyy-MM');
      const cat = (e.category || '').trim();
      if (!cat) return;
      if (!byMonthCategory[monthKey]) byMonthCategory[monthKey] = {};
      byMonthCategory[monthKey][cat] = (byMonthCategory[monthKey][cat] || 0) + (e.amount || 0);
      totalsByCategory[cat] = (totalsByCategory[cat] || 0) + (e.amount || 0);
    });

    const sortedCategories = Object.entries(totalsByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const topLimit = 8;
    const topCategories = sortedCategories.slice(0, topLimit);
    const hasOther = sortedCategories.length > topLimit;

    let cumulative = {};
    const data = monthLabels.map((m) => {
      const row = { name: m.label };
      let otherTotal = 0;
      topCategories.forEach((cat) => {
        const value = byMonthCategory[m.key]?.[cat] || 0;
        if (showCumulativeMonthlyCategories) {
          cumulative[cat] = (cumulative[cat] || 0) + value;
          row[cat] = cumulative[cat];
        } else {
          row[cat] = value;
        }
      });
      if (hasOther) {
        sortedCategories.slice(topLimit).forEach((cat) => {
          otherTotal += byMonthCategory[m.key]?.[cat] || 0;
        });
        if (showCumulativeMonthlyCategories) {
          cumulative.Other = (cumulative.Other || 0) + otherTotal;
          row.Other = cumulative.Other;
        } else {
          row.Other = otherTotal;
        }
      }
      return row;
    });

    return { data, categories: topCategories, hasOther };
  }, [filteredExpenses, currentDate, showCumulativeMonthlyCategories]);

  const yearlyExpenseByCategory = useMemo(() => {
    const startYear = Number(yearRangeStart);
    const endYear = Number(yearRangeEnd);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) {
      return { data: [], categories: [], hasOther: false };
    }
    const years = [];
    for (let y = startYear; y <= endYear; y += 1) {
      years.push({ key: String(y), label: String(y) });
    }

    const totalsByCategory = {};
    const byYearCategory = {};

    filteredExpenses.forEach((e) => {
      const d = new Date(e.date);
      const y = String(d.getFullYear());
      if (Number(y) < startYear || Number(y) > endYear) return;
      const cat = (e.category || '').trim();
      if (!cat) return;
      if (!byYearCategory[y]) byYearCategory[y] = {};
      byYearCategory[y][cat] = (byYearCategory[y][cat] || 0) + (e.amount || 0);
      totalsByCategory[cat] = (totalsByCategory[cat] || 0) + (e.amount || 0);
    });

    const sortedCategories = Object.entries(totalsByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const topLimit = 8;
    const topCategories = sortedCategories.slice(0, topLimit);
    const hasOther = sortedCategories.length > topLimit;

    let cumulative = {};
    const data = years.map((y) => {
      const row = { name: y.label };
      let otherTotal = 0;
      topCategories.forEach((cat) => {
        const value = byYearCategory[y.key]?.[cat] || 0;
        if (showCumulativeYearlyCategories) {
          cumulative[cat] = (cumulative[cat] || 0) + value;
          row[cat] = cumulative[cat];
        } else {
          row[cat] = value;
        }
      });
      if (hasOther) {
        sortedCategories.slice(topLimit).forEach((cat) => {
          otherTotal += byYearCategory[y.key]?.[cat] || 0;
        });
        if (showCumulativeYearlyCategories) {
          cumulative.Other = (cumulative.Other || 0) + otherTotal;
          row.Other = cumulative.Other;
        } else {
          row.Other = otherTotal;
        }
      }
      return row;
    });

    return { data, categories: topCategories, hasOther };
  }, [filteredExpenses, yearRangeStart, yearRangeEnd, showCumulativeYearlyCategories]);

  const yearlyCategoryLegend = useMemo(() => {
    const items = [
      ...yearlyExpenseByCategory.categories.map((cat) => ({
        key: cat,
        name: cat,
        color: getCategoryColor(cat, 'expense'),
      })),
    ];
    if (yearlyExpenseByCategory.hasOther) {
      items.push({ key: 'Other', name: 'Other', color: '#cbd5f5' });
    }
    return items;
  }, [yearlyExpenseByCategory, getCategoryColor]);

  const goalsCategoryOptions = useMemo(() => {
    if (viewMode !== 'months') return [];
    const yearKey = format(currentDate, 'yyyy');
    const activeGoals = goals.filter((g) => {
      const start = `${g.start_month}-01`;
      const end = `${g.end_month}-31`;
      const currencyMatch = (g.currency || chartCurrency) === chartCurrency;
      return end >= `${yearKey}-01-01` && start <= `${yearKey}-12-31` && currencyMatch;
    });
    return Array.from(
      new Set(activeGoals.map((g) => (g.category || '').trim()).filter(Boolean))
    );
  }, [goals, currentDate, viewMode, chartCurrency]);

  const goalsPerformanceData = useMemo(() => {
    if (viewMode !== 'months') return { data: [], categories: [] };
    const yearKey = format(currentDate, 'yyyy');
    const monthLabels = eachMonthOfInterval({
      start: startOfYear(currentDate),
      end: endOfYear(currentDate),
    }).map((date) => ({
      key: format(date, 'yyyy-MM'),
      label: format(date, 'MMM'),
      date,
    }));

    const activeGoals = goals.filter((g) => {
      const start = `${g.start_month}-01`;
      const end = `${g.end_month}-31`;
      const currencyMatch = (g.currency || chartCurrency) === chartCurrency;
      return end >= `${yearKey}-01-01` && start <= `${yearKey}-12-31` && currencyMatch;
    });
    const categories = goalsCategoryOptions;
    const activeCategories =
      selectedGoalCategories.length > 0
        ? categories.filter((cat) => selectedGoalCategories.includes(cat))
        : categories;

    if (activeCategories.length === 0) return { data: [], categories: [] };

    const goalByCategory = {};
    activeCategories.forEach((cat) => {
      const goalsForCat = activeGoals.filter((g) => (g.category || '').trim() === cat);
      goalByCategory[cat] = goalsForCat.reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
    });

    const monthlyActual = {};
    filteredExpenses.forEach((e) => {
      const date = new Date(e.date);
      const monthKey = format(date, 'yyyy-MM');
      const cat = (e.category || '').trim();
      if (!activeCategories.includes(cat)) return;
      const dateKey = format(date, 'yyyy-MM-dd');
      if (dateKey < `${yearKey}-01-01` || dateKey > `${yearKey}-12-31`) return;
      if (!monthlyActual[monthKey]) monthlyActual[monthKey] = {};
      monthlyActual[monthKey][cat] =
        (monthlyActual[monthKey][cat] || 0) + (Number(e.amount) || 0);
    });

    const cumulativeActual = {};
    const cumulativeGoal = {};
    const data = monthLabels.map((m) => {
      const row = { name: m.label, actual_total: 0, goal_total: 0 };
      activeCategories.forEach((cat) => {
        const goal = goalByCategory[cat] || 0;
        const actual = monthlyActual[m.key]?.[cat] || 0;
        if (showCumulativeGoalsPerformance) {
          cumulativeActual[cat] = (cumulativeActual[cat] || 0) + actual;
          cumulativeGoal[cat] = (cumulativeGoal[cat] || 0) + goal;
          row[`actual_${cat}`] = cumulativeActual[cat];
          row[`goal_${cat}`] = cumulativeGoal[cat];
          row.actual_total += cumulativeActual[cat];
          row.goal_total += cumulativeGoal[cat];
        } else {
          row[`actual_${cat}`] = actual;
          row[`goal_${cat}`] = goal;
          row.actual_total += actual;
          row.goal_total += goal;
        }
      });
      return row;
    });

    return { data, categories: activeCategories };
  }, [
    goals,
    filteredExpenses,
    currentDate,
    viewMode,
    showCumulativeGoalsPerformance,
    selectedGoalCategories,
    goalsCategoryOptions,
    chartCurrency,
  ]);

  useEffect(() => {
    if (goalsCategoryOptions.length === 0) {
      setSelectedGoalCategories([]);
      return;
    }
    setSelectedGoalCategories((prev) => {
      const filtered = prev.filter((c) => goalsCategoryOptions.includes(c));
      return filtered.length === 0 ? goalsCategoryOptions : filtered;
    });
  }, [goalsCategoryOptions]);

  const monthlyCategorySeries = useMemo(() => {
    const base = monthlyExpenseByCategory.categories.filter((cat) => cat !== 'Other');
    return monthlyExpenseByCategory.hasOther ? [...base, 'Other'] : base;
  }, [monthlyExpenseByCategory]);

  const monthlyCategoryLegend = useMemo(() => {
    return monthlyCategorySeries.map((key) => ({
      key,
      name: key,
      color: key === 'Other' ? '#cbd5f5' : getCategoryColor(key, 'expense'),
    }));
  }, [monthlyCategorySeries, getCategoryColor]);

  const monthlyCategorySeriesStack = useMemo(() => {
    const rest = monthlyCategorySeries.filter((cat) => cat !== 'Other');
    return monthlyCategorySeries.includes('Other') ? [...rest, 'Other'] : rest;
  }, [monthlyCategorySeries]);

  const incomeInPeriod = useMemo(() => {
    return filteredIncome.filter((i) => {
      const d = new Date(i.date);
      return d >= periodStart && d <= periodEnd;
    });
  }, [filteredIncome, periodStart, periodEnd]);

  const barChartData = useMemo(() => {
    let cumIncome = 0;
    let cumExpenses = 0;
    let cumIncomeImportant = 0;
    let cumIncomeOther = 0;
    let cumExpensesImportant = 0;
    let cumExpensesOther = 0;
    return lineChartData.map((point) => {
      if (!showCumulativeBars) {
        return {
          ...point,
          income: point.income,
          expenses: point.expenses,
          incomeImportant: point.incomeImportant,
          incomeOther: point.incomeOther,
          expensesImportant: point.expensesImportant,
          expensesOther: point.expensesOther,
        };
      }
      cumIncome += point.income;
      cumExpenses += point.expenses;
      cumIncomeImportant += point.incomeImportant;
      cumIncomeOther += point.incomeOther;
      cumExpensesImportant += point.expensesImportant;
      cumExpensesOther += point.expensesOther;
      return {
        ...point,
        income: cumIncome,
        expenses: cumExpenses,
        incomeImportant: cumIncomeImportant,
        incomeOther: cumIncomeOther,
        expensesImportant: cumExpensesImportant,
        expensesOther: cumExpensesOther,
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
          <div className="sticky top-0 z-30 -mx-4 px-4 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200/70 mb-6">
            <div className="flex items-center justify-between mb-3">
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

              <div className="flex items-center gap-3">
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
                <Select value={chartCurrency} onValueChange={setChartCurrency}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCurrencies.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days in Month</SelectItem>
                  <SelectItem value="months">Months in Year</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-3 ml-auto items-center">
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
                <span className="text-xs text-slate-400">Checked = include</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 mb-6 border border-slate-100">
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatNumber(value, 1)} />
                  <Tooltip
                    labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                    content={({ payload, label }) => {
                      if (!payload || payload.length === 0) return null;
                      const data = payload[0]?.payload;
                      if (!data) return null;
                      const current = Number(data.networth) || 0;
                      const lastYear = Number(data.networthLastYear) || 0;
                      const delta = current - lastYear;
                      const deltaPercent = formatDeltaPercent(current, lastYear);
                      const deltaClass = delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-700';
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
                          <div className="font-medium text-slate-900 mb-1">
                            {data.fullName || label}
                          </div>
                          <div className="text-slate-700">Net Worth: €{formatAmount(current)}</div>
                          <div className="text-slate-700">Net Worth Last Year: €{formatAmount(lastYear)}</div>
                          <div className={deltaClass}>Δ: €{formatAmount(delta)}</div>
                          <div className={deltaClass}>Δ%: {deltaPercent}</div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="networth" stroke="#10b981" strokeWidth={2} name="Net Worth" />
                  <Line type="monotone" dataKey="networthLastYear" stroke="#6ee7b7" strokeWidth={2} name="Net Worth Last Year" />
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
                    itemSorter={(item) => {
                      const order = {
                        incomeImportant: 0,
                        incomeOther: 1,
                        expensesImportant: 2,
                        expensesOther: 3,
                      };
                      return order[item.dataKey] ?? 99;
                    }}
                  />
                  <Bar dataKey="incomeImportant" stackId="income" fill="#10b981" name="Income (Regular)" />
                  <Bar dataKey="incomeOther" stackId="income" fill="#8ee3c2" name="Income (Extra)" />
                  <Bar dataKey="expensesImportant" stackId="expenses" fill="#ef4444" name="Expense (Need)" />
                  <Bar dataKey="expensesOther" stackId="expenses" fill="#f59f9f" name="Expense (Want)" />
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
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                </LineChart>
              )}
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 text-sm mt-2">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#10b981' }} />
                Income (Regular)
              </span>
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#8ee3c2' }} />
                Income (Extra)
              </span>
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                Expense (Need)
              </span>
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#f59f9f' }} />
                Expense (Want)
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Expenses</h2>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-red-600 tabular-nums">€{formatAmount(totalExpenses)}</p>
              </div>
              {expensePieData.length > 0 ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setPieModal({ open: true, type: 'expense' });
                    setExpandedCategory(null);
                    setExpandedSubcategories([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setPieModal({ open: true, type: 'expense' });
                      setExpandedCategory(null);
                      setExpandedSubcategories([]);
                    }
                  }}
                  className="cursor-pointer"
                >
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
                      <Tooltip formatter={(value) => `€${formatAmount(value)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setPieModal({ open: true, type: 'income' });
                    setExpandedCategory(null);
                    setExpandedSubcategories([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setPieModal({ open: true, type: 'income' });
                      setExpandedCategory(null);
                      setExpandedSubcategories([]);
                    }
                  }}
                  className="cursor-pointer"
                >
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
                      <Tooltip formatter={(value) => `€${formatAmount(value)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">No income data</p>
              )}
            </div>
          </div>

          {viewMode === 'months' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Monthly Expenses by Category</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{format(currentDate, 'yyyy')}</span>
                <button
                  type="button"
                  onClick={() => setMonthlyCategoryView((prev) => (prev === 'column' ? 'area' : 'column'))}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    monthlyCategoryView === 'column'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {monthlyCategoryView === 'column' ? 'Columns' : 'Area'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCumulativeMonthlyCategories((prev) => !prev)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    showCumulativeMonthlyCategories
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {showCumulativeMonthlyCategories ? 'Cumulative' : 'Selective'}
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              {monthlyCategoryView === 'column' ? (
                <BarChart
                  data={monthlyExpenseByCategory.data}
                  barCategoryGap="20%"
                  key={`monthly-bars-${format(currentDate, 'yyyy')}-${monthlyCategorySeries.join('|')}-${showCumulativeMonthlyCategories}`}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatNumber(value, 1)} />
                  <Tooltip
                    content={({ label, payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const items = monthlyCategoryLegend
                        .map((legend) => payload.find((p) => p.dataKey === legend.key))
                        .filter(Boolean);
                      return (
                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm">
                          <div className="text-slate-600">{label}</div>
                        {items.map((item) => (
                          <div key={item.dataKey} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-slate-600">
                              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
                              {item.name}
                            </span>
                            <span className="text-slate-800 tabular-nums">€{formatAmount(item.value, 0)}</span>
                          </div>
                        ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    content={() => (
                      <div className="flex flex-wrap justify-center gap-3 text-xs mt-2">
                        {monthlyCategoryLegend.map((item) => (
                          <span key={item.key} className="flex items-center gap-2 text-slate-600">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </span>
                        ))}
                      </div>
                    )}
                  />
                  {monthlyCategorySeriesStack.map((cat) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="expenses"
                      fill={cat === 'Other' ? '#cbd5f5' : getCategoryColor(cat, 'expense')}
                      name={cat}
                    />
                  ))}
                </BarChart>
              ) : (
                <AreaChart
                  data={monthlyExpenseByCategory.data}
                  key={`monthly-area-${format(currentDate, 'yyyy')}-${monthlyCategorySeries.join('|')}-${showCumulativeMonthlyCategories}`}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatNumber(value, 1)} />
                  <Tooltip
                    content={({ label, payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const items = monthlyCategoryLegend
                        .map((legend) => payload.find((p) => p.dataKey === legend.key))
                        .filter(Boolean);
                      return (
                        <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm">
                          <div className="text-slate-600">{label}</div>
                          {items.map((item) => (
                            <div key={item.dataKey} className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 text-slate-600">
                                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
                                {item.name}
                              </span>
                            <span className="text-slate-800 tabular-nums">€{formatAmount(item.value, 0)}</span>
                          </div>
                        ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    content={() => (
                      <div className="flex flex-wrap justify-center gap-3 text-xs mt-2">
                        {monthlyCategoryLegend.map((item) => (
                          <span key={item.key} className="flex items-center gap-2 text-slate-600">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </span>
                        ))}
                      </div>
                    )}
                  />
                  {monthlyCategorySeriesStack.map((cat) => (
                    <Area
                      key={cat}
                      dataKey={cat}
                      stackId="expenses"
                      stroke={cat === 'Other' ? '#cbd5f5' : getCategoryColor(cat, 'expense')}
                      fill={cat === 'Other' ? '#cbd5f5' : getCategoryColor(cat, 'expense')}
                      fillOpacity={cat === 'Other' ? 0.35 : 0.3}
                      type="monotone"
                      name={cat}
                    />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
            <p className="text-xs text-slate-500 mt-2">
              Showing top {monthlyExpenseByCategory.categories.length} categories
              {monthlyExpenseByCategory.hasOther ? ' + Other' : ''}.
            </p>
          </div>
          )}

          <div className="bg-white rounded-2xl p-6 border border-slate-100 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900">Yearly Expenses by Category</h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="2000"
                    max="2100"
                    className="w-24"
                    value={yearRangeStart}
                    onChange={(e) => setYearRangeStart(e.target.value)}
                  />
                  <span className="text-sm text-slate-500">to</span>
                  <Input
                    type="number"
                    min="2000"
                    max="2100"
                    className="w-24"
                    value={yearRangeEnd}
                    onChange={(e) => setYearRangeEnd(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setYearlyCategoryView((prev) => (prev === 'column' ? 'area' : 'column'))}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    yearlyCategoryView === 'column'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {yearlyCategoryView === 'column' ? 'Columns' : 'Area'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCumulativeYearlyCategories((prev) => !prev)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    showCumulativeYearlyCategories
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {showCumulativeYearlyCategories ? 'Cumulative' : 'Selective'}
                </button>
              </div>
            </div>
            {yearlyExpenseByCategory.data.length === 0 ? (
              <p className="text-sm text-slate-400">Pick a valid year range to display data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                {yearlyCategoryView === 'column' ? (
                  <BarChart data={yearlyExpenseByCategory.data} barCategoryGap="20%" stackOrder="reverse">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatCompactNumber(value)} />
                    <Tooltip
                      content={({ label, payload }) => {
                        if (!payload || payload.length === 0) return null;
                        const items = yearlyCategoryLegend
                          .map((legend) => payload.find((p) => p.dataKey === legend.key))
                          .filter(Boolean);
                        return (
                          <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm">
                            <div className="text-slate-600">{label}</div>
                            {items.map((item) => (
                              <div key={item.dataKey} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-slate-600">
                                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
                                  {item.name}
                                </span>
                                <span className="text-slate-800 tabular-nums">€{formatAmount(item.value, 0)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      content={() => (
                        <div className="flex flex-wrap justify-center gap-3 text-xs mt-2">
                          {yearlyCategoryLegend.map((item) => (
                            <span key={item.key} className="flex items-center gap-2 text-slate-600">
                              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                              {item.name}
                            </span>
                          ))}
                        </div>
                      )}
                    />
                    {yearlyExpenseByCategory.categories.map((cat) => (
                      <Bar
                        key={cat}
                        dataKey={cat}
                        stackId="expenses"
                        fill={getCategoryColor(cat, 'expense')}
                        name={cat}
                      />
                    ))}
                    {yearlyExpenseByCategory.hasOther && (
                      <Bar
                        dataKey="Other"
                        stackId="expenses"
                        fill="#cbd5f5"
                        name="Other"
                      />
                    )}
                  </BarChart>
                ) : (
                  <AreaChart data={yearlyExpenseByCategory.data} stackOrder="reverse">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatCompactNumber(value)} />
                    <Tooltip
                      content={({ label, payload }) => {
                        if (!payload || payload.length === 0) return null;
                        const items = yearlyCategoryLegend
                          .map((legend) => payload.find((p) => p.dataKey === legend.key))
                          .filter(Boolean);
                        return (
                          <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm">
                            <div className="text-slate-600">{label}</div>
                            {items.map((item) => (
                              <div key={item.dataKey} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-slate-600">
                                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
                                  {item.name}
                                </span>
                                <span className="text-slate-800 tabular-nums">€{formatAmount(item.value, 0)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      content={() => (
                        <div className="flex flex-wrap justify-center gap-3 text-xs mt-2">
                          {yearlyCategoryLegend.map((item) => (
                            <span key={item.key} className="flex items-center gap-2 text-slate-600">
                              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                              {item.name}
                            </span>
                          ))}
                        </div>
                      )}
                    />
                    {yearlyExpenseByCategory.categories.map((cat) => (
                      <Area
                        key={cat}
                        dataKey={cat}
                        stackId="expenses"
                        stroke={getCategoryColor(cat, 'expense')}
                        fill={getCategoryColor(cat, 'expense')}
                        fillOpacity={0.3}
                        type="monotone"
                        name={cat}
                      />
                    ))}
                    {yearlyExpenseByCategory.hasOther && (
                      <Area
                        dataKey="Other"
                        stackId="expenses"
                        stroke="#cbd5f5"
                        fill="#cbd5f5"
                        fillOpacity={0.35}
                        type="monotone"
                        name="Other"
                      />
                    )}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Showing top {yearlyExpenseByCategory.categories.length} categories
              {yearlyExpenseByCategory.hasOther ? ' + Other' : ''}.
            </p>
          </div>

          {viewMode === 'months' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900">Goals Performance (Monthly)</h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setGoalsPerformanceView((prev) => (prev === 'column' ? 'area' : 'column'))}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      goalsPerformanceView === 'column'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {goalsPerformanceView === 'column' ? 'Columns' : 'Area'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCumulativeGoalsPerformance((prev) => !prev)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      showCumulativeGoalsPerformance
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {showCumulativeGoalsPerformance ? 'Cumulative' : 'Selective'}
                  </button>
                </div>
              </div>
              {goalsCategoryOptions.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {goalsCategoryOptions.map((cat) => (
                    <label
                      key={cat}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                        selectedGoalCategories.includes(cat)
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={selectedGoalCategories.includes(cat)}
                        onChange={() =>
                          setSelectedGoalCategories((prev) => {
                            const next = prev.includes(cat)
                              ? prev.filter((c) => c !== cat)
                              : [...prev, cat];
                            return next.length === 0 ? goalsCategoryOptions : next;
                          })
                        }
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              )}
              {goalsPerformanceData.categories.length === 0 ? (
                <p className="text-sm text-slate-400">No goals for the selected year.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={goalsPerformanceData.data} barCategoryGap="20%" barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatNumber(value, 1)} />
                    <Tooltip
                      content={({ label, payload }) => {
                        if (!payload || payload.length === 0) return null;
                        return (
                          <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm">
                            <div className="text-slate-600">{label}</div>
                            {payload.map((item) => (
                              <div key={item.dataKey} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-slate-600">
                                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
                                  {item.name}
                                </span>
                                <span className="text-slate-800 tabular-nums">€{formatAmount(item.value, 0)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    {goalsPerformanceView === 'column' ? (
                      <>
                        {goalsPerformanceData.categories.map((cat) => (
                          <Bar
                            key={`actual_${cat}`}
                            dataKey={`actual_${cat}`}
                            stackId="actual"
                            fill={getCategoryColor(cat, 'expense')}
                            name={`${cat} actual`}
                          />
                        ))}
                        {goalsPerformanceData.categories.map((cat) => (
                          <Bar
                            key={`goal_${cat}`}
                            dataKey={`goal_${cat}`}
                            stackId="goal"
                            fill={lightenColor(getCategoryColor(cat, 'expense'), 0.45)}
                            name={`${cat} goal`}
                          />
                        ))}
                      </>
                    ) : (
                      <>
                        <Area
                          dataKey="actual_total"
                          stroke="#16a34a"
                          fill="#16a34a"
                          fillOpacity={0.15}
                          type="monotone"
                          name="Actuals"
                        />
                        <Area
                          dataKey="goal_total"
                          stroke="#ef4444"
                          fill="#ef4444"
                          fillOpacity={0.12}
                          type="monotone"
                          name="Goals"
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </motion.div>
      </div>
      <Dialog open={pieModal.open} onOpenChange={(open) => !open && setPieModal({ open: false, type: pieModal.type })}>
        <DialogContent
          className="max-w-4xl p-0 overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 10rem - env(safe-area-inset-bottom))' }}
        >
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
          <div
            className="overflow-auto p-5 pb-20 space-y-4 bg-slate-50"
            style={{ maxHeight: 'calc(100vh - 17rem - env(safe-area-inset-bottom))' }}
          >
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
                          setExpandedSubcategories([]);
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
                                const isSubExpanded = expandedSubcategories.includes(group.name);
                                return (
                                  <div key={group.name} className="rounded-lg border border-slate-200">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedSubcategories((prev) =>
                                          prev.includes(group.name)
                                            ? prev.filter((name) => name !== group.name)
                                            : [...prev, group.name]
                                        )
                                      }
                                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                                    >
                                      <span className="font-semibold text-slate-900">{group.name}</span>
                                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                                        €{formatAmount(group.total)}
                                      </span>
                                    </button>
                                    {isSubExpanded && (
                                      <div className="px-3 pb-2 space-y-1 max-h-48 overflow-auto">
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
