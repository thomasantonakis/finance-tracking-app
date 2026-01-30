import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit, Trash2, Check, X } from 'lucide-react';
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
import { formatAmount } from '@/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const colorOptions = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];
const RESERVED_CATEGORY_NAMES = new Set(['starting balance', 'system - starting balance']);

export default function CategoryManager({ type }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', color: colorOptions[0] });
  const [mergeDialog, setMergeDialog] = useState({ open: false, existingCategory: null, editingId: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, category: null, target: '' });
  const queryClient = useQueryClient();

  const entityName = type === 'expense' ? 'ExpenseCategory' : 'IncomeCategory';
  const transactionEntity = type === 'expense' ? 'Expense' : 'Income';

  const { data: rawCategories = [] } = useQuery({
    queryKey: [entityName],
    queryFn: () => base44.entities[entityName].list(),
  });

  // Deduplicate categories by name and sort alphabetically
  const categoriesMap = new Map();
  rawCategories.forEach(cat => {
    const nameLower = cat.name.toLowerCase();
    if (!categoriesMap.has(nameLower)) {
      categoriesMap.set(nameLower, cat);
    }
  });
  const categories = Array.from(categoriesMap.values())
    .filter((cat) => !RESERVED_CATEGORY_NAMES.has(cat.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: transactions = [] } = useQuery({
    queryKey: [transactionEntity],
    queryFn: () => base44.entities[transactionEntity].list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities[entityName].create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityName] });
      setCreating(false);
      setFormData({ name: '', color: colorOptions[0] });
      toast.success('Category created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities[entityName].update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityName] });
      setEditing(null);
      toast.success('Category updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (category) => {
      const nameLower = category.name.toLowerCase();
      const duplicates = rawCategories.filter((c) => c.name.toLowerCase() === nameLower);
      for (const dup of duplicates) {
        await base44.entities[entityName].delete(dup.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityName] });
      queryClient.invalidateQueries({ queryKey: [transactionEntity] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Category deleted');
    },
    onError: () => {
      toast.error('Failed to delete category');
    },
  });

  const handleCreate = () => {
    if (!formData.name) {
      toast.error('Please enter a category name');
      return;
    }
    if (RESERVED_CATEGORY_NAMES.has(formData.name.toLowerCase())) {
      toast.error('This category name is reserved.');
      return;
    }
    createMutation.mutate({
      name: formData.name.toLowerCase(),
      color: formData.color,
      order: categories.length
    });
  };

  const handleUpdate = async (id) => {
    if (!formData.name) {
      toast.error('Please enter a category name');
      return;
    }
    
    const newName = formData.name.toLowerCase();
    if (RESERVED_CATEGORY_NAMES.has(newName)) {
      toast.error('This category name is reserved.');
      return;
    }
    const currentCategory = categories.find(c => c.id === id);
    const existingCategory = categories.find(c => c.name.toLowerCase() === newName && c.id !== id);
    
    // If renaming to an existing category name, prompt for merge
    if (existingCategory) {
      setMergeDialog({ open: true, existingCategory, editingId: id });
      return;
    }
    
    // Update the category
    await base44.entities[entityName].update(id, { name: newName, color: formData.color });
    
    // Update all transactions that use this category
    const oldName = currentCategory.name;
    const transactionsToUpdate = transactions.filter(t => t.category === oldName);
    
    for (const t of transactionsToUpdate) {
      await base44.entities[transactionEntity].update(t.id, { category: newName });
    }
    
    queryClient.invalidateQueries({ queryKey: [entityName] });
    queryClient.invalidateQueries({ queryKey: [transactionEntity] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    setEditing(null);
    toast.success(`Category renamed. ${transactionsToUpdate.length} transaction(s) updated.`);
  };

  const handleMerge = async () => {
    const { existingCategory, editingId } = mergeDialog;
    const categoryToDelete = categories.find(c => c.id === editingId);
    
    // Update all transactions from the deleted category to the existing one
    const transactionsToUpdate = transactions.filter(t => t.category === categoryToDelete.name);
    
    for (const t of transactionsToUpdate) {
      await base44.entities[transactionEntity].update(t.id, { category: existingCategory.name });
    }
    
    // Delete the old category
    await base44.entities[entityName].delete(editingId);
    
    queryClient.invalidateQueries({ queryKey: [entityName] });
    queryClient.invalidateQueries({ queryKey: [transactionEntity] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    setMergeDialog({ open: false, existingCategory: null, editingId: null });
    setEditing(null);
    setFormData({ name: '', color: colorOptions[0] });
    toast.success(`Categories merged. ${transactionsToUpdate.length} transaction(s) moved to "${existingCategory.name}".`);
  };

  const openDeleteDialog = (category) => {
    const hasTransactions = transactions.some((t) => t.category === category.name);
    if (!hasTransactions) {
      deleteMutation.mutate(category);
      return;
    }
    setDeleteDialog({ open: true, category, target: '' });
  };

  const handleMoveAndDelete = async () => {
    const categoryToDelete = deleteDialog.category;
    const targetName = deleteDialog.target;
    if (!categoryToDelete || !targetName) return;

    const transactionsToUpdate = transactions.filter((t) => t.category === categoryToDelete.name);
    const totalAmount = transactionsToUpdate.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    for (const t of transactionsToUpdate) {
      await base44.entities[transactionEntity].update(t.id, { category: targetName });
    }

    const nameLower = categoryToDelete.name.toLowerCase();
    const duplicates = rawCategories.filter((c) => c.name.toLowerCase() === nameLower);
    for (const dup of duplicates) {
      await base44.entities[entityName].delete(dup.id);
    }
    queryClient.invalidateQueries({ queryKey: [entityName] });
    queryClient.invalidateQueries({ queryKey: [transactionEntity] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    setDeleteDialog({ open: false, category: null, target: '' });
    toast.success(
      `Category deleted. ${transactionsToUpdate.length} transaction(s) moved (total ${formatAmount(totalAmount)}).`
    );
  };

  const startEdit = (category) => {
    setEditing(category.id);
    setFormData({ name: category.name, color: category.color });
  };

  const cancelEdit = () => {
    setEditing(null);
    setCreating(false);
    setFormData({ name: '', color: colorOptions[0] });
  };

  const deleteDialogTransactions = deleteDialog.category
    ? transactions.filter((t) => t.category === deleteDialog.category.name)
    : [];
  const deleteDialogTotal = deleteDialogTransactions.reduce(
    (sum, t) => sum + (Number(t.amount) || 0),
    0
  );

  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <div key={category.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          {editing === category.id ? (
            <>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="flex-1"
                placeholder="Category name"
              />
              <div className="flex gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-6 h-6 rounded-full ${formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <Button size="icon" variant="ghost" onClick={() => handleUpdate(category.id)}>
                <Check className="w-4 h-4 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" onClick={cancelEdit}>
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <div
                className="w-6 h-6 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="flex-1 capitalize">{category.name}</span>
              <Button size="icon" variant="ghost" onClick={() => startEdit(category)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => openDeleteDialog(category)}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            </>
          )}
        </div>
      ))}

      {creating ? (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="flex-1"
            placeholder="Category name"
          />
          <div className="flex gap-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                onClick={() => setFormData({ ...formData, color })}
                className={`w-6 h-6 rounded-full ${formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Button size="icon" variant="ghost" onClick={handleCreate}>
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" onClick={cancelEdit}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => setCreating(true)}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add {type === 'expense' ? 'Expense' : 'Income'} Category
        </Button>
      )}

      <AlertDialog open={mergeDialog.open} onOpenChange={(open) => !open && setMergeDialog({ open: false, existingCategory: null, editingId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Categories?</AlertDialogTitle>
            <AlertDialogDescription>
              A category named "{mergeDialog.existingCategory?.name}" already exists. 
              Would you like to merge these categories? All transactions from the current category 
              will be moved to "{mergeDialog.existingCategory?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMergeDialog({ open: false, existingCategory: null, editingId: null })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge}>
              Merge Categories
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, category: null, target: '' })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This category has transactions. To delete it, move those transactions to another category first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-xs text-slate-500">
            {deleteDialog.category ? (
              <>
                Affects {deleteDialogTransactions.length} transaction(s), total {formatAmount(deleteDialogTotal)}.
              </>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Move transactions to</Label>
            <Select
              value={deleteDialog.target}
              onValueChange={(value) => setDeleteDialog((prev) => ({ ...prev, target: value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => c.id !== deleteDialog.category?.id)
                  .filter((c) => !RESERVED_CATEGORY_NAMES.has(c.name.toLowerCase()))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {categories.filter((c) => c.id !== deleteDialog.category?.id).length === 0 && (
              <p className="text-xs text-slate-500">
                Create another category first, then move transactions.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialog({ open: false, category: null, target: '' })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMoveAndDelete}
              disabled={!deleteDialog.target}
            >
              Move & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
