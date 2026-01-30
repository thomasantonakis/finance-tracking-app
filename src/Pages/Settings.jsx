import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Download, Upload, LogOut, Palette, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import CategoryManager from '../Components/settings/CategoryManager';
import { Progress } from '@/components/ui/progress';
import { getNumberFormat, setNumberFormat } from '@/utils';

const defaultColors = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

export default function Settings() {
  const [showCustomize, setShowCustomize] = useState(false);
  const [numberFormat, setNumberFormatState] = useState(getNumberFormat());
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [importLogs, setImportLogs] = useState([]);
  const [deleteAccountsReport, setDeleteAccountsReport] = useState({ deleted: [], skipped: [] });
  const [showDeleteAccountsReport, setShowDeleteAccountsReport] = useState(false);
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

  const { data: existingExpenseCategories = [] } = useQuery({
    queryKey: ['ExpenseCategory'],
    queryFn: () => base44.entities.ExpenseCategory.list(),
  });

  const { data: existingIncomeCategories = [] } = useQuery({
    queryKey: ['IncomeCategory'],
    queryFn: () => base44.entities.IncomeCategory.list(),
  });

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

    expenses.forEach(e => {
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
      ['transfer', '2026-01-01', '200.75', 'Bank', 'Savings', '', 'Monthly savings', '', '']
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
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently delete ALL your financial data including:\n\n' +
      '• All expenses\n' +
      '• All income\n' +
      '• All transfers\n\n' +
      'This action CANNOT be undone.\n\n' +
      'Are you absolutely sure you want to continue?'
    );

    if (!confirmed) return;

    const doubleCheck = window.confirm('Final confirmation: Delete all data?');
    if (!doubleCheck) return;

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
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently delete ALL accounts.\n\n' +
      'This action CANNOT be undone.\n\n' +
      'Are you absolutely sure you want to continue?'
    );
    if (!confirmed) return;

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
        const hasExpense = expensesToCheck.some((e) => e.account_id === acc.id);
        const hasIncome = incomeToCheck.some((i) => i.account_id === acc.id);
        const hasTransfer = transfersToCheck.some(
          (t) => t.from_account_id === acc.id || t.to_account_id === acc.id
        );

        if (hasExpense || hasIncome || hasTransfer) {
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
    setImportLogs([]);

    try {
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
        setImportLogs(['Error: Invalid CSV file - no data rows found']);
        toast.error('Invalid CSV file');
        setImporting(false);
        return;
      }

      const data = rows.slice(1).filter(row => row.length > 1 && row[0]);
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
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2;
        
        try {
          const type = row[0]?.toLowerCase();
          const date = row[1];
          const amount = parseFloat(row[2]);
          const accountName = row[3];
          const category = row[4];
          const subcategory = row[5] || undefined;
          const notes = row[6] || undefined;
          const cleared = row[7]?.toLowerCase() === 'yes';
          const projected = row[8]?.toLowerCase() === 'yes';

          if (!type || !date || isNaN(amount) || !accountName) {
            logs.push(`Row ${rowNumber}: Skipped - Missing required fields (type, date, amount, or account)`);
            continue;
          }

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
              <Button variant="outline" onClick={() => setShowDeleteAccountsReport(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
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
                      <h3 className="font-semibold text-slate-900 mb-3">Expense Categories</h3>
                      <CategoryManager type="expense" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">Income Categories</h3>
                      <CategoryManager type="income" />
                    </div>
                  </div>
                )}
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
