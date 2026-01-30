import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function CategoryManager({ type }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', color: colorOptions[0] });
  const [mergeDialog, setMergeDialog] = useState({ open: false, existingCategory: null, editingId: null });
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
  const categories = Array.from(categoriesMap.values()).sort((a, b) => 
    a.name.localeCompare(b.name)
  );

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
    mutationFn: async (id) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat) throw new Error('Category not found');
      const inUse = transactions.some((t) => t.category === cat.name);
      if (inUse) {
        throw new Error('Category in use');
      }
      return base44.entities[entityName].delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityName] });
      toast.success('Category deleted');
    },
    onError: (error) => {
      if (error.message === 'Category in use') {
        toast.error('Cannot delete a category that has transactions.');
      } else {
        toast.error('Failed to delete category');
      }
    },
  });

  const handleCreate = () => {
    if (!formData.name) {
      toast.error('Please enter a category name');
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

  const startEdit = (category) => {
    setEditing(category.id);
    setFormData({ name: category.name, color: category.color });
  };

  const cancelEdit = () => {
    setEditing(null);
    setCreating(false);
    setFormData({ name: '', color: colorOptions[0] });
  };

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
                onClick={() => deleteMutation.mutate(category.id)}
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
    </div>
  );
}
