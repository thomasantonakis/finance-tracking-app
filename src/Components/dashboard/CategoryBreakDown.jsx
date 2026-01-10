import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, CreditCard, PiggyBank, TrendingUp, MoreHorizontal } from 'lucide-react';

const categoryIcons = {
  cash: Wallet,
  bank: Wallet,
  credit_card: CreditCard,
  savings: PiggyBank,
  investment: TrendingUp,
  other: MoreHorizontal
};

export default function AccountsBreakdown({ accounts, accountBalances }) {
  if (!accounts || accounts.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Accounts Overview</h2>
        <p className="text-sm text-slate-400 text-center py-8">
          No accounts created yet. Go to Settings to create your first account.
        </p>
      </div>
    );
  }

  const totalBalance = Object.values(accountBalances).reduce((sum, bal) => sum + bal, 0);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Accounts Overview</h2>
      <div className="space-y-3">
        {accounts.map((account, index) => {
          const Icon = categoryIcons[account.category] || Wallet;
          const balance = accountBalances[account.id] || 0;
          const percentage = totalBalance > 0 ? (balance / totalBalance) * 100 : 0;
          
          return (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: account.color + '20' }}
                  >
                    <Icon className="w-4 h-4" style={{ color: account.color }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-900">
                      {account.name}
                    </span>
                    <p className="text-xs text-slate-400 capitalize">
                      {account.category.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    €{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-400">{percentage.toFixed(1)}%</p>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.abs(percentage)}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: account.color }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
