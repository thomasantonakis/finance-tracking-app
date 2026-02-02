import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatAmount } from '@/utils';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [deleteDialog, setDeleteDialog] = useState({ open: false, category: null, target: '', query: '', showList: false });
  const [removeUnusedDialog, setRemoveUnusedDialog] = useState({ open: false, categories: [] });
  const [progressDialog, setProgressDialog] = useState({ open: false, title: '', total: 0, done: 0 });
  const queryClient = useQueryClient();
  const deleteDropdownRef = useRef(null);
  const createInputRef = useRef(null);

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

  const categoryTotals = categories.reduce((acc, cat) => {
    acc[cat.name] = transactions
      .filter((t) => t.category === cat.name)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    return acc;
  }, {});

  const categoriesByTotal = [...categories].sort((a, b) => {
    const totalDiff = (categoryTotals[b.name] || 0) - (categoryTotals[a.name] || 0);
    if (totalDiff !== 0) return totalDiff;
    return a.name.localeCompare(b.name);
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

  const capitalizeFirst = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  const handleCreate = () => {
    if (!formData.name) {
      toast.error('Please enter a category name');
      return;
    }
    const normalizedName = capitalizeFirst(formData.name);
    if (RESERVED_CATEGORY_NAMES.has(normalizedName.toLowerCase())) {
      toast.error('This category name is reserved.');
      return;
    }
    createMutation.mutate({
      name: normalizedName,
      color: formData.color,
      order: categories.length
    });
  };

  const handleUpdate = async (id) => {
    if (!formData.name) {
      toast.error('Please enter a category name');
      return;
    }
    
    const newName = capitalizeFirst(formData.name);
    if (RESERVED_CATEGORY_NAMES.has(newName)) {
      toast.error('This category name is reserved.');
      return;
    }
    const currentCategory = categories.find(c => c.id === id);
    const existingCategory = categories.find(
      c => c.name.toLowerCase() === newName.toLowerCase() && c.id !== id
    );
    
    // If renaming to an existing category name, prompt for merge
    if (existingCategory) {
      setMergeDialog({ open: true, existingCategory, editingId: id });
      return;
    }
    
    const nameChanged = currentCategory.name.toLowerCase() !== newName.toLowerCase();
    const colorChanged = currentCategory.color !== formData.color;

    if (!nameChanged && !colorChanged) {
      setEditing(null);
      toast.info('No changes to update.');
      return;
    }

    // Update the category (color only or name + color)
    await base44.entities[entityName].update(id, {
      name: nameChanged ? newName : currentCategory.name,
      color: colorChanged ? formData.color : currentCategory.color
    });
    
    let transactionsToUpdate = [];
    if (nameChanged) {
      const oldName = currentCategory.name;
      transactionsToUpdate = transactions.filter(t => t.category === oldName);
      if (transactionsToUpdate.length > 0) {
        setProgressDialog({
          open: true,
          title: 'Updating transactions…',
          total: transactionsToUpdate.length,
          done: 0
        });
      }
      let updated = 0;
      for (const t of transactionsToUpdate) {
        await base44.entities[transactionEntity].update(t.id, { category: newName });
        updated += 1;
        setProgressDialog((prev) => ({ ...prev, done: updated }));
      }
      setProgressDialog((prev) => ({ ...prev, open: false }));
    }
    
    queryClient.invalidateQueries({ queryKey: [entityName] });
    queryClient.invalidateQueries({ queryKey: [transactionEntity] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    setEditing(null);
    if (nameChanged) {
      toast.success(`Category renamed. ${transactionsToUpdate.length} transaction(s) updated.`);
    } else {
      toast.success('Category color updated.');
    }
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
    setDeleteDialog({ open: true, category, target: '', query: '', showList: false });
  };

  const handleMoveAndDelete = async () => {
    const categoryToDelete = deleteDialog.category;
    const targetName = deleteDialog.target;
    if (!categoryToDelete || !targetName) return;

    const transactionsToUpdate = transactions.filter((t) => t.category === categoryToDelete.name);
    const totalAmount = transactionsToUpdate.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    if (transactionsToUpdate.length > 0) {
      setProgressDialog({
        open: true,
        title: 'Moving transactions…',
        total: transactionsToUpdate.length,
        done: 0
      });
    }
    let moved = 0;
    for (const t of transactionsToUpdate) {
      await base44.entities[transactionEntity].update(t.id, { category: targetName });
      moved += 1;
      setProgressDialog((prev) => ({ ...prev, done: moved }));
    }
    setProgressDialog((prev) => ({ ...prev, open: false }));

    const nameLower = categoryToDelete.name.toLowerCase();
    const duplicates = rawCategories.filter((c) => c.name.toLowerCase() === nameLower);
    for (const dup of duplicates) {
      await base44.entities[entityName].delete(dup.id);
    }
    queryClient.invalidateQueries({ queryKey: [entityName] });
    queryClient.invalidateQueries({ queryKey: [transactionEntity] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    setDeleteDialog({ open: false, category: null, target: '', query: '', showList: false });
    toast.success(
      `Category deleted. ${transactionsToUpdate.length} transaction(s) moved (total ${formatAmount(totalAmount)}).`
    );
  };

  const handleRemoveUnused = async () => {
    const usedNames = new Set(transactions.map((t) => t.category));
    const unusedCategories = categories.filter((c) => !usedNames.has(c.name));
    if (unusedCategories.length === 0) {
      toast.info('No unused categories found.');
      return;
    }
    setRemoveUnusedDialog({ open: true, categories: unusedCategories });
  };

  const handleConfirmRemoveUnused = async () => {
    const toRemove = removeUnusedDialog.categories || [];
    if (toRemove.length === 0) {
      setRemoveUnusedDialog({ open: false, categories: [] });
      return;
    }
    for (const cat of toRemove) {
      await deleteMutation.mutateAsync(cat);
    }
    setRemoveUnusedDialog({ open: false, categories: [] });
    toast.success(`Removed ${toRemove.length} unused category(ies).`);
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

  useEffect(() => {
    if (creating && createInputRef.current) {
      setTimeout(() => {
        createInputRef.current?.focus();
        createInputRef.current?.select();
      }, 0);
    }
  }, [creating]);

  useEffect(() => {
    if (!deleteDialog.showList) return;
    const handleClick = (event) => {
      if (deleteDropdownRef.current && !deleteDropdownRef.current.contains(event.target)) {
        setDeleteDialog((prev) => ({ ...prev, showList: false }));
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [deleteDialog.showList]);

  const deleteDialogTransactions = deleteDialog.category
    ? transactions.filter((t) => t.category === deleteDialog.category.name)
    : [];
  const deleteDialogTotal = deleteDialogTransactions.reduce(
    (sum, t) => sum + (Number(t.amount) || 0),
    0
  );

  return (
    <div className="space-y-3">
      {creating ? (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          <Input
            ref={createInputRef}
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
          onClick={() => {
            setCreating(true);
            setTimeout(() => {
              createInputRef.current?.focus();
              createInputRef.current?.select();
            }, 0);
          }}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add {type === 'expense' ? 'Expense' : 'Income'} Category
        </Button>
      )}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleRemoveUnused}
      >
        Remove Unused {type === 'expense' ? 'Expense' : 'Income'} Categories
      </Button>
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

      <Dialog open={progressDialog.open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{progressDialog.title || 'Working…'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-slate-900 transition-all"
                style={{
                  width:
                    progressDialog.total > 0
                      ? `${Math.round((progressDialog.done / progressDialog.total) * 100)}%`
                      : '0%',
                }}
              />
            </div>
            <div className="text-sm text-slate-600">
              {progressDialog.done} / {progressDialog.total}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, category: null, target: '', query: '', showList: false })}
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
            <div className="relative" ref={deleteDropdownRef}>
              <Input
                value={deleteDialog.query}
                onChange={(e) =>
                  setDeleteDialog((prev) => ({ ...prev, query: e.target.value }))
                }
                onFocus={() => setDeleteDialog((prev) => ({ ...prev, showList: true }))}
                placeholder="Type to filter categories"
              />
              {deleteDialog.query && (
                <button
                  type="button"
                  onClick={() =>
                    setDeleteDialog((prev) => ({
                      ...prev,
                      query: '',
                      target: '',
                      showList: false,
                    }))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
              {deleteDialog.showList && (
                <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {categoriesByTotal
                  .filter((c) => c.id !== deleteDialog.category?.id)
                  .filter((c) => !RESERVED_CATEGORY_NAMES.has(c.name.toLowerCase()))
                  .filter((c) =>
                    c.name.toLowerCase().includes(deleteDialog.query.trim().toLowerCase())
                  )
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setDeleteDialog((prev) => ({
                          ...prev,
                          target: c.name,
                          query: c.name,
                          showList: false,
                        }))
                      }
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-100 ${
                        deleteDialog.target === c.name ? 'bg-slate-100' : ''
                      }`}
                    >
                      <span className="capitalize">{c.name}</span>
                      <span className="text-xs text-slate-400">
                        {formatAmount(categoryTotals[c.name] || 0)}
                      </span>
                    </button>
                  ))}
                {categoriesByTotal
                  .filter((c) => c.id !== deleteDialog.category?.id)
                  .filter((c) => !RESERVED_CATEGORY_NAMES.has(c.name.toLowerCase()))
                  .filter((c) =>
                    c.name.toLowerCase().includes(deleteDialog.query.trim().toLowerCase())
                  ).length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">No categories found</div>
                )}
                </div>
              )}
            </div>
            {categoriesByTotal.filter((c) => c.id !== deleteDialog.category?.id).length === 0 && (
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

      <AlertDialog
        open={removeUnusedDialog.open}
        onOpenChange={(open) => !open && setRemoveUnusedDialog({ open: false, categories: [] })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove unused categories?</AlertDialogTitle>
            <AlertDialogDescription>
              These categories have no transactions and will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-48 overflow-auto rounded-md border border-slate-200 p-3 text-sm text-slate-700">
            <ul className="list-disc pl-5 space-y-1">
              {[...removeUnusedDialog.categories]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((cat) => (
                <li key={cat.id}>{cat.name}</li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveUnusedDialog({ open: false, categories: [] })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemoveUnused}>
              Delete {removeUnusedDialog.categories.length} Categories
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
