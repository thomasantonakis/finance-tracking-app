import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AlertDialog({ open, onOpenChange, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

export function AlertDialogContent({ children }) {
  return <DialogContent>{children}</DialogContent>;
}

export function AlertDialogHeader({ children }) {
  return <DialogHeader>{children}</DialogHeader>;
}

export function AlertDialogTitle({ children }) {
  return <DialogTitle>{children}</DialogTitle>;
}

export function AlertDialogDescription({ children }) {
  return <p className="text-sm text-slate-600">{children}</p>;
}

export function AlertDialogFooter({ children }) {
  return <div className="mt-4 flex items-center justify-end gap-2">{children}</div>;
}

export function AlertDialogAction({ className = "", ...props }) {
  return (
    <Button
      className={`!bg-slate-900 !text-white !border-slate-900 hover:!bg-slate-800 ${className}`}
      {...props}
    />
  );
}

export function AlertDialogCancel({ className = "", ...props }) {
  return <Button variant="ghost" className={className} {...props} />;
}
