import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ArrowLeft, Plus, Trash2, MoreVertical, Save, IndianRupee, Edit } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useTheme } from '../App';
import { useAuth } from '../contexts/AuthContext';
import lineService from '../services/lineService';
import accountService from '../services/accountService';
import LoadingScreen from './LoadingScreen';
import ProfileDropdownWithSync from './ProfileDropdownWithSync';

const Account = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lineId = searchParams.get('lineId');
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [line, setLine] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState({ credit: 0, debit: 0, netBalance: 0 });
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [editingTransactions, setEditingTransactions] = useState({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bfAmount, setBfAmount] = useState(0);
  const [editingAccount, setEditingAccount] = useState(null);
  const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState(false);
  const [editAccountName, setEditAccountName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lineId) {
      loadAccountsData();
    }
  }, [lineId]);

  useEffect(() => {
    if (selectedAccount && lineId) {
      loadTransactions();
    }
  }, [selectedAccount, lineId]);

  const loadAccountsData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const lineData = await lineService.getLineById(lineId);
      setLine(lineData.line);
      setBfAmount(lineData.line.currentBF || 0);

      const accountsData = await accountService.getAccounts(lineId);
      const accountsList = accountsData.accounts || [];
      setAccounts(accountsList);
      
      if (accountsList.length > 0 && !selectedAccount) {
        setSelectedAccount(accountsList[0]);
      }
    } catch (err) {
      // console.error('Error loading accounts:', err);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Lightweight function to just update BF without loading screen
  const refreshBF = async () => {
    try {
      const lineData = await lineService.getLineById(lineId);
      setBfAmount(lineData.line.currentBF || 0);
    } catch (err) {
      // console.error('Error refreshing BF:', err);
    }
  };

  const loadTransactions = async () => {
    if (!selectedAccount) return;
    
    try {
      const data = await accountService.getAccountTransactions(selectedAccount.id, lineId);
      setTransactions(data.transactions || []);
      setTotals(data.totals || { credit: 0, debit: 0, netBalance: 0 });
    } catch (err) {
      // console.error('Error loading transactions:', err);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;

    try {
      const accountData = { name: newAccountName };
      await accountService.createAccount(lineId, accountData);
      
      await loadAccountsData(false); // No loading screen for account operations
      setNewAccountName('');
      setIsAddingAccount(false);
    } catch (err) {
      alert(err.message || 'Failed to add account');
    }
  };

  const handleEditAccount = (account, e) => {
    e.stopPropagation();
    setEditingAccount(account);
    setEditAccountName(account.name);
    setIsEditAccountModalOpen(true);
  };

  const handleSaveEditAccount = async () => {
    if (!editAccountName.trim()) return;

    try {
      await accountService.updateAccount(editingAccount.id, lineId, { name: editAccountName });
      await loadAccountsData(false); // No loading screen for account operations
      setIsEditAccountModalOpen(false);
      setEditingAccount(null);
      setEditAccountName('');
    } catch (err) {
      alert(err.message || 'Failed to update account');
    }
  };

  const handleDeleteAccount = async (account, e) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'account', id: account.id, name: account.name });
    setDeleteConfirmText('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      alert('Please type "delete" to confirm');
      return;
    }

    try {
      if (deleteTarget.type === 'account') {
        await accountService.deleteAccount(deleteTarget.id, lineId);
        await loadAccountsData(false); // No loading screen
      } else if (deleteTarget.type === 'transaction') {
        await accountService.deleteAccountTransaction(selectedAccount.id, deleteTarget.id, lineId);
        await loadTransactions();
        await refreshBF(); // Just refresh BF without loading screen
      }

      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      setDeleteConfirmText('');
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleAddTransaction = () => {
    if (!selectedAccount) return;

    const hasEditingTransaction = transactions.some(t => t.isEditing || editingTransactions[t.id]);
    
    if (hasEditingTransaction) {
      alert('Please save the current transaction before adding a new one');
      return;
    }

    const newTransaction = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      name: '',
      creditAmount: '',
      debitAmount: '',
      isEditing: true
    };

    setTransactions([...transactions, newTransaction]);
    setEditingTransactions({ ...editingTransactions, [newTransaction.id]: true });
  };

  const handleSaveTransaction = async (transactionId) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    const credit = parseFloat(transaction.creditAmount) || 0;
    const debit = parseFloat(transaction.debitAmount) || 0;

    if (credit === 0 && debit === 0) {
      alert('Please enter either credit or debit amount');
      return;
    }

    if (credit > 0 && debit > 0) {
      alert('Please enter either credit OR debit, not both');
      return;
    }

    try {
      const transData = {
        date: transaction.date,
        name: transaction.name,
        creditAmount: credit,
        debitAmount: debit
      };

      await accountService.createAccountTransaction(selectedAccount.id, lineId, transData);

      await loadTransactions();
      await refreshBF(); // Just refresh BF without loading screen

      const updatedEditingTransactions = { ...editingTransactions };
      delete updatedEditingTransactions[transactionId];
      setEditingTransactions(updatedEditingTransactions);
    } catch (err) {
      alert(err.message || 'Failed to save transaction');
    }
  };

  const handleEditTransaction = (transactionId) => {
    setEditingTransactions({ ...editingTransactions, [transactionId]: true });
  };

  const handleCancelTransaction = (transactionId) => {
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (transaction && transaction.isEditing && !transaction.createdAt) {
      // Remove new unsaved transaction (no createdAt means it hasn't been saved yet)
      setTransactions(transactions.filter(t => t.id !== transactionId));
      const updatedEditingTransactions = { ...editingTransactions };
      delete updatedEditingTransactions[transactionId];
      setEditingTransactions(updatedEditingTransactions);
    } else {
      // Cancel editing existing transaction
      const updatedEditingTransactions = { ...editingTransactions };
      delete updatedEditingTransactions[transactionId];
      setEditingTransactions(updatedEditingTransactions);
      
      // Reload to revert changes
      loadTransactions();
    }
  };

  const handleDeleteTransaction = (transaction, e) => {
    e.stopPropagation();
    setDeleteTarget({
      type: 'transaction',
      id: transaction.id,
      name: transaction.name
    });
    setDeleteConfirmText('');
    setIsDeleteModalOpen(true);
  };

  const handleTransactionChange = (transactionId, field, value) => {
    const updatedTransactions = transactions.map(t => {
      if (t.id === transactionId) {
        return { ...t, [field]: value };
      }
      return t;
    });
    setTransactions(updatedTransactions);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!line) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p>Line not found</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col md:flex-row overflow-hidden ${
      theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100'
    }`}>
      {/* Left Panel - Account List */}
      <div className={`w-full md:w-64 border-r flex flex-col h-auto md:h-full max-h-48 md:max-h-none overflow-y-auto md:overflow-visible ${
        theme === 'dark' 
          ? 'bg-slate-800 border-slate-700' 
          : 'bg-white/80 backdrop-blur-sm border-slate-200'
      }`}>
        <div className={`p-3 md:p-4 border-b ${
          theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate(-1)}
              variant="ghost"
              size="icon"
              className={`h-10 w-10 rounded-full shadow-md transition-all hover:shadow-lg ${
                theme === 'light'
                  ? 'bg-white/80 hover:bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900'
                  : 'hover:bg-slate-800'
              }`}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className={`text-lg font-semibold ${
              theme === 'light' ? 'text-slate-800' : 'text-white'
            }`}>
              Back
            </span>
          </div>
        </div>

        {/* Add Account Section */}
        <div className={`p-4 border-b ${
          theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
        }`}>
          {isAddingAccount ? (
            <div className="space-y-2">
              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Account name"
                autoFocus
                className={
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500'
                }
                onKeyPress={(e) => e.key === 'Enter' && handleAddAccount()}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleAddAccount}
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Add
                </Button>
                <Button
                  onClick={() => {
                    setIsAddingAccount(false);
                    setNewAccountName('');
                  }}
                  size="sm"
                  variant="outline"
                  className={`flex-1 ${
                    theme === 'dark'
                      ? 'border-slate-600 hover:bg-slate-700 text-white'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setIsAddingAccount(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          )}
        </div>

        {/* Account List */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 flex md:flex-col flex-row md:space-x-0 space-x-2 md:space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              onClick={() => setSelectedAccount(account)}
              className={`p-3 rounded-lg cursor-pointer transition-all group flex items-center justify-between ${
                selectedAccount?.id === account.id
                  ? theme === 'dark'
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'bg-blue-100 text-slate-900 border border-blue-300'
                  : theme === 'dark'
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-transparent'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-transparent'
              }`}
            >
              <span className="font-medium">{account.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${
                    theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-slate-300'
                  }`}>
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className={
                  theme === 'dark' 
                    ? 'bg-slate-800 border-slate-700' 
                    : 'bg-white border-slate-300'
                }>
                  <DropdownMenuItem
                    onClick={(e) => handleEditAccount(account, e)}
                    className={`cursor-pointer ${
                      theme === 'dark'
                        ? 'text-blue-400 hover:text-blue-300 hover:bg-slate-700'
                        : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => handleDeleteAccount(account, e)}
                    className={`cursor-pointer ${
                      theme === 'dark'
                        ? 'text-red-400 hover:text-red-300 hover:bg-slate-700'
                        : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Transaction Table */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${
        theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100'
      }`}>
        {/* Header with BF and Profile */}
        <div className={`border-b px-3 md:px-6 py-3 md:py-4 ${
          theme === 'dark' 
            ? 'bg-slate-800 border-slate-700' 
            : 'bg-white/80 backdrop-blur-sm border-slate-200'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="w-full md:w-auto">
              {selectedAccount ? (
                <h1 className={`text-xl md:text-2xl font-semibold truncate ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>{selectedAccount.name}</h1>
              ) : (
                <h1 className={`text-xl md:text-2xl font-semibold ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>Account Transactions</h1>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-4 w-full md:w-auto">
              {selectedAccount && (
                <Button
                  onClick={handleAddTransaction}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                  size="sm"
                >
                  <Plus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Add Transaction
                </Button>
              )}
              <div className={`px-3 md:px-4 py-2 rounded-lg border flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto ${
                theme === 'dark'
                  ? 'bg-slate-700 border-slate-600'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <span className={`text-xs md:text-sm font-medium ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>BF (Balance):</span>
                <span className={`font-semibold text-base md:text-lg ${
                  theme === 'dark' ? 'text-white' : 'text-emerald-700'
                }`}>₹{bfAmount.toFixed(2)}</span>
              </div>
              {/* Profile Dropdown with Sync */}
              <ProfileDropdownWithSync theme={theme} />
            </div>
          </div>
        </div>

        {/* Content Area */}
        {!selectedAccount ? (
          <div className={`flex-1 flex items-center justify-center ${
            theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
          }`}>
            <div className="text-center">
              <IndianRupee className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">Select or create an account to view transactions</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-3 md:p-6">
            <div className={`flex-1 flex flex-col overflow-hidden rounded-lg border ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700'
                : 'bg-white/80 backdrop-blur-sm border-slate-200'
            }`}>
              {/* Scrollable Table Container */}
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[600px]">
                  <thead className={`sticky top-0 border-b z-10 ${
                    theme === 'dark'
                      ? 'bg-slate-700 border-slate-600'
                      : 'bg-slate-100 border-slate-300'
                  }`}>
                    <tr>
                      <th className={`text-left p-2 md:p-3 font-medium text-xs md:text-sm w-1/4 ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>Name</th>
                      <th className={`text-left p-2 md:p-3 font-medium text-xs md:text-sm w-1/5 ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>Date</th>
                      <th className={`text-left p-2 md:p-3 font-medium text-xs md:text-sm w-1/5 ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>Credit</th>
                      <th className={`text-left p-2 md:p-3 font-medium text-xs md:text-sm w-1/5 ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>Debit</th>
                      <th className={`text-center p-2 md:p-3 font-medium text-xs md:text-sm w-1/6 ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={theme === 'dark' ? 'bg-slate-800' : 'bg-white/50'}>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan="5" className={`text-center py-16 ${
                          theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          <div className="flex flex-col items-center">
                            <IndianRupee className="w-12 h-12 mb-3 opacity-20" />
                            <p>No transactions yet. Click "Add Transaction" to get started.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      transactions.map((trans) => (
                        <tr
                          key={trans.id}
                          className={`border-b transition-colors ${
                            theme === 'dark'
                              ? 'border-slate-700 hover:bg-slate-750'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-3">
                            {trans.isEditing || editingTransactions[trans.id] ? (
                              <Input
                                value={trans.name}
                                onChange={(e) => handleTransactionChange(trans.id, 'name', e.target.value)}
                                placeholder="Enter name"
                                className={`text-sm ${
                                  theme === 'dark'
                                    ? 'bg-slate-700 border-slate-600 text-white'
                                    : 'bg-slate-50 border-slate-300 text-slate-900'
                                }`}
                              />
                            ) : (
                              <span className={`text-sm ${
                                theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
                              }`}>{trans.name || '-'}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {trans.isEditing || editingTransactions[trans.id] ? (
                              <Input
                                type="date"
                                value={trans.date}
                                onChange={(e) => handleTransactionChange(trans.id, 'date', e.target.value)}
                                className={`text-sm ${
                                  theme === 'dark'
                                    ? 'bg-slate-700 border-slate-600 text-white'
                                    : 'bg-slate-50 border-slate-300 text-slate-900'
                                }`}
                              />
                            ) : (
                              <span className={`text-sm ${
                                theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
                              }`}>{trans.date}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {trans.isEditing || editingTransactions[trans.id] ? (
                              <Input
                                type="number"
                                value={trans.creditAmount === 0 ? '' : trans.creditAmount}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                                  // If user enters credit, clear debit
                                  if (value !== '' && value !== 0) {
                                    handleTransactionChange(trans.id, 'debitAmount', '');
                                  }
                                  handleTransactionChange(trans.id, 'creditAmount', value);
                                }}
                                placeholder="Credit Amount"
                                disabled={trans.debitAmount && trans.debitAmount !== '' && trans.debitAmount !== 0}
                                className={`text-sm ${
                                  theme === 'dark'
                                    ? 'bg-slate-700 border-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                                    : 'bg-slate-50 border-slate-300 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed'
                                }`}
                              />
                            ) : (
                              <span className={`font-medium text-sm ${
                                theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                              }`}>₹{trans.creditAmount || '-'}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {trans.isEditing || editingTransactions[trans.id] ? (
                              <Input
                                type="number"
                                value={trans.debitAmount === 0 ? '' : trans.debitAmount}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                                  // If user enters debit, clear credit
                                  if (value !== '' && value !== 0) {
                                    handleTransactionChange(trans.id, 'creditAmount', '');
                                  }
                                  handleTransactionChange(trans.id, 'debitAmount', value);
                                }}
                                placeholder="Debit Amount"
                                disabled={trans.creditAmount && trans.creditAmount !== '' && trans.creditAmount !== 0}
                                className={`text-sm ${
                                  theme === 'dark'
                                    ? 'bg-slate-700 border-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                                    : 'bg-slate-50 border-slate-300 text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed'
                                }`}
                              />
                            ) : (
                              <span className={`font-medium text-sm ${
                                theme === 'dark' ? 'text-red-400' : 'text-red-600'
                              }`}>₹{trans.debitAmount || '-'}</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(trans.isEditing || editingTransactions[trans.id]) && (
                                <>
                                  <Button
                                    onClick={() => handleSaveTransaction(trans.id)}
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 w-8 p-0 ${
                                      theme === 'dark'
                                        ? 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-700'
                                        : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                    }`}
                                    title="Save Transaction"
                                  >
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={() => handleCancelTransaction(trans.id)}
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 w-8 p-0 ${
                                      theme === 'dark'
                                        ? 'text-red-400 hover:text-red-300 hover:bg-slate-700'
                                        : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                    }`}
                                    title="Cancel Transaction"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {!(trans.isEditing || editingTransactions[trans.id]) && (
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 w-8 p-0 ${
                                      theme === 'dark'
                                        ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-700'
                                        : 'text-slate-600 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className={
                                  theme === 'dark'
                                    ? 'bg-slate-800 border-slate-700'
                                    : 'bg-white border-slate-300'
                                }>
                                  <DropdownMenuItem
                                    onClick={() => setEditingTransactions({ ...editingTransactions, [trans.id]: true })}
                                    className={`cursor-pointer ${
                                      theme === 'dark'
                                        ? 'text-slate-300 hover:text-white hover:bg-slate-700'
                                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => handleDeleteTransaction(trans, e)}
                                    className={`cursor-pointer ${
                                      theme === 'dark'
                                        ? 'text-red-400 hover:text-red-300 hover:bg-slate-700'
                                        : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                    }`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Total Row - Sticky Bottom */}
              {transactions.length > 0 && (
                <div className={`border-t ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600'
                    : 'bg-slate-100 border-slate-300'
                }`}>
                  <div className="flex items-center p-3">
                    <div className="w-1/4 text-left">
                      <span className={`font-semibold text-sm ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>Total</span>
                    </div>
                    <div className="w-1/5"></div>
                    <div className="w-1/5 text-left">
                      <span className={`font-semibold text-base ${
                        theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                      }`}>
                        ₹{totals.credit.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-1/5 text-left">
                      <span className={`font-semibold text-base ${
                        theme === 'dark' ? 'text-red-400' : 'text-red-600'
                      }`}>
                        ₹{totals.debit.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-1/6 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          Net Amount
                        </span>
                        <span className={`font-bold text-xl ${
                          theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                        }`}>
                          ₹{Math.abs(totals.netBalance).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className={
          theme === 'dark'
            ? 'bg-slate-800 border-slate-700'
            : 'bg-white border-slate-300'
        }>
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
              Are you sure you want to delete this {deleteTarget?.type === 'account' ? 'account' : 'transaction'}? 
              {deleteTarget?.type === 'account' && ' All transactions in this account will also be deleted.'}
            </p>
            <div>
              <Label className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>Type "delete" to confirm</Label>
              <Input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type delete"
                className={`mt-1 ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500'
                }`}
              />
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={confirmDelete} 
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
              >
                Delete
              </Button>
              <Button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTarget(null);
                  setDeleteConfirmText('');
                }}
                variant="outline"
                className={`flex-1 ${
                  theme === 'dark'
                    ? 'border-slate-600 text-white hover:bg-slate-700'
                    : 'border-slate-300 text-slate-900 hover:bg-slate-100'
                }`}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Account Modal */}
      <Dialog open={isEditAccountModalOpen} onOpenChange={setIsEditAccountModalOpen}>
        <DialogContent className={
          theme === 'dark'
            ? 'bg-slate-800 border-slate-700'
            : 'bg-white border-slate-300'
        }>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>
              Edit Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                Account Name
              </Label>
              <Input
                type="text"
                value={editAccountName}
                onChange={(e) => setEditAccountName(e.target.value)}
                placeholder="Enter account name"
                className={`mt-1 ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500'
                }`}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveEditAccount()}
              />
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={handleSaveEditAccount} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save Changes
              </Button>
              <Button 
                onClick={() => {
                  setIsEditAccountModalOpen(false);
                  setEditingAccount(null);
                  setEditAccountName('');
                }}
                variant="outline"
                className={`flex-1 ${
                  theme === 'dark'
                    ? 'border-slate-600 text-white hover:bg-slate-700'
                    : 'border-slate-300 text-slate-900 hover:bg-slate-100'
                }`}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Account;