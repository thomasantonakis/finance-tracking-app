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
    cleared: transaction?.cleared || false,
    projected: transaction?.projected || false,
    newCategoryName: ''
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const entityName = type === 'income' ? 'IncomeCategory' : 'ExpenseCategory';
  const { data: customCategories = [] } = useQuery({
    queryKey: [entityName],
    queryFn: () => base44.entities[entityName].list(),
  });

  // Deduplicate categories by name (keep first occurrence)
  const deduplicatedCategories = customCategories.length > 0 
    ? customCategories
        .sort((a, b) => a.order - b.order)
        .filter((cat, index, self) => 
          index === self.findIndex(c => c.name.toLowerCase() === cat.name.toLowerCase())
        )
    : (type === 'income' ? incomeCategories : expenseCategories).map(cat => ({ name: cat, color: '#64748b' }));

  const categories = deduplicatedCategories;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let finalCategory = formData.category;
    
    if (formData.category === '__new__') {
      if (!formData.newCategoryName) {
        toast.error('Please enter a category name');
        return;
      }
      finalCategory = formData.newCategoryName.toLowerCase();
      
      // Create the new category
      const entityName = type === 'income' ? 'IncomeCategory' : 'ExpenseCategory';
      const existingCategories = customCategories.length > 0 ? customCategories : [];
      await base44.entities[entityName].create({
        name: finalCategory,
        color: '#64748b',
        order: existingCategories.length
      });
    }
    
    if (!formData.amount || !finalCategory || !formData.account_id || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    const entity = type === 'income' ? 'Income' : 'Expense';
    await base44.entities[entity].update(transaction.id, {
      amount: parseFloat(formData.amount),
      category: finalCategory,
      subcategory: formData.subcategory || undefined,
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="category">Category *</Label>
            {formData.category === '__new__' ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter new category name"
                  value={formData.newCategoryName || ''}
                  onChange={(e) => setFormData({ ...formData, newCategoryName: e.target.value })}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setFormData({ ...formData, category: transaction?.category || '', newCategoryName: '' })}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                required
                className="w-full"
              >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${type} category`} />
            </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.name || cat} value={cat.name || cat} label={cat.name || cat}>
                      <div className="flex items-center gap-2">
                        {cat.color && (
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        {(cat.name || cat).charAt(0).toUpperCase() + (cat.name || cat).slice(1)}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__" label="+ New Category">
                    <div className="flex items-center gap-2 text-blue-600">
                      <span>+ New Category</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategory</Label>
            <Input
              id="subcategory"
              placeholder="e.g., Groceries, Gas, etc."
              value={formData.subcategory}
              onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
            />
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
                {accounts.map((account) => (
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

          <div className="flex gap-3 pt-2">
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
