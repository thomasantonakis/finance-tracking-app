import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TransactionForm from './TransactionForm';
import TransferForm from './TransferForm';

export default function UnifiedTransactionModal({ open, onOpenChange, onSuccess, defaultTab = 'expense' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleSuccess = () => {
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expense" className="text-sm">Expense</TabsTrigger>
            <TabsTrigger value="income" className="text-sm">Income</TabsTrigger>
            <TabsTrigger value="transfer" className="text-sm">Transfer</TabsTrigger>
          </TabsList>

          <TabsContent value="expense" className="mt-4">
            <TransactionForm
              type="expense"
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="income" className="mt-4">
            <TransactionForm
              type="income"
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="transfer" className="mt-4">
            <TransferForm
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}