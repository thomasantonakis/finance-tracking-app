import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import UnifiedTransactionModal from './UnifiedTransactionModal';

export default function FloatingAddButton({ onSuccess }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors active:scale-95"
      >
        <Plus className="w-8 h-8" />
      </button>

      <UnifiedTransactionModal
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}