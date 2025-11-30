const fileManager = require('../services/fileManager');
const bfCalculation = require('../services/bfCalculation');
const Customer = require('../models/Customer');

/**
 * SIMPLIFIED CUSTOMER CONTROLLER
 * 
 * Core Rules:
 * 1. internalId = permanent identity (never changes, never reused)
 * 2. customerId (id field) = visible ID (can change on restore, can be reused if free)
 * 3. BF updates ONLY on NEW transactions:
 *    - New loan: BF -= (Amount - Interest - PC)
 *    - Renewal: BF -= (Amount - Interest - PC)
 *    - Restore loan: BF -= (Amount - Interest - PC)
 *    - Payment: BF += amount
 *    - Delete/Update: NO BF change
 * 4. History is for UI display only (via internalId)
 * 5. NO restoration chains, NO remainingAtDeletion, NO migration, NO recalculation
 */

class CustomerController {
  /**
   * Get all customers for a line/day
   */
  async getCustomersByLineAndDay(req, res, next) {
    try {
      const { lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      
      // Calculate balance for each customer
      const customersWithBalance = customers.map(customer => {
        const internalId = customer.internalId || customer.id;
        
        // Load current data using internalId
        const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
        const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
        const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
        
        // Calculate totalOwed: use latest renewal if exists, else initial loan
        let totalOwed;
        let latestRenewalDate = null;
        let latestRenewal = null;
        
        if (renewals.length > 0) {
          const sortedRenewals = renewals.sort((a, b) => {
            const dateA = new Date(a.renewalDate || a.date).getTime();
            const dateB = new Date(b.renewalDate || b.date).getTime();
            return dateB - dateA;
          });
          latestRenewal = sortedRenewals[0];
          totalOwed = parseFloat(latestRenewal.takenAmount) || 0;
          latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
        } else {
          totalOwed = parseFloat(customer.takenAmount) || 0;
        }
        
        // Calculate totalPaid: only payments after latest renewal
        const allPayments = [...transactions, ...chatTransactions];
        const totalPaid = allPayments.reduce((sum, payment) => {
          const paymentDate = new Date(payment.createdAt || payment.date).getTime();
          if (latestRenewalDate && paymentDate < latestRenewalDate) {
            return sum;
          }
          return sum + (parseFloat(payment.amount) || 0);
        }, 0);
        
        const remainingAmount = totalOwed - totalPaid;
        
        // If there's a renewal, use its values for display
        const customerData = { ...customer };
        if (latestRenewal) {
          customerData.date = latestRenewal.date;
          customerData.interest = latestRenewal.interest !== undefined && latestRenewal.interest !== null 
            ? latestRenewal.interest : customerData.interest;
          customerData.pc = latestRenewal.pc !== undefined && latestRenewal.pc !== null 
            ? latestRenewal.pc : customerData.pc;
          customerData.weeks = latestRenewal.weeks || customerData.weeks;
          customerData.takenAmount = latestRenewal.takenAmount;
          customerData.hasRenewals = true;
        } else {
          customerData.hasRenewals = false;
        }
        
        return {
          ...customerData,
          totalOwed,
          totalPaid,
          remainingAmount
        };
      });
      
      res.json({ customers: customersWithBalance });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific customer by ID
   */
  async getCustomerById(req, res, next) {
    try {
      const { id } = req.params;
      const { lineId, day } = req.query;
      
      if (!lineId || !day) {
        return res.status(400).json({ error: 'lineId and day are required as query parameters' });
      }
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      // Load current data
      const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // Calculate balance
      let totalOwed;
      let latestRenewalDate = null;
      let latestRenewal = null;
      
      if (renewals.length > 0) {
        const sortedRenewals = renewals.sort((a, b) => {
          const dateA = new Date(a.renewalDate || a.date).getTime();
          const dateB = new Date(b.renewalDate || b.date).getTime();
          return dateB - dateA;
        });
        latestRenewal = sortedRenewals[0];
        totalOwed = parseFloat(latestRenewal.takenAmount) || 0;
        latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
      } else {
        totalOwed = parseFloat(customer.takenAmount) || 0;
      }
      
      const allPayments = [...transactions, ...chatTransactions];
      const totalPaid = allPayments.reduce((sum, payment) => {
        const paymentDate = new Date(payment.createdAt || payment.date).getTime();
        if (latestRenewalDate && paymentDate < latestRenewalDate) {
          return sum;
        }
        return sum + (parseFloat(payment.amount) || 0);
      }, 0);
      
      const remainingAmount = totalOwed - totalPaid;
      
      const customerData = { ...customer };
      if (latestRenewal) {
        customerData.date = latestRenewal.date;
        customerData.interest = latestRenewal.interest !== undefined && latestRenewal.interest !== null 
          ? latestRenewal.interest : customerData.interest;
        customerData.pc = latestRenewal.pc !== undefined && latestRenewal.pc !== null 
          ? latestRenewal.pc : customerData.pc;
        customerData.weeks = latestRenewal.weeks || customerData.weeks;
        customerData.takenAmount = latestRenewal.takenAmount;
      }
      
      res.json({ 
        customer: {
          ...customerData,
          totalOwed,
          totalPaid,
          remainingAmount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get deleted customer by ID (for restore UI)
   */
  async getDeletedCustomerById(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { timestamp } = req.query;
      
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      let customer;
      if (timestamp) {
        customer = deletedCustomers.find(c => c.id === id && c.deletionTimestamp === parseInt(timestamp));
      } else {
        const matchingCustomers = deletedCustomers.filter(c => c.id === id);
        customer = matchingCustomers.length > 0 
          ? matchingCustomers[matchingCustomers.length - 1] 
          : null;
      }
      
      if (!customer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      res.json({ customer });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new customer
   * BF Rule: BF = BF - (Amount - Interest - PC)
   */
  async createCustomer(req, res, next) {
    try {
      const { lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      
      // Check if customer ID already exists in active customers
      if (customers.find(c => c.id === req.body.id)) {
        return res.status(400).json({ error: 'Customer ID already exists' });
      }
      
      // Create new customer (Customer model will generate new internalId)
      const newCustomer = new Customer(req.body);
      customers.push(newCustomer.toJSON());
      
      fileManager.writeJSON(`customers/${lineId}/${day}.json`, customers);
      
      // Update BF: Decrement by principal
      const takenAmount = parseFloat(req.body.takenAmount) || 0;
      const interest = parseFloat(req.body.interest) || 0;
      const pc = parseFloat(req.body.pc) || 0;
      const principal = takenAmount - interest - pc;
      
      const bfResult = bfCalculation.decrementBF(lineId, principal);
      
      res.status(201).json({
        message: 'Customer created successfully',
        customer: newCustomer.toJSON(),
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update customer details
   * BF Rule: NO BF change on update
   */
  async updateCustomer(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      let customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customerIndex = customers.findIndex(c => c.id === id);
      
      if (customerIndex === -1) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const customer = customers[customerIndex];
      const internalId = customer.internalId || customer.id;
      
      // If customer has renewals and takenAmount is being updated, update the latest renewal
      if (req.body.takenAmount !== undefined) {
        let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
        
        if (renewals.length > 0) {
          renewals.sort((a, b) => {
            const dateA = new Date(a.renewalDate || a.date).getTime();
            const dateB = new Date(b.renewalDate || b.date).getTime();
            return dateB - dateA;
          });
          
          renewals[0].takenAmount = parseFloat(req.body.takenAmount);
          if (req.body.interest !== undefined) renewals[0].interest = req.body.interest;
          if (req.body.pc !== undefined) renewals[0].pc = req.body.pc;
          if (req.body.weeks !== undefined) renewals[0].weeks = req.body.weeks;
          
          fileManager.writeJSON(`renewals/${lineId}/${day}/${internalId}.json`, renewals);
        }
      }
      
      const updatedCustomer = new Customer({
        ...customers[customerIndex],
        ...req.body,
        id,
        internalId // Preserve internalId
      });
      
      customers[customerIndex] = updatedCustomer.toJSON();
      fileManager.writeJSON(`customers/${lineId}/${day}.json`, customers);
      
      // NO BF change on update
      const currentBF = bfCalculation.getCurrentBF(lineId);
      
      res.json({
        message: 'Customer updated successfully',
        customer: updatedCustomer.toJSON(),
        newBF: currentBF
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete/archive customer
   * BF Rule: NO BF change on delete
   */
  async deleteCustomer(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      let customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      // Check if customer has cleared balance
      const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      let totalOwed;
      let latestRenewalDate = null;
      
      if (renewals.length > 0) {
        const sortedRenewals = renewals.sort((a, b) => {
          const dateA = new Date(a.renewalDate || a.date).getTime();
          const dateB = new Date(b.renewalDate || b.date).getTime();
          return dateB - dateA;
        });
        const latestRenewal = sortedRenewals[0];
        totalOwed = parseFloat(latestRenewal.takenAmount) || 0;
        latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
      } else {
        totalOwed = parseFloat(customer.takenAmount) || 0;
      }
      
      const allPayments = [...transactions, ...chatTransactions];
      const totalPaid = allPayments.reduce((sum, payment) => {
        const paymentDate = new Date(payment.createdAt || payment.date).getTime();
        if (latestRenewalDate && paymentDate < latestRenewalDate) {
          return sum;
        }
        return sum + (parseFloat(payment.amount) || 0);
      }, 0);
      
      const remainingAmount = totalOwed - totalPaid;
      
      if (remainingAmount > 0) {
        return res.status(400).json({ 
          error: `Cannot delete customer with pending amount: ₹${remainingAmount.toFixed(2)}` 
        });
      }
      
      // Archive customer data
      const deletionTimestamp = Date.now();
      
      // Archive transactions, chat, and renewals
      if (transactions.length > 0) {
        fileManager.writeJSON(
          `transactions_deleted/${lineId}/${day}/${internalId}_${deletionTimestamp}.json`,
          transactions
        );
      }
      if (chatTransactions.length > 0) {
        fileManager.writeJSON(
          `chat_deleted/${lineId}/${day}/${internalId}_${deletionTimestamp}.json`,
          chatTransactions
        );
      }
      if (renewals.length > 0) {
        fileManager.writeJSON(
          `renewals_deleted/${lineId}/${day}/${internalId}_${deletionTimestamp}.json`,
          renewals
        );
      }
      
      // Remove from active customers
      customers = customers.filter(c => c.id !== id);
      fileManager.writeJSON(`customers/${lineId}/${day}.json`, customers);
      
      // Delete active transaction files
      fileManager.deleteJSON(`transactions/${lineId}/${day}/${internalId}.json`);
      fileManager.deleteJSON(`chat/${lineId}/${day}/${internalId}.json`);
      fileManager.deleteJSON(`renewals/${lineId}/${day}/${internalId}.json`);
      
      // Add to deleted customers list (for potential restore)
      let deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      deletedCustomers.push({
        ...customer,
        internalId: internalId,
        deletedDate: new Date().toISOString().split('T')[0],
        deletedFrom: day,
        deletionTimestamp,
        isRestored: false
      });
      fileManager.writeJSON(`deleted_customers/${lineId}.json`, deletedCustomers);
      
      // NO BF change on delete
      
      res.json({ message: 'Customer deleted and archived successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Restore deleted customer with new loan
   * BF Rule: BF = BF - (Amount - Interest - PC)
   * 
   * Process:
   * 1. Check if newId (customerId) is free → reject if taken
   * 2. Create customer with newId but SAME internalId (preserves history)
   * 3. NEW loan is always required
   * 4. Reduce BF by principal
   */
  async restoreCustomer(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { newId, takenAmount, deletedFrom, interest, pc, date, weeks, deletionTimestamp } = req.body;
      
      // Validate required fields
      if (!newId || !takenAmount || !deletedFrom || !date) {
        return res.status(400).json({ 
          error: 'Required fields: newId, takenAmount, deletedFrom, date' 
        });
      }
      
      // Get deleted customer
      let deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      let deletedCustomer;
      if (deletionTimestamp) {
        deletedCustomer = deletedCustomers.find(c => 
          c.id === id && 
          c.deletedFrom === deletedFrom && 
          c.deletionTimestamp === parseInt(deletionTimestamp)
        );
      } else {
        const candidates = deletedCustomers.filter(c => 
          c.id === id && 
          c.deletedFrom === deletedFrom && 
          !c.isRestored
        );
        deletedCustomer = candidates.length > 0 
          ? candidates.sort((a, b) => b.deletionTimestamp - a.deletionTimestamp)[0]
          : null;
      }
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      if (deletedCustomer.isRestored) {
        return res.status(400).json({ 
          error: 'This customer has already been restored',
          restoredAs: deletedCustomer.restoredAs,
          restoredDate: deletedCustomer.restoredDate
        });
      }
      
      // Check if new customerId is available
      const activeCustomers = fileManager.readJSON(`customers/${lineId}/${deletedFrom}.json`) || [];
      if (activeCustomers.find(c => c.id === newId)) {
        return res.status(400).json({ error: 'Customer ID already exists' });
      }
      
      // CRITICAL: Keep the SAME internalId to preserve history link
      const preservedInternalId = deletedCustomer.internalId || deletedCustomer.id;
      
      // Create restored customer with new visible ID but same internalId
      const restoredCustomer = new Customer({
        id: newId,
        internalId: preservedInternalId, // SAME internalId
        name: deletedCustomer.name,
        village: deletedCustomer.village,
        phone: deletedCustomer.phone,
        profileImage: deletedCustomer.profileImage,
        takenAmount: parseFloat(takenAmount),
        interest: interest !== undefined && interest !== null ? interest : (deletedCustomer.interest || 0),
        pc: pc !== undefined && pc !== null ? pc : (deletedCustomer.pc || 0),
        date: date,
        weeks: weeks || deletedCustomer.weeks || 12
      });
      
      // Add to active customers
      activeCustomers.push(restoredCustomer.toJSON());
      fileManager.writeJSON(`customers/${lineId}/${deletedFrom}.json`, activeCustomers);
      
      // Mark as restored in deleted list (for UI tracking)
      deletedCustomers = deletedCustomers.map(c => {
        if (c.id === id && 
            c.deletedFrom === deletedFrom && 
            c.deletionTimestamp === deletedCustomer.deletionTimestamp) {
          return {
            ...c,
            isRestored: true,
            restoredAs: newId,
            restoredDate: new Date().toISOString()
          };
        }
        return c;
      });
      fileManager.writeJSON(`deleted_customers/${lineId}.json`, deletedCustomers);
      
      // Update BF: Restore always includes a new loan
      const newInterest = interest !== undefined && interest !== null ? parseFloat(interest) : 0;
      const newPc = pc !== undefined && pc !== null ? parseFloat(pc) : 0;
      const principal = parseFloat(takenAmount) - newInterest - newPc;
      
      const bfResult = bfCalculation.decrementBF(lineId, principal);
      
      res.status(201).json({
        message: 'Customer restored successfully with new loan',
        customer: restoredCustomer.toJSON(),
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer transactions (including history via internalId)
   */
  async getCustomerTransactions(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      // Load all transactions for this internalId (includes full history)
      const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      res.json({ transactions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer renewals
   */
  async getCustomerRenewals(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      res.json({ renewals });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create renewal for customer
   * BF Rule: BF = BF - (Amount - Interest - PC)
   */
  async createRenewal(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      const { takenAmount, interest, pc, date, weeks } = req.body;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      // Check if customer has cleared balance
      const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      let totalOwed;
      let latestRenewalDate = null;
      
      if (renewals.length > 0) {
        const sortedRenewals = renewals.sort((a, b) => {
          const dateA = new Date(a.renewalDate || a.date).getTime();
          const dateB = new Date(b.renewalDate || b.date).getTime();
          return dateB - dateA;
        });
        const latestRenewal = sortedRenewals[0];
        totalOwed = parseFloat(latestRenewal.takenAmount) || 0;
        latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
      } else {
        totalOwed = parseFloat(customer.takenAmount) || 0;
      }
      
      const allPayments = [...transactions, ...chatTransactions];
      const totalPaid = allPayments.reduce((sum, payment) => {
        const paymentDate = new Date(payment.createdAt || payment.date).getTime();
        if (latestRenewalDate && paymentDate < latestRenewalDate) {
          return sum;
        }
        return sum + (parseFloat(payment.amount) || 0);
      }, 0);
      
      const remainingAmount = totalOwed - totalPaid;
      
      if (remainingAmount > 0) {
        return res.status(400).json({ 
          error: `Customer has pending balance: ₹${remainingAmount.toFixed(2)}. Please clear before renewal.` 
        });
      }
      
      // Create renewal
      const newRenewal = {
        id: Date.now().toString(),
        takenAmount: parseFloat(takenAmount),
        interest: interest !== undefined && interest !== null ? interest : customer.interest,
        pc: pc !== undefined && pc !== null ? pc : customer.pc,
        date: date || new Date().toISOString().split('T')[0],
        weeks: weeks || customer.weeks,
        renewalDate: new Date().toISOString(),
        customerName: customer.name
      };
      
      renewals.push(newRenewal);
      fileManager.writeJSON(`renewals/${lineId}/${day}/${internalId}.json`, renewals);
      
      // Update BF: Renewal is a new loan
      const renewalInterest = interest !== undefined && interest !== null ? parseFloat(interest) : parseFloat(customer.interest) || 0;
      const renewalPc = pc !== undefined && pc !== null ? parseFloat(pc) : parseFloat(customer.pc) || 0;
      const principal = parseFloat(takenAmount) - renewalInterest - renewalPc;
      
      const bfResult = bfCalculation.decrementBF(lineId, principal);
      
      res.status(201).json({
        message: 'Renewal created successfully',
        renewal: newRenewal,
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer chat transactions
   */
  async getCustomerChat(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      // Load all data for this customer (full history via internalId)
      const chat = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      res.json({ 
        chat,
        transactions,
        renewals,
        customer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add chat transaction (payment via chat)
   * BF Rule: BF = BF + amount
   */
  async addChatTransaction(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      const { amount, date, comment } = req.body;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      let chat = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      
      const newChatTransaction = {
        id: Date.now().toString(),
        amount: parseFloat(amount),
        date,
        comment: comment || '',
        customerName: customer.name,
        createdAt: new Date().toISOString()
      };
      
      chat.push(newChatTransaction);
      fileManager.writeJSON(`chat/${lineId}/${day}/${internalId}.json`, chat);
      
      // Update BF: Payment increases BF
      const bfResult = bfCalculation.incrementBF(lineId, parseFloat(amount));
      
      res.status(201).json({
        message: 'Chat transaction added successfully',
        transaction: newChatTransaction,
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all pending customers across all days for a line
   */
  async getPendingCustomers(req, res, next) {
    try {
      const { lineId } = req.params;
      
      const days = fileManager.readJSON(`days/${lineId}.json`) || [];
      let allPendingCustomers = [];
      
      days.forEach(day => {
        const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
        
        customers.forEach(customer => {
          const internalId = customer.internalId || customer.id;
          const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
          const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
          const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
          
          let totalOwed;
          let latestRenewalDate = null;
          
          if (renewals.length > 0) {
            const sortedRenewals = renewals.sort((a, b) => {
              const dateA = new Date(a.renewalDate || a.date).getTime();
              const dateB = new Date(b.renewalDate || b.date).getTime();
              return dateB - dateA;
            });
            totalOwed = parseFloat(sortedRenewals[0].takenAmount) || 0;
            latestRenewalDate = new Date(sortedRenewals[0].renewalDate || sortedRenewals[0].date).getTime();
          } else {
            totalOwed = parseFloat(customer.takenAmount) || 0;
          }
          
          const allPayments = [...transactions, ...chatTransactions];
          const totalPaid = allPayments.reduce((sum, payment) => {
            const paymentDate = new Date(payment.createdAt || payment.date).getTime();
            if (latestRenewalDate && paymentDate < latestRenewalDate) {
              return sum;
            }
            return sum + (parseFloat(payment.amount) || 0);
          }, 0);
          
          const remainingAmount = totalOwed - totalPaid;
          
          if (remainingAmount > 0) {
            allPendingCustomers.push({
              ...customer,
              day,
              remainingAmount,
              totalOwed,
              totalPaid
            });
          }
        });
      });
      
      res.json({ customers: allPendingCustomers });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all deleted customers for a line
   */
  async getDeletedCustomers(req, res, next) {
    try {
      const { lineId } = req.params;
      
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      res.json({ customers: deletedCustomers });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get next available customer ID for a line/day
   */
  async getNextCustomerId(req, res, next) {
    try {
      const { lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      
      let maxId = 0;
      customers.forEach(c => {
        const numericId = parseInt(c.id);
        if (!isNaN(numericId) && numericId > maxId) {
          maxId = numericId;
        }
      });
      
      const nextId = (maxId + 1).toString();
      
      res.json({ nextId });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get deleted customer transactions
   */
  async getDeletedCustomerTransactions(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { timestamp, day } = req.query;
      
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const deletedCustomer = deletedCustomers.find(
        dc => dc.id === id && 
              dc.deletionTimestamp === parseInt(timestamp) &&
              dc.deletedFrom === day
      );
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      const internalId = deletedCustomer.internalId || deletedCustomer.id;
      
      const transactions = fileManager.readJSON(
        `transactions_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
      ) || [];
      
      res.json({ transactions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get deleted customer chat
   */
  async getDeletedCustomerChat(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { timestamp, day } = req.query;
      
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const deletedCustomer = deletedCustomers.find(
        dc => dc.id === id && 
              dc.deletionTimestamp === parseInt(timestamp) &&
              dc.deletedFrom === day
      );
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      const internalId = deletedCustomer.internalId || deletedCustomer.id;
      
      const chat = fileManager.readJSON(
        `chat_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
      ) || [];
      
      const transactions = fileManager.readJSON(
        `transactions_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
      ) || [];
      
      const renewals = fileManager.readJSON(
        `renewals_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
      ) || [];
      
      res.json({ 
        chat,
        transactions,
        renewals,
        customer: deletedCustomer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get deleted customer renewals
   */
  async getDeletedCustomerRenewals(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { timestamp, day } = req.query;
      
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const deletedCustomer = deletedCustomers.find(
        dc => dc.id === id && 
              dc.deletionTimestamp === parseInt(timestamp) &&
              dc.deletedFrom === day
      );
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      const internalId = deletedCustomer.internalId || deletedCustomer.id;
      
      const renewals = fileManager.readJSON(
        `renewals_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
      ) || [];
      
      res.json({ renewals });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get customer print data
   */
  async getCustomerPrintData(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const internalId = customer.internalId || customer.id;
      
      const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      res.json({
        customer,
        transactions,
        chatTransactions,
        renewals
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CustomerController();
