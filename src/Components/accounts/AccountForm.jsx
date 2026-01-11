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
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const accountCategories = ['cash', 'bank', 'credit_card', 'savings', 'investment', 'other'];

const colorOptions = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export default function AccountForm({ account, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(account ? {
    name: account.name,
    starting_balance: account.starting_balance.toString(),
    category: account.category,
    color: account.color
  } : {
    name: '',
    starting_balance: '',
    category: '',
    color: colorOptions[0]
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.starting_balance || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    if (account) {
      await base44.entities.Account.update(account.id, {
        name: formData.name,
        starting_balance: parseFloat(formData.starting_balance),
        category: formData.category,
        color: formData.color
      });
      toast.success('Account updated successfully');
    } else {
      await base44.entities.Account.create({
        name: formData.name,
        starting_balance: parseFloat(formData.starting_balance),
        category: formData.category,
        color: formData.color
      });
      toast.success('Account created successfully');
    }
    
    setLoading(false);
    onSuccess();
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">€</span>
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
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-slate-900 hover:bg-slate-800"
          disabled={loading}
        >
          {loading ? (account ? 'Updating...' : 'Creating...') : (account ? 'Update Account' : 'Create Account')}
        </Button>
      </div>
    </form>
  );
}
