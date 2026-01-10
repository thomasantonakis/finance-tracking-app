import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NetWorthCard({ totalIncome, totalExpenses, currentNetWorth, previousNetWorth, period, onPeriodChange }) {
  const periodChange = currentNetWorth - previousNetWorth;
  const isPositive = periodChange >= 0;

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
            <SelectTrigger className="w-40 h-8 bg-white/10 border-white/20 text-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last30">Last 30 days</SelectItem>
              <SelectItem value="thisMonth">This month</SelectItem>
              <SelectItem value="lastMonth">Last month</SelectItem>
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
          ) : (
            <TrendingDown className="w-8 h-8 text-red-400" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400">Income</p>
            <p className="text-xl font-semibold text-green-400 tabular-nums">
              +€{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400">Expenses</p>
            <p className="text-xl font-semibold text-red-400 tabular-nums">
              -€{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}