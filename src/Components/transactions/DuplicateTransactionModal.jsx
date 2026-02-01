import React from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TransactionForm from "./TransactionForm";
import TransferForm from "./TransferForm";
import { getDuplicateDate, setDuplicateDate } from "@/utils";

export default function DuplicateTransactionModal({
  open,
  onOpenChange,
  transaction,
  type,
  onSuccess,
}) {
  const defaultDate = getDuplicateDate() ?? format(new Date(), "yyyy-MM-dd");

  const handleCreated = (savedDate) => {
    if (savedDate) setDuplicateDate(savedDate);
  };

  const handleSuccess = () => {
    onSuccess?.();
    onOpenChange(false);
  };

  const initialData =
    type === "transfer"
      ? {
          amount: transaction?.amount,
          from_account_id: transaction?.from_account_id,
          to_account_id: transaction?.to_account_id,
          notes: transaction?.notes,
        }
      : {
          amount: transaction?.amount,
          category: transaction?.category,
          subcategory: transaction?.subcategory,
          account_id: transaction?.account_id,
          notes: transaction?.notes,
          cleared: transaction?.cleared,
          projected: transaction?.projected,
          important: transaction?.important,
        };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Duplicate {type === "income" ? "Income" : type === "transfer" ? "Transfer" : "Expense"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(80vh-72px)] overflow-y-auto pr-1 pb-12">
          {type === "transfer" ? (
            <TransferForm
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
              initialData={initialData}
              initialDate={defaultDate}
              onAfterCreate={handleCreated}
            />
          ) : (
            <TransactionForm
              type={type}
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
              initialData={initialData}
              initialDate={defaultDate}
              onAfterCreate={handleCreated}
              filterSubcategoryByCategory={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
