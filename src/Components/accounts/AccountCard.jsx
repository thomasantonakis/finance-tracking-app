import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, CreditCard, PiggyBank, TrendingUp, MoreHorizontal, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils';

const categoryIcons = {
  cash: Wallet,
  bank: Wallet,
  credit_card: CreditCard,
  savings: PiggyBank,
  investment: TrendingUp,
  other: MoreHorizontal
};

export default function AccountCard({ account, balance, index = 0, onEdit }) {
  const Icon = categoryIcons[account.category] || Wallet;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-3 rounded-xl"
            style={{ backgroundColor: account.color + '20' }}
          >
            <Icon className="w-5 h-5" style={{ color: account.color }} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{account.name}</h3>
            <p className="text-xs text-slate-500 capitalize">{account.category.replace('_', ' ')}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(account)}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
        >
          <Edit className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Current Balance</span>
          <span className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(balance, account.currency || 'EUR')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Starting Balance</span>
          <span className="text-sm text-slate-600 tabular-nums">
            {formatCurrency(account.starting_balance, account.currency || 'EUR')}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
