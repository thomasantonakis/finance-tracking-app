import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NetWorthCard({
  totalIncome,
  totalExpenses,
  currentNetWorth,
  previousNetWorth,
  netWorthDelta,
  netWorthDeltaPercent,
  incomeDelta,
  incomeDeltaPercent,
  expenseDelta,
  expenseDeltaPercent,
  period,
  onPeriodChange,
}) {
  const periodChange = netWorthDelta ?? (currentNetWorth - previousNetWorth);
  const isPositive = periodChange > 0;
  const isNegative = periodChange < 0;
  const isNeutral = periodChange === 0;
  const absChange = Math.abs(periodChange);
  const percentChange = netWorthDeltaPercent ?? 0;
  const percentText = Number.isFinite(percentChange) ? Math.abs(percentChange).toFixed(1) : '∞';
  const deltaClass = isPositive ? "text-green-400" : isNegative ? "text-red-400" : "text-slate-400";
  const incomeDeltaValue = incomeDelta ?? 0;
  const expenseDeltaValue = expenseDelta ?? 0;
  const incomeDeltaText = Number.isFinite(incomeDeltaPercent) ? Math.abs(incomeDeltaPercent).toFixed(1) : '∞';
  const expenseDeltaText = Number.isFinite(expenseDeltaPercent) ? Math.abs(expenseDeltaPercent).toFixed(1) : '∞';
  const incomeDeltaClass = incomeDeltaValue > 0 ? "text-green-400" : incomeDeltaValue < 0 ? "text-red-400" : "text-slate-400";
  const expenseDeltaClass = expenseDeltaValue > 0 ? "text-red-400" : expenseDeltaValue < 0 ? "text-green-400" : "text-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-2xl"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-y-32 -translate-x-32" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-slate-300">Current Net Worth</p>
          <Select value={period} onValueChange={onPeriodChange}>
            <SelectTrigger variant="inverted" className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
          <SelectContent>
            <SelectItem value="last30">Last 30 days</SelectItem>
            <SelectItem value="last90">Last 90 days</SelectItem>
            <SelectItem value="thisMonth">This month</SelectItem>
            <SelectItem value="thisYear">This year</SelectItem>
          </SelectContent>
        </Select>
      </div>
        <div className="flex items-baseline gap-3 mb-6">
          <h1 className="text-5xl font-bold tracking-tight tabular-nums">
            €{currentNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
          {isPositive ? (
            <TrendingUp className="w-8 h-8 text-green-400" />
          ) : isNegative ? (
            <TrendingDown className="w-8 h-8 text-red-400" />
          ) : (
            <Minus className="w-8 h-8 text-slate-400" />
          )}
        </div>
        <div className="text-sm text-slate-300 mb-6">
          <span className={deltaClass}>
            {isPositive ? "+" : isNegative ? "-" : ""}€{absChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-slate-400"> · </span>
          <span className={deltaClass}>
            {isPositive ? "+" : isNegative ? "-" : ""}{percentText}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400">Income</p>
            <p className="text-xl font-semibold text-green-400 tabular-nums">
              +€{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={`text-xs tabular-nums ${incomeDeltaClass}`}>
              {incomeDeltaValue > 0 ? "+" : incomeDeltaValue < 0 ? "-" : ""}€{Math.abs(incomeDeltaValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {incomeDeltaValue > 0 ? "+" : incomeDeltaValue < 0 ? "-" : ""}{incomeDeltaText}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400">Expenses</p>
            <p className="text-xl font-semibold text-red-400 tabular-nums">
              -€{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={`text-xs tabular-nums ${expenseDeltaClass}`}>
              {expenseDeltaValue > 0 ? "+" : expenseDeltaValue < 0 ? "-" : ""}€{Math.abs(expenseDeltaValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {expenseDeltaValue > 0 ? "+" : expenseDeltaValue < 0 ? "-" : ""}{expenseDeltaText}%
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
