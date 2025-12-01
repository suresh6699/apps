import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { ArrowLeft, User, Send, FileText, IndianRupee, RefreshCw, Edit3, Trash2, X } from 'lucide-react';
import { useTheme } from '../App';
import { useAuth } from '../contexts/AuthContext';
import customerService from '../services/customerService';
import transactionService from '../services/transactionService';
import LoadingScreen from './LoadingScreen';
import { motion, AnimatePresence } from 'framer-motion';

const CustomerChat = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('id');
  const day = searchParams.get('day');
  const lineId = searchParams.get('lineId');
  const isDeletedParam = searchParams.get('deleted') === 'true';
  const deletionTimestamp = searchParams.get('timestamp');
  const returnView = searchParams.get('returnView'); // Get the return view parameter
  const { theme } = useTheme();
  const { user } = useAuth();
  const chatContainerRef = useRef(null);

  const [customer, setCustomer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [pendingComment, setPendingComment] = useState('');
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editComment, setEditComment] = useState('');

  // Auto-scroll to bottom when messages change - with smooth animation
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      // Start at top to show first transaction
      chatContainerRef.current.scrollTop = 0;
      
      // Then smoothly scroll to bottom after a brief delay
      const scrollTimer = setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 300); // 300ms delay to see first transaction
      
      return () => clearTimeout(scrollTimer);
    }
  }, [messages]);

  useEffect(() => {
    console.log('CustomerChat URL params:', { customerId, lineId, day, isDeletedParam, deletionTimestamp });
    if (customerId && lineId) {
      // For deleted customers, we don't need 'day' to load basic info
      // For active customers, we need 'day'
      if (isDeletedParam || day) {
        loadCustomerData();
      } else {
        console.error('Missing required parameter: day is required for active customers');
        setCustomer({ error: 'Missing required parameter: day' });
        setLoading(false);
      }
    } else {
      console.error('Missing required parameters:', { customerId, lineId });
      if (!customerId || !lineId) {
        setCustomer({ error: `Missing required parameters: ${!customerId ? 'customerId' : ''} ${!lineId ? 'lineId' : ''}`.trim() });
        setLoading(false);
      }
    }
  }, [customerId, day, lineId, isDeletedParam, deletionTimestamp]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      
      // Load customer details - check if it's a deleted customer
      let customerData;
      if (isDeletedParam && deletionTimestamp) {
        customerData = await customerService.getDeletedCustomerById(customerId, lineId, deletionTimestamp);
      } else {
        customerData = await customerService.getCustomerById(customerId, lineId, day);
      }
      // Backend now provides totalOwed, totalPaid, remainingAmount
      setCustomer(customerData.customer);

      // Fetch transactions, chat, and renewals
      let timeline = [];
      let renewalsData = [];
      
      if (isDeletedParam && deletionTimestamp) {
        // For deleted customers, fetch complete timeline from backend
        try {
          const chatData = await customerService.getDeletedCustomerChat(customerId, lineId, customerData.customer.deletedFrom || day, deletionTimestamp);
          // Backend now returns complete timeline including loans, renewals, and payments
          timeline = chatData.chat || [];
          // Backend now returns renewals separately
          renewalsData = chatData.renewals || [];
        } catch (err) {
          console.log('No archived data found for deleted customer:', err.message);
          timeline = [];
          renewalsData = [];
        }
      } else {
        // Load comprehensive timeline for active customers from backend
        const chatData = await customerService.getChat(customerId, lineId, day);
        // Backend now returns complete timeline including loans, renewals, and payments
        timeline = chatData.chat || [];
        // Backend now returns renewals separately
        renewalsData = chatData.renewals || [];
      }

      setMessages(timeline);
      setRenewals(renewalsData);
    } catch (err) {
      console.error('Error loading customer data:', err);
      console.error('Error details:', {
        customerId,
        lineId,
        day,
        isDeleted: isDeletedParam,
        timestamp: deletionTimestamp,
        message: err.message,
        response: err.response?.data
      });
      // Set customer to null to show "not found" message with actual error
      setCustomer({ error: err.response?.data?.error || err.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAmount = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const transData = {
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        type: 'received'
      };

      await transactionService.createTransaction(customerId, lineId, day, transData);
      await loadCustomerData();
      setAmount('');
    } catch (err) {
      alert(err.message || 'Failed to add transaction');
    }
  };

  const handleAddComment = () => {
    if (!comment.trim()) {
      alert('Please enter a comment');
      return;
    }

    // Set pending comment and close modal - don't send yet
    setPendingComment(comment);
    setComment('');
    setIsCommentModalOpen(false);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSendMessage = async () => {
    // If no amount but has pending comment, send only comment
    if ((!amount || parseFloat(amount) <= 0) && pendingComment.trim()) {
      try {
        await customerService.addChatMessage(customerId, lineId, day, pendingComment);
        await loadCustomerData();
        setPendingComment('');
      } catch (err) {
        console.error('Error adding comment:', err);
        alert(err.message || 'Failed to add comment');
      }
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter an amount');
      return;
    }

    try {
      const amountValue = parseFloat(amount);
      const currentDate = new Date().toISOString().split('T')[0];
      const tempComment = pendingComment.trim();
      
      // Create optimistic transaction with unique temporary ID
      const optimisticTransaction = {
        id: `temp-${Date.now()}`,
        type: 'payment',
        amount: amountValue,
        date: currentDate,
        comment: tempComment || '',
        timestamp: new Date().toISOString(),
        isOptimistic: true // Flag to identify optimistic updates
      };

      // Update UI immediately (optimistic update)
      setMessages(prevMessages => [...prevMessages, optimisticTransaction]);
      
      // Update remaining amount optimistically
      setCustomer(prevCustomer => ({
        ...prevCustomer,
        remainingAmount: (prevCustomer.remainingAmount || 0) - amountValue
      }));
      
      // Clear input fields immediately
      setAmount('');
      setPendingComment('');
      
      // Scroll to bottom to show new transaction
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);

      const transData = {
        amount: amountValue,
        date: currentDate,
        type: 'received',
        comment: tempComment || ''
      };

      // Send transaction in background
      await transactionService.createTransaction(customerId, lineId, day, transData);
      
      // Refresh data silently without loading screen
      const customerData = await customerService.getCustomerById(customerId, lineId, day);
      setCustomer(customerData.customer);
      
      const chatData = await customerService.getChat(customerId, lineId, day);
      setMessages(chatData.chat || []);
      setRenewals(chatData.renewals || []);
      
    } catch (err) {
      console.error('Error in transaction:', err);
      alert(err.message || 'Failed to add transaction');
      // Rollback on error - reload data
      await loadCustomerData();
    }
  };

  // Edit transaction handler
  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setEditAmount(transaction.amount.toString());
    setEditComment(transaction.comment || '');
    setIsEditModalOpen(true);
  };

  // Save edited transaction
  const handleSaveEdit = async () => {
    if (!editAmount || parseFloat(editAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await transactionService.updateTransaction(
        editingTransaction.id,
        customerId,
        lineId,
        day,
        {
          amount: parseFloat(editAmount),
          comment: editComment.trim()
        }
      );
      await loadCustomerData();
      setIsEditModalOpen(false);
      setEditingTransaction(null);
      setEditAmount('');
      setEditComment('');
    } catch (err) {
      console.error('Error updating transaction:', err);
      alert(err.message || 'Failed to update transaction');
    }
  };

  // Delete transaction handler
  const handleDeleteTransaction = async (transaction) => {
    if (!window.confirm(`Delete payment of ₹${transaction.amount}?`)) {
      return;
    }

    try {
      await transactionService.deleteTransaction(
        transaction.id,
        customerId,
        lineId,
        day
      );
      await loadCustomerData();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      alert(err.message || 'Failed to delete transaction');
    }
  };

  // Helper function to handle back navigation with proper view state
  const handleGoBack = () => {
    if (returnView && lineId) {
      // Navigate back to entry page with the proper view
      navigate(`/entry?id=${lineId}&view=${returnView}`);
    } else if (day && lineId) {
      // Navigate back to entry page with the day
      navigate(`/entry?id=${lineId}&day=${day}`);
    } else {
      // Fallback to browser back
      navigate(-1);
    }
  };

  // Use remainingAmount from backend-calculated customer data
  const remainingAmount = customer?.remainingAmount || 0;

  if (loading) {
    return <LoadingScreen />;
  }

  if (!customer || customer.error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4 p-6">
          <p className="text-xl font-semibold">Customer not found</p>
          {customer?.error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="text-sm">Error: {customer.error}</p>
              <p className="text-xs mt-2">
                Customer ID: {customerId}<br />
                Line ID: {lineId}<br />
                Day: {day}
              </p>
            </div>
          )}
          <Button onClick={handleGoBack} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${
      theme === 'light' 
        ? 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50' 
        : 'bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700'
    }`}>
      {/* Floating emojis */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`absolute text-2xl animate-pulse ${
              theme === 'light' ? 'opacity-10' : 'opacity-5'
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          >
            <IndianRupee className={`w-6 h-6 ${
              theme === 'light' ? 'text-blue-400' : 'text-white'
            }`} />
          </div>
        ))}
      </div>

      {/* Fixed Header */}
      <div className={`flex-shrink-0 backdrop-blur-lg border-b p-2 md:p-3 relative z-10 ${
        theme === 'light'
          ? 'bg-white/60 border-slate-200'
          : 'bg-white/10 border-white/20'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 md:space-x-3 w-full md:w-auto">
            <Button 
              onClick={handleGoBack} 
              variant="ghost" 
              size="icon"
              className={`h-8 w-8 rounded-full shadow-md transition-all hover:shadow-lg border-2 ${
                theme === 'light'
                  ? 'bg-white hover:bg-slate-50 border-slate-300 hover:border-slate-400 text-slate-700'
                  : 'bg-white/20 hover:bg-white/30 border-white/30 hover:border-white/50 text-white'
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div
              onClick={() => setIsProfileModalOpen(true)}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 ${
                theme === 'light'
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {customer.profileImage ? (
                <img src={customer.profileImage} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className={`text-base md:text-lg font-bold truncate ${
                  theme === 'light' ? 'text-slate-800' : 'text-white'
                }`}>{customer.name}</h2>
                {isDeletedParam && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    theme === 'light' 
                      ? 'bg-red-100 text-red-700 border border-red-300'
                      : 'bg-red-500/30 text-red-300 border border-red-500/50'
                  }`}>
                    DELETED
                  </span>
                )}
              </div>
              <p className={`text-[10px] md:text-xs ${
                theme === 'light' ? 'text-slate-600' : 'text-white/70'
              }`}>ID: {customer.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            {isDeletedParam ? (
              // Show SETTLED badge for deleted customers (they were deleted because they paid everything)
              <div className={`backdrop-blur-sm px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs font-bold w-full md:w-auto text-center ${
                theme === 'light'
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-700'
                  : 'bg-emerald-500/30 border border-emerald-400/50 text-emerald-100'
              }`}>
                ✓ SETTLED
              </div>
            ) : (
              <>
                {/* Edit Toggle Button */}
                <Button
                  onClick={() => setIsEditMode(!isEditMode)}
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full shadow-md transition-all hover:shadow-lg border-2 ${
                    isEditMode
                      ? theme === 'light'
                        ? 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600'
                        : 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700'
                      : theme === 'light'
                        ? 'bg-white hover:bg-slate-50 border-slate-300 hover:border-slate-400 text-slate-700'
                        : 'bg-white/20 hover:bg-white/30 border-white/30 hover:border-white/50 text-white'
                  }`}
                  title={isEditMode ? 'Exit Edit Mode' : 'Edit Payments'}
                >
                  {isEditMode ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                </Button>
                
                {/* Show remaining amount for active customers */}
                <div className={`backdrop-blur-sm px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs font-semibold w-full md:w-auto text-center ${
                  remainingAmount > 0 
                    ? theme === 'light'
                      ? 'bg-orange-100 border border-orange-300 text-orange-700'
                      : 'bg-orange-500/30 border border-orange-400/50 text-orange-100'
                    : remainingAmount < 0 
                      ? theme === 'light'
                        ? 'bg-emerald-100 border border-emerald-300 text-emerald-700'
                        : 'bg-emerald-500/30 border border-emerald-400/50 text-emerald-100'
                      : theme === 'light'
                        ? 'bg-slate-100 border border-slate-300 text-slate-700'
                        : 'bg-white/20 text-white'
                }`}>
                  <span className="font-medium">Remaining:</span> {remainingAmount < 0 ? '-' : ''}₹{Math.abs(remainingAmount).toFixed(2)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Chat Box */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-2.5 relative z-10" 
      >
        {/* Render complete timeline from backend (chronological order, auto-scrolls to bottom) */}
        <AnimatePresence mode="popLayout">
        {messages.map((item, index) => {
          const isArchivedAndSettled = item.isArchived && item.isSettled;
          
          // Check if there's a renewal after this item (for both loans and payments)
          let isBeforeRenewal = false;
          if (item.type === 'payment' || item.type === 'loan') {
            // Find if there's a renewal after this item
            const nextRenewalIndex = messages.findIndex((msg, idx) => 
              idx > index && msg.type === 'renewal'
            );
            if (nextRenewalIndex !== -1) {
              // This item is before a renewal
              isBeforeRenewal = true;
            }
          }
          
          if (item.type === 'loan' || item.type === 'renewal') {
            // Render loan/renewal (left side - taken amount)
            // Show "Old Loan (Settled)" for original loans that have a renewal after them
            const showOldLoanSettled = (item.type === 'loan' && isBeforeRenewal) || (isArchivedAndSettled && item.type === 'loan');
            // Show "RENEWAL (Settled)" for archived renewals that were settled
            const showRenewalSettled = item.type === 'renewal' && isArchivedAndSettled;
            // Check if this is a restored customer's new loan (including archived/settled restored loans)
            const isRestoredLoan = item.type === 'loan' && item.isRestored;
            // Check if this is the VERY FIRST loan ever (only show NEW for the original first loan)
            // Use isFirstLoan flag from backend which marks the very first loan in the chain
            const isOriginalFirstLoan = item.type === 'loan' && item.isFirstLoan === true;
            // For current active loan that's not restored and not the first archived loan
            const isNewCustomerLoan = item.type === 'loan' && !item.isArchived && !item.isRestored && !showOldLoanSettled;
            
            return (
              <motion.div 
                key={`${item.type}-${index}-${item.timestamp}`} 
                className="flex justify-start"
                initial={{ opacity: 0, x: -50, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, scale: 0.8 }}
                transition={{ 
                  duration: 0.4, 
                  ease: "easeOut",
                  type: "spring",
                  stiffness: 200,
                  damping: 20
                }}
                layout
              >
                <div className="flex flex-col items-start">
                  <div className={`backdrop-blur-md rounded-xl rounded-tl-sm p-2.5 md:p-3 max-w-[280px] md:max-w-xs shadow-lg ${
                    showOldLoanSettled || showRenewalSettled
                      ? theme === 'light'
                        ? 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 border-2 border-slate-600'
                        : 'bg-gradient-to-br from-gray-600 to-gray-700 border border-gray-500'
                      : isRestoredLoan
                        ? 'bg-gradient-to-br from-orange-400 to-amber-500 border-2 border-orange-300/50'
                        : item.type === 'renewal'
                          ? 'bg-gradient-to-br from-orange-400 to-amber-500 border-2 border-orange-300/50'
                          : theme === 'light'
                            ? 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 border-2 border-blue-300'
                            : 'bg-white/20'
                  }`}>
                    {/* Show RENEWAL flag for all renewals including settled ones */}
                    {item.type === 'renewal' && (
                      <div className="flex items-center space-x-1.5 mb-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-white" />
                        <p className="text-white font-bold text-[10px] uppercase tracking-wide">Renewal</p>
                      </div>
                    )}
                    {/* Show RESTORED flag for all restored loans including settled ones */}
                    {isRestoredLoan && (
                      <div className="flex items-center space-x-1.5 mb-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-white" />
                        <p className="text-white font-bold text-[10px] uppercase tracking-wide">Restored</p>
                      </div>
                    )}
                    {/* Show NEW flag ONLY for the very first original loan OR current active new customer loan */}
                    {(isOriginalFirstLoan || isNewCustomerLoan) && (
                      <div className="flex items-center space-x-1.5 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <p className="text-white font-bold text-[10px] uppercase tracking-wide">New</p>
                      </div>
                    )}
                    <p className={`font-bold ${item.type === 'renewal' || isRestoredLoan || isOriginalFirstLoan || isNewCustomerLoan ? 'text-white text-lg' : 'text-base'} ${
                      showOldLoanSettled || showRenewalSettled
                        ? 'text-white'
                        : item.type === 'renewal' || isRestoredLoan || isOriginalFirstLoan || isNewCustomerLoan
                          ? 'text-white'
                          : theme === 'light' ? 'text-white' : 'text-white'
                    }`}>₹{parseFloat(item.amount).toFixed(0)}</p>
                    <p className={`text-[10px] mt-0.5 ${
                      showOldLoanSettled || showRenewalSettled
                        ? 'text-white/90'
                        : item.type === 'renewal' || isRestoredLoan || isOriginalFirstLoan || isNewCustomerLoan
                          ? 'text-white/70'
                          : theme === 'light' ? 'text-white/90' : 'text-white/70'
                    }`}>{item.date}</p>
                  </div>
                  {/* Show "Old Loan (Settled)" for original loans that were renewed */}
                  {showOldLoanSettled && (
                    <span className={`text-[9px] mt-0.5 px-1.5 py-0.5 rounded font-semibold ${
                      theme === 'light' 
                        ? 'bg-slate-600 text-white border border-slate-700' 
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      Old Loan (Settled)
                    </span>
                  )}
                  {/* Show "RENEWAL (Settled)" for archived renewals that were settled */}
                  {showRenewalSettled && (
                    <span className={`text-[9px] mt-0.5 px-1.5 py-0.5 rounded font-semibold ${
                      theme === 'light' 
                        ? 'bg-slate-600 text-white border border-slate-700' 
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      Old Loan (Settled)
                    </span>
                  )}
                </div>
              </motion.div>
            );
          } else if (item.type === 'payment') {
            // Render payment (right side - received amount)
            const showOldLoanSettledForPayment = isBeforeRenewal && !isArchivedAndSettled;
            const isEditable = !isArchivedAndSettled && !showOldLoanSettledForPayment;
            
            return (
              <motion.div 
                key={`payment-${index}-${item.timestamp}`} 
                className="flex justify-end"
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.8 }}
                transition={{ 
                  duration: 0.4, 
                  ease: "easeOut",
                  type: "spring",
                  stiffness: 200,
                  damping: 20
                }}
                layout
              >
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    {/* Edit/Delete buttons - show only in edit mode for active payments */}
                    {isEditMode && isEditable && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditTransaction(item)}
                          className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
                            theme === 'light'
                              ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                              : 'bg-blue-900/40 hover:bg-blue-800/60 text-blue-300'
                          }`}
                          title="Edit payment"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(item)}
                          className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
                            theme === 'light'
                              ? 'bg-red-100 hover:bg-red-200 text-red-700'
                              : 'bg-red-900/40 hover:bg-red-800/60 text-red-300'
                          }`}
                          title="Delete payment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    
                    <div className={`rounded-xl rounded-tr-sm p-2.5 md:p-3 max-w-[280px] md:max-w-xs shadow-lg ${
                      item.isOptimistic 
                        ? 'bg-gradient-to-br from-emerald-400 via-green-400 to-green-500 border-2 border-emerald-300 animate-pulse'
                        : isArchivedAndSettled || showOldLoanSettledForPayment
                          ? theme === 'light'
                            ? 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 border-2 border-slate-600'
                            : 'bg-gradient-to-br from-gray-600 to-gray-700'
                          : theme === 'light'
                            ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-green-600 border-2 border-emerald-400'
                            : 'bg-gradient-to-br from-emerald-400 to-cyan-500'
                    }`}>
                      <p className="text-white font-bold text-base">₹{parseFloat(item.amount).toFixed(0)}</p>
                      {item.comment && <p className="text-white/90 text-xs mt-1">{item.comment}</p>}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={`text-[10px] ${
                          (isArchivedAndSettled || showOldLoanSettledForPayment) ? 'text-white/90' : 'text-white/70'
                        }`}>{item.date}</p>
                        {item.isEdited && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                            theme === 'light' 
                              ? 'bg-white/30 text-white border border-white/40' 
                              : 'bg-white/20 text-white border border-white/30'
                          }`}>
                            Edited
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {(isArchivedAndSettled || showOldLoanSettledForPayment) && (
                    <span className={`text-[9px] mt-0.5 px-1.5 py-0.5 rounded font-semibold ${
                      theme === 'light' 
                        ? 'bg-slate-600 text-white border border-slate-700' 
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      Old Loan (Settled)
                    </span>
                  )}
                </div>
              </motion.div>
            );
          }
          return null;
        })}
        </AnimatePresence>
      </div>

      {/* Fixed Input Bar - Enhanced */}
      {!isDeletedParam ? (
        <div className={`flex-shrink-0 backdrop-blur-lg border-t relative z-10 ${
          theme === 'light'
            ? 'bg-white/60 border-slate-200'
            : 'bg-white/10 border-white/20'
        }`}>
          {/* Amount Input Bar */}
          <div className="p-2.5 md:p-3">
            <div className="space-y-2 max-w-4xl mx-auto">
              {/* Pending Comment Display - Same width as amount bar */}
              {pendingComment && (
                <div className={`p-2 md:p-2.5 rounded-lg border ${
                  theme === 'light'
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-blue-900/30 border-blue-700/50'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 flex items-start gap-2">
                      <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        theme === 'light' ? 'text-blue-600' : 'text-blue-400'
                      }`} />
                      <p className={`text-sm break-words ${
                        theme === 'light' ? 'text-blue-900' : 'text-blue-100'
                      }`}>
                        {pendingComment}
                      </p>
                    </div>
                    <button
                      onClick={() => setPendingComment('')}
                      className={`p-1 rounded-full transition-all hover:scale-110 flex-shrink-0 ${
                        theme === 'light'
                          ? 'text-blue-600 hover:bg-blue-200'
                          : 'text-blue-300 hover:bg-blue-800/50'
                      }`}
                      aria-label="Remove comment"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Amount Input Row */}
              <div className="flex items-center space-x-2 md:space-x-3">
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`flex-1 h-10 md:h-11 text-sm md:text-base rounded-lg transition-all focus:ring-2 ${
                    theme === 'light'
                      ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-blue-500'
                      : 'bg-white/10 border-white/30 text-white placeholder-white/50 focus:ring-cyan-500'
                  }`}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button
                  onClick={() => setIsCommentModalOpen(true)}
                  variant="outline"
                  className={`h-10 md:h-11 w-10 md:w-11 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105 border-2 ${
                    pendingComment 
                      ? theme === 'light'
                        ? 'bg-blue-100 border-blue-400 text-blue-700 hover:bg-blue-200 hover:border-blue-500'
                        : 'bg-blue-600/40 border-blue-400 text-blue-200 hover:bg-blue-600/60 hover:border-blue-300'
                      : theme === 'light'
                        ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                        : 'bg-white/20 border-white/30 text-white hover:bg-white/30 hover:border-white/40'
                  }`}
                >
                  <FileText className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <Button
                  onClick={handleSendMessage}
                  className={`h-10 md:h-11 w-10 md:w-11 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105 border-2 ${
                    theme === 'light'
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 border-emerald-300/50'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 border-white/20'
                  }`}
                >
                  <Send className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`flex-shrink-0 backdrop-blur-lg border-t p-2.5 md:p-3 relative z-10 ${
          theme === 'light'
            ? 'bg-red-50/80 border-red-200'
            : 'bg-red-900/20 border-red-800/30'
        }`}>
          <div className="text-center max-w-4xl mx-auto">
            <p className={`text-xs md:text-sm font-medium ${
              theme === 'light' ? 'text-red-700' : 'text-red-300'
            }`}>
              This customer has been deleted. Transaction history is read-only.
            </p>
            {customer.deletedDate && (
              <p className={`text-[10px] md:text-xs mt-0.5 ${
                theme === 'light' ? 'text-red-600' : 'text-red-400'
              }`}>
                Deleted on: {new Date(customer.deletedDate).toLocaleDateString('en-IN')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Comment Modal */}
      <Dialog open={isCommentModalOpen} onOpenChange={setIsCommentModalOpen}>
        <DialogContent className={`shadow-2xl ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' 
            : 'bg-white border-gray-200'
        } border-2`}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Add Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Textarea
              placeholder="Enter your comment (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className={theme === 'dark' 
                ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'
              }
            />
            <div className={`text-xs ${
              theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
            }`}>
              💡 This comment will be displayed above the amount input bar. You can send it along with an amount later.
            </div>
            <Button onClick={handleAddComment} className={`w-full text-white ${
              theme === 'light'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700'
                : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
            }`}>
              Add Comment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className={`shadow-2xl ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' 
            : 'bg-white border-gray-200'
        } border-2`}>
          <DialogHeader>
            <DialogTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Edit Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className={`text-sm font-medium mb-1 block ${
                theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
              }`}>
                Amount
              </label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className={theme === 'dark' 
                  ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'
                }
              />
            </div>
            <div>
              <label className={`text-sm font-medium mb-1 block ${
                theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
              }`}>
                Comment (optional)
              </label>
              <Textarea
                placeholder="Enter comment..."
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={3}
                className={theme === 'dark' 
                  ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500'
                }
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setIsEditModalOpen(false)} 
                variant="outline"
                className={`flex-1 ${
                  theme === 'dark' 
                    ? 'border-slate-600 text-slate-300 hover:bg-slate-700' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEdit} 
                className={`flex-1 text-white ${
                  theme === 'light'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                }`}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Modal - Theme Aware */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className={`max-w-sm shadow-2xl ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' 
            : 'bg-white border-gray-200'
        } border-2`}>
          <DialogHeader>
            <DialogTitle className={`text-lg font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Customer Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center shadow-lg">
                {customer.profileImage ? (
                  <img src={customer.profileImage} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className={`flex justify-between py-1.5 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'
                }`}>Name:</span>
                <span className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{customer.name}</span>
              </div>
              
              <div className={`flex justify-between py-1.5 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'
                }`}>ID:</span>
                <span className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{customer.id}</span>
              </div>
              
              <div className={`flex justify-between py-1.5 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'
                }`}>Village:</span>
                <span className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>{customer.village || 'N/A'}</span>
              </div>
              
              <div className={`flex justify-between py-1.5 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'
                }`}>Phone:</span>
                <span className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>{customer.phone || 'N/A'}</span>
              </div>
              
              <div className={`flex justify-between py-1.5 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'
                }`}>Amount:</span>
                <span className={`font-bold text-base ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                }`}>₹{customer.takenAmount}</span>
              </div>
              
              <div className={`flex justify-between py-1.5 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'
                }`}>Interest:</span>
                <span className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>{customer.interest || 'N/A'}</span>
              </div>
              
              <div className={`flex justify-between py-1.5 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'
                }`}>PC:</span>
                <span className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>{customer.pc || 'N/A'}</span>
              </div>
              
              <div className={`flex justify-between py-1.5 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}>
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'
                }`}>Date:</span>
                <span className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>{customer.date}</span>
              </div>
              
              <div className="flex justify-between py-1.5">
                <span className={`font-medium ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'
                }`}>Weeks:</span>
                <span className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>{customer.weeks}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerChat;