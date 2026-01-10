import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Edit3, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import AccountForm from '../Components/accounts/AccountForm';
import AccountsList from '../Components/accounts/AccountsList';
import AccountTransactionsList from '../Components/accounts/AccountTransactionsList';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Accounts() {
  const [editMode, setEditMode] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [orderedAccounts, setOrderedAccounts] = useState([]);
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
    onSuccess: (data) => {
      if (orderedAccounts.length === 0) {
        setOrderedAccounts(data);
      }
    }
  });

  React.useEffect(() => {
    if (accounts.length > 0 && orderedAccounts.length === 0) {
      setOrderedAccounts(accounts);
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
    
    return account.starting_balance + accountIncome - accountExpenses - transfersOut + transfersIn;
  };

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

  const handleAccountFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    setEditingAccount(null);
  };

  const handleReorder = (sourceIndex, destinationIndex) => {
    const reordered = Array.from(orderedAccounts);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, removed);
    setOrderedAccounts(reordered);
  };

  const handleDelete = (id, type) => {
    if (type === 'income') {
      deleteIncomeMutation.mutate(id);
    } else if (type === 'transfer') {
      deleteTransferMutation.mutate(id);
    } else {
      deleteExpenseMutation.mutate(id);
    }
  };

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown';
  };

  if (selectedAccount) {
    const account = accounts.find(a => a.id === selectedAccount);
    const balance = getAccountBalance(selectedAccount);
    const allTransactions = [
      ...expenses.filter(e => e.account_id === selectedAccount).map(e => ({ ...e, type: 'expense' })),
      ...income.filter(i => i.account_id === selectedAccount).map(i => ({ ...i, type: 'income' })),
      ...transfers.filter(t => t.from_account_id === selectedAccount || t.to_account_id === selectedAccount).map(t => ({ ...t, type: 'transfer' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              variant="ghost"
              onClick={() => setSelectedAccount(null)}
              className="mb-4 text-slate-600"
            >
              ← Back to Accounts
            </Button>

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
                <p className="text-4xl font-bold text-slate-900 tabular-nums">€{balance.toFixed(2)}</p>
              </div>
            </div>

            <AccountTransactionsList
              selectedAccount={selectedAccount}
              transactions={allTransactions}
              getAccountName={getAccountName}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  const displayAccounts = orderedAccounts.length > 0 ? orderedAccounts : accounts;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
            <Button
              variant={editMode ? 'default' : 'outline'}
              onClick={() => setEditMode(!editMode)}
              className={editMode ? 'bg-slate-900' : ''}
            >
              {editMode ? <><Check className="w-4 h-4 mr-2" /> Done</> : <><Edit3 className="w-4 h-4 mr-2" /> Edit</>}
            </Button>
          </div>

          <AccountsList
            accounts={displayAccounts}
            editMode={editMode}
            onReorder={handleReorder}
            onEdit={setEditingAccount}
            onSelect={setSelectedAccount}
            getAccountBalance={getAccountBalance}
          />
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
    </div>
  );
}