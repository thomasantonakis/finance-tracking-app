import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { getCurrencySymbol } from '@/utils';

const accountCategories = ['cash', 'bank', 'credit_card', 'savings', 'investment', 'other'];
const currencyOptions = [
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'CHF', label: 'Swiss Franc (CHF)' },
  { code: 'SEK', label: 'Swedish Krona (SEK)' },
  { code: 'NOK', label: 'Norwegian Krone (NOK)' },
  { code: 'DKK', label: 'Danish Krone (DKK)' },
  { code: 'PLN', label: 'Polish Zloty (PLN)' },
  { code: 'CZK', label: 'Czech Koruna (CZK)' },
  { code: 'HUF', label: 'Hungarian Forint (HUF)' },
  { code: 'RON', label: 'Romanian Leu (RON)' },
  { code: 'BGN', label: 'Bulgarian Lev (BGN)' },
  { code: 'TRY', label: 'Turkish Lira (TRY)' },
  { code: 'JPY', label: 'Japanese Yen (JPY)' },
  { code: 'AUD', label: 'Australian Dollar (AUD)' },
  { code: 'CAD', label: 'Canadian Dollar (CAD)' }
];

const STARTING_BALANCE_DATE = '1970-01-01';
const STARTING_BALANCE_CATEGORY = 'SYSTEM - Starting Balance';
const STARTING_BALANCE_CATEGORIES = new Set(['starting balance', 'system - starting balance']);

const ensureStartingBalanceTransaction = async (accountId, rawAmount) => {
  const amount = Number(rawAmount) || 0;
  const isIncome = amount > 0;
  const absAmount = Math.abs(amount);

  const [incomeList, expenseList] = await Promise.all([
    base44.entities.Income.list(),
    base44.entities.Expense.list(),
  ]);

  const isStarting = (t) => STARTING_BALANCE_CATEGORIES.has((t.category || '').trim().toLowerCase());
  const matchIncome = incomeList.find(
    (t) =>
      t.account_id === accountId &&
      isStarting(t)
  );
  const matchExpense = expenseList.find(
    (t) =>
      t.account_id === accountId &&
      isStarting(t)
  );

  if (absAmount === 0) {
    if (matchIncome) await base44.entities.Income.delete(matchIncome.id);
    if (matchExpense) await base44.entities.Expense.delete(matchExpense.id);
    return;
  }

  if (isIncome) {
    if (matchExpense) {
      await base44.entities.Expense.delete(matchExpense.id);
    }
    if (matchIncome) {
      await base44.entities.Income.update(matchIncome.id, {
        amount: absAmount,
        category: STARTING_BALANCE_CATEGORY,
        date: STARTING_BALANCE_DATE,
        cleared: true,
        projected: true,
      });
    } else {
      await base44.entities.Income.create({
        amount: absAmount,
        category: STARTING_BALANCE_CATEGORY,
        account_id: accountId,
        date: STARTING_BALANCE_DATE,
        notes: 'starting balance',
        cleared: true,
        projected: true,
      });
    }
  } else {
    if (matchIncome) {
      await base44.entities.Income.delete(matchIncome.id);
    }
    if (matchExpense) {
      await base44.entities.Expense.update(matchExpense.id, {
        amount: absAmount,
        category: STARTING_BALANCE_CATEGORY,
        date: STARTING_BALANCE_DATE,
        cleared: true,
        projected: true,
      });
    } else {
      await base44.entities.Expense.create({
        amount: absAmount,
        category: STARTING_BALANCE_CATEGORY,
        account_id: accountId,
        date: STARTING_BALANCE_DATE,
        notes: 'starting balance',
        cleared: true,
        projected: true,
      });
    }
  }
};

