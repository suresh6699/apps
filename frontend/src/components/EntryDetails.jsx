import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ArrowLeft, LogOut, User as UserIcon, Plus, Calendar, Search, Edit, MoreVertical, Trash2, AlertCircle, Clock, RefreshCw, CheckCircle, RotateCcw, Printer, ChevronDown, Mail } from 'lucide-react';
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from './ui/sidebar';
import { useTheme } from '../App';
import { useAuth } from '../contexts/AuthContext';
import lineService from '../services/lineService';
import customerService from '../services/customerService';
import transactionService from '../services/transactionService';
import pdfService from '../services/pdfService';
import LoadingScreen from './LoadingScreen';
import ProfileDropdownWithSync from './ProfileDropdownWithSync';

// Sidebar content component that can access useSidebar hook
const SidebarContent = ({ 
  theme, 
  line, 
  days, 
  selectedDay, 
  handleSelectDay, 
  setIsAddDayModalOpen,
  allPendingCustomers,
  allDeletedCustomers,
  activeView,
  handleViewPending,
  handleViewDeleted,
  handleDeleteDay
}) => {
  const { open } = useSidebar();
  
  return (
    <>
      {/* Logo / Line Info - Fixed at top */}
      <div className={`py-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-slate-800/50'} flex-shrink-0 ${open ? 'px-2' : 'px-0'} flex items-center justify-center`}>
        {open ? (
          <div className="flex items-center gap-2 w-full px-2">
            <div className={`px-3 py-2 ${theme === 'light' ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-400' : 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-cyan-400/50'} backdrop-blur-md rounded-lg border shadow-lg whitespace-nowrap w-full text-center`}>
              <span className={`${theme === 'light' ? 'text-blue-700' : 'text-cyan-300'} text-xs font-bold tracking-wide`}>
                {line?.name || 'Loading...'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'light' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'} shadow-lg`}>
              <span className="text-white text-sm font-bold">
                {line?.name?.charAt(0).toUpperCase() || 'L'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add Day Button - Fixed below header */}
      <div className={`py-3 flex-shrink-0 border-b ${theme === 'light' ? 'border-gray-200' : 'border-slate-800/50'} flex justify-center ${open ? 'px-2' : 'px-0'}`}>
        <Button 
          onClick={() => setIsAddDayModalOpen(true)} 
          className={`${open ? 'w-full' : 'w-10 h-10 p-0'} ${theme === 'light' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600' : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'} shadow-lg ${open ? 'h-9' : ''} text-xs flex items-center justify-center flex-shrink-0`} 
          size="sm"
        >
          <Plus className={`w-4 h-4 ${open ? 'mr-2' : ''} flex-shrink-0`} />
          {open && <span className="whitespace-nowrap overflow-hidden">Add Day</span>}
        </Button>
      </div>
      
      {/* Days List - Scrollable area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 sidebar-scroll">
        <div className={`mt-4 pb-4 flex flex-col gap-2 ${open ? 'px-2' : 'px-0'}`}>
          {days.map((day) => (
            <div key={day} className="relative group">
              <SidebarLink
                link={{
                  label: day,
                  onClick: () => handleSelectDay(day),
                  icon: (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedDay === day
                        ? theme === 'light' 
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                        : theme === 'light'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-slate-800/50 text-slate-400'
                    }`}>
                      <Calendar className="w-4 h-4" />
                    </div>
                  ),
                }}
                className={`p-2 rounded-lg transition-all ${
                  selectedDay === day
                    ? theme === 'light' 
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-cyan-500/10 border border-cyan-500/30'
                    : theme === 'light'
                      ? 'hover:bg-gray-50'
                      : 'hover:bg-slate-800/30'
                } ${!open ? 'mx-auto' : ''}`}
              />
              {open && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className={`absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded ${
                        theme === 'light' 
                          ? 'hover:bg-gray-200 text-gray-600' 
                          : 'hover:bg-slate-700 text-slate-400'
                      } opacity-0 group-hover:opacity-100 transition-opacity z-10`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={(e) => e.stopPropagation()}
                    onMouseLeave={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteDay(day, e);
                      }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Day
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Section - Quick View Buttons */}
      <div className={`${theme === 'light' ? 'bg-gray-50/80 border-gray-200' : 'bg-[#141824]/50 border-slate-800/50'} flex-shrink-0 border-t`}>
        <div className={`p-2 space-y-2 ${!open ? 'flex flex-col items-center' : ''}`}>
          {/* Pending Button */}
          <SidebarLink
            link={{
              label: `Pending (${allPendingCustomers.length})`,
              onClick: handleViewPending,
              icon: (
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  activeView === 'pending'
                    ? theme === 'light'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                      : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                    : theme === 'light'
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-orange-500/20 text-orange-400'
                }`}>
                  <AlertCircle className="w-4 h-4" />
                </div>
              ),
            }}
            className={`p-2 rounded-lg transition-all ${
              activeView === 'pending'
                ? theme === 'light'
                  ? 'bg-orange-50 border border-orange-200'
                  : 'bg-orange-500/10 border border-orange-500/30'
                : theme === 'light'
                  ? 'hover:bg-gray-50'
                  : 'hover:bg-slate-800/30'
            } ${!open ? 'w-12' : ''}`}
          />

          {/* Deleted Button */}
          <SidebarLink
            link={{
              label: `Deleted (${allDeletedCustomers.length})`,
              onClick: handleViewDeleted,
              icon: (
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  activeView === 'deleted'
                    ? theme === 'light'
                      ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                      : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                    : theme === 'light'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-red-500/20 text-red-400'
                }`}>
                  <Trash2 className="w-4 h-4" />
                </div>
              ),
            }}
            className={`p-2 rounded-lg transition-all ${
              activeView === 'deleted'
                ? theme === 'light'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-red-500/10 border border-red-500/30'
                : theme === 'light'
                  ? 'hover:bg-gray-50'
                  : 'hover:bg-slate-800/30'
            } ${!open ? 'w-12' : ''}`}
          />
        </div>
      </div>
    </>
  );
};

const EntryDetails = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const lineId = searchParams.get('id');
  
  const [line, setLine] = useState(null);
  const [days, setDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bfAmount, setBfAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isAddDayModalOpen, setIsAddDayModalOpen] = useState(false);
  const [isQuickTransactionOpen, setIsQuickTransactionOpen] = useState(false);
  const [transactionList, setTransactionList] = useState([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newDay, setNewDay] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isDeleteDayModalOpen, setIsDeleteDayModalOpen] = useState(false);
  const [dayToDelete, setDayToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeleteCustomerModalOpen, setIsDeleteCustomerModalOpen] = useState(false);
  const [deleteCustomerError, setDeleteCustomerError] = useState('');
  const [isErrorAlertOpen, setIsErrorAlertOpen] = useState(false);
  const [deletedCustomers, setDeletedCustomers] = useState([]);
  const [pendingCustomers, setPendingCustomers] = useState([]);
  const [allPendingCustomers, setAllPendingCustomers] = useState([]);
  const [allDeletedCustomers, setAllDeletedCustomers] = useState([]);
  const [activeView, setActiveView] = useState('customers');
  const [viewSelectedDay, setViewSelectedDay] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [renewalCustomer, setRenewalCustomer] = useState(null);
  const [renewalForm, setRenewalForm] = useState({
    takenAmount: '',
    interest: '',
    pc: '',
    date: new Date().toISOString().split('T')[0],
    weeks: '12'
  });
  
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [customerToRestore, setCustomerToRestore] = useState(null);
  const [restoreForm, setRestoreForm] = useState({
    newId: '',
    takenAmount: '',
    interest: '',
    pc: '',
    date: new Date().toISOString().split('T')[0],
    weeks: '12'
  });
  
  const [customerForm, setCustomerForm] = useState({
    id: '',
    name: '',
    village: '',
    phone: '',
    takenAmount: '',
    interest: '',
    pc: '',
    date: '',
    weeks: '12',
    profileImage: null
  });
  
  const [quickTransaction, setQuickTransaction] = useState({
    customerId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [universalDate, setUniversalDate] = useState(new Date().toISOString().split('T')[0]);
  const suggestionRef = useRef(null);
  
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printType, setPrintType] = useState('transactions');
  const [printCustomerId, setPrintCustomerId] = useState('');
  const [printCustomerName, setPrintCustomerName] = useState('');
  const [selectedDaysForPrint, setSelectedDaysForPrint] = useState([]);
  const [selectAllDays, setSelectAllDays] = useState(true);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (lineId) {
      loadLineData();
    }
  }, [lineId]);

  useEffect(() => {
    if (selectedDay) {
      loadCustomersAndCalculate();
    }
  }, [selectedDay]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = customers.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchQuery, customers]);

  const loadLineData = async () => {
    try {
      setLoading(true);
      const lineData = await lineService.getLineById(lineId);
      setLine(lineData.line);
      setBfAmount(lineData.line.currentBF || 0);
      
      const daysData = await lineService.getDays(lineId);
      setDays(daysData.days || []);
      
      // Set selected day from URL or use first day
      const dayFromUrl = searchParams.get('day');
      const viewFromUrl = searchParams.get('view');
      const viewDayFromUrl = searchParams.get('viewDay');
      
      if (viewFromUrl && ['customers', 'pending', 'deleted'].includes(viewFromUrl)) {
        setActiveView(viewFromUrl);
        
        // Load pending/deleted data if view is pending or deleted
        if (viewFromUrl === 'pending' || viewFromUrl === 'deleted') {
          await loadPendingAndDeletedCounts();
        }
      }
      
      if (viewDayFromUrl) {
        setViewSelectedDay(viewDayFromUrl);
      }
      
      if (dayFromUrl && daysData.days?.includes(dayFromUrl)) {
        setSelectedDay(dayFromUrl);
      } else if (daysData.days && daysData.days.length > 0 && !viewFromUrl) {
        // Only set default day if we're not in pending/deleted view
        setSelectedDay(daysData.days[0]);
      }
    } catch (err) {
      // console.error('Error loading line:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomersAndCalculate = useCallback(async () => {
    if (!selectedDay) return;
    
    try {
      const data = await customerService.getCustomers(lineId, selectedDay);
      const customersList = data.customers || [];
      
      // Backend already provides calculated values (totalOwed, totalPaid, remainingAmount)
      setCustomers(customersList);
      setFilteredCustomers(customersList);
      
      // Also load pending and deleted customers for counts
      await loadPendingAndDeletedCounts();
      
    } catch (err) {
      // console.error('Error loading customers:', err);
    }
  }, [lineId, selectedDay]);
  
  const loadPendingAndDeletedCounts = async () => {
    try {
      // Load pending customers using the backend API
      const pendingData = await customerService.getPendingCustomers(lineId);
      const allPending = pendingData.pendingCustomers || [];
      
      setAllPendingCustomers(allPending);
      setPendingCustomers(allPending);
      
      // Load deleted customers using the backend API
      const deletedData = await customerService.getDeletedCustomers(lineId);
      const allDeleted = deletedData.deletedCustomers || [];
      
      setAllDeletedCustomers(allDeleted);
      setDeletedCustomers(allDeleted);
      
    } catch (err) {
      // console.error('Error loading pending and deleted customers:', err);
    }
  };

  const handleAddDay = async () => {
    if (!newDay.trim()) {
      alert('Please enter a day');
      return;
    }
    
    if (days.includes(newDay)) {
      alert('This day already exists');
      return;
    }
    
    try {
      await lineService.createDay(lineId, {
        day: newDay,
        date: new Date().toISOString().split('T')[0]
      });
      
      await loadLineData();
      setIsAddDayModalOpen(false);
      setNewDay('');
    } catch (err) {
      alert(err.message || 'Failed to add day');
    }
  };

  const handleDeleteDay = (day, e) => {
    e.stopPropagation();
    setDayToDelete(day);
    setDeleteConfirmText('');
    setIsDeleteDayModalOpen(true);
  };

  const confirmDeleteDay = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      alert('Please type "delete" to confirm');
      return;
    }
    
    // Note: Backend should handle cascading delete of customers and transactions
    try {
      // This would need a delete day endpoint in the backend
      // For now, we'll just refresh the data
      await loadLineData();
      setIsDeleteDayModalOpen(false);
      setDayToDelete(null);
      setDeleteConfirmText('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSelectDay = (day) => {
    setSelectedDay(day);
    setActiveView('customers'); // Always switch to customers view when selecting a day
    setSearchParams({ id: lineId, day });
  };

  const handleOpenCustomerModal = async (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerForm({
        id: customer.id,
        name: customer.name,
        village: customer.village || '',
        phone: customer.phone || '',
        takenAmount: customer.takenAmount.toString(),
        interest: customer.interest || '',
        pc: customer.pc || '',
        date: customer.date || '',
        weeks: customer.weeks || '12',
        profileImage: null
      });
    } else {
      setEditingCustomer(null);
      
      // Get next customer ID from backend
      try {
        const { nextId } = await customerService.getNextCustomerId(lineId, selectedDay);
        setCustomerForm({
          id: nextId,
          name: '',
          village: '',
          phone: '',
          takenAmount: '',
          interest: '',
          pc: '',
          date: new Date().toISOString().split('T')[0],
          weeks: '12',
          profileImage: null
        });
      } catch (err) {
        // console.error('Error getting next ID:', err);
        // Fallback to '1' if API fails
        setCustomerForm({
          id: '1',
          name: '',
          village: '',
          phone: '',
          takenAmount: '',
          interest: '',
          pc: '',
          date: new Date().toISOString().split('T')[0],
          weeks: '12',
          profileImage: null
        });
      }
    }
    setError('');
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async () => {
    // Frontend validation for required fields
    if (!customerForm.name.trim()) {
      setError('Customer name is required');
      return;
    }
    if (!customerForm.id.trim()) {
      setError('Customer ID is required');
      return;
    }
    if (!customerForm.takenAmount || parseFloat(customerForm.takenAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    try {
      const customerData = {
        id: customerForm.id,
        name: customerForm.name,
        village: customerForm.village,
        phone: customerForm.phone,
        takenAmount: parseFloat(customerForm.takenAmount),
        interest: customerForm.interest,
        pc: customerForm.pc,
        date: customerForm.date,
        weeks: customerForm.weeks
      };

      if (editingCustomer) {
        const response = await customerService.updateCustomer(editingCustomer.id, lineId, selectedDay, customerData);
        setSuccessMessage(`Customer updated! New BF: ₹${response.newBF?.toFixed(2) || 'N/A'}`);
      } else {
        const response = await customerService.createCustomer(lineId, selectedDay, customerData);
        setSuccessMessage(`Customer added! ₹${customerData.takenAmount} deducted from BF. New BF: ₹${response.newBF?.toFixed(2) || 'N/A'}`);
      }

      await loadCustomersAndCalculate();
      await loadLineData(); // Refresh BF
      
      setCustomerForm({
        id: '',
        name: '',
        village: '',
        phone: '',
        takenAmount: '',
        interest: '',
        pc: '',
        date: '',
        weeks: '12',
        profileImage: null
      });
      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
      setError('');
      setIsSuccessModalOpen(true);
    } catch (err) {
      // Backend will send proper error messages for duplicate ID, etc.
      setError(err.message || 'Failed to save customer');
    }
  };

  const handleDeleteCustomer = (customer, e) => {
    e.stopPropagation();
    
    // Check if customer has remaining amount before opening modal
    if (customer.remainingAmount > 0) {
      setDeleteCustomerError(`Unable to delete due to pending amount: ₹${customer.remainingAmount.toFixed(2)}`);
      setIsErrorAlertOpen(true);
      return;
    }
    
    setCustomerToDelete(customer);
    setDeleteConfirmText('');
    setIsDeleteCustomerModalOpen(true);
  };

  const confirmDeleteCustomer = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      alert('Please type "delete" to confirm');
      return;
    }
    
    try {
      await customerService.deleteCustomer(customerToDelete.id, lineId, selectedDay);
      await loadCustomersAndCalculate();
      await loadLineData();
      setIsDeleteCustomerModalOpen(false);
      setCustomerToDelete(null);
      setDeleteConfirmText('');
      
      setSuccessMessage('Customer deleted successfully! Transaction history preserved.');
      setIsSuccessModalOpen(true);
    } catch (err) {
      setDeleteCustomerError(err.message || 'Failed to delete customer');
    }
  };

  const handleQuickTransaction = async () => {
    if (!quickTransaction.customerId) {
      alert('Please select a customer');
      return;
    }
    if (!quickTransaction.amount || parseFloat(quickTransaction.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const transData = {
        amount: parseFloat(quickTransaction.amount),
        date: quickTransaction.date,
        type: 'received'
      };

      await transactionService.createTransaction(quickTransaction.customerId, lineId, selectedDay, transData);
      
      await loadCustomersAndCalculate();
      await loadLineData();
      
      setQuickTransaction({
        customerId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
      });
      setIsQuickTransactionOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to add transaction');
    }
  };

  const handleAddToTransactionList = () => {
    if (!quickTransaction.customerId || !quickTransaction.amount) {
      alert('Please select a customer and enter amount');
      return;
    }

    const customer = customers.find(c => c.id === quickTransaction.customerId);
    if (!customer) return;

    const newTransaction = {
      tempId: Date.now().toString(),
      customerId: quickTransaction.customerId,
      customerName: customer.name,
      amount: parseFloat(quickTransaction.amount),
      date: universalDate
    };

    setTransactionList([...transactionList, newTransaction]);
    setQuickTransaction({
      ...quickTransaction,
      customerId: '',
      amount: ''
    });
    setShowSuggestions(false);
  };

  const handleCustomerIdChange = (value) => {
    setQuickTransaction({ ...quickTransaction, customerId: value });
    
    if (value.trim() === '') {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Filter customers based on input
    const filtered = customers.filter(c => 
      c.id.toLowerCase().includes(value.toLowerCase()) ||
      c.name.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 5); // Limit to 5 suggestions

    setCustomerSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const selectCustomerSuggestion = (customer) => {
    setQuickTransaction({ ...quickTransaction, customerId: customer.id });
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  };

  const handleDeleteTransaction = (tempId) => {
    setTransactionList(transactionList.filter(t => t.tempId !== tempId));
  };

  const handleSaveTransactions = async () => {
    if (transactionList.length === 0) {
      alert('No transactions to save');
      return;
    }

    try {
      // Save all transactions
      let totalCollectedAmount = 0;
      await Promise.all(
        transactionList.map(trans => {
          totalCollectedAmount += trans.amount;
          return transactionService.createTransaction(trans.customerId, lineId, selectedDay, {
            amount: trans.amount,
            date: trans.date,
            type: 'received'
          });
        })
      );

      await loadCustomersAndCalculate();
      const lineData = await loadLineData();
      
      setTransactionList([]);
      setIsQuickTransactionOpen(false);
      
      setSuccessMessage(`All transactions saved successfully! Collected: ₹${totalCollectedAmount.toFixed(2)}.`);
      setIsSuccessModalOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to save transactions');
    }
  };

  const handleResetTransactions = () => {
    setTransactionList([]);
  };

  const handleProfileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCustomerForm({ ...customerForm, profileImage: file });
    }
  };

  const handleOpenRenewalModal = (customer, e) => {
    e.stopPropagation();
    
    // Check if customer has cleared their balance (remaining amount must be 0)
    if (customer.remainingAmount > 0) {
      alert(`Customer is not eligible for renewal. Remaining balance: ₹${customer.remainingAmount.toFixed(2)}. Please clear the balance first.`);
      return;
    }
    
    setRenewalCustomer(customer);
    setRenewalForm({
      takenAmount: '',
      interest: customer.interest || '',
      pc: customer.pc || '',
      date: new Date().toISOString().split('T')[0],
      weeks: '12'
    });
    setError('');
    setIsRenewalModalOpen(true);
  };

  const handleSaveRenewal = async () => {
    if (renewalCustomer.remainingAmount > 0) {
      setError('Customer still has pending amount. Please clear it before renewal.');
      return;
    }
    if (!renewalForm.takenAmount || parseFloat(renewalForm.takenAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      const renewalData = {
        takenAmount: parseFloat(renewalForm.takenAmount),
        interest: renewalForm.interest,
        pc: renewalForm.pc,
        date: renewalForm.date,
        weeks: renewalForm.weeks
      };

      const response = await customerService.createRenewal(renewalCustomer.id, lineId, selectedDay, renewalData);
      
      await loadCustomersAndCalculate();
      await loadLineData();
      
      setIsRenewalModalOpen(false);
      setRenewalCustomer(null);
      setRenewalForm({
        takenAmount: '',
        interest: '',
        pc: '',
        date: new Date().toISOString().split('T')[0],
        weeks: '12'
      });
      setError('');
      
      setSuccessMessage(`Renewal saved! ₹${renewalData.takenAmount.toFixed(2)} deducted from BF. New BF: ₹${response.newBF?.toFixed(2) || 'N/A'}`);
      setIsSuccessModalOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to create renewal');
    }
  };

  const handleOpenRestoreModal = async (customer, e) => {
    e.stopPropagation();
    
    // Get next available customer ID from backend for the day they were deleted from
    let nextId = '1';
    try {
      const { nextId: generatedId } = await customerService.getNextCustomerId(lineId, customer.deletedFrom);
      nextId = generatedId;
    } catch (err) {
      // console.error('Error getting next ID:', err);
    }
    
    setCustomerToRestore(customer);
    setRestoreForm({
      newId: nextId,
      takenAmount: '',
      interest: customer.interest || '',
      pc: customer.pc || '',
      date: new Date().toISOString().split('T')[0],
      weeks: '12'
    });
    setError('');
    setIsRestoreModalOpen(true);
  };

  const handleRestoreCustomer = async () => {
    // Frontend validation for required fields
    if (!restoreForm.newId.trim()) {
      setError('Please enter customer ID');
      return;
    }
    if (!restoreForm.takenAmount || parseFloat(restoreForm.takenAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      const restoreData = {
        newId: restoreForm.newId,
        takenAmount: parseFloat(restoreForm.takenAmount),
        interest: restoreForm.interest,
        pc: restoreForm.pc,
        date: restoreForm.date,
        weeks: restoreForm.weeks,
        deletedFrom: customerToRestore.deletedFrom,
        deletionTimestamp: customerToRestore.deletionTimestamp // CRITICAL: Identify exact customer to restore
      };

      const response = await customerService.restoreCustomer(customerToRestore.id, lineId, restoreData);
      
      await loadCustomersAndCalculate();
      await loadLineData();
      await loadPendingAndDeletedCounts(); // Refresh deleted list
      
      setIsRestoreModalOpen(false);
      setCustomerToRestore(null);
      setRestoreForm({
        newId: '',
        takenAmount: '',
        interest: '',
        pc: '',
        date: new Date().toISOString().split('T')[0],
        weeks: '12'
      });
      setError('');
      
      setSuccessMessage(`Customer restored successfully with new ID: ${restoreData.newId}! ₹${restoreData.takenAmount.toFixed(2)} deducted from BF. New BF: ₹${response.newBF?.toFixed(2) || 'N/A'}`);
      setIsSuccessModalOpen(true);
    } catch (err) {
      // Backend will send proper error messages for duplicate ID, etc.
      setError(err.message || 'Failed to restore customer');
    }
  };

  const handleViewPending = async () => {
    setActiveView('pending');
    setViewSelectedDay(null); // Show all by default
    setSelectedDay(null); // Clear the selected day
    setSearchParams({ id: lineId, view: 'pending' });
    // Always reload to get fresh data
    await loadPendingAndDeletedCounts();
  };

  const handleViewDeleted = async () => {
    setActiveView('deleted');
    setViewSelectedDay(null); // Show all by default
    setSelectedDay(null); // Clear the selected day
    setSearchParams({ id: lineId, view: 'deleted' });
    // Always reload to get fresh data
    await loadPendingAndDeletedCounts();
  };

  const handleOpenPrintModal = () => {
    setIsPrintModalOpen(true);
    setSelectedDaysForPrint(days);
    setSelectAllDays(true);
  };

  const handlePrint = async () => {
    if (printType === 'transactions') {
      handlePrintCustomerTransactions();
    } else {
      handlePrintCustomerSummary();
    }
  };

  const handlePrintCustomerTransactions = async () => {
    if (!printCustomerId.trim()) {
      alert('Please enter Customer ID');
      return;
    }

    try {
      // Get customer data to verify existence
      const customer = customers.find(c => c.id === printCustomerId);
      if (!customer) {
        alert('Customer not found in current day');
        return;
      }

      // Call backend PDF generation endpoint
      await pdfService.downloadCustomerTransactionPDF(customer.id, lineId, selectedDay);
      
      setIsPrintModalOpen(false);
      
    } catch (err) {
      // console.error('Error generating PDF:', err);
      alert(err.message || 'Failed to generate PDF');
    }
  };

  const handlePrintCustomerSummary = async () => {
    const daysToInclude = selectAllDays ? days : selectedDaysForPrint;
    
    if (!selectAllDays && daysToInclude.length === 0) {
      alert('Please select at least one day');
      return;
    }

    try {
      // Call backend PDF generation endpoint
      const filters = {
        days: daysToInclude.join(','),
        selectAllDays: selectAllDays
      };
      
      await pdfService.downloadCustomerSummaryPDF(lineId, filters);
      setIsPrintModalOpen(false);
      
    } catch (err) {
      // console.error('Error generating PDF:', err);
      alert(err.message || 'Failed to generate PDF');
    }
  };
  
  // Computed values for search filtering
  const searchFilteredPendingCustomers = pendingCustomers.filter(c => 
    !searchQuery || 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery))
  );
  
  const searchFilteredDeletedCustomers = deletedCustomers.filter(c => 
    !searchQuery || 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  // Get unique days from pending and deleted customers
  const pendingDays = [...new Set(allPendingCustomers.map(c => c.dayName))];
  const deletedDays = [...new Set(allDeletedCustomers.map(c => c.deletedFrom))];

  // Filter pending customers by selected day
  const filteredPendingCustomers = viewSelectedDay 
    ? searchFilteredPendingCustomers.filter(c => c.dayName === viewSelectedDay)
    : searchFilteredPendingCustomers;

  // Filter deleted customers by selected day
  const filteredDeletedCustomers = viewSelectedDay
    ? searchFilteredDeletedCustomers.filter(c => c.deletedFrom === viewSelectedDay)
    : searchFilteredDeletedCustomers;

  if (loading) {
    return <LoadingScreen />;
  }

  if (!line) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p>Line not found</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`min-h-screen ${theme === 'light' ? 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20' : 'bg-[#0f1419]'} flex flex-col md:flex-row relative`}>
        {/* Subtle Background Pattern for Light Mode */}
        {theme === 'light' && (
          <div className="fixed inset-0 pointer-events-none z-0">
            {/* Subtle gradient mesh */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.03),transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(6,182,212,0.03),transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(99,102,241,0.02),transparent_50%)]"></div>
            
            {/* Very subtle grid pattern */}
            <div className="absolute inset-0 opacity-[0.02]" style={{
              backgroundImage: `linear-gradient(rgba(100, 116, 139, 0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(100, 116, 139, 0.1) 1px, transparent 1px)`,
              backgroundSize: '64px 64px'
            }}></div>
          </div>
        )}
        
        {/* Ambient glows */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className={`absolute top-20 right-20 w-96 h-96 ${theme === 'light' ? 'bg-blue-400/5' : 'bg-cyan-500/10'} rounded-full blur-3xl`} />
          <div className={`absolute bottom-20 left-20 w-96 h-96 ${theme === 'light' ? 'bg-cyan-400/5' : 'bg-blue-500/10'} rounded-full blur-3xl`} />
          <div className={`absolute top-1/2 left-1/2 w-96 h-96 ${theme === 'light' ? 'bg-blue-400/3' : 'bg-blue-500/5'} rounded-full blur-3xl`} />
        </div>

        {/* Left Sidebar - Animated Sidebar with hover to expand */}
        <Sidebar open={isSidebarOpen} setOpen={setIsSidebarOpen}>
          <SidebarBody className={`${theme === 'light' ? 'bg-white/95 border-gray-200' : 'bg-[#1a1f2e]/80 border-slate-800/50'} backdrop-blur-xl border-r`}>
            <SidebarContent
              theme={theme}
              line={line}
              days={days}
              selectedDay={selectedDay}
              handleSelectDay={handleSelectDay}
              setIsAddDayModalOpen={setIsAddDayModalOpen}
              allPendingCustomers={allPendingCustomers}
              allDeletedCustomers={allDeletedCustomers}
              activeView={activeView}
              handleViewPending={handleViewPending}
              handleViewDeleted={handleViewDeleted}
              handleDeleteDay={handleDeleteDay}
            />
          </SidebarBody>
        </Sidebar>

      {/* Right Side - Header + Content */}
      <div className="relative z-10 flex-1 flex flex-col md:h-screen">
        {/* Header */}
        <div className={`${theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1a1f2e] border-slate-800/50'} border-b backdrop-blur-xl flex-shrink-0 h-[72px]`}>
          <div className="px-6 h-full flex items-center">
            <div className="grid grid-cols-3 items-center gap-3 w-full">
              {/* Left - Back Button & Day Name */}
              <div className="flex items-center gap-3 justify-start">
                <Button 
                  onClick={() => navigate('/dashboard')} 
                  variant="ghost" 
                  size="icon"
                  className={`h-10 w-10 rounded-full shadow-md transition-all hover:shadow-lg ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-900' : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white'} border-2`}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                {/* Day Name */}
                {selectedDay && (
                  <div className={`px-4 py-2 backdrop-blur-md rounded-lg border-2 shadow-md min-w-[120px] text-center ${theme === 'light' ? 'bg-blue-50 border-blue-300' : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-500/30'}`}>
                    <span className={`${theme === 'light' ? 'text-blue-700' : 'text-blue-300'} text-sm font-bold tracking-wide whitespace-nowrap`}>{selectedDay}</span>
                  </div>
                )}
              </div>

              {/* Center - BF Badge - Simple & Rich */}
              <div className="flex items-center justify-center">
                <div className={`relative group flex items-center gap-3 px-6 py-3 rounded-xl backdrop-blur-xl border transition-all duration-300 ${
                  theme === 'light' 
                    ? 'bg-white/80 border-blue-200 shadow-lg shadow-blue-100/50 hover:shadow-xl hover:shadow-blue-200/60' 
                    : 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 shadow-lg shadow-cyan-500/10 hover:shadow-xl hover:shadow-cyan-500/20'
                }`}>
                  {/* Subtle accent bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                    theme === 'light' 
                      ? 'bg-gradient-to-b from-blue-500 via-cyan-500 to-emerald-500' 
                      : 'bg-gradient-to-b from-cyan-500 via-blue-500 to-purple-500'
                  }`}></div>
                  
                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                    theme === 'light' 
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                      : 'bg-gradient-to-br from-cyan-500 to-blue-600'
                  } shadow-md`}>
                    <span className="text-xl">💰</span>
                  </div>
                  
                  {/* Text Content */}
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      theme === 'light' ? 'text-blue-600' : 'text-cyan-400'
                    }`}>
                      Balance Forward
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xs font-semibold ${
                        theme === 'light' ? 'text-blue-500' : 'text-cyan-300'
                      }`}>₹</span>
                      <span className={`text-2xl font-bold ${
                        theme === 'light' ? 'text-gray-900' : 'text-white'
                      } tracking-tight`}>
                        {bfAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right - Accounts, Print & Logout */}
              <div className="flex items-center gap-3 justify-end">
                {/* Accounts Button - Enhanced Attractive Design */}
                <Button
                  onClick={() => navigate(`/account?lineId=${lineId}`)}
                  variant="outline"
                  size="sm"
                  className={`group relative overflow-hidden ${
                    theme === 'light' 
                      ? 'bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-600 hover:from-purple-600 hover:via-violet-600 hover:to-indigo-700 text-white border-2 border-purple-400 hover:border-purple-300 shadow-lg shadow-purple-500/40 hover:shadow-xl hover:shadow-purple-500/60' 
                      : 'bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 hover:from-purple-500 hover:via-violet-500 hover:to-indigo-600 text-white border-2 border-purple-400/60 hover:border-purple-300/80 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/50'
                  } transition-all duration-300 hover:scale-[1.05] text-xs md:text-sm whitespace-nowrap h-9 font-bold`}
                >
                  {/* Animated shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out"></div>
                  
                  {/* Subtle pulse animation */}
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300 rounded-md"></div>
                  
                  {/* Icon with bounce animation */}
                  <UserIcon className="w-4 h-4 mr-2 relative z-10 group-hover:animate-bounce transition-transform duration-200" />
                  
                  {/* Text */}
                  <span className="hidden md:inline relative z-10 tracking-wide">Accounts</span>
                </Button>
                {/* Print Button */}
                {selectedDay && (
                  <Button
                    onClick={handleOpenPrintModal}
                    variant="outline"
                    size="sm"
                    className={`${theme === 'light' ? 'bg-gradient-to-br from-green-50 to-white border-2 border-green-300 text-green-900 hover:from-green-100 hover:to-white hover:border-green-400' : 'bg-slate-800 border-slate-600 text-slate-200 hover:text-white'} shadow-md transition-all hover:shadow-lg text-xs md:text-sm whitespace-nowrap h-9`}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    <span className="hidden md:inline">Print</span>
                  </Button>
                )}
                {/* Profile Dropdown with Sync */}
                <ProfileDropdownWithSync theme={theme} />
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 px-6 py-6 overflow-y-auto relative z-10 ${theme === 'light' ? 'bg-transparent' : 'bg-[#0f1419]'}`}>
            {/* Day Tabs for Pending/Deleted View */}
            {(activeView === 'pending' || activeView === 'deleted') && ((activeView === 'pending' ? pendingDays : deletedDays).length > 0) && (
              <div className={`mb-4 backdrop-blur-lg rounded-xl p-3 border ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-800/30 border-slate-700/50'}`}>
                <div className="flex items-center space-x-2 mb-3">
                  <Calendar className={`w-4 h-4 ${theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}`} />
                  <span className={`text-sm font-semibold ${theme === 'light' ? 'text-gray-700' : 'text-slate-300'}`}>Filter by Day</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* All Days Option */}
                  <button
                    onClick={() => {
                      setViewSelectedDay(null);
                      setSearchParams({ 
                        id: lineId, 
                        view: activeView
                      });
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      !viewSelectedDay
                        ? theme === 'light'
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                        : theme === 'light'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                    }`}
                  >
                    All Days
                  </button>
                  {(activeView === 'pending' ? pendingDays : deletedDays).map((day) => (
                    <button
                      key={day}
                      onClick={() => {
                        setViewSelectedDay(day);
                        // Update URL
                        setSearchParams({ 
                          id: lineId, 
                          view: activeView,
                          viewDay: day
                        });
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        viewSelectedDay === day
                          ? theme === 'light'
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                          : theme === 'light'
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 gap-3">
              <div className="relative flex-1 md:max-w-md h-10">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === 'light' ? 'text-gray-400' : 'text-slate-500'}`} />
                <Input
                  placeholder="Search by Name, ID, or Phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-10 h-full backdrop-blur-lg ${theme === 'light' ? 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500' : 'bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50'}`}
                />
              </div>
              {/* Only show action buttons in customers view */}
              {activeView === 'customers' && (
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  {selectedDay && (
                    <>
                      <Button
                        onClick={() => setIsQuickTransactionOpen(true)}
                        size="sm"
                        className="group relative bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/40 hover:shadow-violet-500/60 border-2 border-violet-500/70 hover:border-violet-400/90 text-white text-xs md:text-sm w-full sm:w-auto font-semibold transition-all duration-300 hover:scale-[1.02]"
                      >
                        <div className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-all duration-500 rounded-md"></div>
                        <RefreshCw className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin-slow group-hover:animate-spin relative z-10" />
                        <span className="hidden sm:inline relative z-10">Quick Transaction</span>
                        <span className="sm:hidden relative z-10">Quick Trans</span>
                      </Button>
                      <Button 
                        onClick={() => navigate(`/collections?id=${lineId}&day=${selectedDay}`)} 
                        size="sm"
                        className="group relative bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/40 hover:shadow-blue-500/60 border-2 border-blue-500/70 hover:border-blue-400/90 text-white text-xs md:text-sm w-full sm:w-auto font-semibold transition-all duration-300 hover:scale-[1.02]"
                      >
                        <div className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-all duration-500 rounded-md"></div>
                        <CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 relative z-10 animate-pulse-slow group-hover:animate-bounce" />
                        <span className="relative z-10">Collections</span>
                      </Button>
                      <Button
                        onClick={() => handleOpenCustomerModal()}
                        size="sm"
                        className="group relative bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/40 hover:shadow-emerald-500/60 border-2 border-emerald-500/70 hover:border-emerald-400/90 text-white text-xs md:text-sm w-full sm:w-auto font-semibold transition-all duration-300 hover:scale-[1.02]"
                      >
                        <div className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-all duration-500 rounded-md"></div>
                        <Plus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 relative z-10 animate-pulse group-hover:animate-ping-slow" />
                        <span className="relative z-10">Add Customer</span>
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Customer Cards */}
            {activeView === 'pending' ? (
              // Pending Customers View
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className={`text-xl font-bold text-transparent bg-clip-text ${theme === 'light' ? 'bg-gradient-to-r from-orange-600 to-amber-600' : 'bg-gradient-to-r from-orange-400 to-amber-400'}`}>
                    Pending Customers {viewSelectedDay ? `- ${viewSelectedDay}` : '- All Days'}
                  </h2>
                  <span className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-slate-400'}`}>{filteredPendingCustomers.length} customer(s)</span>
                </div>
                {filteredPendingCustomers.length === 0 ? (
                  <div className={`text-center py-20 ${theme === 'light' ? 'text-gray-400' : 'text-slate-500'}`}>
                    <Clock className="w-24 h-24 mx-auto mb-4 opacity-20" />
                    <p className="text-lg">No pending customers</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredPendingCustomers.map((customer) => {
                      // Backend provides calculated values including renewals
                      // Use totalOwed which includes original amount + renewals
                      const displayTakenAmount = customer.totalOwed || 0;
                      
                      return (
                        <div
                          key={`${customer.dayName}_${customer.id}`}
                          onClick={() => navigate(`/customer?id=${customer.id}&day=${customer.dayName}&lineId=${lineId}&returnView=pending`)}
                          className={`backdrop-blur-xl rounded-xl p-3 shadow-lg border-l-4 border-orange-500 hover:border-orange-400 transition-all duration-300 cursor-pointer hover:scale-[1.01] relative hover:z-50 ${theme === 'light' ? 'bg-white hover:shadow-orange-200/40' : 'bg-gradient-to-br from-slate-800/40 to-slate-900/40 hover:shadow-orange-500/20'}`}
                        >
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="relative group/profile">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
                                {customer.profileImage ? (
                                  <img src={customer.profileImage} alt="Profile" className="w-full h-full rounded-lg object-cover" />
                                ) : (
                                  <UserIcon className="w-5 h-5" />
                                )}
                              </div>
                              
                              {/* Tooltip */}
                              <div className={`absolute left-full ml-2 top-0 w-64 border p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-200 z-[100] text-xs space-y-1.5 backdrop-blur-xl ${theme === 'light' ? 'bg-white border-gray-200 text-gray-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}`}>
                                <p><strong className={theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}>Name:</strong> {customer.name}</p>
                                <p><strong className={theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}>ID:</strong> {customer.id}</p>
                                <p><strong className={theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}>Village:</strong> {customer.village}</p>
                                <p><strong className={theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}>Phone:</strong> {customer.phone}</p>
                                <p><strong className={theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}>Taken Amount:</strong> ₹{customer.takenAmount}</p>
                                <p><strong className={theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}>Interest:</strong> {customer.interest}</p>
                                <p><strong className={theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}>PC:</strong> {customer.pc}</p>
                                <p><strong className={theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}>Date:</strong> {customer.date}</p>
                                <p><strong className={theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}>Weeks:</strong> {customer.weeks}</p>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <h4 className={`font-bold text-sm truncate ${theme === 'light' ? 'text-gray-800' : 'text-slate-200'}`}>{customer.name}</h4>
                              </div>
                              <p className={`text-[10px] ${theme === 'light' ? 'text-gray-600' : 'text-slate-400'}`}>ID: {customer.id}</p>
                            </div>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className={theme === 'light' ? 'text-gray-500' : 'text-slate-500'}>Day:</span>
                              <span className={`font-medium ${theme === 'light' ? 'text-orange-600' : 'text-cyan-400'}`}>{customer.dayName}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-slate-500'}`}>Taken</span>
                                <div className={`font-bold text-xs ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>₹{displayTakenAmount.toFixed(2)}</div>
                              </div>
                              <div>
                                <span className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-slate-500'}`}>Remaining</span>
                                <div className="font-bold text-red-500 text-xs">₹{customer.remainingAmount.toFixed(2)}</div>
                              </div>
                            </div>
                            <div className={`flex justify-between pt-1 border-t ${theme === 'light' ? 'border-gray-200' : 'border-slate-700/50'}`}>
                              <span className={theme === 'light' ? 'text-gray-500' : 'text-slate-500'}>Overdue:</span>
                              <span className="font-bold text-orange-500">{customer.daysOverdue} days</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeView === 'deleted' ? (
              // Deleted Customers View
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className={`text-xl font-bold text-transparent bg-clip-text ${theme === 'light' ? 'bg-gradient-to-r from-red-600 to-rose-600' : 'bg-gradient-to-r from-red-400 to-rose-400'}`}>
                    Deleted Customers {viewSelectedDay && `- ${viewSelectedDay}`}
                  </h2>
                  <span className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-slate-400'}`}>{filteredDeletedCustomers.length} customer(s)</span>
                </div>
                {filteredDeletedCustomers.length === 0 ? (
                  <div className={`text-center py-20 ${theme === 'light' ? 'text-gray-400' : 'text-slate-500'}`}>
                    <Trash2 className="w-24 h-24 mx-auto mb-4 opacity-20" />
                    <p className="text-lg">No deleted customers</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredDeletedCustomers.map((customer, index) => (
                      <div
                        key={`deleted_${index}`}
                        onClick={() => navigate(`/customer?id=${customer.id}&day=${customer.deletedFrom}&lineId=${lineId}&deleted=true&timestamp=${customer.deletionTimestamp}&returnView=deleted`)}
                        className={`backdrop-blur-xl rounded-xl p-3 shadow-lg border-l-4 border-red-500 hover:border-red-400 transition-all duration-300 cursor-pointer hover:scale-[1.01] relative hover:z-50 ${theme === 'light' ? 'bg-white hover:shadow-red-200/40' : 'bg-gradient-to-br from-slate-800/40 to-slate-900/40 hover:shadow-red-500/20'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <div className="relative group/profile">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
                                {customer.profileImage ? (
                                  <img src={customer.profileImage} alt="Profile" className="w-full h-full rounded-lg object-cover" />
                                ) : (
                                  <UserIcon className="w-5 h-5" />
                                )}
                              </div>
                              
                              {/* Tooltip */}
                              <div className={`absolute left-full ml-2 top-0 w-64 border p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-200 z-[100] text-xs space-y-1.5 backdrop-blur-xl ${theme === 'light' ? 'bg-white border-gray-200 text-gray-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}`}>
                                <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Name:</strong> {customer.name}</p>
                                <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>ID:</strong> {customer.id}</p>
                                <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Village:</strong> {customer.village}</p>
                                <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Phone:</strong> {customer.phone}</p>
                                <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Taken Amount:</strong> ₹{customer.displayTakenAmount || customer.takenAmount}</p>
                                <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Interest:</strong> {customer.interest}</p>
                                <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>PC:</strong> {customer.pc}</p>
                                <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Date:</strong> {customer.date}</p>
                                <p><strong className={theme === 'light' ? 'text-red-600' : 'text-cyan-400'}>Weeks:</strong> {customer.weeks}</p>
                                <p className={`pt-2 border-t ${theme === 'light' ? 'border-gray-200' : 'border-slate-700'}`}><strong className="text-red-500">Deleted On:</strong> {customer.deletedDate}</p>
                                <p><strong className="text-red-500">Deleted From:</strong> {customer.deletedFrom}</p>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-bold text-sm truncate ${theme === 'light' ? 'text-gray-800' : 'text-slate-200'}`}>{customer.name}</h4>
                              <p className={`text-[10px] ${theme === 'light' ? 'text-gray-600' : 'text-slate-400'}`}>ID: {customer.id}</p>
                            </div>
                          </div>
                          <div className={`px-1.5 py-0.5 rounded text-[9px] font-medium border flex-shrink-0 ml-1 ${theme === 'light' ? 'bg-red-100 text-red-600 border-red-300' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                            Deleted
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-slate-500'}`}>From Day:</span>
                            <span className={`font-medium ${theme === 'light' ? 'text-red-600' : 'text-cyan-400'}`}>{customer.deletedFrom}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-slate-500'}`}>Deleted On:</span>
                            <span className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>{customer.deletedDate}</span>
                          </div>
                          <div className={`pt-1 border-t ${theme === 'light' ? 'border-gray-200' : 'border-slate-700/50'}`}>
                            <div>
                              <span className={`text-[10px] ${theme === 'light' ? 'text-gray-500' : 'text-slate-500'}`}>Taken Amount</span>
                              <div className={`font-medium text-sm ${theme === 'light' ? 'text-gray-700' : 'text-slate-300'}`}>₹{customer.displayTakenAmount || customer.takenAmount}</div>
                            </div>
                          </div>
                          
                          {/* Restore Button */}
                          <button
                            onClick={(e) => handleOpenRestoreModal(customer, e)}
                            className={`w-full mt-3 px-3 py-2 border rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${theme === 'light' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border-blue-400 hover:border-blue-500 text-blue-600 hover:text-blue-700 shadow-blue-200/20' : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border-blue-500/50 hover:border-blue-400 text-blue-400 hover:text-blue-300 shadow-blue-500/10'}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restore to Active
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : !selectedDay ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Calendar className={`w-24 h-24 mb-6 opacity-50 ${theme === 'light' ? 'text-gray-400' : 'text-slate-600'}`} />
                <h3 className="text-2xl font-bold text-slate-400 mb-2">No Day Selected</h3>
                <p className="text-slate-500 mb-6 max-w-md">
                  Please add a day from the left sidebar to start adding customers and managing transactions.
                </p>
                <Button 
                  onClick={() => setIsAddDayModalOpen(true)} 
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20 border border-cyan-400/30"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Day
                </Button>
              </div>
            ) : (
              // Active Customers View
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredCustomers.map((customer) => {
                  // Use backend-provided calculated values
                  const totalPaid = customer.totalPaid || 0;
                  const totalOwed = customer.totalOwed || 0;
                  const remainingAmount = customer.remainingAmount || 0;
                  // Display totalOwed (includes renewals) instead of just takenAmount
                  const displayTakenAmount = totalOwed;
                  
                  return (
                    <div
                      key={customer.id}
                      onClick={() => navigate(`/customer?id=${customer.id}&day=${selectedDay}&lineId=${lineId}`)}
                      className={`backdrop-blur-xl rounded-xl p-3 shadow-lg border transition-all duration-300 cursor-pointer hover:scale-[1.01] group relative hover:z-50 ${theme === 'light' ? 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-blue-200/40' : 'bg-gradient-to-br from-slate-800/40 to-slate-900/40 border-slate-700/50 hover:border-cyan-500/50 hover:shadow-cyan-500/20'}`}
                    >
                      {/* 3-Dot Menu */}
                      <div className="absolute top-2 right-2 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className={`w-7 h-7 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors border ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 border-gray-300' : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white border-slate-600'}`}>
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className={`${theme === 'light' ? 'bg-white border-gray-200 text-gray-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}`}>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); handleOpenCustomerModal(customer); }}
                              className={`cursor-pointer ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-slate-800'}`}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleOpenRenewalModal(customer, e)}
                              className={`cursor-pointer ${theme === 'light' ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' : 'text-blue-400 hover:text-blue-300 hover:bg-slate-800'}`}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Renewal
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleDeleteCustomer(customer, e)}
                              className={`cursor-pointer ${theme === 'light' ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="relative group/profile">
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg ${theme === 'light' ? 'shadow-blue-200/40 border-blue-300' : 'shadow-cyan-500/20 border-cyan-400/30'} border`}>
                            {customer.profileImage ? (
                              <img src={customer.profileImage} alt="Profile" className="w-full h-full rounded-lg object-cover" />
                            ) : (
                              <UserIcon className="w-6 h-6" />
                            )}
                          </div>
                          
                          {/* Tooltip */}
                          <div className={`absolute left-full ml-2 top-0 w-64 border p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-200 z-50 text-xs space-y-1.5 backdrop-blur-xl ${theme === 'light' ? 'bg-white border-gray-200 text-gray-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}`}>
                            <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Name:</strong> {customer.name}</p>
                            <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>ID:</strong> {customer.id}</p>
                            <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Village:</strong> {customer.village}</p>
                            <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Phone:</strong> {customer.phone}</p>
                            <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Taken Amount:</strong> ₹{customer.takenAmount}</p>
                            <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Interest:</strong> {customer.interest}</p>
                            <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>PC:</strong> {customer.pc}</p>
                            <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Date:</strong> {customer.date}</p>
                            <p><strong className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>Weeks:</strong> {customer.weeks}</p>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0 pr-10">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-bold text-base truncate transition-colors ${theme === 'light' ? 'text-gray-800 group-hover:text-blue-600' : 'text-slate-200 group-hover:text-cyan-400'}`}>{customer.name}</h4>
                            {/* Renewal Badge - After Name */}
                            {customer.hasRenewals && (
                              <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md ${
                                theme === 'light' 
                                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' 
                                  : 'bg-gradient-to-br from-green-400 to-emerald-500 text-white'
                              }`} title="Renewed Customer">
                                R
                              </div>
                            )}
                          </div>
                          <p className={`text-xs mb-2 ${theme === 'light' ? 'text-gray-600' : 'text-slate-400'}`}>ID: {customer.id}</p>
                          
                          {/* Taken Amount and Remaining Side by Side */}
                          <div className="grid grid-cols-2 gap-2 mb-1.5">
                            <div>
                              <span className={`text-[10px] uppercase tracking-wide ${theme === 'light' ? 'text-gray-500' : 'text-slate-500'}`}>Taken</span>
                              <div className={`font-bold text-sm ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                                ₹{displayTakenAmount.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <span className={`text-[10px] uppercase tracking-wide ${theme === 'light' ? 'text-gray-500' : 'text-slate-500'}`}>Remaining</span>
                              <div className={`font-bold text-sm ${remainingAmount > 0 ? 'text-orange-500' : remainingAmount < 0 ? 'text-red-500' : (theme === 'light' ? 'text-blue-600' : 'text-blue-400')}`}>
                                ₹{remainingAmount.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          
                          <p className={`text-[10px] px-2 py-0.5 rounded inline-block ${theme === 'light' ? 'text-gray-600 bg-gray-100' : 'text-slate-500 bg-slate-800/50'}`}>{customer.date}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Day Modal */}
      <Dialog open={isAddDayModalOpen} onOpenChange={setIsAddDayModalOpen}>
        <DialogContent className={theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}>
          <DialogHeader>
            <DialogTitle className={theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}>Add New Day</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>Day Name (e.g., "2025-01-15" or "Monday Morning")</Label>
              <Input
                type="text"
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                placeholder="Enter day name or identifier"
                className={`mt-1 ${
                  theme === 'light'
                    ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-500'
                }`}
              />
            </div>
            <Button onClick={handleAddDay} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20">
              Add Day
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Transaction Modal */}
      <Dialog open={isQuickTransactionOpen} onOpenChange={setIsQuickTransactionOpen}>
        <DialogContent className={`max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl ${
          theme === 'light' 
            ? 'bg-gradient-to-br from-white via-slate-50 to-slate-100 border-slate-300 text-slate-800' 
            : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-600 text-slate-200'
        }`}>
          <DialogHeader>
            <DialogTitle className={`text-2xl pr-8 font-bold ${
              theme === 'light'
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400'
            }`}>
              Quick Transaction
            </DialogTitle>
            {selectedDay && (
              <div className={`text-sm font-normal px-3 py-1.5 rounded-full mt-2 inline-block ${
                theme === 'light'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
              }`}>
                Day: {selectedDay}
              </div>
            )}
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Date Picker and PDF Import */}
            <div className={`rounded-xl p-5 border shadow-lg ${
              theme === 'light'
                ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
                : 'bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border-blue-700/40'
            }`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3 flex-1">
                  <Calendar className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
                  <Label className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    Date
                  </Label>
                  <Input
                    type="date"
                    value={universalDate}
                    onChange={(e) => setUniversalDate(e.target.value)}
                    className={`max-w-xs backdrop-blur-sm ${
                      theme === 'light'
                        ? 'bg-white border-blue-300 text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50'
                        : 'bg-white/10 border-blue-600/50 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:contrast-200 [&::-webkit-calendar-picker-indicator]:saturate-0 [&::-webkit-calendar-picker-indicator]:opacity-100'
                    }`}
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="file"
                    accept=".pdf"
                    id="pdf-upload"
                    className="hidden"
                    onChange={(e) => {
                      // Logic will be implemented later
                      const file = e.target.files?.[0];
                      if (file) {
                        console.log('PDF file selected:', file.name);
                        // TODO: Implement PDF import logic
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => document.getElementById('pdf-upload').click()}
                    className={`${
                      theme === 'light'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                    } shadow-lg`}
                  >
                    Browse PDF
                  </Button>
                </div>
              </div>
            </div>

            {/* Input Form */}
            <div className={`rounded-xl p-5 border shadow-lg backdrop-blur-sm relative ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-300'
                : 'bg-gradient-to-br from-slate-700/50 to-slate-800/50 border-slate-600'
            }`}
            style={{ zIndex: 10 }}
            >
              <div className="grid grid-cols-4 gap-3">
                <div className="relative" ref={suggestionRef} style={{ zIndex: 100 }}>
                  <Input
                    placeholder="Customer ID"
                    value={quickTransaction.customerId}
                    onChange={(e) => handleCustomerIdChange(e.target.value)}
                    onFocus={() => {
                      if (quickTransaction.customerId && customerSuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    className={`backdrop-blur-sm ${
                      theme === 'light'
                        ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50'
                        : 'bg-white/10 border-slate-500 text-white placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50'
                    }`}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddToTransactionList()}
                  />
                  
                  {/* Autocomplete Suggestions Dropdown */}
                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div className={`absolute z-[9999] w-full mt-1 rounded-lg shadow-xl border max-h-60 overflow-y-auto ${
                      theme === 'light'
                        ? 'bg-white border-slate-300'
                        : 'bg-slate-800 border-slate-600'
                    }`}
                    style={{ position: 'absolute', top: '100%', left: 0 }}
                    >
                      {customerSuggestions.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => selectCustomerSuggestion(customer)}
                          className={`px-3 py-2 cursor-pointer transition-colors ${
                            theme === 'light'
                              ? 'hover:bg-blue-50 border-b border-slate-200 last:border-b-0'
                              : 'hover:bg-slate-700 border-b border-slate-700 last:border-b-0'
                          }`}
                        >
                          <div className={`font-semibold text-sm ${
                            theme === 'light' ? 'text-slate-800' : 'text-white'
                          }`}>
                            {customer.id}
                          </div>
                          <div className={`text-xs ${
                            theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                          }`}>
                            {customer.name} - {customer.village || 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  placeholder="Name (auto-filled)"
                  value={customers.find(c => c.id === quickTransaction.customerId)?.name || ''}
                  readOnly
                  className={`backdrop-blur-sm ${
                    theme === 'light'
                      ? 'bg-slate-100 border-slate-300 text-slate-600'
                      : 'bg-white/5 border-slate-600 text-slate-200'
                  }`}
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={quickTransaction.amount}
                  onChange={(e) => setQuickTransaction({ ...quickTransaction, amount: e.target.value })}
                  className={`backdrop-blur-sm ${
                    theme === 'light'
                      ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50'
                      : 'bg-white/10 border-slate-500 text-white placeholder:text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50'
                  }`}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddToTransactionList()}
                />
                <Button 
                  onClick={handleAddToTransactionList} 
                  className={`shadow-lg font-semibold ${
                    theme === 'light'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border border-blue-500/30'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border border-blue-400/50'
                  }`}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            {/* Transaction List */}
            <div>
              <h3 className={`font-semibold mb-3 text-lg ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                Transaction List ({transactionList.length})
              </h3>
              {transactionList.length === 0 ? (
                <div className={`text-center py-8 rounded-lg border border-dashed backdrop-blur-sm ${
                  theme === 'light'
                    ? 'text-slate-500 bg-slate-100 border-slate-300'
                    : 'text-slate-300 bg-slate-700/50 border-slate-500'
                }`}>
                  No transactions added yet
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-transparent">
                  {transactionList.map((trans) => (
                    <div 
                      key={trans.tempId}
                      className={`flex items-center justify-between backdrop-blur-sm p-4 rounded-xl border transition-all ${
                        theme === 'light'
                          ? 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-lg'
                          : 'bg-gradient-to-r from-slate-700/60 to-slate-800/60 border-slate-500 hover:border-blue-400/70 hover:shadow-lg hover:shadow-blue-500/20'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-lg ${
                          theme === 'light'
                            ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white border border-blue-400/50'
                            : 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white border border-blue-400/50'
                        }`}>
                          {trans.customerId.slice(-2)}
                        </div>
                        <div>
                          <p className={`font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            {trans.customerName}
                          </p>
                          <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>
                            ID: {trans.customerId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className={`font-bold text-lg ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                            ₹{trans.amount}
                          </p>
                          <p className={`text-xs font-medium ${theme === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>
                            {trans.date}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTransaction(trans.tempId)}
                          className={`${
                            theme === 'light'
                              ? 'text-red-600 hover:text-red-700 hover:bg-red-100 border border-red-300'
                              : 'text-red-400 hover:text-red-300 hover:bg-red-500/20 border border-red-500/30'
                          }`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className={`flex space-x-3 pt-4 border-t ${theme === 'light' ? 'border-slate-300' : 'border-slate-600'}`}>
              <Button
                onClick={handleSaveTransactions}
                disabled={transactionList.length === 0}
                className={`flex-1 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold ${
                  theme === 'light'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border border-blue-500/30'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border border-blue-400/50'
                }`}
              >
                Save All Transactions
              </Button>
              <Button
                onClick={handleResetTransactions}
                variant="outline"
                className={`flex-1 font-semibold ${
                  theme === 'light'
                    ? 'border-slate-400 hover:bg-slate-100 text-slate-700 hover:border-slate-500'
                    : 'border-slate-500 hover:bg-slate-700 text-white hover:border-slate-400'
                }`}
              >
                Reset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Customer Modal */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${theme === 'light' ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}`}>
          <DialogHeader>
            <DialogTitle className={theme === 'light' ? 'text-blue-600' : 'text-cyan-400'}>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          {error && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            </div>
          )}
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>Customer ID *</Label>
                <Input 
                  value={customerForm.id} 
                  onChange={(e) => setCustomerForm({ ...customerForm, id: e.target.value })} 
                  disabled={!!editingCustomer} 
                  className={`disabled:opacity-50 ${theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-slate-800/50 border-slate-700 text-slate-200'}`}
                  placeholder="Auto-generated (editable)"
                />
              </div>
              <div>
                <Label className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>Name *</Label>
                <Input 
                  value={customerForm.name} 
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} 
                  className={theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-slate-800/50 border-slate-700 text-slate-200'}
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <Label className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>Village</Label>
                <Input 
                  value={customerForm.village} 
                  onChange={(e) => setCustomerForm({ ...customerForm, village: e.target.value })} 
                  className={theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-slate-800/50 border-slate-700 text-slate-200'}
                  placeholder="Enter village name"
                />
              </div>
              <div>
                <Label className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>Phone Number</Label>
                <Input 
                  type="tel"
                  value={customerForm.phone} 
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setCustomerForm({ ...customerForm, phone: value });
                  }} 
                  className={theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-slate-800/50 border-slate-700 text-slate-200'}
                  placeholder="Enter phone number"
                  maxLength="10"
                />
              </div>
              <div>
                <Label className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>Amount *</Label>
                <Input 
                  type="number" 
                  value={customerForm.takenAmount} 
                  onChange={(e) => setCustomerForm({ ...customerForm, takenAmount: e.target.value })} 
                  className={theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-slate-800/50 border-slate-700 text-slate-200'}
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <Label className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>Interest</Label>
                <Input 
                  type="number" 
                  value={customerForm.interest} 
                  onChange={(e) => setCustomerForm({ ...customerForm, interest: e.target.value })} 
                  className={theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-slate-800/50 border-slate-700 text-slate-200'}
                  placeholder="Enter interest rate"
                />
              </div>
              <div>
                <Label className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>PC</Label>
                <Input 
                  type="number" 
                  value={customerForm.pc} 
                  onChange={(e) => setCustomerForm({ ...customerForm, pc: e.target.value })} 
                  className={theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-slate-800/50 border-slate-700 text-slate-200'}
                  placeholder="Enter PC value"
                />
              </div>
              <div>
                <Label className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>Date</Label>
                <Input 
                  type="date" 
                  value={customerForm.date} 
                  onChange={(e) => setCustomerForm({ ...customerForm, date: e.target.value })} 
                  className={theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-slate-800/50 border-slate-700 text-slate-200'}
                />
              </div>
              <div>
                <Label className={theme === 'light' ? 'text-gray-700' : 'text-slate-300'}>No. of Weeks</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max="54" 
                  value={customerForm.weeks} 
                  onChange={(e) => setCustomerForm({ ...customerForm, weeks: e.target.value })} 
                  className={theme === 'light' ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-slate-800/50 border-slate-700 text-slate-200'}
                  placeholder="Default: 12"
                />
              </div>
              <div>
                <Label className={`mb-2 block ${theme === 'light' ? 'text-gray-700' : 'text-slate-300'}`}>Profile Photo</Label>
                <label className={`flex items-center justify-center w-full px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                  theme === 'light' 
                    ? 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-blue-400' 
                    : 'bg-slate-800/50 border-slate-600 hover:bg-slate-700/50 hover:border-cyan-500/50'
                }`}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    onChange={handleProfileUpload} 
                    className="hidden" 
                  />
                  <div className={`flex items-center space-x-2 ${theme === 'light' ? 'text-gray-600' : 'text-slate-300'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm font-medium">Choose Photo</span>
                  </div>
                </label>
              </div>
            </div>
            {customerForm.profileImage && (
              <div className="flex justify-center">
                <img src={customerForm.profileImage} alt="Preview" className={`w-24 h-24 rounded-2xl object-cover border-2 shadow-lg ${
                  theme === 'light' ? 'border-blue-400 shadow-blue-200' : 'border-cyan-500/50 shadow-cyan-500/20'
                }`} />
              </div>
            )}
            <Button onClick={handleSaveCustomer} className={`w-full shadow-lg ${
              theme === 'light'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-blue-500/20'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-cyan-500/20'
            }`}>
              {editingCustomer ? 'Update Customer' : 'Add Customer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Renewal Modal */}
      <Dialog open={isRenewalModalOpen} onOpenChange={setIsRenewalModalOpen}>
        <DialogContent className={`max-w-xl ${
          theme === 'light' 
            ? 'bg-white border-slate-300 text-slate-800' 
            : 'bg-[#1a1f2e] border-slate-700 text-slate-200'
        }`}>
          <DialogHeader>
            <DialogTitle className={`flex items-center space-x-2 ${
              theme === 'light' ? 'text-blue-600' : 'text-blue-400'
            }`}>
              <RefreshCw className="w-5 h-5" />
              <span>Customer Renewal</span>
            </DialogTitle>
          </DialogHeader>
          {renewalCustomer && (
            <div className="space-y-4 mt-4">
              {/* Customer Info */}
              <div className={`rounded-lg p-4 border ${
                theme === 'light'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-slate-800/50 border-slate-700'
              }`}>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                    {renewalCustomer.profileImage ? (
                      <img src={renewalCustomer.profileImage} alt="Profile" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <UserIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className={`font-bold ${
                      theme === 'light' ? 'text-slate-800' : 'text-slate-200'
                    }`}>{renewalCustomer.name}</h4>
                    <p className={`text-xs ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>ID: {renewalCustomer.id}</p>
                  </div>
                </div>
                <div className={`text-sm ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  <p><span className={theme === 'light' ? 'text-slate-500' : 'text-slate-500'}>Village:</span> {renewalCustomer.village}</p>
                  <p><span className={theme === 'light' ? 'text-slate-500' : 'text-slate-500'}>Phone:</span> {renewalCustomer.phone}</p>
                </div>
              </div>

              {/* Renewal Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>Amount *</Label>
                  <Input 
                    type="number" 
                    value={renewalForm.takenAmount} 
                    onChange={(e) => setRenewalForm({ ...renewalForm, takenAmount: e.target.value })} 
                    placeholder="Enter renewal amount"
                    className={theme === 'light' 
                      ? 'bg-white border-slate-300 text-slate-800' 
                      : 'bg-slate-800/50 border-slate-700 text-slate-200'
                    } 
                  />
                </div>
                <div>
                  <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>Interest</Label>
                  <Input 
                    type="number" 
                    value={renewalForm.interest} 
                    onChange={(e) => setRenewalForm({ ...renewalForm, interest: e.target.value })} 
                    className={theme === 'light' 
                      ? 'bg-white border-slate-300 text-slate-800' 
                      : 'bg-slate-800/50 border-slate-700 text-slate-200'
                    } 
                    placeholder="Enter interest rate"
                  />
                </div>
                <div>
                  <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>PC</Label>
                  <Input 
                    type="number" 
                    value={renewalForm.pc} 
                    onChange={(e) => setRenewalForm({ ...renewalForm, pc: e.target.value })} 
                    className={theme === 'light' 
                      ? 'bg-white border-slate-300 text-slate-800' 
                      : 'bg-slate-800/50 border-slate-700 text-slate-200'
                    } 
                    placeholder="Enter PC value"
                  />
                </div>
                <div>
                  <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>Date</Label>
                  <Input 
                    type="date" 
                    value={renewalForm.date} 
                    onChange={(e) => setRenewalForm({ ...renewalForm, date: e.target.value })} 
                    className={theme === 'light' 
                      ? 'bg-white border-slate-300 text-slate-800' 
                      : 'bg-slate-800/50 border-slate-700 text-slate-200'
                    } 
                  />
                </div>
                <div>
                  <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>No. of Weeks</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="54" 
                    value={renewalForm.weeks} 
                    onChange={(e) => setRenewalForm({ ...renewalForm, weeks: e.target.value })} 
                    className={theme === 'light' 
                      ? 'bg-white border-slate-300 text-slate-800' 
                      : 'bg-slate-800/50 border-slate-700 text-slate-200'
                    } 
                    placeholder="Default: 12"
                  />
                </div>
              </div>

              {/* Info Alert */}
              <div className={`rounded-lg p-3 flex items-start space-x-2 border ${
                theme === 'light'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}>
                <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                }`} />
                <p className={`text-xs ${
                  theme === 'light' ? 'text-blue-700' : 'text-blue-300'
                }`}>
                  The renewal amount will be deducted from your BF (Balance Forward) and will be displayed on the customer card.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-2">
                <Button 
                  onClick={handleSaveRenewal} 
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/20"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Save Renewal
                </Button>
                <Button 
                  onClick={() => {
                    setIsRenewalModalOpen(false);
                    setRenewalCustomer(null);
                  }} 
                  variant="outline" 
                  className={theme === 'light'
                    ? 'flex-1 border-slate-300 text-slate-700 hover:bg-slate-100'
                    : 'flex-1 border-slate-600 text-slate-300 hover:bg-slate-800'
                  }
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Day Confirmation Modal */}
      <Dialog open={isDeleteDayModalOpen} onOpenChange={setIsDeleteDayModalOpen}>
        <DialogContent className={theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}>
          <DialogHeader>
            <DialogTitle className={theme === 'light' ? 'text-red-600' : 'text-red-400'}>Confirm Delete Day</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
              Are you sure you want to delete <strong className={theme === 'light' ? 'text-red-600' : 'text-red-400'}>"{dayToDelete}"</strong>? This will also delete all customers and transactions for this day.
            </p>
            <div>
              <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>Type "delete" to confirm</Label>
              <Input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type delete"
                className={`mt-1 ${
                  theme === 'light'
                    ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-500'
                }`}
              />
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={confirmDeleteDay} 
                className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/20"
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
              >
                Delete
              </Button>
              <Button 
                onClick={() => {
                  setIsDeleteDayModalOpen(false);
                  setDayToDelete(null);
                  setDeleteConfirmText('');
                }}
                variant="outline"
                className={theme === 'light' 
                  ? 'flex-1 border-slate-300 hover:bg-slate-100 text-slate-700' 
                  : 'flex-1 border-slate-700 hover:bg-slate-800 text-slate-300'
                }
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Confirmation Modal */}
      <Dialog open={isDeleteCustomerModalOpen} onOpenChange={setIsDeleteCustomerModalOpen}>
        <DialogContent className={theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}>
          <DialogHeader>
            <DialogTitle className={theme === 'light' ? 'text-red-600' : 'text-red-400'}>Confirm Delete Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
              Are you sure you want to move customer <strong className={theme === 'light' ? 'text-red-600' : 'text-red-400'}>"{customerToDelete?.name}"</strong> (ID: {customerToDelete?.id}) to the deleted section?
            </p>
            <div className={`p-3 rounded-lg border ${
              theme === 'light' 
                ? 'bg-blue-50 border-blue-200' 
                : 'bg-blue-500/10 border-blue-500/30'
            }`}>
              <p className={`text-xs ${theme === 'light' ? 'text-blue-700' : 'text-blue-300'}`}>
                📝 Note: Transaction history will be preserved for record keeping.
              </p>
            </div>
            <div>
              <Label className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>Type "delete" to confirm</Label>
              <Input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type delete"
                className={`mt-1 ${
                  theme === 'light'
                    ? 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-800/50 border-slate-700 text-slate-200 placeholder:text-slate-500'
                }`}
              />
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={confirmDeleteCustomer} 
                className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/20"
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
              >
                Delete
              </Button>
              <Button 
                onClick={() => {
                  setIsDeleteCustomerModalOpen(false);
                  setCustomerToDelete(null);
                  setDeleteConfirmText('');
                }}
                variant="outline"
                className={theme === 'light'
                  ? 'flex-1 border-slate-300 hover:bg-slate-100 text-slate-700'
                  : 'flex-1 border-slate-700 hover:bg-slate-800 text-slate-300'
                }
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Alert for Pending Amount */}
      <AlertDialog open={isErrorAlertOpen} onOpenChange={setIsErrorAlertOpen}>
        <AlertDialogContent className={theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#1a1f2e] border-slate-700 text-slate-200'}>
          <AlertDialogHeader>
            <AlertDialogTitle className={theme === 'light' ? 'text-red-600' : 'text-red-400'}>Cannot Delete Customer</AlertDialogTitle>
            <AlertDialogDescription className={`text-base ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
              {deleteCustomerError}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsErrorAlertOpen(false)} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Customer Modal */}
      <Dialog open={isRestoreModalOpen} onOpenChange={setIsRestoreModalOpen}>
        <DialogContent className={`max-w-md ${
          theme === 'light'
            ? 'bg-white border-slate-300 text-slate-800'
            : 'bg-[#1a1f2e] border-slate-700 text-slate-200'
        }`}>
          <DialogHeader>
            <DialogTitle className={`text-xl font-bold ${
              theme === 'light'
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400'
            }`}>
              Restore Customer to Active
            </DialogTitle>
          </DialogHeader>
          
          {error && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            </div>
          )}
          
          {customerToRestore && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className={`p-3 rounded-lg border ${
                theme === 'light'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-slate-800/50 border-slate-700'
              }`}>
                <p className={`text-sm mb-1 ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                }`}>Restoring Customer:</p>
                <p className={`font-bold ${
                  theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'
                }`}>{customerToRestore.name}</p>
                <p className={`text-xs ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                }`}>Old ID: {customerToRestore.id} (Will be changed)</p>
              </div>
              
              {/* New ID */}
              <div>
                <Label htmlFor="newId" className={
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }>New Customer ID *</Label>
                <Input
                  id="newId"
                  value={restoreForm.newId}
                  onChange={(e) => setRestoreForm({ ...restoreForm, newId: e.target.value })}
                  className={`mt-1 ${
                    theme === 'light'
                      ? 'bg-white border-slate-300 text-slate-800'
                      : 'bg-slate-800/50 border-slate-700 text-slate-200'
                  }`}
                  placeholder="Enter new ID"
                />
              </div>

              {/* Renewal Details */}
              <div className={`pt-3 border-t ${
                theme === 'light' ? 'border-slate-200' : 'border-slate-700'
              }`}>
                <p className={`text-sm font-semibold mb-3 ${
                  theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                }`}>New Loan Details</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="takenAmount" className={`text-xs ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                    }`}>Taken Amount *</Label>
                    <Input
                      id="takenAmount"
                      type="number"
                      value={restoreForm.takenAmount}
                      onChange={(e) => setRestoreForm({ ...restoreForm, takenAmount: e.target.value })}
                      className={`mt-1 ${
                        theme === 'light'
                          ? 'bg-white border-slate-300 text-slate-800'
                          : 'bg-slate-800/50 border-slate-700 text-slate-200'
                      }`}
                      placeholder="Amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="interest" className={`text-xs ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                    }`}>Interest</Label>
                    <Input
                      id="interest"
                      value={restoreForm.interest}
                      onChange={(e) => setRestoreForm({ ...restoreForm, interest: e.target.value })}
                      className={`mt-1 ${
                        theme === 'light'
                          ? 'bg-white border-slate-300 text-slate-800'
                          : 'bg-slate-800/50 border-slate-700 text-slate-200'
                      }`}
                      placeholder="Interest"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label htmlFor="pc" className={`text-xs ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                    }`}>PC</Label>
                    <Input
                      id="pc"
                      value={restoreForm.pc}
                      onChange={(e) => setRestoreForm({ ...restoreForm, pc: e.target.value })}
                      className={`mt-1 ${
                        theme === 'light'
                          ? 'bg-white border-slate-300 text-slate-800'
                          : 'bg-slate-800/50 border-slate-700 text-slate-200'
                      }`}
                      placeholder="PC"
                    />
                  </div>
                  <div>
                    <Label htmlFor="weeks" className={`text-xs ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                    }`}>Weeks</Label>
                    <Input
                      id="weeks"
                      type="number"
                      value={restoreForm.weeks}
                      onChange={(e) => setRestoreForm({ ...restoreForm, weeks: e.target.value })}
                      className={`mt-1 ${
                        theme === 'light'
                          ? 'bg-white border-slate-300 text-slate-800'
                          : 'bg-slate-800/50 border-slate-700 text-slate-200'
                      }`}
                      placeholder="Weeks"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Label htmlFor="date" className={`text-xs ${
                    theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                  }`}>Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={restoreForm.date}
                    onChange={(e) => setRestoreForm({ ...restoreForm, date: e.target.value })}
                    className={`mt-1 ${
                      theme === 'light'
                        ? 'bg-white border-slate-300 text-slate-800'
                        : 'bg-slate-800/50 border-slate-700 text-slate-200'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={() => setIsRestoreModalOpen(false)}
              variant="outline"
              className={theme === 'light'
                ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestoreCustomer}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/20"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restore Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <AlertDialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <AlertDialogContent className={`shadow-2xl max-w-md ${
          theme === 'light'
            ? 'bg-gradient-to-br from-white to-blue-50 border-blue-300 text-slate-800 shadow-blue-300/30'
            : 'bg-gradient-to-br from-[#1a1f2e] to-[#0f1419] border-blue-500/50 text-slate-200 shadow-blue-500/20'
        }`}>
          <AlertDialogHeader>
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center animate-pulse">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <AlertDialogTitle className={`text-2xl font-bold text-transparent bg-clip-text text-center ${
                theme === 'light'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600'
                  : 'bg-gradient-to-r from-blue-400 to-cyan-400'
              }`}>
                Success!
              </AlertDialogTitle>
              <AlertDialogDescription className={`text-base text-center leading-relaxed ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-300'
              }`}>
                {successMessage}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-center">
            <AlertDialogAction 
              onClick={() => setIsSuccessModalOpen(false)} 
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8 py-2 rounded-lg shadow-lg shadow-blue-500/30 transition-all"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Modal */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className={`max-w-3xl ${
          theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-slate-200'
        }`}>
          <DialogHeader>
            <DialogTitle className={`text-xl font-bold ${
              theme === 'light' ? 'text-blue-700' : 'text-blue-400'
            }`}>
              Print Options
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Print Type Selection - Side by Side */}
            <div>
              <Label className={`text-sm font-semibold mb-3 block ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-300'
              }`}>
                Select Print Type
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer border-2 transition-all ${
                  printType === 'transactions'
                    ? theme === 'light'
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-blue-500/20 border-blue-500'
                    : theme === 'light'
                      ? 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
                }`}>
                  <input
                    type="radio"
                    name="printType"
                    value="transactions"
                    checked={printType === 'transactions'}
                    onChange={(e) => setPrintType(e.target.value)}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className={`font-semibold text-sm ${
                      theme === 'light' ? 'text-slate-800' : 'text-slate-200'
                    }`}>
                      Customer Transactions
                    </div>
                    <div className={`text-xs mt-1 ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      Print transactions for a specific customer
                    </div>
                  </div>
                </label>
                
                <label className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer border-2 transition-all ${
                  printType === 'summary'
                    ? theme === 'light'
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-blue-500/20 border-blue-500'
                    : theme === 'light'
                      ? 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
                }`}>
                  <input
                    type="radio"
                    name="printType"
                    value="summary"
                    checked={printType === 'summary'}
                    onChange={(e) => setPrintType(e.target.value)}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className={`font-semibold text-sm ${
                      theme === 'light' ? 'text-slate-800' : 'text-slate-200'
                    }`}>
                      Customer Summary
                    </div>
                    <div className={`text-xs mt-1 ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      Print summary of all customers
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Customer ID and Name - Side by Side (only for transactions) */}
            {printType === 'transactions' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="printCustomerId" className={`text-sm font-semibold ${
                    theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                  }`}>
                    Customer ID
                  </Label>
                  <Input
                    id="printCustomerId"
                    value={printCustomerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPrintCustomerId(id);
                      
                      // Auto-fill customer name
                      if (id.trim()) {
                        const foundCustomer = customers.find(c => c.id === id.trim());
                        if (foundCustomer) {
                          setPrintCustomerName(foundCustomer.name);
                        } else {
                          setPrintCustomerName('Customer not found');
                        }
                      } else {
                        setPrintCustomerName('');
                      }
                    }}
                    placeholder="Enter Customer ID"
                    className={`mt-2 ${
                      theme === 'light'
                        ? 'bg-white border-gray-300'
                        : 'bg-slate-700 border-slate-600'
                    }`}
                  />
                </div>
                
                <div>
                  <Label htmlFor="printCustomerName" className={`text-sm font-semibold ${
                    theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                  }`}>
                    Customer Name
                  </Label>
                  <Input
                    id="printCustomerName"
                    value={printCustomerName}
                    disabled
                    placeholder="Auto-filled"
                    className={`mt-2 ${
                      theme === 'light'
                        ? 'bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Day Selection (only for summary) - Popover Dropdown */}
            {printType === 'summary' && (
              <div>
                <Label className={`text-sm font-semibold mb-2 block ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Select Days to Include
                </Label>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-between ${
                        theme === 'light'
                          ? 'bg-white border-gray-300 hover:bg-gray-50'
                          : 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      <span>
                        {selectAllDays || selectedDaysForPrint.length === days.length
                          ? `Select all (${days.length})` 
                          : selectedDaysForPrint.length === 1
                            ? selectedDaysForPrint[0]
                            : `${selectedDaysForPrint.length} Days Selected`}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className={`w-72 p-2 max-h-80 overflow-y-auto ${
                    theme === 'light' ? 'bg-white' : 'bg-slate-800'
                  }`} align="start">
                    <div className="space-y-1">
                      {/* Select All Option */}
                      <label
                        className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors border-b ${
                          theme === 'light'
                            ? 'hover:bg-blue-50 border-slate-200'
                            : 'hover:bg-slate-700 border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectAllDays || selectedDaysForPrint.length === days.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Select all days
                              setSelectAllDays(true);
                              setSelectedDaysForPrint(days);
                            } else {
                              // Deselect all days
                              setSelectAllDays(false);
                              setSelectedDaysForPrint([]);
                            }
                          }}
                          className="w-4 h-4 rounded border-2 border-blue-500"
                        />
                        <span className={`text-sm font-bold ${
                          theme === 'light' ? 'text-blue-700' : 'text-blue-400'
                        }`}>
                          Select All ({days.length})
                        </span>
                      </label>
                      
                      {/* Individual Days - Always Clickable */}
                      {days.map((day) => (
                        <label
                          key={day}
                          className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                            theme === 'light'
                              ? 'hover:bg-blue-50'
                              : 'hover:bg-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectAllDays || selectedDaysForPrint.includes(day)}
                            onChange={(e) => {
                              let newSelected;
                              if (e.target.checked) {
                                // Add this day
                                newSelected = [...selectedDaysForPrint, day];
                                // If all days are now selected, set selectAllDays to true
                                if (newSelected.length === days.length) {
                                  setSelectAllDays(true);
                                  setSelectedDaysForPrint(days);
                                } else {
                                  setSelectAllDays(false);
                                  setSelectedDaysForPrint(newSelected);
                                }
                              } else {
                                // Remove this day
                                setSelectAllDays(false);
                                newSelected = selectedDaysForPrint.filter(d => d !== day);
                                setSelectedDaysForPrint(newSelected);
                              }
                            }}
                            className="w-4 h-4 rounded border-2 border-blue-500"
                          />
                          <span className={`text-sm font-medium ${
                            theme === 'light' ? 'text-slate-700' : 'text-slate-200'
                          }`}>
                            {day}
                          </span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <div className={`mt-2 text-xs ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  {selectAllDays || selectedDaysForPrint.length === days.length ? (
                    <span className="flex items-center gap-1">
                      <span className="text-green-600">✓</span> All {days.length} days will be included
                    </span>
                  ) : selectedDaysForPrint.length === 0 ? (
                    <span className="text-orange-600">⚠ No days selected</span>
                  ) : (
                    <span>
                      {selectedDaysForPrint.length} day{selectedDaysForPrint.length !== 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsPrintModalOpen(false)}
              className={theme === 'light' ? 'border-gray-300' : 'border-slate-600'}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePrint}
              className={`${
                theme === 'light'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'
              } text-white shadow-lg`}
            >
              <Printer className="w-4 h-4 mr-2" />
              Generate PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EntryDetails;