import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TransactionForm from './TransactionForm';
import TransferForm from './TransferForm';

export default function QuickAddButton({ type, onSuccess }) {
  const [open, setOpen] = useState(false);

  const getButtonStyle = () => {
    if (type === 'income') return 'bg-green-500 hover:bg-green-600';
    if (type === 'transfer') return 'bg-blue-500 hover:bg-blue-600';
    return 'bg-red-500 hover:bg-red-600';
  };

  const getTitle = () => {
    if (type === 'income') return 'Income';
    if (type === 'transfer') return 'Transfer';
    return 'Expense';
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={`rounded-full shadow-lg hover:shadow-xl transition-all ${getButtonStyle()}`}
      >
        <Plus className="w-5 h-5 mr-2" />
        Add {getTitle()}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {getTitle()}</DialogTitle>
          </DialogHeader>
          {type === 'transfer' ? (
            <TransferForm
              onSuccess={() => {
                setOpen(false);
                onSuccess?.();
              }}
              onCancel={() => setOpen(false)}
            />
          ) : (
            <TransactionForm
              type={type}
              onSuccess={() => {
                setOpen(false);
                onSuccess?.();
              }}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}