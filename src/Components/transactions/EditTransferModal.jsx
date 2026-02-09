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
import { sortAccountsByOrder, getCurrencySymbol, getMainCurrency, readFxRates, evaluateNumericInput, needsEvaluation, roundToTwoDecimals, toTwoDecimalString } from '@/utils';
import { ArrowRight } from 'lucide-react';

export default function EditTransferModal({ open, onOpenChange, transfer, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [amountToEdited, setAmountToEdited] = useState(false);
  const [formData, setFormData] = useState({
    from_account_id: transfer?.from_account_id || '',
    to_account_id: transfer?.to_account_id || '',
    amount: transfer?.amount?.toString() || '',
    amount_to: transfer?.amount_to?.toString() || '',
    subcategory: transfer?.subcategory || '',
    date: transfer?.date || '',
    notes: transfer?.notes || '',
    cleared: transfer?.cleared ?? true,
    projected: transfer?.projected ?? true
  });
  React.useEffect(() => {
    setAmountToEdited(!!transfer?.amount_to);
  }, [transfer]);

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
    const amountValue = evaluateNumericInput(formData.amount);
    const roundedAmount = roundToTwoDecimals(amountValue);
    if (roundedAmount === null || !Number.isFinite(roundedAmount) || roundedAmount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    const amountToValue = formData.amount_to ? evaluateNumericInput(formData.amount_to) : null;
    const roundedAmountTo = amountToValue === null ? null : roundToTwoDecimals(amountToValue);
    if (currencyMismatch && (roundedAmountTo === null || !Number.isFinite(roundedAmountTo) || roundedAmountTo < 0)) {
      toast.error('Please enter both amounts for mismatched currencies');
      return;
    }

    if (formData.from_account_id === formData.to_account_id) {
      toast.error('Source and destination accounts must be different');
      return;
    }

    setLoading(true);
    
    await base44.entities.Transfer.update(transfer.id, {
      amount: roundedAmount,
      amount_to: currencyMismatch ? roundedAmountTo : undefined,
      from_account_id: formData.from_account_id,
      to_account_id: formData.to_account_id,
      subcategory: formData.subcategory || undefined,
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
  const fromAccount = accounts.find((a) => a.id === formData.from_account_id);
  const toAccount = accounts.find((a) => a.id === formData.to_account_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Transfer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[calc(80vh-72px)] overflow-y-auto pr-1 pb-12">
          <div className="space-y-2">
            <Label htmlFor="from">From Account *</Label>
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
                  <span className="text-slate-500">Select account</span>
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
            <Label htmlFor="to">To Account *</Label>
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
                  <span className="text-slate-500">Select account</span>
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
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="pl-7"
                  value={formData.amount}
                  onChange={(e) => {
                    setAmountToEdited(false);
                    setFormData({ ...formData, amount: e.target.value });
                  }}
                  onBlur={() => {
                    const evaluated = evaluateNumericInput(formData.amount);
                    if (evaluated !== null) {
                      setFormData((prev) => ({ ...prev, amount: toTwoDecimalString(evaluated) }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    if (needsEvaluation(formData.amount)) {
                      const evaluated = evaluateNumericInput(formData.amount);
                      if (evaluated !== null) {
                        e.preventDefault();
                        setFormData((prev) => ({ ...prev, amount: toTwoDecimalString(evaluated) }));
                      }
                    }
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
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-7"
                    value={formData.amount_to}
                    onChange={(e) => {
                      setAmountToEdited(true);
                      setFormData({ ...formData, amount_to: e.target.value });
                    }}
                    onBlur={() => {
                      const evaluated = evaluateNumericInput(formData.amount_to);
                      if (evaluated !== null) {
                        setFormData((prev) => ({ ...prev, amount_to: toTwoDecimalString(evaluated) }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (needsEvaluation(formData.amount_to)) {
                        const evaluated = evaluateNumericInput(formData.amount_to);
                        if (evaluated !== null) {
                          e.preventDefault();
                          setFormData((prev) => ({ ...prev, amount_to: toTwoDecimalString(evaluated) }));
                        }
                      }
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
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={loading || sameAccountError}
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
