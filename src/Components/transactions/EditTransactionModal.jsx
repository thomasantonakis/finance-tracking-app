import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { sortAccountsByOrder } from '@/utils';
import CategoryCombobox from './CategoryCombobox';

const expenseCategories = ['food', 'transport', 'utilities', 'entertainment', 'shopping', 'health', 'education', 'travel', 'subscriptions', 'housing', 'other'];
const incomeCategories = ['salary', 'freelance', 'investment', 'business', 'gift', 'refund', 'rental', 'bonus', 'other'];

export default function EditTransactionModal({ open, onOpenChange, transaction, type, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: transaction?.amount?.toString() || '',
    category: transaction?.category || '',
    subcategory: transaction?.subcategory || '',
    account_id: transaction?.account_id || '',
    date: transaction?.date || format(new Date(), 'yyyy-MM-dd'),
    notes: transaction?.notes || '',
    cleared: transaction?.cleared ?? true,
    projected: transaction?.projected ?? true
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });
  const orderedAccounts = sortAccountsByOrder(accounts);

  React.useEffect(() => {
    if (!transaction) return;
    setFormData({
      amount: transaction?.amount?.toString() || '',
      category: transaction?.category || '',
      subcategory: transaction?.subcategory || '',
      account_id: transaction?.account_id || '',
      date: transaction?.date || format(new Date(), 'yyyy-MM-dd'),
      notes: transaction?.notes || '',
      cleared: transaction?.cleared ?? true,
      projected: transaction?.projected ?? true
    });
  }, [transaction, type]);

  const entityName = type === 'income' ? 'IncomeCategory' : 'ExpenseCategory';
  const { data: customCategories = [] } = useQuery({
    queryKey: [entityName],
    queryFn: () => base44.entities[entityName].list(),
  });

  const transactionEntity = type === 'income' ? 'Income' : 'Expense';
  const { data: transactions = [] } = useQuery({
    queryKey: [transactionEntity],
    queryFn: () => base44.entities[transactionEntity].list(),
  });

  // Deduplicate categories by name (keep first occurrence)
  const deduplicatedCategories = customCategories.length > 0 
    ? customCategories
        .sort((a, b) => a.order - b.order)
        .filter((cat, index, self) => 
          index === self.findIndex(c => c.name.toLowerCase() === cat.name.toLowerCase())
        )
    : (type === 'income' ? incomeCategories : expenseCategories).map(cat => ({ name: cat, color: '#64748b' }));

  const categories = React.useMemo(() => {
    const totals = transactions.reduce((acc, t) => {
      const key = (t.category || '').toLowerCase();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + (t.amount || 0);
      return acc;
    }, {});

    return [...deduplicatedCategories].sort((a, b) => {
      const aKey = (a.name || a).toLowerCase();
      const bKey = (b.name || b).toLowerCase();
      const aTotal = totals[aKey] || 0;
      const bTotal = totals[bKey] || 0;
      if (aTotal !== bTotal) return bTotal - aTotal;
      return aKey.localeCompare(bKey);
    });
  }, [deduplicatedCategories, transactions]);

  const subcategoryOptions = React.useMemo(() => {
    const totals = transactions.reduce((acc, t) => {
      const raw = (t.subcategory || '').trim();
      if (!raw) return acc;
      const key = raw.toLowerCase();
      if (!acc[key]) acc[key] = { name: raw, total: 0 };
      acc[key].total += t.amount || 0;
      return acc;
    }, {});

    return Object.values(totals).sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
  }, [transactions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
  const rawCategory = (formData.category || '').trim();
  const rawSubcategory = (formData.subcategory || '').trim();
  if (!formData.amount || !rawCategory || !rawSubcategory || !formData.account_id || !formData.date) {
    toast.error('Please fill in all required fields');
    return;
  }

    setLoading(true);
    
  const entity = type === 'income' ? 'Income' : 'Expense';
  const finalCategory = rawCategory.toLowerCase();
  const categoryExists = deduplicatedCategories.some(
    (cat) => (cat.name || cat).toLowerCase() === finalCategory
  );
  if (!categoryExists) {
    const existingCategories = customCategories.length > 0 ? customCategories : [];
    await base44.entities[entityName].create({
      name: finalCategory,
      color: '#64748b',
      order: existingCategories.length
    });
  }

  await base44.entities[entity].update(transaction.id, {
    amount: parseFloat(formData.amount),
    category: finalCategory,
    subcategory: rawSubcategory,
      account_id: formData.account_id,
      date: formData.date,
      notes: formData.notes || undefined,
      cleared: formData.cleared,
      projected: formData.projected
    });
    
    toast.success(`${type === 'income' ? 'Income' : 'Expense'} updated successfully`);
    setLoading(false);
    onSuccess();
    onOpenChange(false);
  };

  const createdStamp = transaction?.created_at ?? transaction?.created_date;
  const updatedStamp = transaction?.updated_at ?? transaction?.updated_date ?? createdStamp;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit {type === 'income' ? 'Income' : 'Expense'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col max-h-[70vh]">
          <div className="flex-1 overflow-auto space-y-4 pr-1 pb-20">
            <CategoryCombobox
              id="subcategory"
              label="Subcategory *"
              value={formData.subcategory}
              onChange={(value) => setFormData({ ...formData, subcategory: value })}
              categories={subcategoryOptions.map((item) => item.name)}
              placeholder="Select subcategory"
              required
            />

            <CategoryCombobox
              id="category"
              label="Category *"
              value={formData.category}
              onChange={(value) => setFormData({ ...formData, category: value })}
              categories={categories}
              placeholder={`Select ${type} category`}
              required
            />

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">€</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-7"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Account *</Label>
              <Select
                value={formData.account_id}
                onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                required
                className="w-full"
              >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
                <SelectContent>
                  {orderedAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="cleared"
                  checked={formData.cleared}
                  onChange={(e) => setFormData({ ...formData, cleared: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <Label htmlFor="cleared" className="font-normal cursor-pointer">Cleared</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="projected"
                  checked={formData.projected}
                  onChange={(e) => setFormData({ ...formData, projected: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <Label htmlFor="projected" className="font-normal cursor-pointer">Projected</Label>
              </div>
            </div>

            {createdStamp && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                  <div>Created: {new Date(createdStamp).toISOString().replace('T', ' ').slice(0, -1)} UTC</div>
                  {updatedStamp && (
                    <div>Updated: {new Date(updatedStamp).toISOString().replace('T', ' ').slice(0, -1)} UTC</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-white pt-3">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={`flex-1 ${
                  type === 'income' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                }`}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
