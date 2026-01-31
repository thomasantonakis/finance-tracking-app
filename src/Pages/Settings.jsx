import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Download, Upload, LogOut, Palette, Trash2, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format, addWeeks, addMonths, addYears } from 'date-fns';
import CategoryManager from '../Components/settings/CategoryManager';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ensureStartingBalanceTransactions, formatAmount, getNumberFormat, setNumberFormat } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import CategoryCombobox from '@/Components/transactions/CategoryCombobox';

const defaultColors = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

export default function Settings() {
  const [showCustomize, setShowCustomize] = useState(false);
  const [showExpenseCategories, setShowExpenseCategories] = useState(false);
  const [showIncomeCategories, setShowIncomeCategories] = useState(false);
  const [showBulkUpdater, setShowBulkUpdater] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [numberFormat, setNumberFormatState] = useState(getNumberFormat());
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [importLogs, setImportLogs] = useState([]);
  const [deleteAccountsReport, setDeleteAccountsReport] = useState({ deleted: [], skipped: [] });
  const [showDeleteAccountsReport, setShowDeleteAccountsReport] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    onConfirm: null,
  });
  const [bulkFilters, setBulkFilters] = useState({
    type: 'all',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    cleared: 'any',
    projected: 'any',
    text: {
      category: { op: 'contains', value: '' },
      subcategory: { op: 'contains', value: '' },
      notes: { op: 'contains', value: '' },
    },
  });
  const [bulkAction, setBulkAction] = useState({
    type: 'delete',
    textMode: 'append',
    targetField: 'notes',
    sourceField: 'custom',
    customText: '',
    booleanField: 'cleared',
    booleanValue: 'true',
  });
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResult, setBulkResult] = useState({
    open: false,
    inProgress: false,
    successCount: 0,
    failCount: 0,
  });
  const pendingBulkDeleteRef = useRef(null);
  const [recurringForm, setRecurringForm] = useState({
    type: 'expense',
    amount: '',
    category: '',
    subcategory: '',
    account_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    frequency: 'monthly',
    interval: '1',
    notes: '',
    cleared: false,
    projected: false,
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    setNumberFormat(numberFormat);
  }, [numberFormat]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (importing || deleting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [importing, deleting]);

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list(),
  });

  const { data: income = [] } = useQuery({
    queryKey: ['income'],
    queryFn: () => base44.entities.Income.list(),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => base44.entities.Transfer.list(),
  });

  const { data: recurringRules = [] } = useQuery({
    queryKey: ['recurringRules'],
    queryFn: () => base44.entities.RecurringRule.list('-created_at'),
  });

  const { data: existingExpenseCategories = [] } = useQuery({
    queryKey: ['ExpenseCategory'],
    queryFn: () => base44.entities.ExpenseCategory.list(),
  });

  const { data: existingIncomeCategories = [] } = useQuery({
    queryKey: ['IncomeCategory'],
    queryFn: () => base44.entities.IncomeCategory.list(),
  });

  const allTransactions = useMemo(() => {
    const expenseTx = expenses.map((e) => ({ ...e, type: 'expense' }));
    const incomeTx = income.map((i) => ({ ...i, type: 'income' }));
    return [...expenseTx, ...incomeTx];
  }, [expenses, income]);

  const subcategoryTotals = useMemo(() => {
    const totals = {};
    allTransactions.forEach((t) => {
      const sub = (t.subcategory || '').trim();
      if (!sub) return;
      const key = sub.toLowerCase();
      totals[key] = totals[key] || { name: sub, total: 0 };
      totals[key].total += Number(t.amount) || 0;
    });
    return totals;
  }, [allTransactions]);

  const recurringSubcategoryOptions = useMemo(() => {
    return Object.values(subcategoryTotals).sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
  }, [subcategoryTotals]);

  const recurringTopCategoryBySubcategory = useMemo(() => {
    const counts = {};
    allTransactions.forEach((t) => {
      const sub = (t.subcategory || '').trim();
      const cat = (t.category || '').trim();
      if (!sub || !cat) return;
      const subKey = sub.toLowerCase();
      const catKey = cat.toLowerCase();
      if (!counts[subKey]) counts[subKey] = {};
      if (!counts[subKey][catKey]) counts[subKey][catKey] = { name: cat, count: 0 };
      counts[subKey][catKey].count += 1;
    });
    const result = {};
    Object.entries(counts).forEach(([subKey, catMap]) => {
      const best = Object.values(catMap).sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      })[0];
      if (best) result[subKey] = best.name;
    });
    return result;
  }, [allTransactions]);

  const reservedCategoryNames = useMemo(
    () => new Set(['starting balance', 'system - starting balance']),
    []
  );

  const categoryTotals = useMemo(() => {
    const totals = {};
    allTransactions.forEach((t) => {
      if (!t.category) return;
      const key = t.category;
      if (reservedCategoryNames.has(key.toLowerCase())) return;
      totals[key] = (totals[key] || 0) + (Number(t.amount) || 0);
    });
    return totals;
  }, [allTransactions, reservedCategoryNames]);

  const categoryOptions = useMemo(() => {
    const names = new Set();
    existingExpenseCategories.forEach((c) => names.add(c.name));
    existingIncomeCategories.forEach((c) => names.add(c.name));
    allTransactions.forEach((t) => t.category && names.add(t.category));
    const list = Array.from(names).filter(
      (name) => !reservedCategoryNames.has(name.toLowerCase())
    );
    return list.sort((a, b) => {
      const diff = (categoryTotals[b] || 0) - (categoryTotals[a] || 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
  }, [existingExpenseCategories, existingIncomeCategories, allTransactions, categoryTotals, reservedCategoryNames]);

  const matchesText = (value, filter) => {
    if (!filter?.value) return true;
    const target = (value || '').toString().toLowerCase();
    const query = filter.value.toLowerCase();
    if (!query) return true;
    if (filter.op === 'starts') return target.startsWith(query);
    if (filter.op === 'ends') return target.endsWith(query);
    return target.includes(query);
  };

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((t) => {
      if (reservedCategoryNames.has((t.category || '').toLowerCase())) return false;

      if (bulkFilters.type !== 'all' && t.type !== bulkFilters.type) return false;
      if (bulkFilters.dateFrom) {
        if (new Date(t.date) < new Date(bulkFilters.dateFrom)) return false;
      }
      if (bulkFilters.dateTo) {
        if (new Date(t.date) > new Date(bulkFilters.dateTo)) return false;
      }
      if (bulkFilters.amountMin !== '') {
        if ((Number(t.amount) || 0) < Number(bulkFilters.amountMin)) return false;
      }
      if (bulkFilters.amountMax !== '') {
        if ((Number(t.amount) || 0) > Number(bulkFilters.amountMax)) return false;
      }
      if (bulkFilters.cleared !== 'any') {
        const clearedVal = bulkFilters.cleared === 'true';
        if (t.cleared !== clearedVal) return false;
      }
      if (bulkFilters.projected !== 'any') {
        const projectedVal = bulkFilters.projected === 'true';
        if (t.projected !== projectedVal) return false;
      }
      if (!matchesText(t.category, bulkFilters.text.category)) return false;
      if (!matchesText(t.subcategory, bulkFilters.text.subcategory)) return false;
      if (!matchesText(t.notes, bulkFilters.text.notes)) return false;
      return true;
    });
  }, [allTransactions, bulkFilters, reservedCategoryNames]);

  const bulkSummary = useMemo(() => {
    const parts = [];
    if (bulkFilters.type !== 'all') parts.push(`Type: ${bulkFilters.type}`);
    if (bulkFilters.dateFrom || bulkFilters.dateTo) {
      parts.push(
        `Date: ${bulkFilters.dateFrom || '…'} → ${bulkFilters.dateTo || '…'}`
      );
    }
    if (bulkFilters.amountMin !== '' || bulkFilters.amountMax !== '') {
      parts.push(
        `Amount: ${bulkFilters.amountMin || '…'} → ${bulkFilters.amountMax || '…'}`
      );
    }
    if (bulkFilters.cleared !== 'any') parts.push(`Cleared: ${bulkFilters.cleared}`);
    if (bulkFilters.projected !== 'any') parts.push(`Projected: ${bulkFilters.projected}`);
    ['category', 'subcategory', 'notes'].forEach((field) => {
      const rule = bulkFilters.text[field];
      if (rule?.value) {
        parts.push(`${field} ${rule.op} "${rule.value}"`);
      }
    });
    return parts.length ? parts : ['No filters (all transactions)'];
  }, [bulkFilters]);

  const bulkActionSummary = useMemo(() => {
    if (bulkAction.type === 'delete') return 'Delete matched transactions';
    if (bulkAction.type === 'boolean') {
      return `Set ${bulkAction.booleanField} to ${bulkAction.booleanValue}`;
    }
    const source =
      bulkAction.sourceField === 'custom'
        ? `custom text "${bulkAction.customText}"`
        : bulkAction.sourceField;
    return `${bulkAction.textMode} ${source} to ${bulkAction.targetField}`;
  }, [bulkAction]);

  const previewTransactions = useMemo(
    () =>
      [...filteredTransactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8),
    [filteredTransactions]
  );

  useEffect(() => {
    const initializeCategories = async () => {
      // Get unique expense categories from transactions
      const expenseCats = [...new Set(expenses.map(e => e.category))];
      const incomeCats = [...new Set(income.map(i => i.category))];

      // Create missing expense categories
      for (let i = 0; i < expenseCats.length; i++) {
        const cat = expenseCats[i];
        const exists = existingExpenseCategories.find(c => c.name === cat);
        if (!exists) {
          await base44.entities.ExpenseCategory.create({
            name: cat,
            color: defaultColors[i % defaultColors.length],
            order: i
          });
        }
      }

      // Create missing income categories
      for (let i = 0; i < incomeCats.length; i++) {
        const cat = incomeCats[i];
        const exists = existingIncomeCategories.find(c => c.name === cat);
        if (!exists) {
          await base44.entities.IncomeCategory.create({
            name: cat,
            color: defaultColors[i % defaultColors.length],
            order: i
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['ExpenseCategory'] });
      queryClient.invalidateQueries({ queryKey: ['IncomeCategory'] });
    };

    if (expenses.length > 0 || income.length > 0) {
      initializeCategories();
    }
  }, [expenses.length, income.length]);

  const handleExport = () => {
    // Combine all transactions into CSV format
    const rows = [
      ['Type', 'Date', 'Amount', 'Account', 'Category', 'Subcategory', 'Notes', 'Cleared', 'Projected']
    ];

    const isStartingBalance = (t) => (t.category || '').toLowerCase() === 'starting balance';

    expenses.forEach(e => {
      if (isStartingBalance(e)) return;
      const account = accounts.find(a => a.id === e.account_id);
      rows.push([
        'expense',
        e.date,
        e.amount,
        account?.name || '',
        e.category,
        e.subcategory || '',
        e.notes || '',
        e.cleared ? 'yes' : 'no',
        e.projected ? 'yes' : 'no'
      ]);
    });

    income.forEach(i => {
      if (isStartingBalance(i)) return;
      const account = accounts.find(a => a.id === i.account_id);
      rows.push([
        'income',
        i.date,
        i.amount,
        account?.name || '',
        i.category,
        i.subcategory || '',
        i.notes || '',
        i.cleared ? 'yes' : 'no',
        i.projected ? 'yes' : 'no'
      ]);
    });

    transfers.forEach(t => {
      const fromAccount = accounts.find(a => a.id === t.from_account_id);
      const toAccount = accounts.find(a => a.id === t.to_account_id);
      rows.push([
        'transfer',
        t.date,
        t.amount,
        fromAccount?.name || '',
        toAccount?.name || '',
        '',
        t.notes || '',
        '',
        ''
      ]);
    });

    accounts.forEach((acc) => {
      const amount = Number(acc.starting_balance) || 0;
      if (amount === 0) return;
      const type = amount > 0 ? 'income' : 'expense';
      rows.push([
        type,
        '1970-01-01',
        Math.abs(amount),
        acc.name || '',
        'SYSTEM - Starting Balance',
        '',
        'starting balance',
        'yes',
        'yes'
      ]);
    });

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-data-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported successfully');
  };

  const handleDownloadTemplate = () => {
    const rows = [
      ['Type', 'Date', 'Amount', 'Account', 'Category', 'Subcategory', 'Notes', 'Cleared', 'Projected'],
      ['expense', '2026-01-01', '50.12', 'Cash', 'food', 'groceries', 'Weekly shopping', 'yes', 'no'],
      ['income', '2026-01-01', '1234.56', 'Bank', 'salary', '', 'Monthly salary', 'yes', 'no'],
      ['transfer', '2026-01-01', '200.75', 'Bank', 'Savings', '', 'Monthly savings', 'yes', 'no'],
      ['income', '1970-01-01', '1000.00', 'Bank', 'SYSTEM - Starting Balance', '', 'starting balance', 'yes', 'yes']
    ];

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const handleDeleteAllData = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete all data?',
      description:
        'This will permanently delete ALL your financial data including all expenses, income, and transfers. This action cannot be undone.',
      confirmLabel: 'Continue',
      onConfirm: () => {
        setConfirmDialog({
          open: true,
          title: 'Final confirmation',
          description: 'Are you absolutely sure you want to delete all data?',
          confirmLabel: 'Delete all data',
          onConfirm: async () => {
            setConfirmDialog((prev) => ({ ...prev, open: false }));
            await runDeleteAllData();
          },
        });
      },
    });
  };

  const runDeleteAllData = async () => {
    setDeleting(true);
    setDeleteProgress(0);

    try {
      const expensesToDelete = await base44.entities.Expense.list();
      const incomeToDelete = await base44.entities.Income.list();
      const transfersToDelete = await base44.entities.Transfer.list();

      const total = expensesToDelete.length + incomeToDelete.length + transfersToDelete.length;
      let deleted = 0;

      for (const expense of expensesToDelete) {
        await base44.entities.Expense.delete(expense.id);
        deleted++;
        setDeleteProgress(Math.round((deleted / total) * 100));
      }
      for (const inc of incomeToDelete) {
        await base44.entities.Income.delete(inc.id);
        deleted++;
        setDeleteProgress(Math.round((deleted / total) * 100));
      }
      for (const transfer of transfersToDelete) {
        await base44.entities.Transfer.delete(transfer.id);
        deleted++;
        setDeleteProgress(Math.round((deleted / total) * 100));
      }

      queryClient.invalidateQueries();
      toast.success('All data deleted successfully');
    } catch (error) {
      toast.error('Failed to delete data');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllAccounts = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete all accounts?',
      description: 'This will permanently delete ALL accounts. This action cannot be undone.',
      confirmLabel: 'Delete all accounts',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        await runDeleteAllAccounts();
      },
    });
  };

  const runDeleteAllAccounts = async () => {

    setDeleting(true);
    setDeleteProgress(0);
    setDeleteAccountsReport({ deleted: [], skipped: [] });
    setShowDeleteAccountsReport(false);

    try {
      const expensesToCheck = await base44.entities.Expense.list();
      const incomeToCheck = await base44.entities.Income.list();
      const transfersToCheck = await base44.entities.Transfer.list();
      const accountsToDelete = await base44.entities.Account.list();
      const total = accountsToDelete.length || 1;
      let deleted = 0;
      const deletedNames = [];
      const skippedNames = [];

      for (const acc of accountsToDelete) {
        const isStarting = (t) => (t.category || '').toLowerCase() === 'starting balance';
        const accExpenses = expensesToCheck.filter((e) => e.account_id === acc.id);
        const accIncome = incomeToCheck.filter((i) => i.account_id === acc.id);
        const hasExpense = accExpenses.some((e) => !isStarting(e));
        const hasIncome = accIncome.some((i) => !isStarting(i));
        const hasTransfer = transfersToCheck.some(
          (t) => t.from_account_id === acc.id || t.to_account_id === acc.id
        );
        const startingIncome = accIncome.find(isStarting);
        const startingExpense = accExpenses.find(isStarting);
        const startingAmount = startingIncome
          ? startingIncome.amount
          : startingExpense
          ? -startingExpense.amount
          : 0;
        const hasNonZeroStarting = Math.abs(Number(startingAmount) || 0) > 0;

        if (hasExpense || hasIncome || hasTransfer || hasNonZeroStarting) {
          skippedNames.push(acc.name);
        } else {
          await base44.entities.Account.delete(acc.id);
          deletedNames.push(acc.name);
        }
        deleted++;
        setDeleteProgress(Math.round((deleted / total) * 100));
      }

      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDeleteAccountsReport({
        deleted: deletedNames.sort((a, b) => a.localeCompare(b)),
        skipped: skippedNames.sort((a, b) => a.localeCompare(b)),
      });
      setShowDeleteAccountsReport(true);
      toast.success('Account deletion completed');
    } catch (error) {
      toast.error('Failed to delete accounts');
    } finally {
      setDeleting(false);
      setDeleteProgress(0);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(0);
    const attemptStamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    setImportLogs([`Import attempt: ${file.name} @ ${attemptStamp}`]);

    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setImportLogs([`Import attempt: ${file.name} @ ${attemptStamp}`, 'Error: Invalid file type. Please upload a .csv file.']);
        toast.error('Invalid file type');
        setImporting(false);
        return;
      }
      const text = await file.text();
      // Advanced CSV parsing to handle quotes and newlines within cells
      const rows = [];
      const cells = [];
      let currentCell = '';
      let currentRow = [];
      let inQuotes = false;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '"' && nextChar === '"' && inQuotes) {
          // Escaped quote inside quoted field
          currentCell += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          // Toggle quote state
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          // End of cell
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if (char === '\n' && !inQuotes) {
          // End of row
          currentRow.push(currentCell.trim());
          if (currentRow.some(cell => cell.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
        } else if (char === '\r' && nextChar === '\n' && !inQuotes) {
          // Windows line ending
          currentRow.push(currentCell.trim());
          if (currentRow.some(cell => cell.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
          i++; // Skip \n
        } else {
          // Regular character (including newlines inside quotes)
          currentCell += char;
        }
      }
      
      // Don't forget the last cell and row
      if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
      }

      if (rows.length < 2) {
        setImportLogs([`Import attempt: ${file.name} @ ${attemptStamp}`, 'Error: Invalid CSV file - no data rows found']);
        toast.error('Invalid CSV file');
        setImporting(false);
        return;
      }

      const expectedHeaders = ['Type', 'Date', 'Amount', 'Account', 'Category', 'Subcategory', 'Notes', 'Cleared', 'Projected'];
      const headerRow = rows[0].map((cell) => (cell || '').trim());
      const headerMatches =
        headerRow.length === expectedHeaders.length &&
        expectedHeaders.every((header, idx) => headerRow[idx] === header);
      if (!headerMatches) {
        setImportLogs([
          `Import attempt: ${file.name} @ ${attemptStamp}`,
          'Error: CSV headers do not match the template.',
          `Expected: ${expectedHeaders.join(', ')}`,
          `Found: ${headerRow.join(', ')}`,
        ]);
        toast.error('Invalid CSV headers');
        setImporting(false);
        return;
      }

      const data = rows.slice(1).filter(row => row.length > 1 && row[0]);
      const validationErrors = [];
      const amountPattern = /^\d+(?:\.\d{1,2})?$/;
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      const isValidDateString = (value) => {
        if (!datePattern.test(value)) return false;
        const [y, m, d] = value.split('-').map(Number);
        const parsed = new Date(y, m - 1, d);
        return (
          parsed.getFullYear() === y &&
          parsed.getMonth() === m - 1 &&
          parsed.getDate() === d
        );
      };

      data.forEach((row, i) => {
        const rowNumber = i + 2;
        const typeRaw = (row[0] || '').trim();
        const type = typeRaw.toLowerCase();
        const date = (row[1] || '').trim();
        const amountStr = (row[2] || '').trim();
        const accountName = (row[3] || '').trim();
        const category = (row[4] || '').trim();
        const subcategory = (row[5] || '').trim();
        const cleared = (row[7] || '').trim().toLowerCase();
        const projected = (row[8] || '').trim().toLowerCase();

        const isSystemStartingBalance = category.toLowerCase() === 'system - starting balance';

        if (!['expense', 'income', 'transfer'].includes(type)) {
          validationErrors.push(`Row ${rowNumber}: Invalid type "${typeRaw}" (must be expense, income, or transfer)`);
        }
        if (!isValidDateString(date)) {
          validationErrors.push(`Row ${rowNumber}: Invalid date "${date}" (must be YYYY-MM-DD)`);
        }
        if (!amountPattern.test(amountStr)) {
          validationErrors.push(`Row ${rowNumber}: Invalid amount "${amountStr}" (use digits only, optional decimal with up to 2 digits, and "." as the decimal separator)`);
        } else if (Number(amountStr) <= 0) {
          validationErrors.push(`Row ${rowNumber}: Amount must be greater than 0`);
        }
        if (!accountName) {
          validationErrors.push(`Row ${rowNumber}: Account is required`);
        }
        if (!category) {
          validationErrors.push(`Row ${rowNumber}: Category is required`);
        }
        if (!subcategory && !isSystemStartingBalance && type !== 'transfer') {
          validationErrors.push(`Row ${rowNumber}: Subcategory is required`);
        }
        if (cleared !== 'yes' && cleared !== 'no') {
          validationErrors.push(`Row ${rowNumber}: Cleared must be "yes" or "no"`);
        }
        if (projected !== 'yes' && projected !== 'no') {
          validationErrors.push(`Row ${rowNumber}: Projected must be "yes" or "no"`);
        }

        if (type === 'transfer' && !category) {
          validationErrors.push(`Row ${rowNumber}: Transfer requires Category as destination account`);
        }
        if (isSystemStartingBalance) {
          if (type === 'transfer') {
            validationErrors.push(`Row ${rowNumber}: SYSTEM - Starting Balance must be income or expense`);
          }
          if (date !== '1970-01-01') {
            validationErrors.push(`Row ${rowNumber}: Starting Balance date must be 1970-01-01`);
          }
        }
      });

      if (validationErrors.length > 0) {
        const limitedErrors = validationErrors.slice(0, 20);
        if (validationErrors.length > 20) {
          limitedErrors.push(`...and ${validationErrors.length - 20} more error(s).`);
        }
        setImportLogs([`Import attempt: ${file.name} @ ${attemptStamp}`, ...limitedErrors]);
        toast.error('Import failed: fix CSV errors');
        setImporting(false);
        return;
      }
      const logs = [];

      // Refresh accounts list
      const currentAccounts = await base44.entities.Account.list();
      let accountsMap = {};
      currentAccounts.forEach(a => accountsMap[a.name] = a);

      // Get current categories
      const currentExpenseCategories = await base44.entities.ExpenseCategory.list();
      const currentIncomeCategories = await base44.entities.IncomeCategory.list();
      let expenseCatsMap = {};
      let incomeCatsMap = {};
      currentExpenseCategories.forEach(c => expenseCatsMap[c.name] = c);
      currentIncomeCategories.forEach(c => incomeCatsMap[c.name] = c);

      let imported = 0;
      let needsStartingBalanceSync = false;
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2;
        
        try {
          const type = row[0]?.trim().toLowerCase();
          const date = row[1]?.trim();
          const amount = parseFloat(row[2]);
          const accountName = row[3]?.trim();
          const category = row[4]?.trim();
          const subcategory = row[5]?.trim() || undefined;
          const notes = row[6] || undefined;
          const cleared = row[7]?.trim().toLowerCase() === 'yes';
          const projected = row[8]?.trim().toLowerCase() === 'yes';
          const isSystemStartingBalance =
            (category || '').toLowerCase() === 'system - starting balance';

          // Auto-create account if it doesn't exist
          if (!accountsMap[accountName]) {
            const newAccount = await base44.entities.Account.create({
              name: accountName,
              starting_balance: 0,
              category: 'bank',
              color: defaultColors[Object.keys(accountsMap).length % defaultColors.length]
            });
            accountsMap[accountName] = newAccount;
            logs.push(`Row ${rowNumber}: Created new account "${accountName}"`);
          }

          const account = accountsMap[accountName];

          if (type === 'expense') {
            if (isSystemStartingBalance) {
              const startingBalance = -Math.abs(amount);
              await base44.entities.Account.update(account.id, {
                starting_balance: startingBalance,
              });
              accountsMap[accountName] = { ...account, starting_balance: startingBalance };
              logs.push(`Row ${rowNumber}: Set starting balance for "${accountName}"`);
              needsStartingBalanceSync = true;
              continue;
            }
            // Auto-create expense category if it doesn't exist (case-insensitive check)
            const existingCat = Object.keys(expenseCatsMap).find(
              key => key.toLowerCase() === category.toLowerCase()
            );
            if (category && !existingCat) {
              const newCat = await base44.entities.ExpenseCategory.create({
                name: category,
                color: defaultColors[Object.keys(expenseCatsMap).length % defaultColors.length],
                order: Object.keys(expenseCatsMap).length
              });
              expenseCatsMap[category] = newCat;
              logs.push(`Row ${rowNumber}: Created new expense category "${category}"`);
            }

            await base44.entities.Expense.create({
              amount,
              category,
              subcategory,
              account_id: account.id,
              date,
              notes,
              cleared,
              projected
            });
            imported++;
          } else if (type === 'income') {
            if (isSystemStartingBalance) {
              const startingBalance = Math.abs(amount);
              await base44.entities.Account.update(account.id, {
                starting_balance: startingBalance,
              });
              accountsMap[accountName] = { ...account, starting_balance: startingBalance };
              logs.push(`Row ${rowNumber}: Set starting balance for "${accountName}"`);
              needsStartingBalanceSync = true;
              continue;
            }
            // Auto-create income category if it doesn't exist (case-insensitive check)
            const existingCat = Object.keys(incomeCatsMap).find(
              key => key.toLowerCase() === category.toLowerCase()
            );
            if (category && !existingCat) {
              const newCat = await base44.entities.IncomeCategory.create({
                name: category,
                color: defaultColors[Object.keys(incomeCatsMap).length % defaultColors.length],
                order: Object.keys(incomeCatsMap).length
              });
              incomeCatsMap[category] = newCat;
              logs.push(`Row ${rowNumber}: Created new income category "${category}"`);
            }

            await base44.entities.Income.create({
              amount,
              category,
              subcategory,
              account_id: account.id,
              date,
              notes,
              cleared,
              projected
            });
            imported++;
          } else if (type === 'transfer') {
            if (isSystemStartingBalance) {
              logs.push(`Row ${rowNumber}: Skipped - Starting balance rows must be income/expense`);
              continue;
            }
            const toAccountName = category;
            
            // Auto-create destination account if it doesn't exist
            if (!accountsMap[toAccountName]) {
              const newAccount = await base44.entities.Account.create({
                name: toAccountName,
                starting_balance: 0,
                category: 'bank',
                color: defaultColors[Object.keys(accountsMap).length % defaultColors.length]
              });
              accountsMap[toAccountName] = newAccount;
              logs.push(`Row ${rowNumber}: Created new account "${toAccountName}"`);
            }

            const toAccount = accountsMap[toAccountName];
            await base44.entities.Transfer.create({
              amount,
              from_account_id: account.id,
              to_account_id: toAccount.id,
              date,
              notes
            });
            imported++;
          } else {
            logs.push(`Row ${rowNumber}: Skipped - Invalid type "${type}"`);
          }

          setImportProgress(Math.round(((i + 1) / data.length) * 100));
        } catch (error) {
          logs.push(`Row ${rowNumber}: Error - ${error.message}`);
        }
      }

      if (needsStartingBalanceSync) {
        await ensureStartingBalanceTransactions(Object.values(accountsMap), queryClient);
      }

      setImportLogs([...logs, `\n✅ Import completed: ${imported} transactions imported successfully`]);
      queryClient.invalidateQueries();
      toast.success(`Import completed: ${imported} transactions imported`);
      event.target.value = '';
    } catch (error) {
      setImportLogs([`Fatal error: ${error.message}`]);
      toast.error('Failed to import data');
    } finally {
      setImporting(false);
    }
  };

  const generateRecurringDates = (startDate, endDate, frequency, interval) => {
    const dates = [];
    const step = Math.max(Number(interval) || 1, 1);
    let cursor = new Date(startDate);
    const end = new Date(endDate);
    while (cursor <= end) {
      dates.push(new Date(cursor));
      if (frequency === 'weekly') {
        cursor = addWeeks(cursor, step);
      } else if (frequency === 'yearly') {
        cursor = addYears(cursor, step);
      } else {
        cursor = addMonths(cursor, step);
      }
    }
    return dates;
  };

  const handleCreateRecurringRule = async () => {
    const rawCategory = (recurringForm.category || '').trim();
    const rawSubcategory = (recurringForm.subcategory || '').trim();
    const existingCategoryMatch = categoryOptions.find(
      (name) => name.toLowerCase() === rawCategory.toLowerCase()
    );
    const normalizedCategory = existingCategoryMatch || rawCategory;
    const amount = Number(recurringForm.amount);
    if (!rawCategory || !rawSubcategory || !recurringForm.account_id || !recurringForm.start_date || !recurringForm.end_date || Number.isNaN(amount)) {
      toast.error('Please fill in all required fields');
      return;
    }
    const start = new Date(recurringForm.start_date);
    const end = new Date(recurringForm.end_date);
    if (start > end) {
      toast.error('End date must be after start date');
      return;
    }

    const rule = await base44.entities.RecurringRule.create({
      type: recurringForm.type,
      amount,
      category: normalizedCategory,
      subcategory: rawSubcategory,
      account_id: recurringForm.account_id,
      start_date: recurringForm.start_date,
      end_date: recurringForm.end_date,
      frequency: recurringForm.frequency,
      interval: Number(recurringForm.interval) || 1,
      notes: recurringForm.notes || undefined,
      cleared: recurringForm.cleared,
      projected: recurringForm.projected,
    });

    const entity = recurringForm.type === 'income' ? base44.entities.Income : base44.entities.Expense;
    const dates = generateRecurringDates(recurringForm.start_date, recurringForm.end_date, recurringForm.frequency, recurringForm.interval);
    for (const date of dates) {
      await entity.create({
        amount,
        category: normalizedCategory,
        subcategory: rawSubcategory,
        account_id: recurringForm.account_id,
        date: format(date, 'yyyy-MM-dd'),
        notes: recurringForm.notes || undefined,
        cleared: recurringForm.cleared,
        projected: recurringForm.projected,
        recurring_rule_id: rule.id,
      });
    }

    queryClient.invalidateQueries();
    toast.success(`Created ${dates.length} ${recurringForm.type} transaction(s)`);
    setRecurringForm((prev) => ({
      ...prev,
      amount: '',
      category: '',
      subcategory: '',
      notes: '',
    }));
    setShowRecurringModal(false);
  };

  const handleDeleteRecurringRule = async (ruleId) => {
    await base44.entities.RecurringRule.delete(ruleId);
    queryClient.invalidateQueries({ queryKey: ['recurringRules'] });
    toast.success('Recurring rule deleted');
  };

  const getEntityForType = (type) => {
    if (type === 'expense') return base44.entities.Expense;
    return base44.entities.Income;
  };

  const handleApplyBulkAction = async () => {
    if (filteredTransactions.length === 0) {
      toast.info('No transactions match the current filters.');
      return;
    }
    if (bulkAction.type === 'delete') {
      const expensesKey = ['expenses'];
      const incomeKey = ['income'];
      const prevExpenses = queryClient.getQueryData(expensesKey) || [];
      const prevIncome = queryClient.getQueryData(incomeKey) || [];
      const expenseIds = new Set(filteredTransactions.filter((t) => t.type === 'expense').map((t) => t.id));
      const incomeIds = new Set(filteredTransactions.filter((t) => t.type === 'income').map((t) => t.id));
      queryClient.setQueryData(expensesKey, prevExpenses.filter((t) => !expenseIds.has(t.id)));
      queryClient.setQueryData(incomeKey, prevIncome.filter((t) => !incomeIds.has(t.id)));

      const timeoutId = setTimeout(async () => {
        pendingBulkDeleteRef.current = null;
        let successCount = 0;
        let failCount = 0;
        setBulkResult({
          open: true,
          inProgress: true,
          successCount: 0,
          failCount: 0,
        });
        for (const tx of filteredTransactions) {
          const entity = getEntityForType(tx.type);
          try {
            await entity.delete(tx.id);
            successCount += 1;
          } catch {
            failCount += 1;
          }
        }
        setBulkResult({
          open: true,
          inProgress: false,
          successCount,
          failCount,
        });
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['income'] });
      }, 8000);

      pendingBulkDeleteRef.current = {
        timeoutId,
        prevExpenses,
        prevIncome,
      };

      toast.success(`Deleted ${filteredTransactions.length} transactions`, {
        action: {
          label: 'Undo',
          onClick: () => {
            const pending = pendingBulkDeleteRef.current;
            if (!pending) return;
            clearTimeout(pending.timeoutId);
            queryClient.setQueryData(expensesKey, pending.prevExpenses);
            queryClient.setQueryData(incomeKey, pending.prevIncome);
            pendingBulkDeleteRef.current = null;
            toast.success('Bulk delete undone');
          },
        },
      });
      setBulkConfirm(false);
      return;
    }
    setBulkProcessing(true);
    setBulkProgress(0);
    setBulkResult({
      open: true,
      inProgress: true,
      successCount: 0,
      failCount: 0,
    });
    try {
      let successCount = 0;
      let failCount = 0;
      const total = filteredTransactions.length;
      for (const tx of filteredTransactions) {
        const entity = getEntityForType(tx.type);
        try {
          if (bulkAction.type === 'delete') {
            await entity.delete(tx.id);
          } else if (bulkAction.type === 'text') {
            const targetField = bulkAction.targetField;
            const sourceValue =
              bulkAction.sourceField === 'custom'
                ? bulkAction.customText
                : tx[bulkAction.sourceField] || '';
            const existing = tx[targetField] || '';
            const newValue =
              bulkAction.textMode === 'append'
                ? existing
                  ? `${existing}${existing.endsWith(' ') ? '' : ' '}${sourceValue}`
                  : sourceValue
                : sourceValue;
            await entity.update(tx.id, { [targetField]: newValue });
          } else if (bulkAction.type === 'boolean') {
            const value = bulkAction.booleanValue === 'true';
            await entity.update(tx.id, { [bulkAction.booleanField]: value });
          }
          successCount += 1;
        } catch (error) {
          failCount += 1;
        }
        const processed = successCount + failCount;
        setBulkProgress(Math.round((processed / total) * 100));
        setBulkResult((prev) => ({
          ...prev,
          successCount,
          failCount,
        }));
      }
      queryClient.invalidateQueries();
      setBulkResult((prev) => ({ ...prev, inProgress: false }));
    } catch (error) {
      setBulkResult((prev) => ({ ...prev, inProgress: false }));
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const isProcessing = importing || deleting;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="font-bold text-lg mb-4">
              {importing ? 'Importing Data...' : 'Deleting Data...'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Please do not navigate away from this page
            </p>
            <Progress value={importing ? importProgress : deleteProgress} className="h-3" />
            <p className="text-sm text-slate-500 mt-2 text-center">
              {importing ? importProgress : deleteProgress}%
            </p>
          </div>
        </div>
      )}
      {showDeleteAccountsReport && (deleteAccountsReport.deleted.length > 0 || deleteAccountsReport.skipped.length > 0) && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="font-bold text-lg mb-4">Account Deletion Report</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                  ✅ Deleted ({deleteAccountsReport.deleted.length})
                </h4>
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  {deleteAccountsReport.deleted.length === 0 ? (
                    <li>None</li>
                  ) : (
                    deleteAccountsReport.deleted.map((name) => (
                      <li key={`deleted-${name}`}>{name}</li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                  ⚠️ Skipped ({deleteAccountsReport.skipped.length})
                </h4>
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  {deleteAccountsReport.skipped.length === 0 ? (
                    <li>None</li>
                  ) : (
                    deleteAccountsReport.skipped.map((name) => (
                      <li key={`skipped-${name}`}>{name}</li>
                    ))
                  )}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setShowDeleteAccountsReport(false)}
                className="!bg-slate-900 !text-white !border-slate-900 hover:!bg-slate-800"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog((prev) => ({ ...prev, open: false }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <AlertDialogCancel onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const handler = confirmDialog.onConfirm;
                if (typeof handler === 'function') {
                  handler();
                } else {
                  setConfirmDialog((prev) => ({ ...prev, open: false }));
                }
              }}
            >
              {confirmDialog.confirmLabel || 'Confirm'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={showRecurringModal} onOpenChange={setShowRecurringModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Recurring Transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 max-h-[70vh] overflow-auto pr-1">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Create Rule</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={recurringForm.type}
                    onValueChange={(value) => setRecurringForm((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account *</Label>
                  <Select
                    value={recurringForm.account_id}
                    onValueChange={(value) => setRecurringForm((prev) => ({ ...prev, account_id: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    value={recurringForm.amount}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <CategoryCombobox
                    id="recurring-subcategory"
                    label="Subcategory *"
                    value={recurringForm.subcategory}
                    onChange={(value) => setRecurringForm((prev) => ({ ...prev, subcategory: value }))}
                    onSelectItem={(item) => {
                      const suggested = recurringTopCategoryBySubcategory[item.label.toLowerCase()];
                      if (suggested) {
                        setRecurringForm((prev) => ({ ...prev, category: suggested }));
                      }
                    }}
                    categories={recurringSubcategoryOptions.map((item) => item.name)}
                    placeholder="Select subcategory"
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <CategoryCombobox
                    id="recurring-category"
                    label="Category *"
                    value={recurringForm.category}
                    onChange={(value) => setRecurringForm((prev) => ({ ...prev, category: value }))}
                    categories={categoryOptions}
                    placeholder="Select category"
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Start date *</Label>
                      <Input
                        type="date"
                        value={recurringForm.start_date}
                        onChange={(e) => setRecurringForm((prev) => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End date *</Label>
                      <Input
                        type="date"
                        value={recurringForm.end_date}
                        onChange={(e) => setRecurringForm((prev) => ({ ...prev, end_date: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select
                        value={recurringForm.frequency}
                        onValueChange={(value) => setRecurringForm((prev) => ({ ...prev, frequency: value }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Every</Label>
                      <Input
                        type="number"
                        min="1"
                        value={recurringForm.interval}
                        onChange={(e) => setRecurringForm((prev) => ({ ...prev, interval: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={recurringForm.cleared}
                        onChange={(e) => setRecurringForm((prev) => ({ ...prev, cleared: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-600">Cleared</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={recurringForm.projected}
                        onChange={(e) => setRecurringForm((prev) => ({ ...prev, projected: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-600">Projected</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label>Notes</Label>
                  <Input
                    value={recurringForm.notes}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRecurringModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRecurringRule}>Create Rule</Button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Existing Rules</h3>
              {recurringRules.length === 0 ? (
                <div className="text-sm text-slate-500">No recurring rules yet.</div>
              ) : (
                <div className="space-y-2">
                  {recurringRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-lg border border-slate-200 p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-slate-900 capitalize">
                          {rule.type} · {rule.category} / {rule.subcategory}
                        </div>
                        <div className="text-xs text-slate-500">
                          {rule.amount} · {rule.frequency} every {rule.interval} · {rule.start_date} → {rule.end_date}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteRecurringRule(rule.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showBulkUpdater} onOpenChange={setShowBulkUpdater}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bulk Update Transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 max-h-[70vh] overflow-auto pr-1">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Filters (AND)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Type</Label>
                  <Select
                    value={bulkFilters.type}
                    onValueChange={(value) => setBulkFilters((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Date range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={bulkFilters.dateFrom}
                      onChange={(e) => setBulkFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    />
                    <Input
                      type="date"
                      value={bulkFilters.dateTo}
                      onChange={(e) => setBulkFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Amount range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={bulkFilters.amountMin}
                      onChange={(e) => setBulkFilters((prev) => ({ ...prev, amountMin: e.target.value }))}
                    />
                    <Input
                      type="number"
                      value={bulkFilters.amountMax}
                      onChange={(e) => setBulkFilters((prev) => ({ ...prev, amountMax: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Cleared</Label>
                  <Select
                    value={bulkFilters.cleared}
                    onValueChange={(value) => setBulkFilters((prev) => ({ ...prev, cleared: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Projected</Label>
                  <Select
                    value={bulkFilters.projected}
                    onValueChange={(value) => setBulkFilters((prev) => ({ ...prev, projected: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {['category', 'subcategory', 'notes'].map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="capitalize">{field} match</Label>
                    <Select
                      value={bulkFilters.text[field].op}
                      onValueChange={(value) =>
                        setBulkFilters((prev) => ({
                          ...prev,
                          text: { ...prev.text, [field]: { ...prev.text[field], op: value } },
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="starts">Starts with</SelectItem>
                        <SelectItem value="ends">Ends with</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={bulkFilters.text[field].value}
                      onChange={(e) =>
                        setBulkFilters((prev) => ({
                          ...prev,
                          text: { ...prev.text, [field]: { ...prev.text[field], value: e.target.value } },
                        }))
                      }
                      placeholder={`Filter ${field}`}
                    />
                  </div>
                ))}
              </div>

            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Matched</h3>
                <span className="text-sm text-slate-500">{filteredTransactions.length} transaction(s)</span>
              </div>
              <div className="max-h-40 overflow-auto rounded-md border border-slate-200 p-2">
                {previewTransactions.length === 0 ? (
                  <p className="text-xs text-slate-400">No transactions match these filters.</p>
                ) : (
                  previewTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs py-1">
                      <div className="text-slate-600">
                        {format(new Date(tx.date), 'yyyy-MM-dd')} • {tx.type} • {tx.category || '—'}
                        {tx.subcategory ? ` / ${tx.subcategory}` : ''} {tx.notes ? `• ${tx.notes}` : ''}
                      </div>
                      <div className="tabular-nums text-slate-700">€{formatAmount(tx.amount)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Action</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Action type</Label>
                  <Select
                    value={bulkAction.type}
                    onValueChange={(value) => setBulkAction((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="text">Update text field</SelectItem>
                      <SelectItem value="boolean">Set boolean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {bulkAction.type === 'text' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Target field</Label>
                    <Select
                      value={bulkAction.targetField}
                      onValueChange={(value) => setBulkAction((prev) => ({ ...prev, targetField: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="notes">Notes</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="subcategory">Subcategory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <Select
                      value={bulkAction.textMode}
                      onValueChange={(value) => setBulkAction((prev) => ({ ...prev, textMode: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="append">Append</SelectItem>
                        <SelectItem value="overwrite">Overwrite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Source</Label>
                    <Select
                      value={bulkAction.sourceField}
                      onValueChange={(value) => setBulkAction((prev) => ({ ...prev, sourceField: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom text</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="subcategory">Subcategory</SelectItem>
                        <SelectItem value="notes">Notes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {bulkAction.sourceField === 'custom' && (
                    <div className="md:col-span-3">
                      <Label>Custom Text</Label>
                      <Input
                        value={bulkAction.customText}
                        onChange={(e) => setBulkAction((prev) => ({ ...prev, customText: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              )}

              {bulkAction.type === 'boolean' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Field</Label>
                    <Select
                      value={bulkAction.booleanField}
                      onValueChange={(value) => setBulkAction((prev) => ({ ...prev, booleanField: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cleared">Cleared</SelectItem>
                        <SelectItem value="projected">Projected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Set value</Label>
                    <Select
                      value={bulkAction.booleanValue}
                      onValueChange={(value) => setBulkAction((prev) => ({ ...prev, booleanValue: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowBulkUpdater(false)} disabled={bulkProcessing}>
                Cancel
              </Button>
              <Button
                className="!bg-slate-900 !text-white !border-slate-900 hover:!bg-slate-800"
                onClick={() => setBulkConfirm(true)}
                disabled={bulkProcessing}
              >
                {bulkProcessing ? 'Applying...' : 'Review'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Update</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-1">Filters</h4>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                {bulkSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-1">Action</h4>
              <p className="text-sm text-slate-600">{bulkActionSummary}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-1">Matched</h4>
              <p className="text-sm text-slate-600">
                {filteredTransactions.length} transaction(s) will be affected.
              </p>
              <div className="mt-2 max-h-40 overflow-auto rounded-md border border-slate-200 p-2">
                {previewTransactions.length === 0 ? (
                  <p className="text-xs text-slate-400">No transactions match these filters.</p>
                ) : (
                  previewTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs py-1">
                      <div className="text-slate-600">
                        {format(new Date(tx.date), 'yyyy-MM-dd')} • {tx.type} • {tx.category || '—'}
                        {tx.subcategory ? ` / ${tx.subcategory}` : ''} {tx.notes ? `• ${tx.notes}` : ''}
                      </div>
                      <div className="tabular-nums text-slate-700">€{formatAmount(tx.amount)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBulkConfirm(false)} disabled={bulkProcessing}>
                Cancel
              </Button>
              <Button
                className="!bg-slate-900 !text-white !border-slate-900 hover:!bg-slate-800"
                onClick={() => {
                  handleApplyBulkAction();
                }}
                disabled={bulkProcessing}
              >
                {bulkProcessing ? 'Applying...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkResult.open} onOpenChange={(open) => !open && setBulkResult((prev) => ({ ...prev, open } ))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Update Result</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">
                {bulkResult.inProgress ? 'Applying changes...' : 'Update finished.'}
              </p>
              <div className="mt-2">
                <Progress value={bulkProgress} className="h-3" />
                <p className="text-xs text-slate-500 mt-1 text-center">{bulkProgress}%</p>
              </div>
            </div>
            <div className="text-sm text-slate-700">
              <p>Successful: {bulkResult.successCount}</p>
              <p>Failed: {bulkResult.failCount}</p>
              <p>Total: {bulkResult.successCount + bulkResult.failCount}</p>
            </div>
            {!bulkResult.inProgress && (
              <div className="flex justify-end">
                <Button
                  className="!bg-slate-900 !text-white !border-slate-900 hover:!bg-slate-800"
                  onClick={() => {
                    setBulkResult({ open: false, inProgress: false, successCount: 0, failCount: 0 });
                    setBulkConfirm(false);
                    setShowBulkUpdater(false);
                    setBulkProgress(0);
                  }}
                >
                  OK
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Customize</h2>
              </div>
              
              <div className="divide-y divide-slate-100">
                <div className="w-full flex items-center gap-3 p-4">
                  <div className="p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600 font-semibold">1.2</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-900">Number Format</p>
                    <p className="text-sm text-slate-500">Choose thousands and decimal separators</p>
                  </div>
                  <div className="w-64">
                    <Select value={numberFormat} onValueChange={setNumberFormatState}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select number format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dot" label="1.234,56">
                          1.234,56
                        </SelectItem>
                        <SelectItem value="comma" label="1,234.56">
                          1,234.56
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomize(!showCustomize)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-purple-50">
                    <Palette className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-900">Manage Categories</p>
                    <p className="text-sm text-slate-500">Create and customize income and expense categories</p>
                  </div>
                </button>

                {showCustomize && (
                  <div className="p-4 space-y-6">
                    <div>
                      <button
                        className="w-full flex items-center gap-2 text-left mb-3"
                        onClick={() => setShowExpenseCategories((prev) => !prev)}
                      >
                        {showExpenseCategories ? (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                        <h3 className="font-semibold text-slate-900">Expense Categories</h3>
                      </button>
                      {showExpenseCategories && <CategoryManager type="expense" />}
                    </div>
                    <div>
                      <button
                        className="w-full flex items-center gap-2 text-left mb-3"
                        onClick={() => setShowIncomeCategories((prev) => !prev)}
                      >
                        {showIncomeCategories ? (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                        <h3 className="font-semibold text-slate-900">Income Categories</h3>
                      </button>
                      {showIncomeCategories && <CategoryManager type="income" />}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setShowBulkUpdater(true)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-slate-100">
                    <SlidersHorizontal className="w-5 h-5 text-slate-700" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-900">Bulk Update Transactions</p>
                    <p className="text-sm text-slate-500">Filter and apply changes to multiple transactions</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowRecurringModal(true)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-purple-50">
                    <Palette className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-900">Recurring Transactions</p>
                    <p className="text-sm text-slate-500">Create bills or regular income with rules</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Data Management</h2>
              </div>
              
              <div className="divide-y divide-slate-100">
                <button
                  onClick={handleDownloadTemplate}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                  disabled={isProcessing}
                >
                  <div className="p-2 rounded-lg bg-green-50">
                    <Download className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-900">Download Import Template</p>
                    <p className="text-sm text-slate-500">Get a CSV template with example data</p>
                  </div>
                </button>
                <div className="p-4">
                  <button
                    type="button"
                    onClick={() => setShowImportHelp((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="font-medium text-slate-900">Import Help</p>
                      <p className="text-sm text-slate-500">How to fill the CSV template</p>
                    </div>
                    {showImportHelp ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                  {showImportHelp && (
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p>
                        Use the provided CSV template exactly. Headers and column order must remain unchanged.
                      </p>
                      <p>
                        <span className="font-medium">Type</span>: must be one of <code className="px-1">expense</code>, <code className="px-1">income</code>, or <code className="px-1">transfer</code> (lowercase).
                      </p>
                      <p>
                        <span className="font-medium">Date</span>: must be in <code className="px-1">YYYY-MM-DD</code> format.
                      </p>
                      <p>
                        <span className="font-medium">Amount</span>: use positive numbers only, no thousand separators, and up to two decimals (e.g., <code className="px-1">1234</code> or <code className="px-1">1234.50</code>). The type determines the sign.
                      </p>
                      <p>
                        <span className="font-medium">Accounts / Categories / Subcategories</span>: required fields. Values are trimmed (leading/trailing spaces removed). The exact spelling is preserved.
                      </p>
                      <p>
                        <span className="font-medium">Notes</span>: can include commas or new lines if the value is quoted.
                      </p>
                      <p>
                        <span className="font-medium">Cleared / Projected</span>: must be <code className="px-1">yes</code> or <code className="px-1">no</code> (lowercase).
                      </p>
                      <p>
                        <span className="font-medium">Starting Balance</span>: use category <code className="px-1">SYSTEM - Starting Balance</code> on an income or expense row. If balance is 0, omit it.
                      </p>
                      <p>
                        <span className="font-medium">Transfers</span>: set <code className="px-1">Account</code> as the <em>from</em> account and <code className="px-1">Category</code> as the <em>to</em> account.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleExport}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                  disabled={isProcessing}
                >
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Download className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-900">Export Data</p>
                    <p className="text-sm text-slate-500">Download all your financial data as CSV</p>
                  </div>
                </button>

                <label className={`w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors ${isProcessing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <div className="p-2 rounded-lg bg-orange-50">
                    <Upload className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-900">Import Data (Incremental)</p>
                    <p className="text-sm text-slate-500">Upload a CSV file to add transactions</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImport}
                    className="hidden"
                    disabled={isProcessing}
                  />
                </label>

                {importLogs.length > 0 && (
                  <div className="p-4 bg-slate-50">
                    <p className="font-medium text-slate-900 mb-2 text-sm">Import Log:</p>
                    <div className="bg-white rounded-lg p-3 border border-slate-200 max-h-60 overflow-y-auto">
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                        {importLogs.join('\n')}
                      </pre>
                    </div>
                  </div>
                )}


                <button
                  onClick={handleDeleteAllData}
                  className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition-colors text-left"
                  disabled={isProcessing}
                >
                  <div className="p-2 rounded-lg bg-red-50">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-red-900">Delete All Data</p>
                    <p className="text-sm text-red-600">Permanently remove all transactions</p>
                  </div>
                </button>

                <button
                  onClick={handleDeleteAllAccounts}
                  className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition-colors text-left"
                  disabled={isProcessing}
                >
                  <div className="p-2 rounded-lg bg-red-50">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-red-900">Delete All Accounts</p>
                    <p className="text-sm text-red-600">Permanently remove all accounts</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Account</h2>
              </div>
              
              <div className="divide-y divide-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-red-50">
                    <LogOut className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-slate-900">Logout</p>
                    <p className="text-sm text-slate-500">Sign out of your account</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-xs text-slate-400 text-center">
                Finance Manager v1.0
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
