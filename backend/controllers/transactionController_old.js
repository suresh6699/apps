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
      
      const internalId = customer.internalId || customer.id; // Fallback for legacy
      
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      const newTransaction = new Transaction({
        amount: parseFloat(amount),
        date,
        comment: comment || '',
        customerName: customer.name
      });
      
      transactions.push(newTransaction.toJSON());
      fileManager.writeJSON(`transactions/${lineId}/${day}/${internalId}.json`, transactions);
      
      // INCREMENTAL BF UPDATE: Increment by payment amount for NEW payment
      const bfResult = bfCalculation.incrementBF(lineId, parseFloat(amount));
      
      res.status(201).json({
        message: 'Transaction added successfully',
        transaction: newTransaction.toJSON(),
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  // Update transaction
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
      
      // Get old amount to calculate delta
      const targetArray = isInChat ? chatTransactions : transactions;
      const oldAmount = parseFloat(targetArray[transactionIndex].amount);
      const newAmount = parseFloat(amount);
      const delta = newAmount - oldAmount;
      
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
      
      // INCREMENTAL BF UPDATE: Adjust by the difference (delta) in payment amount
      const bfResult = bfCalculation.incrementBF(lineId, delta);
      
      res.json({
        message: 'Transaction updated successfully',
        transaction: targetArray[transactionIndex],
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete transaction
  async deleteTransaction(req, res, next) {
    try {
      const { id, customerId, lineId, day } = req.params;
      
      // Get customer to find internalId
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
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
      
      // Get transaction amount before deleting
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
      
      // INCREMENTAL BF UPDATE: Decrement by deleted payment amount (reverse of adding)
      const bfResult = bfCalculation.incrementBF(lineId, -deletedAmount);
      
      res.json({
        message: 'Transaction deleted successfully',
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransactionController();
