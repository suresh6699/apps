const fileManager = require('../services/fileManager');

class CollectionController {
  // Get collections with filters
  // Query params: days (comma-separated), date, dateFrom, dateTo
  async getCollections(req, res, next) {
    try {
      const { lineId } = req.params;
      const { days, date, dateFrom, dateTo } = req.query;
      
      let selectedDays = [];
      if (days) {
        selectedDays = days.split(',');
      } else {
        // Get all days for line
        selectedDays = fileManager.readJSON(`days/${lineId}.json`) || [];
      }
      
      let incomingTransactions = [];
      let goingTransactions = [];
      
      // Load transactions for selected days
      selectedDays.forEach(day => {
        // Load customers
        const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
        const customerMap = new Map();
        customers.forEach(c => {
          // Map by internalId (for file lookups) AND by id (for display)
          const internalId = c.internalId || c.id;
          customerMap.set(internalId, c);
          customerMap.set(c.id, c); // Also keep id mapping for backward compatibility
        });
        
        // Load deleted customers
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        deletedCustomers.forEach(c => {
          if (c.deletedFrom === day) {
            const internalId = c.internalId || c.id;
            customerMap.set(internalId, c);
            customerMap.set(`${c.id}_deleted_${c.deletionTimestamp}`, c);
          }
        });
        
        // Load incoming transactions
        const transFiles = fileManager.listFiles(`transactions/${lineId}/${day}`);
        transFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          // CRITICAL FIX: Use customer.id for display, not internalId from filename
          const displayCustomerId = customer ? customer.id : fileInternalId;
          
          transactions.forEach(trans => {
            incomingTransactions.push({
              ...trans,
              customerId: displayCustomerId,
              customerName: trans.customerName || (customer ? customer.name : `Customer ${displayCustomerId}`),
              day,
              // Preserve original type or set to 'received'
              type: trans.type || 'received',
              // Include customer details for tooltips
              customerDetails: customer || null,
              isDeleted: false,
              isRestored: customer ? (customer.isRestoredCustomer || false) : false // Mark if from restored customer
            });
          });
        });
        
        // Load chat transactions
        const chatFiles = fileManager.listFiles(`chat/${lineId}/${day}`);
        chatFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          // CRITICAL FIX: Use customer.id for display, not internalId from filename
          const displayCustomerId = customer ? customer.id : fileInternalId;
          
          chatTransactions.forEach(trans => {
            incomingTransactions.push({
              ...trans,
              customerId: displayCustomerId,
              customerName: trans.customerName || (customer ? customer.name : `Customer ${displayCustomerId}`),
              day,
              // Preserve original type or set to 'received'
              type: trans.type || 'received',
              // Include customer details for tooltips
              customerDetails: customer || null,
              isDeleted: false,
              isRestored: customer ? (customer.isRestoredCustomer || false) : false // Mark if from restored customer
            });
          });
        });
        
        // Load going transactions (customer creation)
        customers.forEach(customer => {
          if (customer.takenAmount && customer.date) {
            goingTransactions.push({
              id: `customer_creation_${customer.id}`,
              customerId: customer.id,
              customerName: customer.name,
              amount: parseFloat(customer.takenAmount),
              date: customer.date,
              type: 'customer_creation',
              comment: customer.isRestoredCustomer ? 'Restoration Loan' : 'Customer Created',
              day,
              // Include customer details for tooltips
              customerDetails: customer || null,
              isDeleted: false,
              isRestored: customer.isRestoredCustomer || false // Mark if this is a restored customer's loan
            });
          }
        });
        
        // Load renewals
        const renewalFiles = fileManager.listFiles(`renewals/${lineId}/${day}`);
        renewalFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          // CRITICAL FIX: Use customer.id for display, not internalId from filename
          const displayCustomerId = customer ? customer.id : fileInternalId;
          
