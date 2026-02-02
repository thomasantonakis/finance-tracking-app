import React, { useState } from 'react';
import { format } from 'date-fns';
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
import { sortAccountsByOrder } from '@/utils';
import CategoryCombobox from './CategoryCombobox';

const expenseCategories = [
  'food', 'transport', 'utilities', 'entertainment', 'shopping', 
  'health', 'education', 'travel', 'subscriptions', 'housing', 'other'
];

const incomeCategories = [
  'salary', 'freelance', 'investment', 'business', 'gift', 
  'refund', 'rental', 'bonus', 'other'
];

const categoryLabels = {
  expense: 'Expense Category',
  income: 'Income Category'
};

export default function TransactionForm({ type, onSuccess, onCancel, initialData, initialDate, onAfterCreate, filterSubcategoryByCategory = true }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => ({
    amount: initialData?.amount?.toString() || '',
    category: initialData?.category || '',
    subcategory: initialData?.subcategory || '',
    account_id: initialData?.account_id || '',
    date: initialDate || format(new Date(), 'yyyy-MM-dd'),
    notes: initialData?.notes || '',
    cleared: initialData?.cleared ?? true,
    projected: initialData?.projected ?? false,
    important: initialData?.important ?? false
  }));

  React.useEffect(() => {
    setFormData({
      amount: initialData?.amount?.toString() || '',
      category: initialData?.category || '',
      subcategory: initialData?.subcategory || '',
      account_id: initialData?.account_id || '',
      date: initialDate || format(new Date(), 'yyyy-MM-dd'),
      notes: initialData?.notes || '',
      cleared: initialData?.cleared ?? true,
      projected: initialData?.projected ?? false,
      important: initialData?.important ?? false
    });
  }, [initialData, initialDate, type]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });
  const orderedAccounts = sortAccountsByOrder(accounts);

  const transactionEntity = type === 'income' ? 'Income' : 'Expense';
  const { data: transactions = [] } = useQuery({
    queryKey: [transactionEntity],
    queryFn: () => base44.entities[transactionEntity].list(),
  });

  const entityName = type === 'income' ? 'IncomeCategory' : 'ExpenseCategory';
  const { data: customCategories = [] } = useQuery({
    queryKey: [entityName],
    queryFn: () => base44.entities[entityName].list(),
  });
  const isStartingBalanceLabel = (value) => {
    const v = (value || '').trim().toLowerCase();
    return v === 'starting balance' || v === 'system - starting balance';
  };

  // Deduplicate categories by name (keep first occurrence)
  const deduplicatedCategories = customCategories.length > 0 
    ? customCategories
        .sort((a, b) => a.order - b.order)
        .filter((cat, index, self) => 
          index === self.findIndex(c => c.name.toLowerCase() === cat.name.toLowerCase())
        )
        .filter((cat) => !isStartingBalanceLabel(cat.name))
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
    const selectedCategory = (formData.category || '').trim().toLowerCase();
    const totals = transactions.reduce((acc, t) => {
      if (filterSubcategoryByCategory && selectedCategory && (t.category || '').toLowerCase() !== selectedCategory) return acc;
      const raw = (t.subcategory || '').trim();
      if (!raw || isStartingBalanceLabel(raw)) return acc;
      const key = raw.toLowerCase();
      if (!acc[key]) acc[key] = { name: raw, total: 0 };
      acc[key].total += t.amount || 0;
      return acc;
    }, {});

    return Object.values(totals).sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
  }, [transactions, formData.category, filterSubcategoryByCategory]);

  const topCategoryBySubcategory = React.useMemo(() => {
    const counts = {};
    transactions.forEach((t) => {
      const sub = (t.subcategory || '').trim();
      const cat = (t.category || '').trim();
      if (!sub || !cat) return;
      const subKey = sub.toLowerCase();
      const catKey = cat.toLowerCase();
      if (!counts[subKey]) counts[subKey] = {};
      if (!counts[subKey][catKey]) {
        counts[subKey][catKey] = { name: cat, count: 0 };
      }
      counts[subKey][catKey].count += 1;
    });

    const result = {};
    Object.entries(counts).forEach(([subKey, catMap]) => {
      const best = Object.values(catMap).sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      })[0];
      if (best) result[subKey] = best.name;
    });
    return result;
  }, [transactions]);

  const normalizeCategoryName = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    return trimmed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const rawCategory = (formData.category || '').trim();
    const rawSubcategory = (formData.subcategory || '').trim();
    if (!formData.amount || !rawCategory || !rawSubcategory || !formData.account_id || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (accounts.length === 0) {
      toast.error('Please create an account first in Settings');
      return;
    }

    setLoading(true);
    
    const entity = type === 'income' ? 'Income' : 'Expense';
    const finalCategory = normalizeCategoryName(rawCategory);
    const matchedCategory = deduplicatedCategories.find(
      (cat) => (cat.name || cat).toLowerCase() === finalCategory.toLowerCase()
    );
    const categoryExists = !!matchedCategory;
    if (!categoryExists) {
      const existingCategories = customCategories.length > 0 ? customCategories : [];
      await base44.entities[entityName].create({
        name: finalCategory,
        color: '#64748b',
        order: existingCategories.length
      });
    } else if (matchedCategory?.id && matchedCategory.name !== finalCategory) {
      await base44.entities[entityName].update(matchedCategory.id, {
        name: finalCategory
      });
      const categoryTransactions = transactions.filter(
        (t) => (t.category || '') === matchedCategory.name
      );
      for (const t of categoryTransactions) {
        await base44.entities[entity].update(t.id, { category: finalCategory });
      }
    }

    await base44.entities[entity].create({
      amount: parseFloat(formData.amount),
      category: finalCategory,
      subcategory: rawSubcategory,
      account_id: formData.account_id,
      date: formData.date,
      notes: formData.notes || undefined,
      cleared: formData.cleared,
      projected: formData.projected,
      important: formData.important
    });
    
    toast.success(`${type === 'income' ? 'Income' : 'Expense'} added successfully`);
    setLoading(false);
    onAfterCreate?.(formData.date);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col max-h-[70vh]">
      <div className="flex-1 overflow-auto space-y-5 pr-1 pb-20">
        <CategoryCombobox
          id="subcategory"
          label="Subcategory *"
          value={formData.subcategory}
          onChange={(value) => setFormData({ ...formData, subcategory: value })}
          onSelectItem={(item) => {
            const suggestedCategory = topCategoryBySubcategory[item.label.toLowerCase()];
            if (suggestedCategory) {
              setFormData((prev) => ({
                ...prev,
                category: suggestedCategory
              }));
            }
          }}
          categories={subcategoryOptions.map((item) => item.name)}
          placeholder="Select subcategory"
          required
        />

        <CategoryCombobox
          id="category"
          label={`${categoryLabels[type]} *`}
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
              className="pl-7 text-lg"
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
                <SelectItem key={account.id} value={account.id} label={account.name}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: account.color }}
                    />
                    {account.name}
                  </div>
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
          <Label>Importance</Label>
          <Select
            value={formData.important ? 'true' : 'false'}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, important: value === 'true' }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {type === 'income' ? (
                <>
                  <SelectItem value="true">Main</SelectItem>
                  <SelectItem value="false">Extras</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="true">Must Have</SelectItem>
                  <SelectItem value="false">Nice to Have</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Add any additional details..."
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="cleared"
              checked={formData.cleared}
              onChange={(e) => setFormData({ ...formData, cleared: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300"
            />
            <Label htmlFor="cleared" className="font-normal cursor-pointer">Cleared</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="projected"
              checked={formData.projected}
              onChange={(e) => setFormData({ ...formData, projected: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300"
            />
            <Label htmlFor="projected" className="font-normal cursor-pointer">Projected</Label>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white pt-3">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className={`flex-1 ${
              type === 'income' 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-red-500 hover:bg-red-600'
            }`}
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </div>
    </form>
  );
}