const colorOptions = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export default function AccountForm({ account, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [formData, setFormData] = useState(account ? {
    name: account.name,
    starting_balance: account.starting_balance.toString(),
    category: account.category,
    color: account.color,
    currency: account.currency || 'EUR'
  } : {
    name: '',
    starting_balance: '',
    category: '',
    color: colorOptions[0],
    currency: 'EUR'
  });

  const capitalizeFirst = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.starting_balance || !formData.category || !formData.currency) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    const normalizedName = capitalizeFirst(formData.name);
    const normalizedBalance = parseFloat(formData.starting_balance);
    
    if (account) {
      const hasChanges =
        account.name !== normalizedName ||
        Number(account.starting_balance) !== Number(normalizedBalance) ||
        account.category !== formData.category ||
        account.color !== formData.color ||
        (account.currency || 'EUR') !== formData.currency;

      if (hasChanges) {
        await base44.entities.Account.update(account.id, {
          name: normalizedName,
          starting_balance: normalizedBalance,
          category: formData.category,
          color: formData.color,
          currency: formData.currency
        });
        await ensureStartingBalanceTransaction(account.id, normalizedBalance);
        toast.success('Account updated successfully');
      } else {
        toast.info('No changes to update.');
      }
    } else {
      const created = await base44.entities.Account.create({
        name: normalizedName,
        starting_balance: normalizedBalance,
        category: formData.category,
        color: formData.color,
        currency: formData.currency
      });
      await ensureStartingBalanceTransaction(created.id, normalizedBalance);
      toast.success('Account created successfully');
    }
    
    setLoading(false);
    onSuccess();
  };

  const handleDelete = async () => {
    if (!account) return;
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!account) return;
    setConfirmDeleteOpen(false);
    setDeleting(true);
    try {
      const [expenses, income, transfers] = await Promise.all([
        base44.entities.Expense.list(),
        base44.entities.Income.list(),
        base44.entities.Transfer.list(),
      ]);

      const isStarting = (t) =>
        (t.category || '').toLowerCase() === STARTING_BALANCE_CATEGORY;
      const accExpenses = expenses.filter((e) => e.account_id === account.id);
      const accIncome = income.filter((i) => i.account_id === account.id);
      const hasRegularExpense = accExpenses.some((e) => !isStarting(e));
      const hasRegularIncome = accIncome.some((i) => !isStarting(i));
      const hasTransfer = transfers.some(
        (t) => t.from_account_id === account.id || t.to_account_id === account.id
      );
      const startingAmount = Number(account.starting_balance) || 0;

      if (hasRegularExpense || hasRegularIncome || hasTransfer || startingAmount !== 0) {
        toast.error('Account cannot be deleted while it has transactions or a non-zero starting balance.');
        return;
      }

      const startingExpenses = accExpenses.filter(isStarting);
      const startingIncome = accIncome.filter(isStarting);
      for (const item of startingExpenses) {
        await base44.entities.Expense.delete(item.id);
      }
      for (const item of startingIncome) {
        await base44.entities.Income.delete(item.id);
      }

      await base44.entities.Account.delete(account.id);
      toast.success('Account deleted successfully');
      onSuccess();
    } catch (error) {
      toast.error('Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Account Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Main Bank Account"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="starting_balance">Starting Balance *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
            {getCurrencySymbol(formData.currency || 'EUR')}
          </span>
          <Input
            id="starting_balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            className="pl-7"
            value={formData.starting_balance}
            onChange={(e) => setFormData({ ...formData, starting_balance: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category *</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
          required
          className="w-full"
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {accountCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.replace('_', ' ').charAt(0).toUpperCase() + cat.replace('_', ' ').slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Currency *</Label>
        <Select
          value={formData.currency}
          onValueChange={(value) => setFormData({ ...formData, currency: value })}
          required
          className="w-full"
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((currency) => (
              <SelectItem key={currency.code} value={currency.code}>
                {currency.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="color">Color *</Label>
        <div className="flex gap-2 flex-wrap">
          {colorOptions.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={`w-10 h-10 rounded-lg transition-all ${
                formData.color === color 
                  ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' 
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={loading || deleting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-slate-900 hover:bg-slate-800"
          disabled={loading || deleting}
        >
          {loading ? (account ? 'Updating...' : 'Creating...') : (account ? 'Update Account' : 'Create Account')}
        </Button>
      </div>

      {account && (
        <div className="pt-1">
          <Button
            type="button"
            className="w-full border-red-200 text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            disabled={loading || deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Account'}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <AlertDialogCancel onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
