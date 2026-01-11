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

export default function EditTransferModal({ open, onOpenChange, transfer, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: transfer?.amount?.toString() || '',
    from_account_id: transfer?.from_account_id || '',
    to_account_id: transfer?.to_account_id || '',
    date: transfer?.date || '',
    notes: transfer?.notes || '',
    cleared: transfer?.cleared ?? true,
    projected: transfer?.projected ?? true
  });

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

    setLoading(true);
    
    await base44.entities.Transfer.update(transfer.id, {
      amount: parseFloat(formData.amount),
      from_account_id: formData.from_account_id,
      to_account_id: formData.to_account_id,
      date: formData.date,
      notes: formData.notes || undefined,
      cleared: formData.cleared,
      projected: formData.projected
    });
    
    toast.success('Transfer updated successfully');
    setLoading(false);
    onSuccess();
    onOpenChange(false);
  };

  const createdStamp = transfer?.created_at ?? transfer?.created_date;
  const updatedStamp = transfer?.updated_at ?? transfer?.updated_date ?? createdStamp;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Transfer</DialogTitle>
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
            <Label htmlFor="from">From Account *</Label>
            <Select
              value={formData.from_account_id}
              onValueChange={(value) => setFormData({ ...formData, from_account_id: value })}
              required
              className="w-full"
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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
            <Label htmlFor="to">To Account *</Label>
            <Select
              value={formData.to_account_id}
              onValueChange={(value) => setFormData({ ...formData, to_account_id: value })}
              required
              className="w-full"
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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
              className="flex-1 bg-blue-600 hover:bg-blue-700"
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
