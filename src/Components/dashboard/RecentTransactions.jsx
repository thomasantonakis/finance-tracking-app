import React, { useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Edit, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Copy, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import EditTransactionModal from '../transactions/EditTransactionModal';
import EditTransferModal from '../transactions/EditTransferModal';
import DuplicateTransactionModal from '../transactions/DuplicateTransactionModal';
import { formatAmount } from '@/utils';

export default function RecentTransactions({ transactions, onDelete, onUpdate }) {
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState(null);
  const [duplicatingType, setDuplicatingType] = useState(null);
  const isStartingBalance = (t) =>
    t?.type !== 'transfer' && (t?.category || '').toLowerCase() === 'starting balance';

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const handleEdit = (transaction, type) => {
    setEditingTransaction(transaction);
    setEditingType(type);
  };

  const handleDuplicate = (transaction, type) => {
    setDuplicatingTransaction(transaction);
    setDuplicatingType(type);
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown';
  };

  const getImportanceLabel = (t) => {
    if (t.type === 'income') return t.important ? 'Main' : 'Extras';
    if (t.type === 'expense') return t.important ? 'Must Have' : 'Nice to Have';
    return null;
  };

  const ImportanceEmoji = ({ transaction }) => {
    if (transaction.type === 'transfer') return null;
    const label = getImportanceLabel(transaction);
    if (!label) return null;
    const emoji = transaction.type === 'income'
      ? (transaction.important ? '🔁' : '✨')
      : (transaction.important ? '🍞' : '🎉');
    return (
      <span className="inline-flex items-center text-sm" title={label}>
        {emoji}
      </span>
    );
  };

  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Transactions</h2>
        <p className="text-sm text-slate-400 text-center py-8">
          No transactions yet. Start by adding your first income or expense.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Transactions</h2>
      <div className="space-y-2">
        <AnimatePresence>
          {transactions.map((transaction, index) => (
            <motion.div
              key={transaction.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.03 }}
              className="group flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors"
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
                <div className="flex items-center gap-2 mb-0.5">
                  {transaction.type === 'transfer' ? (
                    <>
                      <p className="font-medium text-slate-900">
                        Transfer
                      </p>
                      <span className="text-slate-300">•</span>
                      <p className="text-sm text-slate-500 truncate">
                        {getAccountName(transaction.from_account_id)} → {getAccountName(transaction.to_account_id)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900 capitalize">
                        {transaction.category}
                      </p>
                      {transaction.subcategory && (
                        <>
                          <span className="text-slate-300">•</span>
                          <p className="text-sm font-semibold text-slate-600 truncate">
                            {transaction.subcategory}
                          </p>
                        </>
                      )}
                      <span className="text-slate-300">•</span>
                      <ImportanceEmoji transaction={transaction} />
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{format(new Date(transaction.date), 'MMM d, yyyy')}</span>
                  {transaction.cleared === false && (
                    <span className="inline-flex items-center gap-1 text-amber-600" title="Not cleared">
                      <AlertCircle className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
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
                      className="h-10 w-10 bg-blue-50 text-blue-600 hover:bg-blue-100"
                      onClick={() => handleEdit(transaction, transaction.type)}
                    >
                      <Edit className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 bg-amber-50 text-amber-600 hover:bg-amber-100"
                      onClick={() => handleDuplicate(transaction, transaction.type)}
                    >
                      <Copy className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 bg-red-50 text-red-600 hover:bg-red-100"
                      onClick={() => onDelete(transaction.id, transaction.type)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
