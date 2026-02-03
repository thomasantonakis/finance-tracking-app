import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Edit, Trash2, Copy, AlertCircle, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditTransactionModal from '../transactions/EditTransactionModal';
import EditTransferModal from '../transactions/EditTransferModal';
import DuplicateTransactionModal from '../transactions/DuplicateTransactionModal';
import { formatAmount, formatCurrency } from '@/utils';

export default function AccountTransactionsList({ 
  selectedAccount, 
  transactions, 
  getAccountName,
  currency = 'EUR',
  onUpdate,
  onDelete
}) {
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState(null);
  const [duplicatingType, setDuplicatingType] = useState(null);
  const [openActionsId, setOpenActionsId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(200);
  const [showUnclearedOnly, setShowUnclearedOnly] = useState(false);

  const getCreatedStamp = (t) => t?.created_at ?? t?.created_date ?? t?.date;
  const getUpdatedStamp = (t) => t?.updated_at ?? t?.updated_date ?? getCreatedStamp(t);
  const isStartingBalance = (t) => {
    const category = (t?.category || '').trim().toLowerCase();
    return t?.type !== 'transfer' && (category === 'starting balance' || category === 'system - starting balance');
  };
  const safeFormatDate = (value) => {
    try {
      const d = parseISO(value);
      return Number.isNaN(d?.getTime?.()) ? '—' : format(d, 'MMM d');
    } catch {
      return '—';
    }
  };

  const startingBalanceTransactions = transactions.filter(isStartingBalance);
  const displayTransactions = transactions.filter((t) => !isStartingBalance(t));

  useEffect(() => {
    setVisibleCount(200);
  }, [selectedAccount]);

  const sortedDisplayTransactions = useMemo(() => {
    const filtered = showUnclearedOnly
      ? displayTransactions.filter((t) => t.cleared === false)
      : displayTransactions;
    return [...filtered].sort((a, b) => {
      const dateCompare = new Date(b.date) - new Date(a.date);
      if (dateCompare !== 0) return dateCompare;
      const createdCompare = new Date(getCreatedStamp(b)) - new Date(getCreatedStamp(a));
      if (createdCompare !== 0) return createdCompare;
      return new Date(getUpdatedStamp(b)) - new Date(getUpdatedStamp(a));
    });
  }, [displayTransactions, showUnclearedOnly]);

  const visibleTransactions = sortedDisplayTransactions.slice(0, visibleCount);

  // Group by month
  const groupedByMonth = {};
  visibleTransactions.forEach(t => {
    const monthKey = format(parseISO(t.date), 'yyyy-MM');
    if (!groupedByMonth[monthKey]) {
      groupedByMonth[monthKey] = [];
    }
    groupedByMonth[monthKey].push(t);
  });

  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

  // Sort all transactions from oldest to newest and calculate running balances
  const allTransactionsSorted = [...transactions].sort((a, b) => {
    const dateCompare = new Date(a.date) - new Date(b.date);
    if (dateCompare !== 0) return dateCompare;
    // If same date, use created_at as primary tiebreaker
    const createdCompare = new Date(getCreatedStamp(a)) - new Date(getCreatedStamp(b));
    if (createdCompare !== 0) return createdCompare;
    // If same created_at, use updated_at as secondary tiebreaker
    return new Date(getUpdatedStamp(a)) - new Date(getUpdatedStamp(b));
  });

  // Calculate running balance map (from oldest to newest)
  const runningBalanceMap = {};
  let runningBalance = 0;
  
  allTransactionsSorted.forEach(t => {
    if (t.type === 'income') {
      runningBalance += t.amount;
    } else if (t.type === 'expense') {
      runningBalance -= t.amount;
    } else if (t.type === 'transfer') {
      if (t.from_account_id === selectedAccount) {
        runningBalance -= t.amount;
      } else {
        runningBalance += t.amount;
      }
    }
    runningBalanceMap[t.id] = runningBalance;
  });

  const handleEdit = (transaction, type) => {
    setEditingTransaction(transaction);
    setEditingType(type);
  };

  const handleDuplicate = (transaction, type) => {
    setDuplicatingTransaction(transaction);
    setDuplicatingType(type);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={showUnclearedOnly}
            onChange={(e) => setShowUnclearedOnly(e.target.checked)}
          />
          Show only uncleared
        </label>
      </div>
      {sortedMonths.length === 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center text-sm text-slate-400">
          No transactions to show.
        </div>
      )}
      {sortedMonths.map(monthKey => (
        <div key={monthKey} className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur py-1">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              {format(parseISO(monthKey + '-01'), 'MMMM yyyy')}
            </h3>
          </div>
          <div className="space-y-2">
            {groupedByMonth[monthKey]
              .sort((a, b) => {
                const dateCompare = new Date(b.date) - new Date(a.date);
                if (dateCompare !== 0) return dateCompare;
                // For same date, use created_at then updated_at (most recent first in display)
                const createdCompare = new Date(getCreatedStamp(b)) - new Date(getCreatedStamp(a));
                if (createdCompare !== 0) return createdCompare;
                return new Date(getUpdatedStamp(b)) - new Date(getUpdatedStamp(a));
              })
              .map((transaction, idx) => {
                const isStarting = isStartingBalance(transaction);
                const transactionBalance = runningBalanceMap[transaction.id] || 0;
                
                return (
                  <div
                    key={transaction.id}
                    className="group flex flex-wrap items-center gap-3 p-3 rounded-lg hover:bg-slate-50"
                  >
                    <div className={`p-2 rounded-lg ${
                      transaction.type === 'income' ? 'bg-green-50' : 
                      transaction.type === 'transfer' ? 'bg-blue-50' : 'bg-red-50'
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
                          <p className="font-medium text-slate-900 text-sm">
                            {transaction.from_account_id === selectedAccount
                              ? `To ${getAccountName(transaction.to_account_id)}`
                              : `From ${getAccountName(transaction.from_account_id)}`}
                          </p>
                        ) : (
                          <p className="font-medium text-slate-900 text-sm capitalize">
                            {transaction.category}
                          </p>
                        )}
                        {transaction.subcategory && (
                          <>
                            <span className="text-slate-300">•</span>
                            <p className="text-xs font-semibold text-slate-600 truncate">{transaction.subcategory}</p>
                          </>
                        )}
                        {transaction.type !== 'transfer' && (
                          <>
                            <span className="text-slate-300">•</span>
                            <ImportanceEmoji transaction={transaction} />
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{safeFormatDate(transaction.date)}</span>
                        {transaction.cleared === false && (
                          <span className="inline-flex items-center text-amber-600" title="Not cleared">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      {transaction.notes && (
                        <p className="text-xs text-slate-400 truncate">{transaction.notes}</p>
                      )}
                    </div>

                    <div className="flex w-28 flex-col items-end gap-1">
                        <p className={`text-base font-bold tabular-nums whitespace-nowrap ${
                            transaction.type === 'income' ? 'text-green-600' : 
                            transaction.type === 'transfer' ? 
                              (transaction.from_account_id === selectedAccount ? 'text-red-600' : 'text-green-600')
                            : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : 
                             transaction.type === 'transfer' ?
                               (transaction.from_account_id === selectedAccount ? '-' : '+')
                             : '-'}{formatCurrency(transaction.amount, currency)}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Bal: {formatCurrency(transactionBalance, currency)}
                        </p>
                      {!isStarting && (
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
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      {visibleTransactions.length < sortedDisplayTransactions.length && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((prev) => prev + 200)}
          >
            Load more
          </Button>
        </div>
      )}

      {startingBalanceTransactions.length > 0 && (
        (() => {
          const startTx = [...startingBalanceTransactions].sort((a, b) => {
            const dateCompare = new Date(a.date) - new Date(b.date);
            if (dateCompare !== 0) return dateCompare;
            return new Date(getCreatedStamp(a)) - new Date(getCreatedStamp(b));
          })[0];
          const sign = startTx?.type === 'income' ? '+' : '-';
          return (
        <div className="flex items-center justify-end px-2 pt-1 text-[11px] text-slate-400">
          Start Balance: {sign}{formatCurrency(startTx?.amount || 0, currency)}
        </div>
          );
        })()
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
