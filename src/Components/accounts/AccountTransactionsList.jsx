import React, { useState } from 'react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Edit, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EditTransactionModal from '../transactions/EditTransactionModal';
import EditTransferModal from '../transactions/EditTransferModal';
import DuplicateTransactionModal from '../transactions/DuplicateTransactionModal';

export default function AccountTransactionsList({ 
  selectedAccount, 
  transactions, 
  getAccountName,
  onUpdate,
  onDelete
}) {
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [duplicatingTransaction, setDuplicatingTransaction] = useState(null);
  const [duplicatingType, setDuplicatingType] = useState(null);

  const getCreatedStamp = (t) => t?.created_at ?? t?.created_date ?? t?.date;
  const getUpdatedStamp = (t) => t?.updated_at ?? t?.updated_date ?? getCreatedStamp(t);

  // Group by month
  const groupedByMonth = {};
  transactions.forEach(t => {
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

  return (
    <div className="space-y-6">
      {sortedMonths.map(monthKey => (
        <div key={monthKey} className="bg-white rounded-2xl p-4 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {format(parseISO(monthKey + '-01'), 'MMMM yyyy')}
          </h3>
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
                const transactionBalance = runningBalanceMap[transaction.id] || 0;
                
                return (
                  <div
                    key={transaction.id}
                    className="group flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50"
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
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs text-slate-400">
                          {format(parseISO(transaction.date), 'MMM d')}
                        </p>
                        <span className="text-slate-300">•</span>
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
                            <p className="text-xs text-slate-500 truncate">{transaction.subcategory}</p>
                          </>
                        )}
                      </div>
                      {transaction.notes && (
                        <p className="text-xs text-slate-400 truncate">{transaction.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <p className={`text-base font-bold tabular-nums ${
                          transaction.type === 'income' ? 'text-green-600' : 
                          transaction.type === 'transfer' ? 
                            (transaction.from_account_id === selectedAccount ? 'text-red-600' : 'text-green-600')
                          : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : 
                           transaction.type === 'transfer' ?
                             (transaction.from_account_id === selectedAccount ? '-' : '+')
                           : '-'}€{transaction.amount.toFixed(2)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-blue-500"
                          onClick={() => handleEdit(transaction, transaction.type)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-slate-900"
                          onClick={() => handleDuplicate(transaction, transaction.type)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => onDelete(transaction.id, transaction.type)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Bal: €{transactionBalance.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}

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
