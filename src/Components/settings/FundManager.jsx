import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowUp, ArrowDown, Edit, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const colorOptions = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1',
  '#8b5cf6', '#14b8a6', '#06b6d4', '#f97316', '#84cc16',
];

export default function FundManager() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', color: colorOptions[0] });

  const { data: funds = [] } = useQuery({
    queryKey: ['funds'],
    queryFn: () => base44.entities.Fund.list('order'),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const orderedFunds = useMemo(() => {
    const map = new Map();
    funds.forEach((fund) => {
      const key = (fund.name || '').trim().toLowerCase();
      if (!key || map.has(key)) return;
      map.set(key, fund);
    });
    return [...map.values()].sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [funds]);

  const createMutation = useMutation({
    mutationFn: (payload) => base44.entities.Fund.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      setCreating(false);
      setFormData({ name: '', color: colorOptions[0] });
      toast.success('Fund created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Fund.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      setEditingId(null);
      toast.success('Fund updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fund) => {
      const affected = accounts.filter((acc) => acc.fund_id === fund.id);
      if (affected.length > 0) {
        await base44.entities.Account.updateMany(
          affected.map((acc) => ({ id: acc.id, fund_id: null }))
        );
      }
      await base44.entities.Fund.delete(fund.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Fund deleted');
    },
  });

  const handleCreate = () => {
    const name = (formData.name || '').trim();
    if (!name) {
      toast.error('Please enter a fund name');
      return;
    }
    const exists = orderedFunds.some((f) => f.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast.error('A fund with this name already exists');
      return;
    }
    createMutation.mutate({
      name,
      color: formData.color,
      order: orderedFunds.length,
    });
  };

  const startEdit = (fund) => {
    setEditingId(fund.id);
    setFormData({ name: fund.name, color: fund.color || colorOptions[0] });
  };

  const handleUpdate = (fund) => {
    const name = (formData.name || '').trim();
    if (!name) {
      toast.error('Please enter a fund name');
      return;
    }
    const exists = orderedFunds.some(
      (f) => f.name.toLowerCase() === name.toLowerCase() && f.id !== fund.id
    );
    if (exists) {
      toast.error('A fund with this name already exists');
      return;
    }
    updateMutation.mutate({
      id: fund.id,
      data: { name, color: formData.color },
    });
  };

  const moveFund = (fund, direction) => {
    const idx = orderedFunds.findIndex((f) => f.id === fund.id);
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= orderedFunds.length) return;
    const target = orderedFunds[nextIdx];
    const currentOrder = fund.order ?? idx;
    const targetOrder = target.order ?? nextIdx;
    base44.entities.Fund.updateMany([
      { id: fund.id, order: targetOrder },
      { id: target.id, order: currentOrder },
    ]).then(() => {
      queryClient.invalidateQueries({ queryKey: ['funds'] });
    });
  };

  return (
    <div className="space-y-3">
      {orderedFunds.map((fund, index) => {
        const isEditing = editingId === fund.id;
        return (
          <div key={fund.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: fund.color || '#94a3b8' }}
            />
            {isEditing ? (
              <>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, color }))}
                      className={`w-6 h-6 rounded-full ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <Button size="icon" variant="ghost" onClick={() => handleUpdate(fund)}>
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-slate-900 font-medium">{fund.name}</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveFund(fund, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveFund(fund, 1)}
                    disabled={index === orderedFunds.length - 1}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(fund)}>
                    <Edit className="w-4 h-4 text-slate-600" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(fund)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {creating ? (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          <Input
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Fund name"
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, color }))}
                className={`w-6 h-6 rounded-full ${
                  formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Button size="icon" variant="ghost" onClick={handleCreate}>
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setCreating(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setCreating(true)} className="w-full">
          Add Fund
        </Button>
      )}
    </div>
  );
}
