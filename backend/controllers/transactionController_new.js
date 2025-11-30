const fileManager = require('../services/fileManager');
const bfCalculation = require('../services/bfCalculation');
const Transaction = require('../models/Transaction');

/**
 * SIMPLIFIED TRANSACTION CONTROLLER
 * 
 * BF Rules:
 * - Add payment: BF = BF + amount
 * - Update payment: BF = BF + delta (newAmount - oldAmount)
 * - Delete payment: BF = BF - amount
 */

class TransactionController {
  /**
   * Get all transactions for customer
   */
  async getTransactions(req, res, next) {
    try {
      const { customerId, lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      // Load all transactions for this internalId
      const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      res.json({ transactions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add transaction (payment)
   * BF Rule: BF = BF + amount
   */
  async addTransaction(req, res, next) {
    try {
      const { customerId, lineId, day } = req.params;
      const { amount, date, comment } = req.body;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      const newTransaction = new Transaction({
        amount: parseFloat(amount),
        date,
        comment: comment || '',
        customerName: customer.name
      });
      
      transactions.push(newTransaction.toJSON());
      fileManager.writeJSON(`transactions/${lineId}/${day}/${internalId}.json`, transactions);
      
      // Update BF: Payment increases BF
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

  /**
   * Update transaction
   * BF Rule: BF = BF + (newAmount - oldAmount)
   */
  async updateTransaction(req, res, next) {
    try {
      const { id, customerId, lineId, day } = req.params;
      const { amount, comment } = req.body;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      // Check both transactions and chat folders
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      
      let transactionIndex = transactions.findIndex(t => t.id === id);
      let isInChat = false;
      
      if (transactionIndex === -1) {
        transactionIndex = chatTransactions.findIndex(t => t.id === id);
        isInChat = true;
      }
      
      if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      // Calculate delta for BF update
      const targetArray = isInChat ? chatTransactions : transactions;
      const oldAmount = parseFloat(targetArray[transactionIndex].amount);
      const newAmount = parseFloat(amount);
      const delta = newAmount - oldAmount;
      
      // Update transaction
      targetArray[transactionIndex] = {
        ...targetArray[transactionIndex],
        amount: newAmount,
        comment: comment || '',
        isEdited: true,
        editedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to correct file
      if (isInChat) {
        fileManager.writeJSON(`chat/${lineId}/${day}/${internalId}.json`, chatTransactions);
      } else {
        fileManager.writeJSON(`transactions/${lineId}/${day}/${internalId}.json`, transactions);
      }
      
      // Update BF by delta
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

  /**
   * Delete transaction
   * BF Rule: BF = BF - amount (reverse of adding)
   */
  async deleteTransaction(req, res, next) {
    try {
      const { id, customerId, lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      // Check both transactions and chat folders
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      
      let transactionIndex = transactions.findIndex(t => t.id === id);
      let isInChat = false;
      
      if (transactionIndex === -1) {
        transactionIndex = chatTransactions.findIndex(t => t.id === id);
        isInChat = true;
      }
      
      if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      // Get amount before deleting
      const targetArray = isInChat ? chatTransactions : transactions;
      const deletedAmount = parseFloat(targetArray[transactionIndex].amount);
      
      // Delete transaction
      if (isInChat) {
        chatTransactions = chatTransactions.filter(t => t.id !== id);
        fileManager.writeJSON(`chat/${lineId}/${day}/${internalId}.json`, chatTransactions);
      } else {
        transactions = transactions.filter(t => t.id !== id);
        fileManager.writeJSON(`transactions/${lineId}/${day}/${internalId}.json`, transactions);
      }
      
      // Update BF: Reduce by deleted payment amount
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
