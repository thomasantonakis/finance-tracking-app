import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Edit3, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import AccountForm from '../Components/accounts/AccountForm';
import AccountsList from '../Components/accounts/AccountsList';
import AccountTransactionsList from '../Components/accounts/AccountTransactionsList';
import { ensureStartingBalanceTransactions, formatAmount, formatCurrency, getMainCurrency, readFxRates, writeFxRates, getFxProvider } from '@/utils';
import { format, subDays } from 'date-fns';
import { getAccountsOrder, setAccountsOrder } from '@/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Accounts() {
  const [editMode, setEditMode] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [orderedAccounts, setOrderedAccounts] = useState([]);
  const [deleteReport, setDeleteReport] = useState({ open: false, success: false, title: '', reasons: [] });
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState(null);
  const queryClient = useQueryClient();

  const applyStoredOrder = (list) => {
    const order = getAccountsOrder();
    if (!order.length) return list;
    const byId = new Map(list.map((acc) => [acc.id, acc]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean);
    const remaining = list.filter((acc) => !order.includes(acc.id));
    return [...ordered, ...remaining];
  };

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
    onSuccess: (data) => {
      if (orderedAccounts.length === 0) {
        setOrderedAccounts(applyStoredOrder(data));
      }
    }
  });

  React.useEffect(() => {
    if (accounts.length > 0) {
      setOrderedAccounts(applyStoredOrder(accounts));
    } else if (orderedAccounts.length !== 0) {
      setOrderedAccounts([]);
    }
  }, [accounts]);

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date'),
  });

  const { data: income = [] } = useQuery({
    queryKey: ['income'],
    queryFn: () => base44.entities.Income.list('-date'),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => base44.entities.Transfer.list('-date'),
  });

  const getAccountBalance = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 0;

    const accountIncome = income
      .filter(i => i.account_id === accountId)
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    
    const accountExpenses = expenses
      .filter(e => e.account_id === accountId)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const transfersOut = transfers
      .filter(t => t.from_account_id === accountId)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const transfersIn = transfers
      .filter(t => t.to_account_id === accountId)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    return accountIncome - accountExpenses - transfersOut + transfersIn;
  };

  React.useEffect(() => {
    ensureStartingBalanceTransactions(accounts, queryClient);
  }, [accounts, queryClient]);

  const getAccountTransactions = (accountId) => {
    const accountExpenses = expenses.filter(e => e.account_id === accountId).map(e => ({ ...e, type: 'expense' }));
    const accountIncome = income.filter(i => i.account_id === accountId).map(i => ({ ...i, type: 'income' }));
    const accountTransfers = transfers.filter(t => t.from_account_id === accountId || t.to_account_id === accountId).map(t => ({ ...t, type: 'transfer' }));
    
    const all = [...accountExpenses, ...accountIncome, ...accountTransfers].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const grouped = {};
    all.forEach(t => {
      const date = t.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(t);
    });
    
    return Object.entries(grouped).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  };

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Transaction deleted');
    },
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: (id) => base44.entities.Income.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Transaction deleted');
    },
  });

  const deleteTransferMutation = useMutation({
    mutationFn: (id) => base44.entities.Transfer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast.success('Transaction deleted');
    },
  });

  const pendingDeletesRef = useRef(new Map());

  const undoDelete = (key) => {
    const pending = pendingDeletesRef.current.get(key);
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    queryClient.setQueryData(pending.queryKey, pending.previous);
    pendingDeletesRef.current.delete(key);
    toast.success('Deletion undone');
  };

  const scheduleDelete = (id, type) => {
    const typeKey = type === 'income' ? 'income' : type === 'transfer' ? 'transfers' : 'expenses';
    const queryKey = [typeKey];
    const previous = queryClient.getQueryData(queryKey) || [];
    const item = previous.find((t) => t.id === id);
    if (!item) {
      if (type === 'income') deleteIncomeMutation.mutate(id);
      else if (type === 'transfer') deleteTransferMutation.mutate(id);
      else deleteExpenseMutation.mutate(id);
      return;
    }
    const key = `${type}:${id}`;
    if (pendingDeletesRef.current.has(key)) return;
    queryClient.setQueryData(queryKey, previous.filter((t) => t.id !== id));
    const timeoutId = setTimeout(() => {
      pendingDeletesRef.current.delete(key);
      if (type === 'income') deleteIncomeMutation.mutate(id);
      else if (type === 'transfer') deleteTransferMutation.mutate(id);
      else deleteExpenseMutation.mutate(id);
    }, 8000);
    pendingDeletesRef.current.set(key, { previous, queryKey, timeoutId });
    toast.success('Transaction deleted', {
      action: {
        label: 'Undo',
        onClick: () => undoDelete(key),
      },
    });
  };

  const handleAccountFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    setEditingAccount(null);
    setCreatingAccount(false);
  };

  const handleReorder = (sourceIndex, destinationIndex) => {
    const reordered = Array.from(orderedAccounts);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, removed);
    setOrderedAccounts(reordered);
    setAccountsOrder(reordered.map((acc) => acc.id));
  };

  const handleDelete = (id, type) => {
    scheduleDelete(id, type);
  };

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
  };

  const getDeleteReasons = (account) => {
    const isStarting = (t) => (t.category || '').toLowerCase() === 'starting balance';
    const accExpenses = expenses.filter((e) => e.account_id === account.id);
    const accIncome = income.filter((i) => i.account_id === account.id);
    const hasRegularExpense = accExpenses.some((e) => !isStarting(e));
    const hasRegularIncome = accIncome.some((i) => !isStarting(i));
    const hasTransfer = transfers.some(
      (t) => t.from_account_id === account.id || t.to_account_id === account.id
    );
    const startingAmount = Number(account.starting_balance) || 0;

    const reasons = [];
    if (hasRegularExpense) reasons.push('Has expense transactions');
    if (hasRegularIncome) reasons.push('Has income transactions');
    if (hasTransfer) reasons.push('Has transfers');
    if (startingAmount !== 0) reasons.push('Starting balance is not zero');
    return reasons;
  };

  const handleDeleteAccount = async (account) => {
    const reasons = getDeleteReasons(account);
    if (reasons.length > 0) {
      setDeleteReport({
        open: true,
        success: false,
        title: `Account not deleted: ${account.name}`,
        reasons,
      });
      return;
    }

    try {
      const isStarting = (t) => (t.category || '').toLowerCase() === 'starting balance';
      const accExpenses = expenses.filter((e) => e.account_id === account.id && isStarting(e));
      const accIncome = income.filter((i) => i.account_id === account.id && isStarting(i));
      for (const item of accExpenses) {
        await base44.entities.Expense.delete(item.id);
      }
      for (const item of accIncome) {
        await base44.entities.Income.delete(item.id);
      }
      await base44.entities.Account.delete(account.id);

      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['income'] });

      setOrderedAccounts((prev) => prev.filter((acc) => acc.id !== account.id));
      setDeleteReport({
        open: true,
        success: true,
        title: `Account deleted: ${account.name}`,
        reasons: [],
      });
    } catch (error) {
      setDeleteReport({
        open: true,
        success: false,
        title: `Account not deleted: ${account.name}`,
        reasons: ['Unexpected error while deleting the account'],
      });
    }
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown';
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedAccount]);

  const displayAccounts = orderedAccounts.length > 0 ? orderedAccounts : accounts;
  const totalBalance = displayAccounts.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);
  const currencySet = new Set(displayAccounts.map((acc) => acc.currency || 'EUR'));
  const totalCurrency = currencySet.size === 1 ? Array.from(currencySet)[0] : null;
  const mainCurrency = getMainCurrency() || 'EUR';
  const [fxRates, setFxRates] = useState(() => readFxRates(mainCurrency));

  useEffect(() => {
    const stored = readFxRates(mainCurrency);
    if (stored) setFxRates(stored);
  }, [mainCurrency]);

  useEffect(() => {
    const getRateDateKey = () => {
      const now = new Date();
      const hourUTC = now.getUTCHours();
      const base = hourUTC >= 4 ? now : subDays(now, 1);
      return format(base, 'yyyy-MM-dd');
    };

    const fetchRates = async () => {
      let dateKey = getRateDateKey();
      if (fxRates?.date === dateKey) return;
      let attempts = 0;
      while (attempts < 7) {
        try {
          const provider = getFxProvider();
          const url =
            provider === "frankfurter.app"
              ? `https://api.frankfurter.app/${dateKey}?from=${mainCurrency}`
              : `https://api.exchangerate.host/${dateKey}?base=${mainCurrency}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch FX rates');
          const data = await res.json();
          const rates = data?.rates || data?.data?.rates;
          if (rates && Object.keys(rates).length > 0) {
            const payload = { date: dateKey, rates };
            writeFxRates(mainCurrency, payload);
            setFxRates(payload);
            return;
          }
        } catch {
          // try previous day
        }
        attempts += 1;
        dateKey = format(subDays(new Date(dateKey), 1), 'yyyy-MM-dd');
      }
    };

    const scheduleNextFetch = () => {
      const now = new Date();
      const next = new Date(now);
      next.setUTCHours(4, 0, 0, 0);
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
      const timeout = next.getTime() - now.getTime();
      const id = setTimeout(async () => {
        await fetchRates();
        scheduleNextFetch();
      }, timeout);
      return () => clearTimeout(id);
    };

    fetchRates();
    return scheduleNextFetch();
  }, [mainCurrency, fxRates]);

  const totalsByCurrency = useMemo(() => {
    const totals = {};
    displayAccounts.forEach((acc) => {
      const code = acc.currency || 'EUR';
      totals[code] = (totals[code] || 0) + getAccountBalance(acc.id);
    });
    return totals;
  }, [displayAccounts, getAccountBalance]);

  const totalsWithMain = useMemo(() => {
    const rates = fxRates?.rates || {};
    return Object.entries(totalsByCurrency).map(([code, amount]) => {
      const rate = code === mainCurrency ? 1 : rates[code];
      const mainEquivalent = rate ? amount / rate : null;
      return { code, amount, rate, mainEquivalent };
    });
  }, [totalsByCurrency, fxRates, mainCurrency]);

  const totalInMainCurrency = useMemo(() => {
    return totalsWithMain.reduce((sum, item) => {
      if (item.mainEquivalent === null) return sum;
      return sum + item.mainEquivalent;
    }, 0);
  }, [totalsWithMain]);

  const totalsSorted = useMemo(() => {
    return [...totalsWithMain].sort((a, b) => {
      const aVal = a.mainEquivalent ?? -Infinity;
      const bVal = b.mainEquivalent ?? -Infinity;
      return bVal - aVal;
    });
  }, [totalsWithMain]);

  if (selectedAccount) {
    const account = accounts.find(a => a.id === selectedAccount);
    const balance = getAccountBalance(selectedAccount);
    const allTransactions = [
      ...expenses.filter(e => e.account_id === selectedAccount).map(e => ({ ...e, type: 'expense' })),
      ...income.filter(i => i.account_id === selectedAccount).map(i => ({ ...i, type: 'income' })),
      ...transfers.filter(t => t.from_account_id === selectedAccount || t.to_account_id === selectedAccount).map(t => ({ ...t, type: 'transfer' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const accountCurrency = account?.currency || 'EUR';

    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-white rounded-2xl p-6 mb-6 border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: account.color + '20' }}
                >
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: account.color }} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
                  <p className="text-sm text-slate-500 capitalize">{account.category.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-1">Current Balance</p>
                <p className="text-4xl font-bold text-slate-900 tabular-nums">
                  {formatCurrency(balance, accountCurrency)}
                </p>
              </div>
            </div>

            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur border-b border-slate-200/70 py-3 mb-4">
              <div className="grid grid-cols-3 items-center">
                <div className="justify-self-start">
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedAccount(null)}
                    className="text-slate-600"
                  >
                    ← Back to Accounts
                  </Button>
                </div>
                <div className="justify-self-center text-center">
                  <div className="text-sm text-slate-500">{account.name}</div>
                </div>
                <div className="justify-self-end text-right">
                  <div className="text-sm text-slate-500">Balance</div>
                  <div className="font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(balance, accountCurrency)}
                  </div>
                </div>
              </div>
            </div>

            <AccountTransactionsList
              selectedAccount={selectedAccount}
              transactions={allTransactions}
              getAccountName={getAccountName}
              currency={accountCurrency}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  const getUnclearedSum = (accountId) => {
    const accountExpenses = expenses.filter((e) => e.account_id === accountId && e.cleared === false);
    const accountIncome = income.filter((i) => i.account_id === accountId && i.cleared === false);
    const accountTransfers = transfers.filter(
      (t) => (t.from_account_id === accountId || t.to_account_id === accountId) && t.cleared === false
    );
    const expenseSum = accountExpenses.reduce((sum, e) => sum + e.amount, 0);
    const incomeSum = accountIncome.reduce((sum, i) => sum + i.amount, 0);
    const transferNet = accountTransfers.reduce((sum, t) => {
      if (t.to_account_id === accountId) return sum + t.amount;
      if (t.from_account_id === accountId) return sum - t.amount;
      return sum;
    }, 0);
    return incomeSum - expenseSum + transferNet;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur border-b border-slate-200/60 py-3 mb-6">
            <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
            <div className="flex items-center gap-3">
              <Button
                variant="default"
                className="bg-slate-900"
                onClick={() => setCreatingAccount(true)}
              >
                + Add Account
              </Button>
              <Button
                variant={editMode ? 'default' : 'outline'}
                onClick={() => setEditMode(!editMode)}
                className={editMode ? 'bg-slate-900' : ''}
              >
                {editMode ? <><Check className="w-4 h-4 mr-2" /> Done</> : <><Edit3 className="w-4 h-4 mr-2" /> Edit</>}
              </Button>
            </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Balance</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums text-right">
                {formatCurrency(totalInMainCurrency, mainCurrency)}
              </p>
            </div>
            {Object.keys(totalsByCurrency).length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3 space-y-1">
                {totalsSorted.map(({ code, amount, rate, mainEquivalent }) => (
                  <div key={code} className="flex items-center justify-between text-sm text-slate-600">
                    <span className="font-medium">{code}</span>
                    <div className="text-right tabular-nums">
                      {formatCurrency(amount, code)}
                      {code !== mainCurrency && rate && mainEquivalent !== null && (
                        <span className="text-xs text-slate-400 ml-2">
                          × {(1 / rate).toFixed(3)} = {formatCurrency(mainEquivalent, mainCurrency)}
                        </span>
                      )}
                      {code !== mainCurrency && (!rate || mainEquivalent === null) && (
                        <span className="text-xs text-slate-400 ml-2">× — = —</span>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-400">
                  Uses {fxRates?.date ? `${fxRates.date} FX rates` : 'yesterday FX rates'} when available.
                </p>
              </div>
            )}
          </div>

          {displayAccounts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">No accounts yet</h2>
              <p className="text-sm text-slate-500 mb-4">
                Create your first account to start tracking balances.
              </p>
              <Button
                className="bg-slate-900"
                onClick={() => setCreatingAccount(true)}
              >
                + Add Account
              </Button>
            </div>
          ) : (
            <AccountsList
              accounts={displayAccounts}
              editMode={editMode}
              onReorder={handleReorder}
              onEdit={setEditingAccount}
              onDelete={setPendingDeleteAccount}
              onSelect={setSelectedAccount}
              getAccountBalance={getAccountBalance}
              getUnclearedSum={getUnclearedSum}
            />
          )}
        </motion.div>
      </div>

      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          {editingAccount && (
            <AccountForm
              account={editingAccount}
              onSuccess={handleAccountFormSuccess}
              onCancel={() => setEditingAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={creatingAccount} onOpenChange={setCreatingAccount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>
          <AccountForm
            onSuccess={handleAccountFormSuccess}
            onCancel={() => setCreatingAccount(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteReport.open}
        onOpenChange={(open) => !open && setDeleteReport({ open: false, success: false, title: '', reasons: [] })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteReport.title}</AlertDialogTitle>
            {deleteReport.success ? (
              <AlertDialogDescription>Account deleted successfully.</AlertDialogDescription>
            ) : (
              <AlertDialogDescription>
                {deleteReport.reasons.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-slate-900 mb-2">Reasons:</p>
                    <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                      {deleteReport.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <div className="flex justify-end pt-2">
            <AlertDialogAction onClick={() => setDeleteReport({ open: false, success: false, title: '', reasons: [] })}>
              Close
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDeleteAccount} onOpenChange={(open) => !open && setPendingDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <AlertDialogCancel onClick={() => setPendingDeleteAccount(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteAccount) {
                  handleDeleteAccount(pendingDeleteAccount);
                }
                setPendingDeleteAccount(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
