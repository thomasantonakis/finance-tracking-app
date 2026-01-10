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
import { ArrowRight } from 'lucide-react';

export default function TransferForm({ onSuccess, onCancel, initialData, initialDate, onAfterCreate }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => ({
    amount: initialData?.amount?.toString() || '',
    from_account_id: initialData?.from_account_id || '',
    to_account_id: initialData?.to_account_id || '',
    date: initialDate || format(new Date(), 'yyyy-MM-dd'),
    notes: initialData?.notes || ''
  }));

  React.useEffect(() => {
    setFormData({
      amount: initialData?.amount?.toString() || '',
      from_account_id: initialData?.from_account_id || '',
      to_account_id: initialData?.to_account_id || '',
      date: initialDate || format(new Date(), 'yyyy-MM-dd'),
      notes: initialData?.notes || ''
    });
  }, [initialData, initialDate]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.from_account_id || !formData.to_account_id || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.from_account_id === formData.to_account_id) {
      toast.error('Source and destination accounts must be different');
      return;
    }

    if (accounts.length === 0) {
      toast.error('Please create at least 2 accounts first');
      return;
    }

    setLoading(true);
    
    await base44.entities.Transfer.create({
      amount: parseFloat(formData.amount),
      from_account_id: formData.from_account_id,
      to_account_id: formData.to_account_id,
      date: formData.date,
      notes: formData.notes || undefined
    });
    
    toast.success('Transfer created successfully');
    setLoading(false);
    onAfterCreate?.(formData.date);
    onSuccess();
  };

  const fromAccount = accounts.find(a => a.id === formData.from_account_id);
  const toAccount = accounts.find(a => a.id === formData.to_account_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
        <Label htmlFor="from_account">From Account *</Label>
        <Select
          value={formData.from_account_id}
          onValueChange={(value) => setFormData({ ...formData, from_account_id: value })}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select source account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
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

      <div className="flex justify-center">
        <div className="p-2 bg-slate-100 rounded-full">
          <ArrowRight className="w-5 h-5 text-slate-600" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="to_account">To Account *</Label>
        <Select
          value={formData.to_account_id}
          onValueChange={(value) => setFormData({ ...formData, to_account_id: value })}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select destination account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
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
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Add any additional details..."
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
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
          className="flex-1 bg-blue-500 hover:bg-blue-600"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Transfer'}
        </Button>
      </div>
    </form>
  );
}
