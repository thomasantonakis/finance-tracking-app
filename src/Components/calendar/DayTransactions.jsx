import React, { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Trash2, Edit, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditTransactionModal from '../transactions/EditTransactionModal';
import EditTransferModal from '../transactions/EditTransferModal';
import DuplicateTransactionModal from '../transactions/DuplicateTransactionModal';
import { formatAmount } from '@/utils';

export default function DayTransactions({ 
  selectedDate, 
  expenses, 
  income, 
  transfers, 
  accounts,
  onDelete,
  onUpdate
}) {
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState(null);
  const [duplicatingType, setDuplicatingType] = useState(null);
  const isStartingBalance = (t) =>
    t?.type !== 'transfer' && (t?.category || '').toLowerCase() === 'starting balance';

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown';
  };

  const handleEdit = (transaction, type) => {
    setEditingTransaction(transaction);
    setEditingType(type);
  };

  const handleDuplicate = (transaction, type) => {
    setDuplicatingTransaction(transaction);
    setDuplicatingType(type);
  };

  const dayExpenses = expenses.filter(e => isSameDay(new Date(e.date), selectedDate));
  const dayIncome = income.filter(i => isSameDay(new Date(i.date), selectedDate));
  const dayTransfers = transfers.filter(t => isSameDay(new Date(t.date), selectedDate));

  const allTransactions = [
    ...dayExpenses.map(e => ({ ...e, type: 'expense' })),
    ...dayIncome.map(i => ({ ...i, type: 'income' })),
    ...dayTransfers.map(t => ({ ...t, type: 'transfer' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalExpenses = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalIncome = dayIncome.reduce((sum, i) => sum + (i.amount || 0), 0);
  const netTotal = totalIncome - totalExpenses;

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {format(selectedDate, 'EEEE, MMM d')}
          </h3>
          <p className="text-sm text-slate-500">
            {allTransactions.length} transaction{allTransactions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold tabular-nums ${
            netTotal >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            €{formatAmount(Math.abs(netTotal))}
          </p>
          <p className="text-xs text-slate-400">Net</p>
        </div>
      </div>

      {allTransactions.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">
          No transactions for this day
        </p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {allTransactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.03 }}
                className="group flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className={`p-2 rounded-lg ${
                  transaction.type === 'income' 
                    ? 'bg-green-50' 
                    : transaction.type === 'transfer'
                    ? 'bg-blue-50'
                    : 'bg-red-50'
                }`}>
                  {transaction.type === 'income' ? (
                    <ArrowUpRight className="w-4 h-4 text-green-600" />
                  ) : transaction.type === 'transfer' ? (
                    <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  {transaction.type === 'transfer' ? (
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 text-sm">Transfer</p>
                      <span className="text-slate-300">•</span>
                      <p className="text-xs text-slate-500 truncate">
                        {getAccountName(transaction.from_account_id)} → {getAccountName(transaction.to_account_id)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 text-sm capitalize">
                        {transaction.category}
                      </p>
                      {transaction.subcategory && (
                        <>
                          <span className="text-slate-300">•</span>
                          <p className="text-xs text-slate-500 truncate">
                            {transaction.subcategory}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {transaction.notes && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{transaction.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <p className={`text-base font-bold tabular-nums ${
                    transaction.type === 'income' 
                      ? 'text-green-600' 
                      : transaction.type === 'transfer'
                      ? 'text-blue-600'
                      : 'text-red-600'
                  }`}>
                    {transaction.type === 'transfer' ? '' : transaction.type === 'income' ? '+' : '-'}€{formatAmount(transaction.amount)}
                  </p>
                  {!isStartingBalance(transaction) && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                        onClick={() => handleEdit(transaction, transaction.type)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() => handleDuplicate(transaction, transaction.type)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                        onClick={() => onDelete(transaction.id, transaction.type)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {editingTransaction && editingType !== 'transfer' && (
        <EditTransactionModal
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          transaction={editingTransaction}
          type={editingType}
          onSuccess={onUpdate}
        />
      )}

      {editingTransaction && editingType === 'transfer' && (
        <EditTransferModal
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          transfer={editingTransaction}
          onSuccess={onUpdate}
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
          onSuccess={onUpdate}
        />
      )}
    </div>
  );
}
