const fileManager = require('../services/fileManager');
const bfCalculation = require('../services/bfCalculation');
const Transaction = require('../models/Transaction');

class TransactionController {
  // Get all transactions for customer
  async getTransactions(req, res, next) {
    try {
      const { customerId, lineId, day } = req.params;
      
      // Get customer to find internalId
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id; // Fallback for legacy
      
      // Get current transactions for this customer using internalId
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      // Check if this customer was restored from a deleted customer
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const restoredFromDeleted = deletedCustomers.find(
        dc => dc.isRestored === true && dc.restoredAs === customerId && dc.deletedFrom === day
      );
      
      // If customer was restored, include archived transactions for HISTORY
      // Mark them so they're not counted in balance if previous loan was settled
      if (restoredFromDeleted && restoredFromDeleted.deletionTimestamp) {
        const archivedTransactions = fileManager.readJSON(
          `transactions_deleted/${lineId}/${day}/${restoredFromDeleted.id}_${restoredFromDeleted.deletionTimestamp}.json`
        ) || [];
        
        // Mark archived transactions with flag to indicate they're from a closed account
        const markedArchived = archivedTransactions.map(t => ({
          ...t,
          isArchived: true,
          isSettled: restoredFromDeleted.remainingAtDeletion === 0
        }));
        
        // Prepend archived transactions (they come first chronologically)
        transactions = [...markedArchived, ...transactions];
      }
      
      res.json({ transactions });
    } catch (error) {
      next(error);
    }
  }

  // Add transaction
  // STEP 2 & STEP 6 FIX: Payment logic should be SIMPLE and ISOLATED
  // Only do: BF = BF + paymentAmount
  // NO recalculation, NO restoration logic, NO settlement logic, NO archived data
  async addTransaction(req, res, next) {
    try {
      const { customerId, lineId, day } = req.params;
      const { amount, date, comment } = req.body;
      
      // Get customer name
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // STEP 6: Use internalId for payment linkage
      const internalId = customer.internalId || customer.id; // Fallback for legacy
      
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      const newTransaction = new Transaction({
        amount: parseFloat(amount),
        date,
        comment: comment || '',
        customerName: customer.name,
        type: 'payment',           // STEP 6: Explicit type
        source: 'quick'             // STEP 6: Mark source as 'quick'
      });
      
      transactions.push(newTransaction.toJSON());
      fileManager.writeJSON(`transactions/${lineId}/${day}/${internalId}.json`, transactions);
      
      // STEP 6: Simple incremental BF update (same as Chat Payment)
      // BF = BF + paymentAmount (NO complex recalculation)
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      const currentBF = parseFloat(line?.currentBF || line?.amount || 0);
      const paymentAmount = parseFloat(amount);
      const newBF = currentBF + paymentAmount;
      
      // Update line with new BF
      const updatedLines = lines.map(l => {
        if (l.id === lineId) {
          return { ...l, currentBF: newBF };
        }
        return l;
      });
      fileManager.writeJSON('lines.json', updatedLines);
      
      console.log(`✅ STEP 6: Quick payment added to transactions/ file with source='quick'`);
      
      res.status(201).json({
        message: 'Transaction added successfully',
        transaction: newTransaction.toJSON(),
        newBF: newBF
      });
    } catch (error) {
      next(error);
    }
  }

  // Update transaction
  // STEP 2 FIX: Payment update should only adjust BF by the difference
  // BF = BF + (newAmount - oldAmount)
  // NO recalculation, NO restoration logic, NO settlement logic
  async updateTransaction(req, res, next) {
    try {
      const { id, customerId, lineId, day } = req.params;
      const { amount, comment } = req.body;
      
      // Get customer to find internalId
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // STEP 2: Use internalId for payment linkage
      const internalId = customer.internalId || customer.id; // Fallback for legacy
      
      // Check both transactions and chat folders using internalId
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      
      // Find transaction in regular transactions
      let transactionIndex = transactions.findIndex(t => t.id === id);
      let isInChat = false;
      
      // If not found in transactions, check chat
      if (transactionIndex === -1) {
        transactionIndex = chatTransactions.findIndex(t => t.id === id);
        isInChat = true;
      }
      
      if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      // STEP 2 FIX: Calculate the amount difference for BF adjustment
      const targetArray = isInChat ? chatTransactions : transactions;
      const oldAmount = parseFloat(targetArray[transactionIndex].amount);
      const newAmount = parseFloat(amount);
      const amountDifference = newAmount - oldAmount;
      
      // Update transaction in the correct array
      targetArray[transactionIndex] = {
        ...targetArray[transactionIndex],
        amount: newAmount,
        comment: comment || '',
        isEdited: true,
        editedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to the correct file using internalId
      if (isInChat) {
        fileManager.writeJSON(`chat/${lineId}/${day}/${internalId}.json`, chatTransactions);
      } else {
        fileManager.writeJSON(`transactions/${lineId}/${day}/${internalId}.json`, transactions);
      }
      
      // STEP 2 FIX: Simple incremental BF update
      // BF = BF + (newAmount - oldAmount)
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      const currentBF = parseFloat(line?.currentBF || line?.amount || 0);
      const newBF = currentBF + amountDifference;
      
      // Update line with new BF
      const updatedLines = lines.map(l => {
        if (l.id === lineId) {
          return { ...l, currentBF: newBF };
        }
        return l;
      });
      fileManager.writeJSON('lines.json', updatedLines);
      
      res.json({
        message: 'Transaction updated successfully',
        transaction: targetArray[transactionIndex],
        newBF: newBF
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete transaction
  // STEP 2 FIX: Payment deletion should only subtract the amount from BF
  // BF = BF - deletedAmount
  // NO recalculation, NO restoration logic, NO settlement logic
  async deleteTransaction(req, res, next) {
    try {
      const { id, customerId, lineId, day } = req.params;
      
      // Get customer to find internalId
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // STEP 2: Use internalId for payment linkage
      const internalId = customer.internalId || customer.id; // Fallback for legacy
      
      // Check both transactions and chat folders using internalId
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      
      // Find transaction in regular transactions
      let transactionIndex = transactions.findIndex(t => t.id === id);
      let isInChat = false;
      
      // If not found in transactions, check chat
      if (transactionIndex === -1) {
        transactionIndex = chatTransactions.findIndex(t => t.id === id);
        isInChat = true;
      }
      
      if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      // STEP 2 FIX: Get the amount before deleting for BF adjustment
      const targetArray = isInChat ? chatTransactions : transactions;
      const deletedAmount = parseFloat(targetArray[transactionIndex].amount);
      
      // Delete from the correct array
      if (isInChat) {
        chatTransactions = chatTransactions.filter(t => t.id !== id);
        fileManager.writeJSON(`chat/${lineId}/${day}/${internalId}.json`, chatTransactions);
      } else {
        transactions = transactions.filter(t => t.id !== id);
        fileManager.writeJSON(`transactions/${lineId}/${day}/${internalId}.json`, transactions);
      }
      
      // STEP 2 FIX: Simple incremental BF update
      // BF = BF - deletedAmount (payment is removed, so BF decreases)
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      const currentBF = parseFloat(line?.currentBF || line?.amount || 0);
      const newBF = currentBF - deletedAmount;
      
      // Update line with new BF
      const updatedLines = lines.map(l => {
        if (l.id === lineId) {
          return { ...l, currentBF: newBF };
        }
        return l;
      });
      fileManager.writeJSON('lines.json', updatedLines);
      
      res.json({
        message: 'Transaction deleted successfully',
        newBF: newBF
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransactionController();
