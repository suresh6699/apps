const fileManager = require('../services/fileManager');
const bfCalculation = require('../services/bfCalculation');

class AccountController {
  // Get all accounts for a line
  async getAccounts(req, res, next) {
    try {
      const { lineId } = req.params;
      
      const accounts = fileManager.readJSON(`accounts/${lineId}.json`) || [];
      
      res.json({ accounts });
    } catch (error) {
      next(error);
    }
  }

  // Create account
  async createAccount(req, res, next) {
    try {
      const { lineId } = req.params;
      const { name } = req.body;
      
      let accounts = fileManager.readJSON(`accounts/${lineId}.json`) || [];
      
      const newAccount = {
        id: Date.now().toString(),
        name,
        createdAt: new Date().toISOString()
      };
      
      accounts.push(newAccount);
      fileManager.writeJSON(`accounts/${lineId}.json`, accounts);
      
      res.status(201).json({
        message: 'Account created successfully',
        account: newAccount
      });
    } catch (error) {
      next(error);
    }
  }

  // Update account
  async updateAccount(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { name } = req.body;
      
      let accounts = fileManager.readJSON(`accounts/${lineId}.json`) || [];
      const accountIndex = accounts.findIndex(a => a.id === id);
      
      if (accountIndex === -1) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      accounts[accountIndex] = {
        ...accounts[accountIndex],
        name,
        updatedAt: new Date().toISOString()
      };
      
      fileManager.writeJSON(`accounts/${lineId}.json`, accounts);
      
      res.json({
        message: 'Account updated successfully',
        account: accounts[accountIndex]
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete account
  async deleteAccount(req, res, next) {
    try {
      const { id, lineId } = req.params;
      
      let accounts = fileManager.readJSON(`accounts/${lineId}.json`) || [];
      
      accounts = accounts.filter(a => a.id !== id);
      fileManager.writeJSON(`accounts/${lineId}.json`, accounts);
      
      // Delete account transactions
      fileManager.deleteJSON(`account_transactions/${lineId}/${id}.json`);
      
      res.json({ message: 'Account and its transactions deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Get account transactions
  async getAccountTransactions(req, res, next) {
    try {
      const { id, lineId } = req.params;
      
      const transactions = fileManager.readJSON(`account_transactions/${lineId}/${id}.json`) || [];
      
      // Calculate totals
      let totalCredit = 0;
      let totalDebit = 0;
      
      transactions.forEach(t => {
        totalCredit += parseFloat(t.creditAmount) || 0;
        totalDebit += parseFloat(t.debitAmount) || 0;
      });
      
      const netBalance = totalCredit - totalDebit;
      
      res.json({ 
        transactions,
        totals: {
          credit: totalCredit,
          debit: totalDebit,
          netBalance
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Add account transaction
  async addAccountTransaction(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { name, date, creditAmount, debitAmount } = req.body;
      
      // Validate: At least credit OR debit should be provided
      const credit = parseFloat(creditAmount) || 0;
      const debit = parseFloat(debitAmount) || 0;
      
      if (credit === 0 && debit === 0) {
        return res.status(400).json({ error: 'Either credit or debit amount is required' });
      }
      
      let transactions = fileManager.readJSON(`account_transactions/${lineId}/${id}.json`) || [];
      
      const newTransaction = {
        id: Date.now().toString(),
        name: name || '',
        date,
        creditAmount: credit,
        debitAmount: debit,
        createdAt: new Date().toISOString()
      };
      
      transactions.push(newTransaction);
      fileManager.writeJSON(`account_transactions/${lineId}/${id}.json`, transactions);
      
      // Update BF: Credit adds to BF, Debit subtracts from BF
      const bfResult = bfCalculation.updateBF(lineId);
      
      res.status(201).json({
        message: 'Account transaction added successfully',
        transaction: newTransaction,
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete account transaction
  async deleteAccountTransaction(req, res, next) {
    try {
      const { id, transactionId, lineId } = req.params;
      
      let transactions = fileManager.readJSON(`account_transactions/${lineId}/${id}.json`) || [];
      
      const transactionIndex = transactions.findIndex(t => t.id === transactionId);
      if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      transactions = transactions.filter(t => t.id !== transactionId);
      fileManager.writeJSON(`account_transactions/${lineId}/${id}.json`, transactions);
      
      // Update BF
      const bfResult = bfCalculation.updateBF(lineId);
      
      res.json({
        message: 'Account transaction deleted successfully',
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AccountController();
