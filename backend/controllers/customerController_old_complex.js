const fileManager = require('../services/fileManager');
const bfCalculation = require('../services/bfCalculation');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');

// Helper functions (defined outside class to avoid 'this' binding issues)
function _getInternalId(customer) {
  return customer.internalId || customer.id; // Fallback to id for legacy customers
}

function _findCustomerById(customers, id) {
  return customers.find(c => c.id === id);
}

class CustomerController {
  // Get all customers for a line/day
  async getCustomersByLineAndDay(req, res, next) {
    try {
      const { lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      
      // Load deleted customers once for efficiency
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      // Add calculated remaining amounts for each customer
      const customersWithBalance = customers.map(customer => {
        const internalId = _getInternalId(customer);
        let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
        let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
        let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
        
        // Check if this customer was restored from a deleted customer
        // Use the customer's own flag instead of searching deleted customers
        // This prevents NEW customers with reused IDs from showing old data
        if (customer.isRestoredCustomer && customer.restoredFromTimestamp) {
          // Find the original deleted customer record for metadata
          const restoredFromDeleted = deletedCustomers.find(
            dc => dc.id === customer.restoredFromId && 
                  dc.deletionTimestamp === customer.restoredFromTimestamp &&
                  dc.deletedFrom === day &&
                  !dc.restorationInvalidated  // Ensure restoration is still valid
          );
          
          // Only load archived data if we found valid deleted customer record
          // and data hasn't been migrated yet
          if (restoredFromDeleted && !restoredFromDeleted.isMigrated) {
            const deletedInternalId = restoredFromDeleted.internalId || restoredFromDeleted.id;
            const archivedTransactions = fileManager.readJSON(
              `transactions_deleted/${lineId}/${day}/${deletedInternalId}_${customer.restoredFromTimestamp}.json`
            ) || [];
            const archivedChat = fileManager.readJSON(
              `chat_deleted/${lineId}/${day}/${deletedInternalId}_${customer.restoredFromTimestamp}.json`
            ) || [];
            const archivedRenewals = fileManager.readJSON(
              `renewals_deleted/${lineId}/${day}/${deletedInternalId}_${customer.restoredFromTimestamp}.json`
            ) || [];
            
            // If previous loan was settled (remainingAtDeletion = 0), 
            // only count NEW transactions in balance calculation
            if (restoredFromDeleted.remainingAtDeletion === 0) {
              // Don't add archived to calculation arrays - they're for history only
              // transactions, chatTransactions, renewals remain as current only
            } else {
              // Previous loan had unpaid balance - include in calculation
              transactions = [...archivedTransactions, ...transactions];
              chatTransactions = [...archivedChat, ...chatTransactions];
              renewals = [...archivedRenewals, ...renewals];
            }
          } else if (restoredFromDeleted && restoredFromDeleted.isMigrated && restoredFromDeleted.remainingAtDeletion === 0) {
            // CRITICAL FIX: Data was migrated and old loan was settled
            // Filter out old transactions (those created before restoration) from balance calculation
            const restorationTimestamp = new Date(customer.updatedAt).getTime();
            
            transactions = transactions.filter(t => {
              const transTimestamp = t.createdAt ? new Date(t.createdAt).getTime() : new Date(t.date).getTime();
              return transTimestamp >= restorationTimestamp; // Only keep transactions after restoration
            });
            
            chatTransactions = chatTransactions.filter(c => {
              const chatTimestamp = c.createdAt ? new Date(c.createdAt).getTime() : new Date(c.date).getTime();
              return chatTimestamp >= restorationTimestamp; // Only keep chat after restoration
            });
            
            renewals = renewals.filter(r => {
              const renewalTimestamp = r.renewalDate 
                ? new Date(r.renewalDate).getTime()
                : r.createdAt
                  ? new Date(r.createdAt).getTime()
                  : new Date(r.date).getTime();
              return renewalTimestamp >= restorationTimestamp; // Only keep renewals after restoration
            });
          }
        }
        
        // Calculate totalOwed: If renewals exist, use last renewal amount, otherwise use initial loan
        let totalOwed;
        let latestRenewalDate = null;
        let latestRenewal = null;
        
        if (renewals.length > 0) {
          // Sort renewals by date to get the latest one
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
        
        // Calculate totalPaid: Only count payments made after latest renewal (if exists)
        const allPayments = [...transactions, ...chatTransactions];
        const totalPaid = allPayments.reduce((sum, t) => {
          const paymentDate = new Date(t.createdAt || t.date).getTime();
          // If there's a renewal, only count payments made after it
          if (latestRenewalDate && paymentDate < latestRenewalDate) {
            return sum; // Skip payments before renewal
          }
          return sum + (parseFloat(t.amount) || 0);
        }, 0);
        
        const remainingAmount = totalOwed - totalPaid;
        
        // If there's a renewal, update customer's date, interest, pc, and takenAmount with the latest renewal values
        const customerData = { ...customer };
        if (latestRenewal) {
          customerData.date = latestRenewal.date;
          customerData.interest = latestRenewal.interest !== undefined && latestRenewal.interest !== null ? latestRenewal.interest : customerData.interest;
          customerData.pc = latestRenewal.pc !== undefined && latestRenewal.pc !== null ? latestRenewal.pc : customerData.pc;
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

  // Get specific customer
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
      
      // Add calculated balance like getCustomersByLineAndDay does
      const internalId = _getInternalId(customer);
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // CRITICAL FIX: Only load archived data if this customer has the isRestoredCustomer flag
      // This prevents NEW customers with reused IDs from showing old deleted customer's data
      if (customer.isRestoredCustomer && customer.restoredFromTimestamp) {
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        const restoredFromDeleted = deletedCustomers.find(
          dc => dc.id === customer.restoredFromId && 
                dc.deletionTimestamp === customer.restoredFromTimestamp &&
                dc.deletedFrom === day &&
                !dc.restorationInvalidated
        );
        
        // Only load archived data if we found valid deleted customer record
        // and data hasn't been migrated yet
        if (restoredFromDeleted && !restoredFromDeleted.isMigrated) {
          const deletedInternalId = restoredFromDeleted.internalId || restoredFromDeleted.id;
          const archivedTransactions = fileManager.readJSON(
            `transactions_deleted/${lineId}/${day}/${deletedInternalId}_${restoredFromDeleted.deletionTimestamp}.json`
          ) || [];
          const archivedChat = fileManager.readJSON(
            `chat_deleted/${lineId}/${day}/${deletedInternalId}_${restoredFromDeleted.deletionTimestamp}.json`
          ) || [];
          const archivedRenewals = fileManager.readJSON(
            `renewals_deleted/${lineId}/${day}/${deletedInternalId}_${restoredFromDeleted.deletionTimestamp}.json`
          ) || [];
          
          // If previous loan was settled (remainingAtDeletion = 0), 
          // only count NEW transactions in balance calculation
          if (restoredFromDeleted.remainingAtDeletion === 0) {
            // Don't add archived to calculation arrays - they're for history only
            // transactions, chatTransactions, renewals remain as current only
          } else {
            // Previous loan had unpaid balance - include in calculation
            transactions = [...archivedTransactions, ...transactions];
            chatTransactions = [...archivedChat, ...chatTransactions];
            renewals = [...archivedRenewals, ...renewals];
          }
        } else if (restoredFromDeleted && restoredFromDeleted.isMigrated && restoredFromDeleted.remainingAtDeletion === 0) {
          // CRITICAL FIX: Data was migrated and old loan was settled
          // Filter out old transactions (those created before restoration) from balance calculation
          const restorationTimestamp = new Date(customer.updatedAt).getTime();
          
          transactions = transactions.filter(t => {
            const transTimestamp = t.createdAt ? new Date(t.createdAt).getTime() : new Date(t.date).getTime();
            return transTimestamp >= restorationTimestamp; // Only keep transactions after restoration
          });
          
          chatTransactions = chatTransactions.filter(c => {
            const chatTimestamp = c.createdAt ? new Date(c.createdAt).getTime() : new Date(c.date).getTime();
            return chatTimestamp >= restorationTimestamp; // Only keep chat after restoration
          });
          
          renewals = renewals.filter(r => {
            const renewalTimestamp = r.renewalDate 
              ? new Date(r.renewalDate).getTime()
              : r.createdAt
                ? new Date(r.createdAt).getTime()
                : new Date(r.date).getTime();
            return renewalTimestamp >= restorationTimestamp; // Only keep renewals after restoration
          });
        }
      }
      
      // Calculate totalOwed: If renewals exist, use last renewal amount, otherwise use initial loan
      let totalOwed;
      let latestRenewalDate = null;
      let latestRenewal = null;
      
      if (renewals.length > 0) {
        // Sort renewals by date to get the latest one
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
      
      // Calculate totalPaid: Only count payments made after latest renewal (if exists)
      const allPayments = [...transactions, ...chatTransactions];
      const totalPaid = allPayments.reduce((sum, t) => {
        const paymentDate = new Date(t.createdAt || t.date).getTime();
        // If there's a renewal, only count payments made after it
        if (latestRenewalDate && paymentDate < latestRenewalDate) {
          return sum; // Skip payments before renewal
        }
        return sum + (parseFloat(t.amount) || 0);
      }, 0);
      
      const remainingAmount = totalOwed - totalPaid;
      
      // If there's a renewal, update customer's date, interest, pc, and takenAmount with the latest renewal values
      const customerData = { ...customer };
      if (latestRenewal) {
        customerData.date = latestRenewal.date;
        customerData.interest = latestRenewal.interest || customerData.interest;
        customerData.pc = latestRenewal.pc || customerData.pc;
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

  // Get deleted customer by ID
  async getDeletedCustomerById(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { timestamp } = req.query;
      
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      let customer;
      if (timestamp) {
        // Find by ID and timestamp for exact match
        customer = deletedCustomers.find(c => c.id === id && c.deletionTimestamp === parseInt(timestamp));
      } else {
        // Find by ID only (get the most recent deletion)
        const matchingCustomers = deletedCustomers.filter(c => c.id === id);
        customer = matchingCustomers.length > 0 ? matchingCustomers[matchingCustomers.length - 1] : null;
      }
      
      if (!customer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      // Add calculated balance for deleted customers
      const day = customer.deletedFrom;
      const deletionTimestamp = customer.deletionTimestamp;
      const deletedInternalId = customer.internalId || customer.id;
      
      // Load archived transactions using internalId
      const archivedTransactions = fileManager.readJSON(
        `transactions_deleted/${lineId}/${day}/${deletedInternalId}_${deletionTimestamp}.json`
      ) || [];
      const archivedChat = fileManager.readJSON(
        `chat_deleted/${lineId}/${day}/${deletedInternalId}_${deletionTimestamp}.json`
      ) || [];
      const archivedRenewals = fileManager.readJSON(
        `renewals_deleted/${lineId}/${day}/${deletedInternalId}_${deletionTimestamp}.json`
      ) || [];
      
      // Calculate totalOwed: If renewals exist, use last renewal amount, otherwise use initial loan
      let totalOwed;
      let latestRenewal = null;
      let latestRenewalDate = null;
      
      if (archivedRenewals.length > 0) {
        // Sort renewals by date to get the latest one
        const sortedRenewals = archivedRenewals.sort((a, b) => {
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
      
      // For re-deleted customers (with merged history), we need to separate old and new loan calculations
      let cutoffTimestamp = null;
      if (customer.originalCustomerId && customer.originalDate) {
        // Use the new loan date as cutoff - only count payments after this
        cutoffTimestamp = new Date(customer.date).getTime();
      }
      
      // Calculate totalPaid: Only count payments made after latest renewal OR after new loan date (for re-deletions)
      const allPayments = [...archivedTransactions, ...archivedChat];
      const totalPaid = allPayments.reduce((sum, t) => {
        const paymentDate = new Date(t.date).getTime();
        
        // If this is a re-deletion, only count payments for the CURRENT loan (after cutoff)
        if (cutoffTimestamp && paymentDate < cutoffTimestamp) {
          return sum; // Skip old loan payments
        }
        
        // If there's a renewal, only count payments made after it
        if (latestRenewalDate && paymentDate < latestRenewalDate) {
          return sum; // Skip payments before renewal
        }
        return sum + (parseFloat(t.amount) || 0);
      }, 0);
      
      const remainingAmount = totalOwed - totalPaid;
      
      // If there's a renewal, update customer's date, interest, pc, and takenAmount with the latest renewal values
      const customerData = { ...customer };
      if (latestRenewal) {
        customerData.date = latestRenewal.date;
        customerData.interest = latestRenewal.interest || customerData.interest;
        customerData.pc = latestRenewal.pc || customerData.pc;
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

  // Create customer
  async createCustomer(req, res, next) {
    try {
      const { lineId, day } = req.params;
      
      let customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      
      // Check if customer ID already exists in active customers
      if (customers.find(c => c.id === req.body.id)) {
        return res.status(400).json({ error: 'Customer ID already exists' });
      }
      
      // Check if this ID was previously used by a deleted customer
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const existingDeleted = deletedCustomers.find(
        dc => dc.id === req.body.id && dc.deletedFrom === day
      );
      
      // If creating a NEW customer with an ID that was previously deleted,
      // mark any previous "restored" records as no longer valid for this new customer
      if (existingDeleted && existingDeleted.isRestored) {
        // This is a NEW customer using the same ID - invalidate the old restoration link
        const updatedDeletedCustomers = deletedCustomers.map(dc => {
          if (dc.id === req.body.id && dc.deletedFrom === day && dc.isRestored) {
            return {
              ...dc,
              restorationInvalidated: true,
              invalidatedDate: new Date().toISOString(),
              invalidatedReason: 'New customer created with same ID'
            };
          }
          return dc;
        });
        fileManager.writeJSON(`deleted_customers/${lineId}.json`, updatedDeletedCustomers);
      }
      
      const newCustomer = new Customer(req.body);
      customers.push(newCustomer.toJSON());
      
      fileManager.writeJSON(`customers/${lineId}/${day}.json`, customers);
      
      // INCREMENTAL BF UPDATE: Decrement by principal for NEW loan
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

  // Update customer
  async updateCustomer(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      let customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customerIndex = customers.findIndex(c => c.id === id);
      
      if (customerIndex === -1) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      const customer = customers[customerIndex];
      const internalId = _getInternalId(customer);
      
      // CRITICAL FIX: Check if customer has renewals
      // If yes, update the LATEST renewal's takenAmount instead of customer's takenAmount
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      if (renewals.length > 0 && req.body.takenAmount !== undefined) {
        // Sort renewals by date to get the latest one
        renewals.sort((a, b) => {
          const dateA = new Date(a.renewalDate || a.date).getTime();
          const dateB = new Date(b.renewalDate || b.date).getTime();
          return dateB - dateA;
        });
        
        // Update the latest renewal's takenAmount
        renewals[0].takenAmount = parseFloat(req.body.takenAmount);
        
        // Also update interest, pc, weeks if provided
        if (req.body.interest !== undefined) renewals[0].interest = req.body.interest;
        if (req.body.pc !== undefined) renewals[0].pc = req.body.pc;
        if (req.body.weeks !== undefined) renewals[0].weeks = req.body.weeks;
        
        // Save updated renewals
        fileManager.writeJSON(`renewals/${lineId}/${day}/${internalId}.json`, renewals);
        
        console.log(`✅ Updated latest renewal: takenAmount changed to ₹${req.body.takenAmount}`);
      }
      
      const updatedCustomer = new Customer({
        ...customers[customerIndex],
        ...req.body,
        id // Preserve ID
      });
      
      customers[customerIndex] = updatedCustomer.toJSON();
      fileManager.writeJSON(`customers/${lineId}/${day}.json`, customers);
      
      // DO NOT UPDATE BF - updating customer details doesn't create new transactions
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

  // Delete/archive customer
  async deleteCustomer(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      let customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Use internalId for file operations
      const internalId = _getInternalId(customer);
      
      // Check if customer has cleared balance
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // CRITICAL FIX: If this is a restored customer with migrated data,
      // filter out OLD transactions from the previous loan for balance calculation
      if (customer.isRestoredCustomer && customer.restoredFromTimestamp) {
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        const restoredFromDeleted = deletedCustomers.find(
          dc => dc.id === customer.restoredFromId && 
                dc.deletionTimestamp === customer.restoredFromTimestamp &&
                dc.deletedFrom === day
        );
        
        // If data was migrated AND old loan was settled, only count NEW transactions
        if (restoredFromDeleted && restoredFromDeleted.isMigrated && restoredFromDeleted.remainingAtDeletion === 0) {
          const restorationTimestamp = new Date(customer.updatedAt).getTime();
          
          // Filter to only include transactions AFTER restoration
          transactions = transactions.filter(t => {
            const transTimestamp = t.createdAt ? new Date(t.createdAt).getTime() : new Date(t.date).getTime();
            return transTimestamp >= restorationTimestamp;
          });
          
          chatTransactions = chatTransactions.filter(c => {
            const chatTimestamp = c.createdAt ? new Date(c.createdAt).getTime() : new Date(c.date).getTime();
            return chatTimestamp >= restorationTimestamp;
          });
          
          renewals = renewals.filter(r => {
            const renewalTimestamp = r.renewalDate 
              ? new Date(r.renewalDate).getTime()
              : r.createdAt
                ? new Date(r.createdAt).getTime()
                : new Date(r.date).getTime();
            return renewalTimestamp >= restorationTimestamp;
          });
        }
      }
      
      // Calculate totalOwed: If renewals exist, use last renewal amount, otherwise use initial loan
      let totalOwed;
      let latestRenewalDate = null;
      
      if (renewals.length > 0) {
        // Sort renewals by date to get the latest one
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
      
      // Calculate totalPaid: Only count payments made after latest renewal (if exists)
      const allPayments = [...transactions, ...chatTransactions];
      const totalPaid = allPayments.reduce((sum, t) => {
        const paymentDate = new Date(t.createdAt || t.date).getTime();
        // If there's a renewal, only count payments made after it
        if (latestRenewalDate && paymentDate < latestRenewalDate) {
          return sum; // Skip payments before renewal
        }
        return sum + (parseFloat(t.amount) || 0);
      }, 0);
      
      const remainingAmount = totalOwed - totalPaid;
      
      if (remainingAmount > 0) {
        return res.status(400).json({ 
          error: `Cannot delete customer with pending amount: ₹${remainingAmount.toFixed(2)}` 
        });
      }
      
      // Archive customer data
      const deletionTimestamp = Date.now();
      
      // Check if this customer was previously restored - need to merge old archived data
      let deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      // CRITICAL FIX: Find previous deletion using the customer's restoration metadata
      // If customer has restoredFromInternalId, that's the previous deletion's internalId
      let previousDeletion = null;
      if (customer.isRestoredCustomer && customer.restoredFromInternalId) {
        previousDeletion = deletedCustomers.find(
          dc => dc.internalId === customer.restoredFromInternalId && 
                dc.deletedFrom === day &&
                dc.isRestored === true
        );
      }
      
      // Fallback: Try legacy method (for customers restored before this fix)
      if (!previousDeletion) {
        previousDeletion = deletedCustomers.find(
          dc => dc.isRestored === true && dc.restoredInternalId === internalId && dc.deletedFrom === day
        );
      }
      
      // Prepare data to archive - merge with old data if customer was restored
      let transactionsToArchive = [...transactions];
      let chatToArchive = [...chatTransactions];
      let renewalsToArchive = [...renewals];
      
      // CRITICAL FIX: Walk the COMPLETE restoration chain to collect ALL historical data
      if (previousDeletion && previousDeletion.deletionTimestamp) {
        console.log(`🔍 Customer ${id} was restored, collecting complete historical data...`);
        
        // Collect all historical data by walking the restoration chain
        const allHistoricalTransactions = [];
        const allHistoricalChat = [];
        const allHistoricalRenewals = [];
        
        let currentDeletion = previousDeletion;
        let chainDepth = 0;
        const maxChainDepth = 20; // Prevent infinite loops
        
        while (currentDeletion && chainDepth < maxChainDepth) {
          const currentInternalId = currentDeletion.internalId || currentDeletion.id;
          console.log(`  📦 Level ${chainDepth + 1}: Loading archived data for ${currentInternalId} (deleted at ${currentDeletion.deletionTimestamp})`);
          
          // Load archived data from this level
          const levelTransactions = fileManager.readJSON(
            `transactions_deleted/${lineId}/${day}/${currentInternalId}_${currentDeletion.deletionTimestamp}.json`
          ) || [];
          const levelChat = fileManager.readJSON(
            `chat_deleted/${lineId}/${day}/${currentInternalId}_${currentDeletion.deletionTimestamp}.json`
          ) || [];
          const levelRenewals = fileManager.readJSON(
            `renewals_deleted/${lineId}/${day}/${currentInternalId}_${currentDeletion.deletionTimestamp}.json`
          ) || [];
          
          console.log(`     Found: ${levelTransactions.length} transactions, ${levelChat.length} chat, ${levelRenewals.length} renewals`);
          
          // Add to historical data (in reverse order so oldest is first)
          allHistoricalTransactions.unshift(...levelTransactions);
          allHistoricalChat.unshift(...levelChat);
          allHistoricalRenewals.unshift(...levelRenewals);
          
          // Move to next level in the chain
          if (currentDeletion.wasRestoredCustomer && currentDeletion.restoredFromInternalId) {
            // This deletion was itself a restored customer, walk back further
            currentDeletion = deletedCustomers.find(
              dc => dc.internalId === currentDeletion.restoredFromInternalId && 
                    dc.deletedFrom === day &&
                    dc.isRestored === true
            );
            chainDepth++;
          } else {
            // Reached the original customer
            break;
          }
        }
        
        console.log(`  ✅ Collected ${allHistoricalTransactions.length} historical transactions, ${allHistoricalChat.length} chat, ${allHistoricalRenewals.length} renewals from ${chainDepth + 1} levels`);
        
        // Merge historical data with current data (historical first for chronological order)
        transactionsToArchive = [...allHistoricalTransactions, ...transactions];
        chatToArchive = [...allHistoricalChat, ...chatTransactions];
        renewalsToArchive = [...allHistoricalRenewals, ...renewals];
        
        console.log(`  💾 Total to archive: ${transactionsToArchive.length} transactions, ${chatToArchive.length} chat, ${renewalsToArchive.length} renewals`);
      }
      
      // Archive transactions with merged data using internalId
      const archivedTransKey = `transactions_deleted/${lineId}/${day}/${internalId}_${deletionTimestamp}.json`;
      const archivedChatKey = `chat_deleted/${lineId}/${day}/${internalId}_${deletionTimestamp}.json`;
      const archivedRenewalKey = `renewals_deleted/${lineId}/${day}/${internalId}_${deletionTimestamp}.json`;
      
      if (transactionsToArchive.length > 0) {
        fileManager.writeJSON(archivedTransKey, transactionsToArchive);
      }
      if (chatToArchive.length > 0) {
        fileManager.writeJSON(archivedChatKey, chatToArchive);
      }
      if (renewalsToArchive.length > 0) {
        fileManager.writeJSON(archivedRenewalKey, renewalsToArchive);
      }
      
      // Remove from active customers
      customers = customers.filter(c => c.id !== id);
      fileManager.writeJSON(`customers/${lineId}/${day}.json`, customers);
      
      // Delete transaction files using internalId
      fileManager.deleteJSON(`transactions/${lineId}/${day}/${internalId}.json`);
      fileManager.deleteJSON(`chat/${lineId}/${day}/${internalId}.json`);
      fileManager.deleteJSON(`renewals/${lineId}/${day}/${internalId}.json`);
      
      // Add to deleted customers with current taken amount (totalOwed which includes renewals)
      // Mark previous deletion as merged if it exists
      if (previousDeletion) {
        deletedCustomers = deletedCustomers.map(dc => {
          if (dc.internalId === previousDeletion.internalId && 
              dc.deletionTimestamp === previousDeletion.deletionTimestamp) {
            return {
              ...dc,
              mergedIntoTimestamp: deletionTimestamp,
              mergedDate: new Date().toISOString()
            };
          }
          return dc;
        });
      }
      
      // Create new deleted customer entry with internalId
      // CRITICAL FIX: Properly track the restoration chain for multiple delete-restore cycles
      const newDeletedEntry = {
        ...customer,
        internalId: internalId, // Store internalId for unique identification
        originalTakenAmount: parseFloat(customer.takenAmount) || 0, // Store the ORIGINAL loan amount (before renewals)
        takenAmount: totalOwed, // Store the latest taken amount (including renewals)
        deletedDate: new Date().toISOString().split('T')[0],
        deletedFrom: day,
        remainingAtDeletion: remainingAmount,
        deletionTimestamp,
        // Track the COMPLETE chain: if this customer was restored, link back to its source
        originalCustomerId: previousDeletion ? previousDeletion.id : (customer.restoredFromId || null),
        originalCustomerInternalId: previousDeletion ? previousDeletion.internalId : (customer.restoredFromInternalId || null),
        // Preserve restoration metadata for chain walking
        wasRestoredCustomer: customer.isRestoredCustomer || false,
        restoredFromId: customer.restoredFromId || null,
        restoredFromInternalId: customer.restoredFromInternalId || null,
        restoredFromTimestamp: customer.restoredFromTimestamp || null,
        isRestored: false // Explicitly set to false for new deletion
      };
      
      deletedCustomers.push(newDeletedEntry);
      fileManager.writeJSON(`deleted_customers/${lineId}.json`, deletedCustomers);
      
      res.json({ message: 'Customer deleted and archived successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Restore deleted customer
  async restoreCustomer(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { newId, takenAmount, deletedFrom, interest, pc, date, weeks, deletionTimestamp } = req.body;
      
      // Get deleted customers
      let deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      // CRITICAL FIX: When multiple customers with same ID exist, use deletionTimestamp to identify the exact one
      let deletedCustomer;
      if (deletionTimestamp) {
        deletedCustomer = deletedCustomers.find(c => 
          c.id === id && 
          c.deletedFrom === deletedFrom && 
          c.deletionTimestamp === parseInt(deletionTimestamp)
        );
      } else {
        // Fallback: find the most recent unrestored customer with this ID
        const candidates = deletedCustomers.filter(c => 
          c.id === id && 
          c.deletedFrom === deletedFrom && 
          !c.isRestored
        );
        if (candidates.length > 0) {
          // Get the most recent one
          deletedCustomer = candidates.sort((a, b) => b.deletionTimestamp - a.deletionTimestamp)[0];
        }
      }
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found or already restored' });
      }
      
      // CRITICAL CHECK: Don't allow restoring an already restored customer
      if (deletedCustomer.isRestored) {
        return res.status(400).json({ 
          error: 'This customer has already been restored',
          restoredAs: deletedCustomer.restoredAs,
          restoredDate: deletedCustomer.restoredDate
        });
      }
      
      // Check if new ID already exists in active customers
      const activeCustomers = fileManager.readJSON(`customers/${lineId}/${deletedFrom}.json`) || [];
      if (activeCustomers.find(c => c.id === newId)) {
        return res.status(400).json({ error: 'Customer ID already exists' });
      }
      
      // Create restored customer with new ID and NEW internalId
      // Use explicit undefined checks to allow 0 values for interest and pc
      // CRITICAL FIX: Don't spread deletedCustomer because it includes old internalId
      // CRITICAL FIX 2: If no takenAmount provided or deleted customer had cleared balance,
      // restore with takenAmount=0 to allow new loans via renewal
      const finalTakenAmount = (takenAmount && takenAmount > 0) ? takenAmount : 0;
      
      const restoredCustomer = new Customer({
        id: newId,
        name: deletedCustomer.name,
        village: deletedCustomer.village,
        phone: deletedCustomer.phone,
        profileImage: deletedCustomer.profileImage,
        // DON'T pass internalId - let Customer model generate a NEW unique internalId
        // This ensures the new customer has its own unique internal identifier
        takenAmount: finalTakenAmount,
        interest: interest !== undefined && interest !== null ? interest : deletedCustomer.interest,
        pc: pc !== undefined && pc !== null ? pc : deletedCustomer.pc,
        date: date || new Date().toISOString().split('T')[0],
        weeks: weeks || deletedCustomer.weeks,
        isRestoredCustomer: true,  // Flag to identify this as a restored customer
        restoredFromId: id,        // Original deleted customer ID
        restoredFromInternalId: deletedCustomer.internalId || deletedCustomer.id, // Original internal ID for data access
        restoredFromTimestamp: deletedCustomer.deletionTimestamp
      });
      
      // Add to active customers
      activeCustomers.push(restoredCustomer.toJSON());
      fileManager.writeJSON(`customers/${lineId}/${deletedFrom}.json`, activeCustomers);
      
      // ===== COMPLETE DATA MIGRATION LOGIC =====
      // Migrate ALL historical data (archived + already migrated) to new customer
      let migrationSuccess = true;
      const migrationErrors = [];
      
      try {
        const deletionTimestamp = deletedCustomer.deletionTimestamp;
        
        if (deletionTimestamp) {
          const deletedInternalId = deletedCustomer.internalId || deletedCustomer.id;
          const restoredInternalId = restoredCustomer.internalId;
          
          console.log(`🔄 Starting migration from ${id} (${deletedInternalId}) to ${newId} (${restoredInternalId})`);
          
          // Define archived file paths using deleted customer's internalId
          const archivedPaths = {
            transactions: `transactions_deleted/${lineId}/${deletedFrom}/${deletedInternalId}_${deletionTimestamp}.json`,
            chat: `chat_deleted/${lineId}/${deletedFrom}/${deletedInternalId}_${deletionTimestamp}.json`,
            renewals: `renewals_deleted/${lineId}/${deletedFrom}/${deletedInternalId}_${deletionTimestamp}.json`
          };
          
          // CRITICAL: Check if deleted customer itself was a restored customer with ACTIVE migrated data
          // This handles multi-level restorations (e.g., customer deleted 3 times)
          const deletedCustomerActivePaths = {
            transactions: `transactions/${lineId}/${deletedFrom}/${deletedInternalId}.json`,
            chat: `chat/${lineId}/${deletedFrom}/${deletedInternalId}.json`,
            renewals: `renewals/${lineId}/${deletedFrom}/${deletedInternalId}.json`
          };
          
          // Define new active file paths using new customer's internalId
          const restoredCustomerPaths = {
            transactions: `transactions/${lineId}/${deletedFrom}/${restoredInternalId}.json`,
            chat: `chat/${lineId}/${deletedFrom}/${restoredInternalId}.json`,
            renewals: `renewals/${lineId}/${deletedFrom}/${restoredInternalId}.json`
          };
          
          // Migrate each data type with COMPLETE history
          for (const [dataType, archivedPath] of Object.entries(archivedPaths)) {
            try {
              // STEP 1: Read archived data from deletion (might be empty if already migrated before)
              const archivedData = fileManager.readJSON(archivedPath) || [];
              console.log(`  📦 Found ${archivedData.length} ${dataType} in archived (${archivedPath})`);
              
              // STEP 2: Read the deleted customer's ACTIVE data (contains previously migrated data)
              // This is the key fix - we need to carry forward ALL historical data!
              const deletedCustomerActiveData = fileManager.readJSON(deletedCustomerActivePaths[dataType]) || [];
              console.log(`  📦 Found ${deletedCustomerActiveData.length} ${dataType} in deleted customer's active files`);
              
              // STEP 3: Read new customer's existing data (might have new transactions already)
              const newCustomerExistingData = fileManager.readJSON(restoredCustomerPaths[dataType]) || [];
              console.log(`  📦 Found ${newCustomerExistingData.length} ${dataType} in new customer's files`);
              
              // STEP 4: Merge ALL data in chronological order
              // Order: archived (oldest) → deleted customer's active data → new customer's existing data
              const completeHistoricalData = [
                ...archivedData,
                ...deletedCustomerActiveData,
                ...newCustomerExistingData
              ];
              
              console.log(`  🔀 Total ${dataType} after merge: ${completeHistoricalData.length}`);
              
              if (completeHistoricalData.length > 0) {
                // Write complete merged data to new customer's file
                const writeSuccess = fileManager.writeJSON(restoredCustomerPaths[dataType], completeHistoricalData);
                
                if (writeSuccess) {
                  console.log(`  ✅ Migrated ${completeHistoricalData.length} ${dataType} records from ${id} to ${newId}`);
                  
                  // CRITICAL FIX: DO NOT clear archived data or delete active files
                  // Keep the complete history in archived files to support multiple delete-restore cycles
                  // If we clear/delete here, the next deletion will lose historical data
                  
                  // Instead, write the COMPLETE historical data to the archived file
                  // This ensures the full chain is preserved for future restorations
                  if (archivedData.length > 0 || deletedCustomerActiveData.length > 0) {
                    // Merge archived + deleted customer's active data (exclude new customer's data)
                    const historicalDataToPreserve = [...archivedData, ...deletedCustomerActiveData];
                    fileManager.writeJSON(archivedPath, historicalDataToPreserve);
                    console.log(`  💾 Preserved ${historicalDataToPreserve.length} historical ${dataType} in archived for future restorations`);
                  }
                  
                  // Delete the deleted customer's active files ONLY (data now in new customer + archived)
                  fileManager.deleteJSON(deletedCustomerActivePaths[dataType]);
                  console.log(`  🗑️  Cleaned up active file for ${deletedInternalId}`);
                } else {
                  migrationErrors.push(`Failed to write ${dataType} data`);
                  migrationSuccess = false;
                }
              } else {
                console.log(`  ℹ️  No ${dataType} data to migrate`);
              }
            } catch (err) {
              console.error(`  ❌ Error migrating ${dataType}:`, err);
              migrationErrors.push(`${dataType}: ${err.message}`);
              migrationSuccess = false;
            }
          }
          
          console.log(`✅ Migration complete: ${migrationSuccess ? 'SUCCESS' : 'FAILED'}`);
        } else {
          console.warn('⚠️ No deletion timestamp found for customer, skipping data migration');
        }
      } catch (migrationError) {
        console.error('❌ Error during data migration:', migrationError);
        migrationErrors.push(`General migration error: ${migrationError.message}`);
        migrationSuccess = false;
      }
      
      // Mark as restored in deleted list with migration status
      // CRITICAL FIX: Only mark the SPECIFIC deleted customer by matching deletionTimestamp
      deletedCustomers = deletedCustomers.map(c => {
        if (c.id === id && 
            c.deletedFrom === deletedFrom && 
            c.deletionTimestamp === deletedCustomer.deletionTimestamp) {
          return {
            ...c,
            isRestored: true,
            restoredAs: newId,
            restoredInternalId: restoredCustomer.internalId, // Store new internalId for future lookups
            restoredDate: new Date().toISOString(),
            isMigrated: migrationSuccess,
            migrationErrors: migrationErrors.length > 0 ? migrationErrors : undefined
          };
        }
        return c;
      });
      fileManager.writeJSON(`deleted_customers/${lineId}.json`, deletedCustomers);
      
      // INCREMENTAL BF UPDATE: Restore itself doesn't affect BF,
      // but if a NEW loan is being created (takenAmount provided), decrement BF by principal
      let newBF;
      if (takenAmount && takenAmount > 0) {
        const newInterest = interest !== undefined && interest !== null ? parseFloat(interest) : parseFloat(deletedCustomer.interest) || 0;
        const newPc = pc !== undefined && pc !== null ? parseFloat(pc) : parseFloat(deletedCustomer.pc) || 0;
        const newPrincipal = parseFloat(takenAmount) - newInterest - newPc;
        
        console.log(`💰 Restore with NEW loan: takenAmount=${takenAmount}, interest=${newInterest}, pc=${newPc}, principal=${newPrincipal}`);
        
        const bfResult = bfCalculation.decrementBF(lineId, newPrincipal);
        newBF = bfResult.bfAmount;
      } else {
        // No new loan - just restoring to show history, BF unchanged
        const lines = fileManager.readJSON('lines.json') || [];
        const line = lines.find(l => l.id === lineId);
        newBF = line ? line.currentBF : 0;
      }
      
      res.status(201).json({
        message: migrationSuccess 
          ? 'Customer restored and data migrated successfully'
          : 'Customer restored but data migration had issues',
        customer: restoredCustomer.toJSON(),
        newBF: newBF,
        migrationStatus: {
          success: migrationSuccess,
          errors: migrationErrors
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get customer transactions
  async getCustomerTransactions(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      // Get customer details first
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Use internalId for file operations
      const internalId = _getInternalId(customer);
      
      // Get current transactions using internalId
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      let archivedCustomerData = null;
      
      // Only load archived data if this is truly a restored customer (has the flag)
      // This prevents NEW customers with reused IDs from showing old data
      if (customer && customer.isRestoredCustomer && customer.restoredFromTimestamp) {
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        const restoredFromDeleted = deletedCustomers.find(
          dc => dc.id === customer.restoredFromId && 
                dc.deletionTimestamp === customer.restoredFromTimestamp &&
                dc.deletedFrom === day &&
                !dc.restorationInvalidated
        );
        
        // If customer was restored but data was NOT migrated (legacy case)
        // Include archived transactions for HISTORY
        if (restoredFromDeleted && !restoredFromDeleted.isMigrated) {
        const deletedInternalId = restoredFromDeleted.internalId || restoredFromDeleted.id;
        const archivedTransactions = fileManager.readJSON(
          `transactions_deleted/${lineId}/${day}/${deletedInternalId}_${restoredFromDeleted.deletionTimestamp}.json`
        ) || [];
        
        // Only add if there's archived data (not migrated yet)
        if (archivedTransactions.length > 0) {
          // Mark archived transactions with flag to indicate they're from a closed account
          const markedArchived = archivedTransactions.map(t => ({
            ...t,
            isArchived: true,
            isSettled: restoredFromDeleted.remainingAtDeletion === 0
          }));
          
          // Prepend archived transactions (they come first chronologically)
          transactions = [...markedArchived, ...transactions];
        }
        
        // Include archived customer data for showing old loan in UI
        archivedCustomerData = {
          takenAmount: restoredFromDeleted.takenAmount,
          date: restoredFromDeleted.date,
          isSettled: restoredFromDeleted.remainingAtDeletion === 0
        };
        } else if (restoredFromDeleted && restoredFromDeleted.isMigrated) {
          // Data was migrated - all transactions are already in the main array
          // Just provide metadata about the previous loan for UI display
          archivedCustomerData = {
            takenAmount: restoredFromDeleted.takenAmount,
            date: restoredFromDeleted.date,
            isSettled: restoredFromDeleted.remainingAtDeletion === 0,
            isMigrated: true
          };
        }
      }
      
      res.json({ 
        transactions,
        archivedCustomer: archivedCustomerData
      });
    } catch (error) {
      next(error);
    }
  }

  // Get customer renewals
  async getCustomerRenewals(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      // Get customer details first
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Use internalId for file operations
      const internalId = _getInternalId(customer);
      
      // Get current renewals using internalId
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // Only load archived data if this is truly a restored customer (has the flag)
      if (customer && customer.isRestoredCustomer && customer.restoredFromTimestamp) {
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        const restoredFromDeleted = deletedCustomers.find(
          dc => dc.id === customer.restoredFromId && 
                dc.deletionTimestamp === customer.restoredFromTimestamp &&
                dc.deletedFrom === day &&
                !dc.restorationInvalidated
        );
        
        // If customer was restored but data was NOT migrated (legacy case)
        // Include archived renewals for HISTORY
        if (restoredFromDeleted && !restoredFromDeleted.isMigrated) {
        const deletedInternalId = restoredFromDeleted.internalId || restoredFromDeleted.id;
        const archivedRenewals = fileManager.readJSON(
          `renewals_deleted/${lineId}/${day}/${deletedInternalId}_${restoredFromDeleted.deletionTimestamp}.json`
        ) || [];
        
        // Only add if there's archived data (not migrated yet)
        if (archivedRenewals.length > 0) {
          // Mark archived renewals
          const markedArchived = archivedRenewals.map(r => ({
            ...r,
            isArchived: true,
            isSettled: restoredFromDeleted.remainingAtDeletion === 0
          }));
          
          // Prepend archived renewals (they come first chronologically)
          renewals = [...markedArchived, ...renewals];
        }
        }
      }
      
      res.json({ renewals });
    } catch (error) {
      next(error);
    }
  }

  // Create renewal for customer
  async createRenewal(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      const { takenAmount, interest, pc, date, weeks } = req.body;
      
      // Check if customer exists
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Use internalId for file operations
      const internalId = _getInternalId(customer);
      
      // Check if customer has cleared balance
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // Check if this customer was restored from a deleted customer
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const restoredFromDeleted = deletedCustomers.find(
        dc => dc.isRestored === true && dc.restoredAs === id && dc.deletedFrom === day
      );
      
      // CRITICAL FIX: For restored customers with settled previous loan (remainingAtDeletion=0),
      // do NOT include archived data AND ignore old loan for balance check
      const isRestoredWithSettledLoan = restoredFromDeleted && 
                                        restoredFromDeleted.deletionTimestamp && 
                                        restoredFromDeleted.remainingAtDeletion === 0;
      
      // Only include archived data in balance calculation if there was unpaid amount at deletion
      if (restoredFromDeleted && restoredFromDeleted.deletionTimestamp && restoredFromDeleted.remainingAtDeletion > 0) {
        const deletedInternalId = restoredFromDeleted.internalId || restoredFromDeleted.id;
        const archivedTransactions = fileManager.readJSON(
          `transactions_deleted/${lineId}/${day}/${deletedInternalId}_${restoredFromDeleted.deletionTimestamp}.json`
        ) || [];
        const archivedChat = fileManager.readJSON(
          `chat_deleted/${lineId}/${day}/${deletedInternalId}_${restoredFromDeleted.deletionTimestamp}.json`
        ) || [];
        const archivedRenewals = fileManager.readJSON(
          `renewals_deleted/${lineId}/${day}/${deletedInternalId}_${restoredFromDeleted.deletionTimestamp}.json`
        ) || [];
        
        transactions = [...archivedTransactions, ...transactions];
        chatTransactions = [...archivedChat, ...chatTransactions];
        renewals = [...archivedRenewals, ...renewals];
      }
      
      // Calculate totalOwed: If renewals exist, use last renewal amount, otherwise use initial loan
      let totalOwed;
      let latestRenewalDate = null;
      
      if (renewals.length > 0) {
        // Sort renewals by date to get the latest one
        const sortedRenewals = renewals.sort((a, b) => {
          const dateA = new Date(a.renewalDate || a.date).getTime();
          const dateB = new Date(b.renewalDate || b.date).getTime();
          return dateB - dateA;
        });
        const latestRenewal = sortedRenewals[0];
        totalOwed = parseFloat(latestRenewal.takenAmount) || 0;
        latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
      } else {
        // CRITICAL FIX: If customer was restored with settled loan and takenAmount=0,
        // consider no active loan (allows immediate renewal)
        if (isRestoredWithSettledLoan && parseFloat(customer.takenAmount) === 0) {
          totalOwed = 0;
        } else {
          totalOwed = parseFloat(customer.takenAmount) || 0;
        }
      }
      
      // Calculate totalPaid: Only count payments made after latest renewal (if exists)
      const allPayments = [...transactions, ...chatTransactions];
      const totalPaid = allPayments.reduce((sum, t) => {
        const paymentDate = new Date(t.createdAt || t.date).getTime();
        // If there's a renewal, only count payments made after it
        if (latestRenewalDate && paymentDate < latestRenewalDate) {
          return sum; // Skip payments before renewal
        }
        return sum + (parseFloat(t.amount) || 0);
      }, 0);
      
      const remainingAmount = totalOwed - totalPaid;
      
      console.log(`📊 Renewal balance check: totalOwed=${totalOwed}, totalPaid=${totalPaid}, remaining=${remainingAmount}, isRestoredWithSettled=${isRestoredWithSettledLoan}`);
      
      if (remainingAmount > 0) {
        return res.status(400).json({ 
          error: `Customer has pending balance: ₹${remainingAmount.toFixed(2)}. Please clear before renewal.` 
        });
      }
      
      // Create renewal
      // Use explicit undefined checks to allow 0 values for interest and pc
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
      
      // Don't modify the customer record - keep original values for history
      // The renewal data is stored separately and will be used for calculations
      
      // INCREMENTAL BF UPDATE: Renewal is treated as a NEW loan - decrement by principal
      const renewalTakenAmount = parseFloat(takenAmount);
      const renewalInterest = interest !== undefined && interest !== null ? parseFloat(interest) : parseFloat(customer.interest) || 0;
      const renewalPc = pc !== undefined && pc !== null ? parseFloat(pc) : parseFloat(customer.pc) || 0;
      const renewalPrincipal = renewalTakenAmount - renewalInterest - renewalPc;
      
      const bfResult = bfCalculation.decrementBF(lineId, renewalPrincipal);
      
      res.status(201).json({
        message: 'Renewal created successfully',
        renewal: newRenewal,
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  // Get customer chat
  async getCustomerChat(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      // Get customer details
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Use internalId for file operations
      const internalId = _getInternalId(customer);
      
      // Get current chat transactions, regular transactions, and renewals
      // NOTE: If data was migrated, these files already contain ALL historical data
      let chat = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      let archivedCustomersDataList = []; // Array to store ALL previous loans in the chain
      let restoredFromDeleted = null; // Store the immediate previous deletion
      
      // COMPLETE RESTORATION CHAIN WALKING - Handles unlimited delete/restore cycles
      // This walks through EVERY previous deletion to collect ALL loan history
      if (customer.isRestoredCustomer && customer.restoredFromTimestamp) {
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        
        // Start with the immediate previous deletion (the one THIS customer was restored from)
        let currentDeletedCustomer = deletedCustomers.find(
          dc => dc.internalId === customer.restoredFromInternalId && 
                dc.deletionTimestamp === customer.restoredFromTimestamp &&
                dc.deletedFrom === day &&
                !dc.restorationInvalidated
        );
        
        restoredFromDeleted = currentDeletedCustomer; // Store immediate previous for later use
        
        // Walk backwards through the ENTIRE chain of deletions
        const processedDeletions = new Set(); // Prevent infinite loops
        
        while (currentDeletedCustomer && !processedDeletions.has(currentDeletedCustomer.deletionTimestamp)) {
          processedDeletions.add(currentDeletedCustomer.deletionTimestamp);
          
          console.log(`📜 Processing deletion chain: ID ${currentDeletedCustomer.id}, internalId ${currentDeletedCustomer.internalId}, timestamp ${currentDeletedCustomer.deletionTimestamp}`);
          
          // If data was NOT migrated, we need to manually load archived data from deleted files
          // Migrated data is already in the current customer's transaction files
          if (!currentDeletedCustomer.isMigrated) {
            const deletedInternalId = currentDeletedCustomer.internalId || currentDeletedCustomer.id;
            const archivedChat = fileManager.readJSON(
              `chat_deleted/${lineId}/${day}/${deletedInternalId}_${currentDeletedCustomer.deletionTimestamp}.json`
            ) || [];
            const archivedTransactions = fileManager.readJSON(
              `transactions_deleted/${lineId}/${day}/${deletedInternalId}_${currentDeletedCustomer.deletionTimestamp}.json`
            ) || [];
            const archivedRenewals = fileManager.readJSON(
              `renewals_deleted/${lineId}/${day}/${deletedInternalId}_${currentDeletedCustomer.deletionTimestamp}.json`
            ) || [];
            
            console.log(`  📦 Loaded ${archivedTransactions.length} transactions, ${archivedChat.length} chat, ${archivedRenewals.length} renewals from archived files`);
            
            // Only add if there's archived data
            if (archivedChat.length > 0 || archivedTransactions.length > 0 || archivedRenewals.length > 0) {
              // Mark archived items with metadata
              const markedArchivedChat = archivedChat.map(c => ({
                ...c,
                isArchived: true,
                isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
                fromDeletion: currentDeletedCustomer.deletionTimestamp
              }));
              const markedArchivedTransactions = archivedTransactions.map(t => ({
                ...t,
                isArchived: true,
                isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
                fromDeletion: currentDeletedCustomer.deletionTimestamp
              }));
              const markedArchivedRenewals = archivedRenewals.map(r => ({
                ...r,
                isArchived: true,
                isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
                fromDeletion: currentDeletedCustomer.deletionTimestamp
              }));
              
              // Prepend archived data (oldest first for chronological order)
              chat = [...markedArchivedChat, ...chat];
              transactions = [...markedArchivedTransactions, ...transactions];
              renewals = [...markedArchivedRenewals, ...renewals];
            }
          } else {
            console.log(`  ✅ Data already migrated for this deletion`);
          }
          
          // Add this deleted customer's loan info to the list for display
          archivedCustomersDataList.push({
            takenAmount: currentDeletedCustomer.originalTakenAmount || currentDeletedCustomer.takenAmount,
            date: currentDeletedCustomer.date,
            name: currentDeletedCustomer.name,
            createdAt: currentDeletedCustomer.createdAt,
            isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
            isArchived: true,
            isMigrated: currentDeletedCustomer.isMigrated || false,
            deletionTimestamp: currentDeletedCustomer.deletionTimestamp,
            internalId: currentDeletedCustomer.internalId,
            isRestoredCustomer: currentDeletedCustomer.isRestoredCustomer || currentDeletedCustomer.wasRestoredCustomer || false
          });
          
          // Walk back: Check if THIS deleted customer was itself a restored customer
          // If yes, find the PREVIOUS deletion it was restored from
          // CRITICAL FIX: Try multiple methods to find the chain link
          let previousDeletionInChain = null;
          
          // Method 1: Use restoredFromInternalId (most reliable for newly restored customers)
          if (currentDeletedCustomer.restoredFromInternalId) {
            console.log(`  ⬅️  Walking back using restoredFromInternalId: ${currentDeletedCustomer.restoredFromInternalId}`);
            previousDeletionInChain = deletedCustomers.find(
              dc => dc.internalId === currentDeletedCustomer.restoredFromInternalId &&
                    dc.deletedFrom === day &&
                    !dc.restorationInvalidated
            );
          }
          
          // Method 2: Fallback to originalCustomerInternalId (for legacy data)
          if (!previousDeletionInChain && currentDeletedCustomer.originalCustomerInternalId) {
            console.log(`  ⬅️  Fallback: Walking back using originalCustomerInternalId: ${currentDeletedCustomer.originalCustomerInternalId}`);
            previousDeletionInChain = deletedCustomers.find(
              dc => dc.internalId === currentDeletedCustomer.originalCustomerInternalId &&
                    dc.deletedFrom === day &&
                    !dc.restorationInvalidated
            );
          }
          
          if (previousDeletionInChain) {
            console.log(`  ✅ Found previous deletion: internalId ${previousDeletionInChain.internalId}`);
            currentDeletedCustomer = previousDeletionInChain;
          } else {
            // No more previous deletions - we've reached the ORIGINAL first loan
            console.log(`  🏁 Reached original first loan (no more chain links)`);
            break;
          }
        }
        
        // Reverse the list so oldest loan appears FIRST (chronological order)
        archivedCustomersDataList.reverse();
        console.log(`📊 Total loans in chain: ${archivedCustomersDataList.length + 1} (${archivedCustomersDataList.length} archived + 1 current)`);
      }
      
      // Create a complete timeline with ALL events sorted chronologically
      const timeline = [];
      
      // Add ALL archived customer loans from the ENTIRE restoration chain
      // This ensures ALL previous loans are displayed (e.g., ₹5000 → ₹1000 → ₹2000)
      if (archivedCustomersDataList.length > 0) {
        archivedCustomersDataList.forEach((archivedCustomerData, index) => {
          timeline.push({
            type: 'loan',
            date: archivedCustomerData.date,
            amount: archivedCustomerData.takenAmount,
            timestamp: new Date(archivedCustomerData.createdAt || archivedCustomerData.date).getTime(),
            createdAt: archivedCustomerData.createdAt || archivedCustomerData.date,
            isArchived: true,
            isSettled: archivedCustomerData.isSettled,
            isMigrated: archivedCustomerData.isMigrated,
            isRestored: archivedCustomerData.isRestoredCustomer === true, // Mark if this was a restored loan
            customerName: archivedCustomerData.name,
            isFirstLoan: index === 0, // Mark the very first loan ever
            loanNumber: index + 1, // Loan sequence: 1, 2, 3, etc.
            tag: index === 0 ? 'ORIGINAL LOAN' : `RESTORED LOAN #${index}`
          });
        });
      }
      
      // Add current customer's initial loan (NEW loan after latest restoration)
      const customerTimestamp = customer.updatedAt 
        ? new Date(customer.updatedAt).getTime() 
        : new Date(customer.createdAt || customer.date).getTime();
      
      const currentLoanNumber = archivedCustomersDataList.length + 1;
      
      timeline.push({
        type: 'loan',
        date: customer.date,
        amount: customer.takenAmount,
        timestamp: customerTimestamp,
        createdAt: customer.updatedAt || customer.createdAt || customer.date,
        isArchived: false,
        isSettled: false,
        isRestored: customer.isRestoredCustomer === true,
        customerName: customer.name,
        isCurrent: true,
        loanNumber: currentLoanNumber,
        tag: customer.isRestoredCustomer ? `RESTORED LOAN #${archivedCustomersDataList.length}` : 'NEW LOAN'
      });
      
      // Determine restoration timestamp for marking old data (when using migrated data)
      const restorationTimestamp = customer.updatedAt ? new Date(customer.updatedAt).getTime() : null;
      const isRestoredAndMigrated = restoredFromDeleted && restoredFromDeleted.isMigrated;
      
      // Add renewals with proper tagging
      renewals.forEach(renewal => {
        const renewalTimestamp = renewal.renewalDate 
          ? new Date(renewal.renewalDate).getTime()
          : renewal.createdAt
            ? new Date(renewal.createdAt).getTime()
            : new Date(renewal.date).getTime();
        
        // For migrated data: mark renewals before restoration as archived
        const isOldRenewal = isRestoredAndMigrated && 
                            restorationTimestamp && 
                            renewalTimestamp < restorationTimestamp;
        
        // For non-migrated data: renewal already has isArchived flag
        const archived = renewal.isArchived || isOldRenewal;
        const settled = renewal.isSettled || (isOldRenewal && restoredFromDeleted.remainingAtDeletion === 0);
        
        timeline.push({
          type: 'renewal',
          date: renewal.date,
          amount: renewal.takenAmount,
          timestamp: renewalTimestamp,
          createdAt: renewal.renewalDate || renewal.createdAt || renewal.date,
          isArchived: archived,
          isSettled: settled,
          customerName: renewal.customerName || customer.name,
          tag: archived ? (settled ? 'RENEWAL (Settled)' : 'RENEWAL (Archived)') : 'RENEWAL'
        });
      });
      
      // Add regular transactions (payments) with proper tagging
      transactions.forEach(trans => {
        const transTimestamp = trans.createdAt 
          ? new Date(trans.createdAt).getTime()
          : new Date(trans.date).getTime();
        
        // For migrated data: mark transactions before restoration as archived
        const isOldTransaction = isRestoredAndMigrated && 
                                 restorationTimestamp && 
                                 transTimestamp < restorationTimestamp;
        
        // For non-migrated data: transaction already has isArchived flag
        const archived = trans.isArchived || isOldTransaction;
        const settled = trans.isSettled || (isOldTransaction && restoredFromDeleted.remainingAtDeletion === 0);
        
        timeline.push({
          id: trans.id,
          type: 'payment',
          date: trans.date,
          amount: trans.amount,
          comment: trans.comment,
          timestamp: transTimestamp,
          createdAt: trans.createdAt || trans.date,
          isArchived: archived,
          isSettled: settled,
          isEdited: trans.isEdited || false,
          editedAt: trans.editedAt || null,
          customerName: trans.customerName || customer.name,
          tag: archived ? (settled ? 'PAYMENT (Settled Loan)' : 'PAYMENT (Previous Loan)') : 'PAYMENT'
        });
      });
      
      // Add chat transactions (payments via chat) with proper tagging
      chat.forEach(chatItem => {
        const chatTimestamp = chatItem.createdAt 
          ? new Date(chatItem.createdAt).getTime()
          : new Date(chatItem.date).getTime();
        
        // For migrated data: mark chat before restoration as archived
        const isOldChat = isRestoredAndMigrated && 
                         restorationTimestamp && 
                         chatTimestamp < restorationTimestamp;
        
        // For non-migrated data: chat already has isArchived flag
        const archived = chatItem.isArchived || isOldChat;
        const settled = chatItem.isSettled || (isOldChat && restoredFromDeleted.remainingAtDeletion === 0);
        
        timeline.push({
          id: chatItem.id,
          type: 'payment',
          date: chatItem.date,
          amount: chatItem.amount,
          comment: chatItem.comment || chatItem.message,
          timestamp: chatTimestamp,
          createdAt: chatItem.createdAt || chatItem.date,
          isArchived: archived,
          isSettled: settled,
          isEdited: chatItem.isEdited || false,
          editedAt: chatItem.editedAt || null,
          customerName: chatItem.customerName || customer.name,
          tag: archived ? (settled ? 'PAYMENT (Settled Loan)' : 'PAYMENT (Previous Loan)') : 'PAYMENT'
        });
      });
      
      // Sort timeline by timestamp (chronological order - oldest first)
      timeline.sort((a, b) => a.timestamp - b.timestamp);
      
      res.json({ 
        chat: timeline,
        customer: {
          id: customer.id,
          name: customer.name,
          takenAmount: customer.takenAmount,
          date: customer.date
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Add chat transaction
  async addChatTransaction(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      const { amount, date, comment, message } = req.body;
      
      // Get customer name
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Use internalId for file operations
      const internalId = _getInternalId(customer);
      
      let chat = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      
      // Handle comment-only message (when 'message' is sent instead of amount)
      if (message && !amount) {
        const commentEntry = {
          type: 'comment',
          message: message,
          date: new Date().toISOString(),
          timestamp: Date.now()
        };
        
        chat.push(commentEntry);
        fileManager.writeJSON(`chat/${lineId}/${day}/${internalId}.json`, chat);
        
        return res.status(201).json({
          message: 'Comment added successfully',
          comment: commentEntry
        });
      }
      
      // Handle transaction with optional comment
      const newTransaction = new Transaction({
        amount: parseFloat(amount),
        date,
        comment: comment || '',
        customerName: customer.name
      });
      
      chat.push(newTransaction.toJSON());
      fileManager.writeJSON(`chat/${lineId}/${day}/${internalId}.json`, chat);
      
      // Update BF
      const bfResult = bfCalculation.updateBF(lineId);
      
      res.status(201).json({
        message: 'Chat transaction added successfully',
        transaction: newTransaction.toJSON(),
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all pending customers across all days for a line
  async getPendingCustomers(req, res, next) {
    try {
      const { lineId } = req.params;
      
      // Get all days for this line from days/{lineId}.json
      const days = fileManager.readJSON(`days/${lineId}.json`) || [];
      if (!days || days.length === 0) {
        return res.json({ pendingCustomers: [] });
      }
      
      const allPendingCustomers = [];
      
      for (const day of days) {
        const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
        
        for (const customer of customers) {
          const internalId = _getInternalId(customer);
          const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
          const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
          const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
          
          // Calculate totalOwed: If renewals exist, use last renewal amount, otherwise use initial loan
          let totalOwed;
          let latestRenewalDate = null;
          let latestRenewal = null;
          
          if (renewals.length > 0) {
            // Sort renewals by date to get the latest one
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
          
          // Calculate totalPaid: Only count payments made after latest renewal (if exists)
          const allPayments = [...transactions, ...chatTransactions];
          const totalPaid = allPayments.reduce((sum, t) => {
            const paymentDate = new Date(t.createdAt || t.date).getTime();
            // If there's a renewal, only count payments made after it
            if (latestRenewalDate && paymentDate < latestRenewalDate) {
              return sum; // Skip payments before renewal
            }
            return sum + (parseFloat(t.amount) || 0);
          }, 0);
          
          const remainingAmount = totalOwed - totalPaid;
          
          // If there's a renewal, update customer data with the latest renewal values
          const customerData = { ...customer };
          if (latestRenewal) {
            customerData.date = latestRenewal.date;
            customerData.interest = latestRenewal.interest || customerData.interest;
            customerData.pc = latestRenewal.pc || customerData.pc;
            customerData.weeks = latestRenewal.weeks || customerData.weeks;
            customerData.takenAmount = latestRenewal.takenAmount;
          }
          
          // Calculate due date and check if overdue - use the effective date (renewal date if exists)
          const effectiveDate = new Date(customerData.date);
          const weeksCount = parseInt(customerData.weeks) || 12;
          const expectedEndDate = new Date(effectiveDate);
          expectedEndDate.setDate(expectedEndDate.getDate() + (weeksCount * 7));
          const today = new Date();
          const daysOverdue = Math.floor((today - expectedEndDate) / (1000 * 60 * 60 * 24));
          
          // Only add to pending if remaining amount > 0 AND due date has passed
          if (remainingAmount > 0 && today > expectedEndDate) {
            allPendingCustomers.push({
              ...customerData,
              dayName: day,
              totalOwed,
              totalPaid,
              remainingAmount,
              daysOverdue: Math.max(0, daysOverdue),
              dueDate: expectedEndDate.toISOString().split('T')[0]
            });
          }
        }
      }
      
      res.json({ pendingCustomers: allPendingCustomers });
    } catch (error) {
      next(error);
    }
  }

  // Get all deleted customers for a line
  async getDeletedCustomers(req, res, next) {
    try {
      const { lineId } = req.params;
      
      const allDeletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      // Filter out restored customers (those with isRestored: true)
      const deletedCustomers = allDeletedCustomers.filter(c => !c.isRestored);
      
      // Calculate display taken amount for each deleted customer (based on renewals)
      const deletedCustomersWithDisplayAmount = deletedCustomers.map(customer => {
        const day = customer.deletedFrom;
        const timestamp = customer.deletionTimestamp;
        const deletedInternalId = customer.internalId || customer.id;
        
        // Load archived renewals using internalId
        const archivedRenewals = fileManager.readJSON(
          `renewals_deleted/${lineId}/${day}/${deletedInternalId}_${timestamp}.json`
        ) || [];
        
        // Calculate display amount: If renewals exist, use last renewal amount, otherwise use initial loan
        let displayTakenAmount;
        if (archivedRenewals.length > 0) {
          // Sort renewals by date to get the latest one
          const sortedRenewals = archivedRenewals.sort((a, b) => {
            const dateA = new Date(a.renewalDate || a.date).getTime();
            const dateB = new Date(b.renewalDate || b.date).getTime();
            return dateB - dateA;
          });
          displayTakenAmount = parseFloat(sortedRenewals[0].takenAmount) || customer.takenAmount;
        } else {
          displayTakenAmount = customer.takenAmount;
        }
        
        return {
          ...customer,
          displayTakenAmount // Add this field for frontend to use
        };
      });
      
      res.json({ deletedCustomers: deletedCustomersWithDisplayAmount });
    } catch (error) {
      next(error);
    }
  }

  // Get next available customer ID for a line/day
  async getNextCustomerId(req, res, next) {
    try {
      const { lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      
      let nextId = '1';
      if (customers.length > 0) {
        // Find the highest numeric ID and increment
        const numericIds = customers
          .map(c => parseInt(c.id))
          .filter(id => !isNaN(id))
          .sort((a, b) => b - a);
        
        if (numericIds.length > 0) {
          nextId = (numericIds[0] + 1).toString();
        }
      }
      
      res.json({ nextId });
    } catch (error) {
      next(error);
    }
  }

  // Get archived transactions for deleted customer
  async getDeletedCustomerTransactions(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { timestamp, day } = req.query;
      
      if (!timestamp || !day) {
        return res.status(400).json({ error: 'timestamp and day are required as query parameters' });
      }
      
      // Find the deleted customer to get internalId
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const deletedCustomer = deletedCustomers.find(
        c => c.id === id && c.deletionTimestamp === parseInt(timestamp)
      );
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      const deletedInternalId = deletedCustomer.internalId || deletedCustomer.id;
      
      // Load archived transactions using internalId
      const archivedTransactions = fileManager.readJSON(`transactions_deleted/${lineId}/${day}/${deletedInternalId}_${timestamp}.json`) || [];
      
      res.json({ transactions: archivedTransactions });
    } catch (error) {
      next(error);
    }
  }

  // Get archived chat for deleted customer
  async getDeletedCustomerChat(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { timestamp, day } = req.query;
      
      if (!timestamp || !day) {
        return res.status(400).json({ error: 'timestamp and day are required as query parameters' });
      }
      
      // Load deleted customer details
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const deletedCustomer = deletedCustomers.find(
        c => c.id === id && c.deletionTimestamp === parseInt(timestamp)
      );
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      const deletedInternalId = deletedCustomer.internalId || deletedCustomer.id;
      
      // CRITICAL FIX: Walk through the ENTIRE restoration chain to collect ALL historical data
      let chat = [];
      let transactions = [];
      let renewals = [];
      let archivedCustomersDataList = [];
      
      // Start with the requested deleted customer and walk backwards through the chain
      let currentDeletedCustomer = deletedCustomer;
      const processedDeletions = new Set(); // Prevent infinite loops
      let isFirstIteration = true; // Track if this is the first (latest) deletion
      
      console.log(`📜 Starting restoration chain walk for deleted customer ID ${id}, timestamp ${timestamp}`);
      
      while (currentDeletedCustomer && !processedDeletions.has(currentDeletedCustomer.deletionTimestamp)) {
        processedDeletions.add(currentDeletedCustomer.deletionTimestamp);
        
        console.log(`📦 Processing deletion: ID ${currentDeletedCustomer.id}, internalId ${currentDeletedCustomer.internalId}, timestamp ${currentDeletedCustomer.deletionTimestamp}, isMigrated: ${currentDeletedCustomer.isMigrated || false}, isFirst: ${isFirstIteration}`);
        
        // CRITICAL FIX: For the LATEST deletion (first iteration), ALWAYS load its archived files
        // because that's where ALL the merged historical data is stored
        // For older deletions that were migrated, skip loading (data was moved forward)
        if (isFirstIteration || !currentDeletedCustomer.isMigrated) {
          // Load archived data for this deletion
          const currentInternalId = currentDeletedCustomer.internalId || currentDeletedCustomer.id;
          const currentTimestamp = currentDeletedCustomer.deletionTimestamp;
          
          const archivedChat = fileManager.readJSON(
            `chat_deleted/${lineId}/${day}/${currentInternalId}_${currentTimestamp}.json`
          ) || [];
          const archivedTransactions = fileManager.readJSON(
            `transactions_deleted/${lineId}/${day}/${currentInternalId}_${currentTimestamp}.json`
          ) || [];
          const archivedRenewals = fileManager.readJSON(
            `renewals_deleted/${lineId}/${day}/${currentInternalId}_${currentTimestamp}.json`
          ) || [];
          
          console.log(`  📦 Loaded ${archivedTransactions.length} transactions, ${archivedChat.length} chat, ${archivedRenewals.length} renewals from archived files`);
          
          // Mark items with metadata
          const markedArchivedChat = archivedChat.map(c => ({
            ...c,
            isArchived: true,
            isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
            fromDeletion: currentDeletedCustomer.deletionTimestamp
          }));
          const markedArchivedTransactions = archivedTransactions.map(t => ({
            ...t,
            isArchived: true,
            isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
            fromDeletion: currentDeletedCustomer.deletionTimestamp
          }));
          const markedArchivedRenewals = archivedRenewals.map(r => ({
            ...r,
            isArchived: true,
            isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
            fromDeletion: currentDeletedCustomer.deletionTimestamp
          }));
          
          // Prepend archived data (oldest first for chronological order)
          chat = [...markedArchivedChat, ...chat];
          transactions = [...markedArchivedTransactions, ...transactions];
          renewals = [...markedArchivedRenewals, ...renewals];
        } else {
          console.log(`  ⏭️  Data was migrated - skipping archived files (data is in later deletion)`);
        }
        
        isFirstIteration = false; // After first iteration, we're walking backwards through older deletions
        
        // Add this deleted customer's loan info to the list for display
        archivedCustomersDataList.push({
          takenAmount: currentDeletedCustomer.originalTakenAmount || currentDeletedCustomer.takenAmount,
          date: currentDeletedCustomer.date,
          name: currentDeletedCustomer.name,
          createdAt: currentDeletedCustomer.createdAt,
          isSettled: currentDeletedCustomer.remainingAtDeletion === 0,
          isArchived: true,
          deletionTimestamp: currentDeletedCustomer.deletionTimestamp,
          internalId: currentDeletedCustomer.internalId,
          isRestoredCustomer: currentDeletedCustomer.wasRestoredCustomer || false // Preserve restoration status
        });
        
        // Walk back: Check if THIS deleted customer was itself a restored customer
        let previousDeletionInChain = null;
        
        // Method 1: Use restoredFromInternalId (most reliable for newly restored customers)
        if (currentDeletedCustomer.restoredFromInternalId) {
          console.log(`  ⬅️  Walking back using restoredFromInternalId: ${currentDeletedCustomer.restoredFromInternalId}`);
          previousDeletionInChain = deletedCustomers.find(
            dc => dc.internalId === currentDeletedCustomer.restoredFromInternalId &&
                  dc.deletedFrom === day &&
                  !dc.restorationInvalidated
          );
        }
        
        // Method 2: Fallback to originalCustomerInternalId (for legacy data)
        if (!previousDeletionInChain && currentDeletedCustomer.originalCustomerInternalId) {
          console.log(`  ⬅️  Fallback: Walking back using originalCustomerInternalId: ${currentDeletedCustomer.originalCustomerInternalId}`);
          previousDeletionInChain = deletedCustomers.find(
            dc => dc.internalId === currentDeletedCustomer.originalCustomerInternalId &&
                  dc.deletedFrom === day &&
                  !dc.restorationInvalidated
          );
        }
        
        if (previousDeletionInChain) {
          console.log(`  ✅ Found previous deletion: internalId ${previousDeletionInChain.internalId}`);
          currentDeletedCustomer = previousDeletionInChain;
        } else {
          console.log(`  🏁 Reached original first loan (no more chain links)`);
          break;
        }
      }
      
      // Reverse the list so oldest loan appears FIRST (chronological order)
      archivedCustomersDataList.reverse();
      console.log(`📊 Total loans in chain: ${archivedCustomersDataList.length}`);
      
      // Now load the archived data for the specific deletion timestamp requested
      const deletedInternalIdForTimestamp = deletedCustomer.internalId || deletedCustomer.id;
      
      // Create a complete timeline with ALL events sorted chronologically
      const timeline = [];
      
      // Add ALL archived customer loans from the ENTIRE restoration chain
      archivedCustomersDataList.forEach((archivedCustomerData, index) => {
        timeline.push({
          type: 'loan',
          date: archivedCustomerData.date,
          amount: archivedCustomerData.takenAmount,
          timestamp: new Date(archivedCustomerData.createdAt || archivedCustomerData.date).getTime(),
          createdAt: archivedCustomerData.createdAt || archivedCustomerData.date,
          isArchived: true,
          isSettled: archivedCustomerData.isSettled,
          isRestored: archivedCustomerData.isRestoredCustomer === true, // Mark if this was a restored loan
          customerName: archivedCustomerData.name,
          isFirstLoan: index === 0,
          loanNumber: index + 1,
          tag: index === 0 ? 'ORIGINAL LOAN' : `RESTORED LOAN #${index}`
        });
      });
      
      // Add renewals from the complete chain
      renewals.forEach(renewal => {
        // Use renewalDate for proper chronological ordering (this is the actual timestamp)
        const renewalTimestamp = renewal.renewalDate 
          ? new Date(renewal.renewalDate).getTime()
          : new Date(renewal.date).getTime();
        
        timeline.push({
          type: 'renewal',
          date: renewal.date,
          amount: renewal.takenAmount,
          timestamp: renewalTimestamp,
          createdAt: renewal.renewalDate || renewal.createdAt || renewal.date,
          isArchived: true,
          isSettled: deletedCustomer.remainingAtDeletion === 0,
          customerName: renewal.customerName || deletedCustomer.name
        });
      });
      
      // Add regular transactions (payments) from the complete chain
      transactions.forEach(trans => {
        // Use createdAt for proper chronological ordering
        const transTimestamp = trans.createdAt 
          ? new Date(trans.createdAt).getTime()
          : new Date(trans.date).getTime();
        
        timeline.push({
          id: trans.id, // Include transaction ID for edit/delete operations
          type: 'payment',
          date: trans.date,
          amount: trans.amount,
          comment: trans.comment,
          timestamp: transTimestamp,
          createdAt: trans.createdAt || trans.date,
          isArchived: trans.isArchived || true,
          isSettled: trans.isSettled || false,
          isEdited: trans.isEdited || false,
          editedAt: trans.editedAt || null,
          customerName: trans.customerName || deletedCustomer.name
        });
      });
      
      // Add chat transactions (payments via chat) from the complete chain
      chat.forEach(chatItem => {
        // Use createdAt for proper chronological ordering
        const chatTimestamp = chatItem.createdAt 
          ? new Date(chatItem.createdAt).getTime()
          : new Date(chatItem.date).getTime();
        
        timeline.push({
          id: chatItem.id, // Include transaction ID for edit/delete operations
          type: 'payment',
          date: chatItem.date,
          amount: chatItem.amount,
          comment: chatItem.comment || chatItem.message,
          timestamp: chatTimestamp,
          createdAt: chatItem.createdAt || chatItem.date,
          isArchived: chatItem.isArchived || true,
          isSettled: chatItem.isSettled || false,
          isEdited: chatItem.isEdited || false,
          editedAt: chatItem.editedAt || null,
          customerName: chatItem.customerName || deletedCustomer.name
        });
      });
      
      // Sort timeline by timestamp (chronological order - oldest first)
      timeline.sort((a, b) => a.timestamp - b.timestamp);
      
      // Extract renewals for separate return (frontend needs this for UI)
      const renewalsList = timeline.filter(item => item.type === 'renewal');
      
      res.json({ 
        chat: timeline,
        renewals: renewalsList
      });
    } catch (error) {
      next(error);
    }
  }

  // Get archived renewals for deleted customer
  async getDeletedCustomerRenewals(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { timestamp, day } = req.query;
      
      if (!timestamp || !day) {
        return res.status(400).json({ error: 'timestamp and day are required as query parameters' });
      }
      
      // Load archived renewals
      const archivedRenewals = fileManager.readJSON(`renewals_deleted/${lineId}/${day}/${id}_${timestamp}.json`) || [];
      
      res.json({ renewals: archivedRenewals });
    } catch (error) {
      next(error);
    }
  }

  // Get customer print data with pre-calculated statement
  async getCustomerPrintData(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      // Get customer
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Load all transactions, chat, and renewals
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${id}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${id}.json`) || [];
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${id}.json`) || [];
      
      // Check if this customer was restored from a deleted customer
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const restoredFromDeleted = deletedCustomers.find(
        dc => dc.isRestored === true && dc.restoredAs === id && dc.deletedFrom === day
      );
      
      // If customer was restored, include archived data for HISTORY
      if (restoredFromDeleted && restoredFromDeleted.deletionTimestamp) {
        const archivedTransactions = fileManager.readJSON(
          `transactions_deleted/${lineId}/${day}/${restoredFromDeleted.id}_${restoredFromDeleted.deletionTimestamp}.json`
        ) || [];
        const archivedChat = fileManager.readJSON(
          `chat_deleted/${lineId}/${day}/${restoredFromDeleted.id}_${restoredFromDeleted.deletionTimestamp}.json`
        ) || [];
        const archivedRenewals = fileManager.readJSON(
          `renewals_deleted/${lineId}/${day}/${restoredFromDeleted.id}_${restoredFromDeleted.deletionTimestamp}.json`
        ) || [];
        
        // Mark archived items
        const markedArchivedTransactions = archivedTransactions.map(t => ({
          ...t,
          isArchived: true,
          isSettled: restoredFromDeleted.remainingAtDeletion === 0
        }));
        const markedArchivedChat = archivedChat.map(c => ({
          ...c,
          isArchived: true,
          isSettled: restoredFromDeleted.remainingAtDeletion === 0
        }));
        const markedArchivedRenewals = archivedRenewals.map(r => ({
          ...r,
          isArchived: true,
          isSettled: restoredFromDeleted.remainingAtDeletion === 0
        }));
        
        // Prepend archived data
        transactions = [...markedArchivedTransactions, ...transactions];
        chatTransactions = [...markedArchivedChat, ...chatTransactions];
        renewals = [...markedArchivedRenewals, ...renewals];
      }
      
      // Calculate totals (ONLY for non-settled archived items)
      const allReceived = [...transactions, ...chatTransactions];
      const totalPaid = allReceived
        .filter(t => !(t.isArchived && t.isSettled))
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      
      const takenAmount = parseFloat(customer.takenAmount) || 0;
      
      // Calculate totalOwed: If renewals exist, use last renewal amount, otherwise use initial loan
      const activeRenewals = renewals.filter(r => !(r.isArchived && r.isSettled));
      let totalOwed;
      if (activeRenewals.length > 0) {
        // Sort renewals by date to get the latest one
        const sortedRenewals = activeRenewals.sort((a, b) => {
          const dateA = new Date(a.renewalDate || a.date).getTime();
          const dateB = new Date(b.renewalDate || b.date).getTime();
          return dateB - dateA;
        });
        totalOwed = parseFloat(sortedRenewals[0].takenAmount) || 0;
      } else {
        totalOwed = takenAmount;
      }
      
      const remainingAmount = totalOwed - totalPaid;
      
      // Prepare bank statement data - Date, Taken, Received
      const statementMap = new Map();
      
      // Add customer creation (Taken)
      if (customer.date && takenAmount > 0) {
        statementMap.set(customer.date, {
          date: customer.date,
          taken: takenAmount,
          received: 0
        });
      }
      
      // Add renewals (Taken)
      renewals.forEach(renewal => {
        if (renewal.date) {
          const existing = statementMap.get(renewal.date) || { date: renewal.date, taken: 0, received: 0 };
          existing.taken += parseFloat(renewal.takenAmount) || 0;
          statementMap.set(renewal.date, existing);
        }
      });
      
      // Add received payments
      allReceived.forEach(trans => {
        if (trans.date) {
          const existing = statementMap.get(trans.date) || { date: trans.date, taken: 0, received: 0 };
          existing.received += parseFloat(trans.amount) || 0;
          statementMap.set(trans.date, existing);
        }
      });
      
      // Convert to array and sort by date
      const statementData = Array.from(statementMap.values()).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      
      res.json({
        customer,
        totals: {
          totalOwed,
          totalPaid,
          remainingAmount
        },
        statementData
      });
    } catch (error) {
      next(error);
    }
  }

}

module.exports = new CustomerController();
