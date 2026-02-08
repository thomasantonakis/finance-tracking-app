import React, { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfWeek, addWeeks, subWeeks, getWeek, isSameMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CalendarGrid from '../Components/calendar/CalendarGrid';
import DayTransactions from '../Components/calendar/DayTransactions';
import FloatingAddButton from '../Components/transactions/FloatingAddButton';
import { useSessionState } from '@/utils';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useSessionState('calendar.currentDate', () => new Date());
  const [selectedDate, setSelectedDate] = useSessionState('calendar.selectedDate', () => new Date());
  const [collapsed, setCollapsed] = useSessionState('calendar.collapsed', false);
  const [weekView, setWeekView] = useSessionState('calendar.weekView', false);
  const queryClient = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date'),
  });

  const { data: income = [] } = useQuery({
    queryKey: ['income'],
    queryFn: () => base44.entities.Income.list('-date'),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => base44.entities.Transfer.list('-date'),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: (id) => base44.entities.Income.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Income deleted');
    },
  });

  const deleteTransferMutation = useMutation({
    mutationFn: (id) => base44.entities.Transfer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast.success('Transfer deleted');
    },
  });

  const pendingDeletesRef = useRef(new Map());

  const undoDelete = (key) => {
    const pending = pendingDeletesRef.current.get(key);
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    queryClient.setQueryData(pending.queryKey, pending.previous);
    pendingDeletesRef.current.delete(key);
    toast.success('Deletion undone');
  };

  const scheduleDelete = (id, type) => {
    const typeKey = type === 'income' ? 'income' : type === 'transfer' ? 'transfers' : 'expenses';
    const queryKey = [typeKey];
    const previous = queryClient.getQueryData(queryKey) || [];
    const item = previous.find((t) => t.id === id);
    if (!item) {
      if (type === 'income') deleteIncomeMutation.mutate(id);
      else if (type === 'transfer') deleteTransferMutation.mutate(id);
      else deleteExpenseMutation.mutate(id);
      return;
    }
    const key = `${type}:${id}`;
    if (pendingDeletesRef.current.has(key)) return;
    queryClient.setQueryData(queryKey, previous.filter((t) => t.id !== id));
    const timeoutId = setTimeout(() => {
      pendingDeletesRef.current.delete(key);
      if (type === 'income') deleteIncomeMutation.mutate(id);
      else if (type === 'transfer') deleteTransferMutation.mutate(id);
      else deleteExpenseMutation.mutate(id);
    }, 8000);
    pendingDeletesRef.current.set(key, { previous, queryKey, timeoutId });
    toast.success('Transaction deleted', {
      action: {
        label: 'Undo',
        onClick: () => undoDelete(key),
      },
    });
  };

  const handleDelete = (id, type) => {
    scheduleDelete(id, type);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['income'] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
  };

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    if (!weekView && !collapsed && !isSameMonth(date, currentDate)) {
      setCurrentDate(date);
    }
  };

  const handleDoubleClick = (date) => {
    setSelectedDate(date);
    setCurrentDate(date);
    setWeekView(true);
    setCollapsed(true);
  };

  const navigatePeriod = (direction) => {
    if (weekView) {
      const newDate = direction > 0 ? addWeeks(selectedDate, 1) : subWeeks(selectedDate, 1);
      setSelectedDate(newDate);
      setCurrentDate(newDate);
    } else {
      setCurrentDate(direction > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const weekNumber = weekView ? getWeek(selectedDate, { weekStartsOn: 1 }) : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur border-b border-slate-200/70 py-3 mb-6">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigatePeriod(-1)}
                className="text-slate-600 hover:text-slate-900"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {weekView ? `W${weekNumber}/${format(selectedDate, 'yyyy')}` : format(currentDate, 'MMM yyyy')}
                </h1>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigatePeriod(1)}
                className="text-slate-600 hover:text-slate-900"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            {(collapsed || weekView) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCollapsed(false);
                  setWeekView(false);
                  setCurrentDate(selectedDate);
                }}
                className="text-slate-600 hover:text-slate-900"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Show Full Month
              </Button>
            )}
            </div>
          </div>

          <CalendarGrid
            currentDate={currentDate}
            expenses={expenses}
            income={income}
            transfers={transfers}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onDoubleClick={handleDoubleClick}
            collapsed={collapsed || weekView}
          />
        </motion.div>

        <div className="space-y-4">
          <DayTransactions
            selectedDate={selectedDate}
            expenses={expenses}
            income={income}
            transfers={transfers}
            accounts={accounts}
            onDelete={handleDelete}
            onUpdate={handleSuccess}
          />

          <FloatingAddButton
            onSuccess={handleSuccess}
            initialDate={format(selectedDate, 'yyyy-MM-dd')}
          />
        </div>
      </div>
    </div>
  );
}
