import React from 'react';
import { motion } from 'framer-motion';
import { 
  Utensils, Car, Zap, Film, ShoppingBag, Heart, GraduationCap, 
  Plane, CreditCard, Home, MoreHorizontal, DollarSign, Briefcase,
  TrendingUp, Gift, RefreshCw, Building2, Award
} from 'lucide-react';

const categoryIcons = {
  food: Utensils,
  transport: Car,
  utilities: Zap,
  entertainment: Film,
  shopping: ShoppingBag,
  health: Heart,
  education: GraduationCap,
  travel: Plane,
  subscriptions: CreditCard,
  housing: Home,
  other: MoreHorizontal,
  salary: DollarSign,
  freelance: Briefcase,
  investment: TrendingUp,
  business: Building2,
  gift: Gift,
  refund: RefreshCw,
  rental: Home,
  bonus: Award
};

export default function CategoryBreakdown({ data, type, total }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          {type === 'income' ? 'Income' : 'Expenses'} by Category
        </h2>
        <p className="text-sm text-slate-400 text-center py-8">
          No {type === 'income' ? 'income' : 'expenses'} recorded yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        {type === 'income' ? 'Income' : 'Expenses'} by Category
      </h2>
      <div className="space-y-3">
        {data.map((item, index) => {
          const Icon = categoryIcons[item.category] || MoreHorizontal;
          const percentage = total > 0 ? (item.total / total) * 100 : 0;
          
          return (
            <motion.div
              key={item.category}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    type === 'income' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`} />
                  </div>
                  <span className="text-sm font-medium text-slate-900 capitalize">
                    {item.category}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    €{item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-400">{percentage.toFixed(1)}%</p>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className={`h-full rounded-full ${
                    type === 'income' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}