          renewals.forEach(renewal => {
            if (renewal.takenAmount && renewal.date) {
              goingTransactions.push({
                id: renewal.id || `renewal_${Date.now()}`,
                customerId: displayCustomerId,
                customerName: renewal.customerName || (customer ? customer.name : `Customer ${displayCustomerId}`),
                amount: parseFloat(renewal.takenAmount),
                date: renewal.date,
                type: 'renewal',
                comment: 'Renewal',
                day,
                // Include customer details for tooltips
                customerDetails: customer || null,
                isDeleted: false
              });
            }
          });
        });
      });
      
      // Load archived transactions from deleted customers - USING COMPLETE RESTORATION CHAIN WALK
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      // CRITICAL FIX: Only process the LATEST deletion for each restoration chain
      // Group deleted customers by their restoration chain
      const deletionChains = new Map(); // Maps internalId to latest deletion in that chain
      
      deletedCustomers.forEach(dc => {
        if (!dc || !dc.deletionTimestamp || !selectedDays.includes(dc.deletedFrom)) {
          return;
        }
        
        // CRITICAL FIX: Skip customers that are currently restored (isRestored: true)
        // Their transactions are already loaded from active customer files
        if (dc.isRestored === true) {
          return;
        }
        
        // Find all deletions that are part of the same chain
        const chainKey = dc.internalId || dc.id;
        
        // Check if this deletion is restored (meaning there's a later deletion in the chain)
        const isRestoredAndReDeleted = deletedCustomers.some(
          other => other.restoredFromInternalId === dc.internalId && 
                   other.deletedFrom === dc.deletedFrom
        );
        
        // Only keep the latest deletion (one that's NOT restored into another deletion)
        if (!isRestoredAndReDeleted) {
          // This is a terminal node in the restoration chain
          const existing = deletionChains.get(chainKey);
          if (!existing || dc.deletionTimestamp > existing.deletionTimestamp) {
            deletionChains.set(chainKey, dc);
          }
        }
      });
      
      // Process only the terminal nodes (latest deletions in each chain)
      const processedDeletionTimestamps = new Set();
      
      deletionChains.forEach(deletedCustomer => {
        // Skip if already processed
        if (processedDeletionTimestamps.has(deletedCustomer.deletionTimestamp)) {
          return;
        }
        
        const day = deletedCustomer.deletedFrom;
        
        // CRITICAL FIX: Walk through the ENTIRE restoration chain to collect ALL historical data
        // This matches the logic in getDeletedCustomerChat to ensure consistency
        let chainChat = [];
        let chainTransactions = [];
        let chainRenewals = [];
        let chainLoans = [];
        
        // Start with the current deleted customer and walk backwards through the chain
        let currentDeletedCustomer = deletedCustomer;
        const processedInChain = new Set();
        let isFirstIteration = true;
        
        while (currentDeletedCustomer && !processedInChain.has(currentDeletedCustomer.deletionTimestamp)) {
          processedInChain.add(currentDeletedCustomer.deletionTimestamp);
          processedDeletionTimestamps.add(currentDeletedCustomer.deletionTimestamp);
          
          // For the LATEST deletion (first iteration), ALWAYS load its archived files
          // For older deletions that were migrated, skip loading (data was moved forward)
          if (isFirstIteration || !currentDeletedCustomer.isMigrated) {
            const currentInternalId = currentDeletedCustomer.internalId || currentDeletedCustomer.id;
            const currentTimestamp = currentDeletedCustomer.deletionTimestamp;
            
            // Load all archived data for this deletion
            const archivedChat = fileManager.readJSON(
              `chat_deleted/${lineId}/${day}/${currentInternalId}_${currentTimestamp}.json`
            ) || [];
            const archivedTransactions = fileManager.readJSON(
              `transactions_deleted/${lineId}/${day}/${currentInternalId}_${currentTimestamp}.json`
            ) || [];
            const archivedRenewals = fileManager.readJSON(
              `renewals_deleted/${lineId}/${day}/${currentInternalId}_${currentTimestamp}.json`
            ) || [];
            
            // Mark items with metadata
            const markedChat = archivedChat.map(c => ({
              ...c,
              isArchived: true,
              isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
              fromDeletion: currentDeletedCustomer.deletionTimestamp
            }));
            const markedTransactions = archivedTransactions.map(t => ({
              ...t,
              isArchived: true,
              isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
              fromDeletion: currentDeletedCustomer.deletionTimestamp
            }));
            const markedRenewals = archivedRenewals.map(r => ({
              ...r,
              isArchived: true,
              isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
              fromDeletion: currentDeletedCustomer.deletionTimestamp
            }));
            
            // Prepend archived data (oldest first for chronological order)
            chainChat = [...markedChat, ...chainChat];
            chainTransactions = [...markedTransactions, ...chainTransactions];
            chainRenewals = [...markedRenewals, ...chainRenewals];
          }
          
          isFirstIteration = false;
          
          // Add this deleted customer's loan to the chain
          chainLoans.push({
            takenAmount: currentDeletedCustomer.originalTakenAmount || currentDeletedCustomer.takenAmount,
            date: currentDeletedCustomer.date,
            name: currentDeletedCustomer.name,
            id: currentDeletedCustomer.id,
            internalId: currentDeletedCustomer.internalId,
            isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
            deletionTimestamp: currentDeletedCustomer.deletionTimestamp,
            isRestoredCustomer: currentDeletedCustomer.wasRestoredCustomer || currentDeletedCustomer.isRestoredCustomer,
            originalCustomerId: currentDeletedCustomer.originalCustomerId
          });
          
          // Walk back: Check if THIS deleted customer was itself a restored customer
          let previousDeletionInChain = null;
          
          // Method 1: Use restoredFromInternalId
          if (currentDeletedCustomer.restoredFromInternalId) {
            previousDeletionInChain = deletedCustomers.find(
              dc => dc.internalId === currentDeletedCustomer.restoredFromInternalId &&
                    dc.deletedFrom === day &&
                    !dc.restorationInvalidated
            );
          }
          
          // Method 2: Fallback to originalCustomerInternalId
          if (!previousDeletionInChain && currentDeletedCustomer.originalCustomerInternalId) {
            previousDeletionInChain = deletedCustomers.find(
              dc => dc.internalId === currentDeletedCustomer.originalCustomerInternalId &&
                    dc.deletedFrom === day &&
                    !dc.restorationInvalidated
            );
          }
          
          if (previousDeletionInChain) {
            currentDeletedCustomer = previousDeletionInChain;
          } else {
            break;
          }
        }
        
        // Reverse loan list so oldest loan appears first
        chainLoans.reverse();
        
        // Determine display ID and customer details
        const isRestored = deletedCustomer.isRestored === true;
        const displayCustomerId = isRestored ? deletedCustomer.restoredAs : deletedCustomer.id;
        const displayCustomerName = deletedCustomer.name;
        
        // Try to find active customer if restored
        let displayCustomer = deletedCustomer;
        if (isRestored) {
          const activeCustomers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
          const restoredCustomer = activeCustomers.find(c => c.id === deletedCustomer.restoredAs);
          if (restoredCustomer) {
            displayCustomer = restoredCustomer;
          }
        }
        
        // Add all transactions from the complete chain
        chainTransactions.forEach(trans => {
          incomingTransactions.push({
            ...trans,
            customerId: displayCustomerId,
            customerName: trans.customerName || displayCustomerName,
            day,
            type: trans.type || 'received',
            customerDetails: displayCustomer,
            isDeleted: !isRestored,
            isRestored: isRestored,
            originalCustomerId: deletedCustomer.id
          });
        });
        
        // Add all chat transactions from the complete chain
        chainChat.forEach(trans => {
          incomingTransactions.push({
            ...trans,
            customerId: displayCustomerId,
            customerName: trans.customerName || displayCustomerName,
            day,
            type: trans.type || 'received',
            customerDetails: displayCustomer,
            isDeleted: !isRestored,
            isRestored: isRestored,
            originalCustomerId: deletedCustomer.id
          });
        });
        
        // Add all renewals from the complete chain
        chainRenewals.forEach(renewal => {
          if (renewal.takenAmount && renewal.date) {
            goingTransactions.push({
              id: renewal.id || `renewal_archived_${Date.now()}_${Math.random()}`,
              customerId: displayCustomerId,
              customerName: renewal.customerName || displayCustomerName,
              amount: parseFloat(renewal.takenAmount),
              date: renewal.date,
              type: 'renewal',
              comment: 'Renewal',
              day,
              customerDetails: displayCustomer,
              isDeleted: !isRestored,
              isRestored: isRestored,
              isSettled: renewal.isSettled || false,
              originalCustomerId: deletedCustomer.id
            });
          }
        });
        
        // Add all loans from the complete chain (in chronological order)
        chainLoans.forEach((loan, index) => {
          const isFirstLoan = index === 0;
          const isRestorationLoan = loan.isRestoredCustomer || loan.originalCustomerId;
          
          goingTransactions.push({
            id: isFirstLoan 
              ? `customer_creation_deleted_${loan.id}_${loan.deletionTimestamp}`
              : `customer_restoration_${loan.id}_${loan.deletionTimestamp}`,
            customerId: displayCustomerId,
            customerName: displayCustomerName,
            amount: parseFloat(loan.takenAmount),
            date: loan.date,
            type: 'customer_creation',
            comment: isFirstLoan ? 'Customer Created' : 'Restoration Loan',
            day,
            customerDetails: displayCustomer,
            isDeleted: !isRestored,
            isRestored: isRestorationLoan,
            isSettled: loan.isSettled,
            originalCustomerId: deletedCustomer.id
          });
        });
      });
      
      // Filter by date if provided
      if (date) {
        incomingTransactions = incomingTransactions.filter(t => t.date === date);
        goingTransactions = goingTransactions.filter(t => t.date === date);
      } else if (dateFrom && dateTo) {
        incomingTransactions = incomingTransactions.filter(t => t.date >= dateFrom && t.date <= dateTo);
        goingTransactions = goingTransactions.filter(t => t.date >= dateFrom && t.date <= dateTo);
      }
      
      // Calculate totals
      const incomingTotal = incomingTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const goingTotal = goingTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const netFlow = incomingTotal - goingTotal;
      
      // Extract unique dates for calendar highlighting
      // Only extract if no date filter is applied (for calendar view)
      let uniqueDates = [];
      if (!date) {
        const allTransactions = [...incomingTransactions, ...goingTransactions];
        uniqueDates = [...new Set(allTransactions.map(t => t.date))].sort();
      }
      
      // Combine all transactions with proper type marking
      const allCollections = [
        ...incomingTransactions.map(t => ({ ...t, type: 'received' })),
        ...goingTransactions.map(t => ({ ...t, type: 'given' }))
      ];
      
      res.json({
        collections: allCollections,
        incomingTransactions,
        goingTransactions,
        totals: {
          incoming: incomingTotal,
          going: goingTotal,
          netFlow
        },
        uniqueDates,
        filters: {
          days: selectedDays,
          date,
          dateFrom,
          dateTo
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CollectionController();
