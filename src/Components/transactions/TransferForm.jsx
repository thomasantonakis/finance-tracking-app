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
import { sortAccountsByOrder, getCurrencySymbol, getMainCurrency, readFxRates } from '@/utils';

export default function TransferForm({ onSuccess, onCancel, initialData, initialDate, onAfterCreate }) {
  const [loading, setLoading] = useState(false);
  const [amountToEdited, setAmountToEdited] = useState(false);
  const [formData, setFormData] = useState(() => ({
    from_account_id: initialData?.from_account_id || '',
    to_account_id: initialData?.to_account_id || '',
    amount: initialData?.amount?.toString() || '',
    amount_to: initialData?.amount_to?.toString() || '',
    subcategory: initialData?.subcategory || '',
    date: initialDate || format(new Date(), 'yyyy-MM-dd'),
    notes: initialData?.notes || '',
    cleared: initialData?.cleared ?? true,
    projected: initialData?.projected ?? false
  }));

  React.useEffect(() => {
    setFormData({
      from_account_id: initialData?.from_account_id || '',
      to_account_id: initialData?.to_account_id || '',
      amount: initialData?.amount?.toString() || '',
      amount_to: initialData?.amount_to?.toString() || '',
      subcategory: initialData?.subcategory || '',
      date: initialDate || format(new Date(), 'yyyy-MM-dd'),
      notes: initialData?.notes || '',
      cleared: initialData?.cleared ?? true,
      projected: initialData?.projected ?? false
    });
    setAmountToEdited(!!initialData?.amount_to);
  }, [initialData, initialDate]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });
  const orderedAccounts = sortAccountsByOrder(accounts);
  const fromAccountCurrency = accounts.find((a) => a.id === formData.from_account_id)?.currency || 'EUR';
  const toAccountCurrency = accounts.find((a) => a.id === formData.to_account_id)?.currency || 'EUR';
  const currencyMismatch = formData.from_account_id && formData.to_account_id && fromAccountCurrency !== toAccountCurrency;
  const mainCurrency = getMainCurrency() || 'EUR';
  const fxRates = readFxRates(mainCurrency);
  const fromOptions = orderedAccounts.filter((account) => account.id !== formData.to_account_id);
  const toOptions = orderedAccounts.filter((account) => account.id !== formData.from_account_id);
  const sameAccountError = formData.from_account_id && formData.to_account_id && formData.from_account_id === formData.to_account_id;

  const getFxRate = (from, to) => {
    if (!fxRates?.rates) return null;
    if (from === to) return 1;
    if (from === mainCurrency) return fxRates.rates[to] ?? null;
    if (to === mainCurrency) {
      const rate = fxRates.rates[from];
      return rate ? 1 / rate : null;
    }
    const rateFrom = fxRates.rates[from];
    const rateTo = fxRates.rates[to];
    if (!rateFrom || !rateTo) return null;
    return rateTo / rateFrom;
  };

  const fromAmount = parseFloat(formData.amount);
  const toAmount = parseFloat(formData.amount_to);
  const expectedRate = currencyMismatch ? getFxRate(fromAccountCurrency, toAccountCurrency) : null;
  const impliedRate = currencyMismatch && fromAmount > 0 && toAmount > 0 ? toAmount / fromAmount : null;
  const fxDiff =
    expectedRate && impliedRate ? Math.abs(impliedRate / expectedRate - 1) : null;
  const fxMessage =
    currencyMismatch && expectedRate && fromAmount > 0
      ? `Implied FX: ${impliedRate ? impliedRate.toFixed(4) : '—'} (expected ${expectedRate.toFixed(4)}${fxDiff !== null ? `, ${(fxDiff * 100).toFixed(1)}%` : ''})`
      : null;
  const fxWarning = fxDiff !== null && fxDiff > 0.05;

  React.useEffect(() => {
    if (!currencyMismatch || !expectedRate || !formData.amount) return;
    if (amountToEdited) return;
    const amountValue = parseFloat(formData.amount);
    if (!Number.isFinite(amountValue)) return;
    const computed = amountValue * expectedRate;
    setFormData((prev) => ({ ...prev, amount_to: computed.toFixed(2) }));
  }, [currencyMismatch, expectedRate, formData.amount, amountToEdited]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.from_account_id || !formData.to_account_id || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (currencyMismatch && !formData.amount_to) {
      toast.error('Please enter both amounts for mismatched currencies');
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
      amount_to: currencyMismatch ? parseFloat(formData.amount_to) : undefined,
      from_account_id: formData.from_account_id,
      to_account_id: formData.to_account_id,
      subcategory: formData.subcategory || undefined,
      date: formData.date,
      notes: formData.notes || undefined,
      cleared: formData.cleared,
      projected: formData.projected
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
        <Label htmlFor="from_account">From Account *</Label>
        <Select
          value={formData.from_account_id}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              from_account_id: value,
              to_account_id: prev.to_account_id === value ? '' : prev.to_account_id
            }))
          }
          required
          className="w-full"
        >
          <SelectTrigger className="w-full">
            {fromAccount ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: fromAccount.color }}
                />
                <span>{fromAccount.name}</span>
              </div>
            ) : (
              <span className="text-slate-500">Select source account</span>
            )}
          </SelectTrigger>
          <SelectContent>
            {fromOptions.map((account) => (
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

      <div className="flex justify-center">
        <div className="p-2 bg-slate-100 rounded-full">
          <ArrowRight className="w-5 h-5 text-slate-600" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="to_account">To Account *</Label>
        <Select
          value={formData.to_account_id}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              to_account_id: value,
              from_account_id: prev.from_account_id === value ? '' : prev.from_account_id
            }))
          }
          required
          className="w-full"
        >
          <SelectTrigger className="w-full">
            {toAccount ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: toAccount.color }}
                />
                <span>{toAccount.name}</span>
              </div>
            ) : (
              <span className="text-slate-500">Select destination account</span>
            )}
          </SelectTrigger>
          <SelectContent>
            {toOptions.map((account) => (
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
        <Label htmlFor="amount">Amount *</Label>
        <div className={`grid gap-3 ${currencyMismatch ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
              {getCurrencySymbol(fromAccountCurrency)}
            </span>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="pl-7 text-lg"
              value={formData.amount}
              onChange={(e) => {
                setAmountToEdited(false);
                setFormData({ ...formData, amount: e.target.value });
              }}
              required
            />
          </div>
          {currencyMismatch && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                {getCurrencySymbol(toAccountCurrency)}
              </span>
              <Input
                id="amount_to"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-7 text-lg"
                value={formData.amount_to}
                onChange={(e) => {
                  setAmountToEdited(true);
                  setFormData({ ...formData, amount_to: e.target.value });
                }}
                required
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subcategory">Subcategory</Label>
        <Input
          id="subcategory"
          placeholder="e.g., Rent, Fees, etc."
          value={formData.subcategory}
          onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
        />
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

      <div className="pt-2 space-y-2">
        {sameAccountError && (
          <div className="text-sm text-red-600">
            Source and destination accounts must be different.
          </div>
        )}
        {fxMessage && (
          <div className={`text-sm ${fxWarning ? 'text-red-600' : 'text-slate-400'}`}>
            {fxMessage}
          </div>
        )}
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
            className="flex-1 bg-blue-500 hover:bg-blue-600"
            disabled={loading || sameAccountError}
          >
            {loading ? 'Creating...' : 'Create Transfer'}
          </Button>
        </div>
      </div>
    </form>
  );
}
