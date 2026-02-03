import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Edit, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Copy, AlertCircle, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import EditTransactionModal from '../transactions/EditTransactionModal';
import EditTransferModal from '../transactions/EditTransferModal';
import DuplicateTransactionModal from '../transactions/DuplicateTransactionModal';
import { formatAmount, formatCurrency } from '@/utils';

export default function RecentTransactions({ transactions, onDelete, onUpdate }) {
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState(null);
  const [duplicatingType, setDuplicatingType] = useState(null);
  const [openActionsId, setOpenActionsId] = useState(null);
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

  const getAccountCurrency = (accountId) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.currency || 'EUR';
  };

  useEffect(() => {
    if (!openActionsId) return;
    const handleClick = (event) => {
      if (!event.target.closest('[data-actions-menu="true"]')) {
        setOpenActionsId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openActionsId]);

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
    <div className="bg-white rounded-2xl p-6 pb-24 sm:pb-6 border border-slate-100">
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
              className="group flex flex-wrap items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors"
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
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
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

              <div className="flex w-24 shrink-0 flex-col items-end gap-1">
                <p className={`text-base font-bold tabular-nums whitespace-nowrap ${
                  transaction.type === 'income' 
                    ? 'text-green-600' 
                    : transaction.type === 'transfer'
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}>
                  {transaction.type === 'transfer' ? '' : transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(
                    transaction.amount,
                    getAccountCurrency(
                      transaction.type === 'transfer'
                        ? transaction.from_account_id
                        : transaction.account_id
                    )
                  )}
                </p>
                {!isStartingBalance(transaction) && (
                  <>
                    <div className="hidden sm:flex items-center gap-2 mt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-blue-50 text-blue-600 hover:bg-blue-100"
                        onClick={() => handleEdit(transaction, transaction.type)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-amber-50 text-amber-600 hover:bg-amber-100"
                        onClick={() => handleDuplicate(transaction, transaction.type)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-red-50 text-red-600 hover:bg-red-100"
                        onClick={() => onDelete(transaction.id, transaction.type)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="relative sm:hidden mt-1" data-actions-menu="true">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-slate-100 text-slate-700 hover:bg-slate-200"
                        onClick={() => setOpenActionsId(openActionsId === transaction.id ? null : transaction.id)}
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </Button>
                      {openActionsId === transaction.id && (
                        <div className="absolute right-0 mt-2 w-36 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setOpenActionsId(null);
                              handleEdit(transaction, transaction.type);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setOpenActionsId(null);
                              handleDuplicate(transaction, transaction.type);
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setOpenActionsId(null);
                              onDelete(transaction.id, transaction.type);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
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
