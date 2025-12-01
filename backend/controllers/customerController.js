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
  // Get all customers for a line and day with balance calculations
  // STEP 4 FIX: Simple data fetching - NO archived logic
  async getCustomersByLineAndDay(req, res, next) {
    try {
      const { lineId, day } = req.params;
      
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      
      // Add calculated remaining amounts for each customer
      const customersWithBalance = customers.map(customer => {
        const internalId = _getInternalId(customer);
        
        // STEP 4: Simply read from active files
        // All history is already here because STEP 3 keeps files intact
        let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
        // FIXED: Chat folder NO LONGER used for payments (only text messages)
        // All payments (including chat payments) are in transactions/ folder
        let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
        
        // STEP 4: NO archived logic, NO timestamp filtering, NO migration checks
        
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
        // FIXED: Use only transactions (chat payments are already in transactions/)
        const allPayments = transactions;
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
  // Get customer by ID with balance calculation
  // STEP 4 FIX: Simple data fetching - NO archived logic
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
      
      // STEP 4: Simply read from active files using internalId
      const internalId = _getInternalId(customer);
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      // FIXED: Chat folder NO LONGER used for payments (only text messages)
      // All payments (including chat payments) are in transactions/ folder
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // STEP 4: NO archived logic, NO timestamp filtering
      // All history is already in these files because STEP 3 keeps files intact
      
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
      // FIXED: Use only transactions (chat payments are already in transactions/)
      const allPayments = transactions;
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
      
      // STEP 8 FIX: Load archived transactions using internalId (NO timestamp suffix)
      const archivedTransactions = fileManager.readJSON(
        `deleted_transactions/${lineId}/${day}/${deletedInternalId}.json`
      ) || [];
      // STEP 8 FIX: Chat folder NO LONGER used for payments (only text messages)
      // All payments (including chat payments) are in transactions
      const archivedRenewals = fileManager.readJSON(
        `deleted_renewals/${lineId}/${day}/${deletedInternalId}.json`
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
      // STEP 8 FIX: Use ONLY archived transactions (chat payments are in transactions)
      const allPayments = archivedTransactions;
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

  // Create customer (STEP 1: NEW CUSTOMER + FIRST LOAN)
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
      // This ensures NEW customers don't inherit old restoration history
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
      
      // STEP 1: Create NEW customer with NEW unique internalId
      // Customer model automatically generates internalId = `${Date.now()}_${random}`
      // This ensures each customer has a permanent unique identifier
      const newCustomer = new Customer(req.body);
      customers.push(newCustomer.toJSON());
      
      fileManager.writeJSON(`customers/${lineId}/${day}.json`, customers);
      
      // STEP 1: Update BF - For NEW customers, this simply subtracts principal
      // principal = takenAmount - interest - pc
      // BF = BF - principal
      // NO restore logic, NO settlement logic, NO chain walking runs for NEW customers
      const bfResult = bfCalculation.updateBF(lineId);
      
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
      
      // Update BF
      const bfResult = bfCalculation.updateBF(lineId);
      
      res.json({
        message: 'Customer updated successfully',
        customer: updatedCustomer.toJSON(),
        newBF: bfResult.bfAmount
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete/archive customer
  // STEP 8 FIX: Delete Customer - PURE SOFT DELETE WITH ARCHIVED COPIES
  // Delete should be the SIMPLEST operation:
  // 1. Move customer to deleted_customers (soft delete)
  // 2. Keep internalId unchanged
  // 3. Free up customerId for reuse
  // 4. DO NOT touch BF (NEVER call calculateBF or updateBF)
  // 5. DO NOT delete/move active transaction files (keep them in place for BF stability)
  // 6. ONLY create COPIES in deleted folders for viewing deleted customer history
  // 7. DO NOT calculate balance
  // 8. DO NOT trigger settlement logic
  // 9. DO NOT trigger archiving/migration logic
  async deleteCustomer(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      let customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // STEP 8: Get internalId
      const internalId = _getInternalId(customer);
      const deletionTimestamp = Date.now();
      
      // STEP 8 FIX: Create COPIES of transaction files in deleted folders
      // CRITICAL: DO NOT delete/move original files
      // Original files MUST stay in place so BF calculation remains stable
      
      // Read existing transaction files
      const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      const chat = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // Write COPIES to archived locations (for deleted customer viewing)
      // CRITICAL: Use correct path format WITHOUT timestamp suffix in filename
      fileManager.writeJSON(`deleted_transactions/${lineId}/${day}/${internalId}.json`, transactions);
      fileManager.writeJSON(`deleted_chat/${lineId}/${day}/${internalId}.json`, chat);
      fileManager.writeJSON(`deleted_renewals/${lineId}/${day}/${internalId}.json`, renewals);
      
      // STEP 8 FIX: DO NOT delete original files
      // Original files stay in place, so BF calculation continues to count them
      // This keeps BF stable (no jumping after deletion)
      
      console.log(`✅ STEP 8: Transaction copies created for deleted customer viewing`);
      
      // Create deleted customer entry
      const deletedEntry = {
        ...customer,
        internalId: internalId,
        isDeleted: true,
        deletedAt: deletionTimestamp,
        deletionTimestamp: deletionTimestamp, // For compatibility with getDeletedCustomerById
        deletedFrom: day
      };
      
      // Add to deleted customers list
      let deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      deletedCustomers.push(deletedEntry);
      fileManager.writeJSON(`deleted_customers/${lineId}.json`, deletedCustomers);
      
      // Remove from active customers
      customers = customers.filter(c => c.id !== id);
      fileManager.writeJSON(`customers/${lineId}/${day}.json`, customers);
      
      console.log(`✅ STEP 8: Customer ${id} (${internalId}) soft-deleted. Transaction files kept in place. BF remains stable.`);
      
      res.json({ 
        message: 'Customer deleted successfully',
        note: 'Customer data archived and can be viewed in deleted tab. BF remains unchanged.'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restore deleted customer
  // STEP 4: CUSTOMER RESTORATION FIX
  // Restore = Reactivate old customer using SAME internalId + Create new loan + Update BF using principal only
  async restoreCustomer(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { newId, takenAmount, deletedFrom, interest, pc, date, weeks, deletionTimestamp } = req.body;
      
      // STEP 4.1: Get deleted customers
      let deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      // STEP 4.2: Find the deleted customer to restore
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
          deletedCustomer = candidates.sort((a, b) => b.deletionTimestamp - a.deletionTimestamp)[0];
        }
      }
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found or already restored' });
      }
      
      // STEP 4.3: Check if already restored
      if (deletedCustomer.isRestored) {
        return res.status(400).json({ 
          error: 'This customer has already been restored',
          restoredAs: deletedCustomer.restoredAs,
          restoredDate: deletedCustomer.restoredDate
        });
      }
      
      // STEP 4.4: Check if new visible customerId already exists in active customers
      let activeCustomers = fileManager.readJSON(`customers/${lineId}/${deletedFrom}.json`) || [];
      if (activeCustomers.find(c => c.id === newId)) {
        return res.status(400).json({ error: 'Customer ID already exists' });
      }
      
      // STEP 4.5: CRITICAL - Reactivate customer using SAME internalId (NOT creating new one)
      // This is how we keep the old history visible under the same internalId
      const oldInternalId = deletedCustomer.internalId || deletedCustomer.id;
      
      console.log(`🔄 STEP 4 RESTORE: Reactivating customer ${id} as ${newId} using SAME internalId: ${oldInternalId}`);
      
      // STEP 4.6: Create restored customer object with SAME internalId
      const restoredCustomer = {
        id: newId,                           // New visible customerId
        internalId: oldInternalId,           // SAME internalId (CRITICAL)
        name: deletedCustomer.name,
        village: deletedCustomer.village,
        phone: deletedCustomer.phone,
        profileImage: deletedCustomer.profileImage,
        takenAmount: parseFloat(takenAmount),
        interest: interest !== undefined && interest !== null ? parseFloat(interest) : parseFloat(deletedCustomer.interest) || 0,
        pc: pc !== undefined && pc !== null ? parseFloat(pc) : parseFloat(deletedCustomer.pc) || 0,
        date: date || new Date().toISOString().split('T')[0],
        weeks: weeks || deletedCustomer.weeks,
        isRestoredCustomer: true,            // Flag to identify this as restored
        restoredAt: Date.now(),              // When restored
        restoredFrom: deletedFrom            // Which day file
      };
      
      // STEP 4.7: Add to active customers
      activeCustomers.push(restoredCustomer);
      fileManager.writeJSON(`customers/${lineId}/${deletedFrom}.json`, activeCustomers);
      
      console.log(`✅ STEP 4: Customer reactivated with SAME internalId ${oldInternalId}`);
      
      // STEP 4.8: Create NEW loan transaction with "restored" type
      // This is a NEW loan being given to the restored customer
      // CRITICAL: type MUST be "restored" (not "loan")
      const Transaction = require('../models/Transaction');
      const newLoanTransaction = new Transaction({
        customerId: newId,
        amount: parseFloat(takenAmount),
        date: date || new Date().toISOString().split('T')[0],
        comment: `Restored customer - New loan of ₹${takenAmount}`,
        type: 'restored', // STEP 4: Use "restored" type
        loanType: 'restoredLoan', // STEP 4: Additional loan type marker
        isRestoredLoan: true, // STEP 4: Flag for restored loan
        restoredAt: Date.now() // STEP 4: Timestamp of restoration
      });
      
      // Save transaction using internalId (so it's with old history)
      const transactionPath = `transactions/${lineId}/${deletedFrom}/${oldInternalId}.json`;
      let transactions = fileManager.readJSON(transactionPath) || [];
      transactions.push(newLoanTransaction.toJSON());
      fileManager.writeJSON(transactionPath, transactions);
      
      console.log(`✅ STEP 4: New loan transaction created for ₹${takenAmount}`);
      
      // STEP 4.9: Update BF using ONLY principal calculation (STEP 1 logic)
      // principal = takenAmount - interest - pc
      // BF = BF - principal
      // NO other logic runs
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      const currentBF = parseFloat(line?.currentBF || line?.amount || 0);
      
      // CRITICAL FIX: Use INPUT parameters directly (not restoredCustomer object values)
      // This ensures we use the exact values provided by the user
      const interestValue = interest !== undefined && interest !== null ? parseFloat(interest) : parseFloat(deletedCustomer.interest) || 0;
      const pcValue = pc !== undefined && pc !== null ? parseFloat(pc) : parseFloat(deletedCustomer.pc) || 0;
      const principal = parseFloat(takenAmount) - interestValue - pcValue;
      const newBF = currentBF - principal;
      
      console.log(`STEP 4 Restore Principal: ${principal}`);
      console.log(`📊 STEP 4 BF Update: BF ${currentBF} - Principal ${principal} = New BF ${newBF}`);
      
      // Update line with new BF
      const updatedLines = lines.map(l => {
        if (l.id === lineId) {
          return { ...l, currentBF: newBF };
        }
        return l;
      });
      fileManager.writeJSON('lines.json', updatedLines);
      
      console.log(`✅ STEP 4: BF updated from ₹${currentBF} to ₹${newBF}`);
      
      // STEP 4.10: Mark as restored in deleted list (simple flag only)
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
      
      console.log(`✅ STEP 4 COMPLETE: Customer restored successfully`);
      
      // STEP 4.11: Return response
      res.status(201).json({
        message: 'Customer restored successfully',
        customer: restoredCustomer,
        newBF: newBF,
        oldHistory: {
          internalId: oldInternalId,
          note: 'Old transactions remain visible under same internalId'
        }
      });
    } catch (error) {
      console.error('❌ STEP 4 ERROR:', error);
      next(error);
    }
  }

  // Get customer transactions
  // STEP 4 FIX: Simple history fetching - NO archived logic
  // Since STEP 3 keeps all files intact under SAME internalId,
  // all transactions (old + new) are already in the same file
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
      
      // STEP 4: Simply read transactions from the SAME internalId file
      // This file contains ALL history (old + new) because:
      // - STEP 3 delete keeps files intact
      // - STEP 4 restore reuses SAME internalId
      // - New transactions append to same file
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      // STEP 4: NO archived logic, NO migration checks, NO timestamp filtering
      // Just return the transactions as-is
      res.json({ 
        transactions
      });
    } catch (error) {
      next(error);
    }
  }

  // Get customer renewals
  // STEP 4 FIX: Simple history fetching - NO archived logic
  // Since STEP 3 keeps all files intact under SAME internalId,
  // all renewals (old + new) are already in the same file
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
      
      // STEP 4: Simply read renewals from the SAME internalId file
      // This file contains ALL history (old + new) because:
      // - STEP 3 delete keeps files intact
      // - STEP 4 restore reuses SAME internalId
      // - New renewals append to same file
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // STEP 4: NO archived logic, NO migration checks, NO timestamp filtering
      // Just return the renewals as-is
      res.json({ renewals });
    } catch (error) {
      next(error);
    }
  }

  // Create renewal for customer
  // STEP 5: RENEWAL HANDLING - SIMPLE, CLEAN LOGIC
  // Renewal = Append ONE new transaction + Update BF by principal only
  async createRenewal(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      const { takenAmount, interest, pc, date, weeks } = req.body;
      
      // STEP 5.1: Check if customer exists
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // STEP 5.2: Use internalId for file operations (SAME folder as all other transactions)
      const internalId = _getInternalId(customer);
      
      // STEP 5.3: Check if customer has cleared balance (SIMPLE calculation only)
      // Read transactions from SAME internalId file
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      // FIXED: Chat folder NO LONGER used for payments (only text messages)
      // All payments (including chat payments) are in transactions/ folder
      
      // STEP 5 CRITICAL: NO archived data logic, NO settlement logic, NO migration logic
      // Only read from active files
      
      // Calculate totalOwed: Find latest renewal or use initial loan
      let totalOwed;
      let latestRenewalDate = null;
      
      // Find renewals by filtering transactions with type: 'renewal'
      const renewalTransactions = transactions.filter(t => t.type === 'renewal' || t.isRenewal === true);
      
      if (renewalTransactions.length > 0) {
        // Sort renewals by date to get the latest one
        const sortedRenewals = renewalTransactions.sort((a, b) => {
          const dateA = new Date(a.renewedAt || a.createdAt || a.date).getTime();
          const dateB = new Date(b.renewedAt || b.createdAt || b.date).getTime();
          return dateB - dateA;
        });
        const latestRenewal = sortedRenewals[0];
        totalOwed = parseFloat(latestRenewal.amount) || 0;
        latestRenewalDate = new Date(latestRenewal.renewedAt || latestRenewal.createdAt || latestRenewal.date).getTime();
      } else {
        // No renewals - use initial customer loan
        totalOwed = parseFloat(customer.takenAmount) || 0;
      }
      
      // Calculate totalPaid: Only count payments made after latest renewal (if exists)
      // FIXED: Use only transactions (chat payments are already in transactions/)
      const paymentTransactions = transactions.filter(t => 
        t.type === 'payment' || (!t.type && t.amount) || t.type === 'chat'
      );
      
      const totalPaid = paymentTransactions.reduce((sum, t) => {
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
          error: `Customer has pending balance: ₹${remainingAmount.toFixed(2)}. Please clear before renewal.` 
        });
      }
      
      // STEP 5.4: Create NEW renewal transaction with proper tags
      const Transaction = require('../models/Transaction');
      const newRenewalTransaction = new Transaction({
        customerId: id,
        amount: parseFloat(takenAmount),
        date: date || new Date().toISOString().split('T')[0],
        comment: `Renewal - New loan of ₹${takenAmount}`,
        type: 'renewal',              // STEP 5: Use "renewal" type
        loanType: 'renewalLoan',      // STEP 5: Additional marker
        isRenewal: true,              // STEP 5: Flag for renewal
        renewedAt: Date.now(),        // STEP 5: Timestamp of renewal
        interest: interest !== undefined && interest !== null ? parseFloat(interest) : parseFloat(customer.interest) || 0,
        pc: pc !== undefined && pc !== null ? parseFloat(pc) : parseFloat(customer.pc) || 0,
        weeks: weeks || customer.weeks,
        customerName: customer.name
      });
      
      // STEP 5.5: Append renewal to transactions file (SAME internalId folder)
      transactions.push(newRenewalTransaction.toJSON());
      fileManager.writeJSON(`transactions/${lineId}/${day}/${internalId}.json`, transactions);
      
      console.log(`✅ STEP 5: Renewal transaction created for ₹${takenAmount}`);
      
      // STEP 5.6: Update BF using ONLY principal calculation (NO bfCalculation.updateBF call)
      // principal = takenAmount - interest - pc
      // BF = BF - principal
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      const currentBF = parseFloat(line?.currentBF || line?.amount || 0);
      
      const interestValue = interest !== undefined && interest !== null ? parseFloat(interest) : parseFloat(customer.interest) || 0;
      const pcValue = pc !== undefined && pc !== null ? parseFloat(pc) : parseFloat(customer.pc) || 0;
      const principal = parseFloat(takenAmount) - interestValue - pcValue;
      const newBF = currentBF - principal;
      
      console.log(`📊 STEP 5 BF Update: BF ${currentBF} - Principal ${principal} = New BF ${newBF}`);
      
      // Update line with new BF
      const updatedLines = lines.map(l => {
        if (l.id === lineId) {
          return { ...l, currentBF: newBF };
        }
        return l;
      });
      fileManager.writeJSON('lines.json', updatedLines);
      
      console.log(`✅ STEP 5: BF updated from ₹${currentBF} to ₹${newBF}`);
      console.log(`✅ STEP 5 COMPLETE: Renewal created successfully`);
      
      // STEP 5.7: Return response
      res.status(201).json({
        message: 'Renewal created successfully',
        renewal: newRenewalTransaction.toJSON(),
        newBF: newBF
      });
    } catch (error) {
      console.error('❌ STEP 5 ERROR:', error);
      next(error);
    }
  }

  // Get customer chat
  // Get customer chat (PhonePe-style timeline view)
  // STEP 4 FIX: Simple history fetching - NO archived logic
  // Since STEP 3 keeps all files intact under SAME internalId,
  // all data (old + new) is already in the same files
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
      
      // STEP 4, 5 & 6: Simply read from active files
      // These files contain ALL history (old + new) because:
      // - STEP 3 delete keeps files intact
      // - STEP 4 restore reuses SAME internalId
      // - STEP 5 renewals append to transactions file
      // - STEP 6 ALL payments (quick + chat) append to transactions file
      // - STEP 6 ONLY comments go to chat file
      let chat = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      // STEP 5: Check if old renewals folder exists (backward compatibility)
      let legacyRenewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // STEP 4 & 5: NO archived logic, NO chain walking, NO migration checks
      // Create a simple timeline with ALL events from the active files
      const timeline = [];
      
      // Add customer's initial loan
      const customerTimestamp = customer.createdAt 
        ? new Date(customer.createdAt).getTime() 
        : new Date(customer.date).getTime();
      
      timeline.push({
        type: 'loan',
        date: customer.date,
        amount: customer.takenAmount,
        timestamp: customerTimestamp,
        createdAt: customer.createdAt || customer.date,
        customerName: customer.name,
        tag: customer.isRestoredCustomer ? 'RESTORED LOAN' : 'NEW LOAN'
      });
      
      // Add legacy renewals (from old renewals/ folder - backward compatibility)
      legacyRenewals.forEach(renewal => {
        const renewalTimestamp = renewal.renewalDate 
          ? new Date(renewal.renewalDate).getTime()
          : renewal.createdAt
            ? new Date(renewal.createdAt).getTime()
            : new Date(renewal.date).getTime();
        
        timeline.push({
          type: 'renewal',
          date: renewal.date,
          amount: renewal.takenAmount,
          timestamp: renewalTimestamp,
          createdAt: renewal.renewalDate || renewal.createdAt || renewal.date,
          customerName: renewal.customerName || customer.name,
          tag: 'RENEWAL'
        });
      });
      
      // Add transactions (payments, restored loans, and STEP 5 renewals)
      transactions.forEach(trans => {
        const transTimestamp = trans.createdAt 
          ? new Date(trans.createdAt).getTime()
          : new Date(trans.date).getTime();
        
        // STEP 5: Check if this is a renewal transaction
        const isRenewal = trans.type === 'renewal' || trans.isRenewal === true;
        
        // STEP 4: Check if this is a restored loan transaction
        const isRestoredLoan = trans.type === 'restored' || trans.isRestoredLoan === true;
        
        // Determine display type and tag
        let displayType = 'payment';
        let displayTag = 'PAYMENT';
        
        if (isRenewal) {
          displayType = 'renewal';
          displayTag = 'RENEWAL';
        } else if (isRestoredLoan) {
          displayType = 'loan';
          displayTag = 'RESTORED LOAN';
        }
        
        timeline.push({
          id: trans.id,
          type: displayType,
          date: trans.date,
          amount: trans.amount,
          comment: trans.comment,
          timestamp: transTimestamp,
          createdAt: trans.createdAt || trans.date,
          isEdited: trans.isEdited || false,
          editedAt: trans.editedAt || null,
          customerName: trans.customerName || customer.name,
          tag: displayTag,
          isRenewal: isRenewal,
          isRestoredLoan: isRestoredLoan
        });
      });
      
      // STEP 6: Add chat items (ONLY comments, NOT payments)
      // After STEP 6 fix, payments are in transactions/ file, only comments in chat/ file
      chat.forEach(chatItem => {
        // Skip if this is a payment (shouldn't happen after STEP 6, but check for backward compatibility)
        if (chatItem.amount && chatItem.type !== 'comment') {
          return; // Skip - payments are now in transactions/ file
        }
        
        const chatTimestamp = chatItem.createdAt 
          ? new Date(chatItem.createdAt).getTime()
          : chatItem.timestamp || new Date(chatItem.date).getTime();
        
        timeline.push({
          id: chatItem.id,
          type: 'comment',
          date: chatItem.date,
          message: chatItem.message,
          comment: chatItem.message,
          timestamp: chatTimestamp,
          createdAt: chatItem.createdAt || chatItem.date,
          customerName: chatItem.customerName || customer.name,
          tag: 'COMMENT'
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
  // STEP 2 FIX: Chat payments (like regular payments) should be SIMPLE
  // Only do: BF = BF + paymentAmount
  // NO recalculation, NO restoration logic, NO settlement logic
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
      
      // STEP 6: Use internalId for all operations
      const internalId = _getInternalId(customer);
      
      // Handle comment-only message (when 'message' is sent instead of amount)
      // STEP 6: Comments go to chat/ file, payments go to transactions/ file
      if (message && !amount) {
        let chat = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
        
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
      
      // STEP 6 FIX: Payment from chat MUST write to transactions/ file (NOT chat/ file)
      // This ensures Quick Transaction and Chat Payment are 100% consistent
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      
      // Handle payment transaction
      const newTransaction = new Transaction({
        amount: parseFloat(amount),
        date,
        comment: comment || '',
        customerName: customer.name,
        type: 'payment',           // STEP 6: Explicit type
        source: 'chat'              // STEP 6: Mark source as 'chat'
      });
      
      // STEP 6: Append to transactions file (SAME as Quick Transaction)
      transactions.push(newTransaction.toJSON());
      fileManager.writeJSON(`transactions/${lineId}/${day}/${internalId}.json`, transactions);
      
      // STEP 6: Simple incremental BF update (same as Quick Transaction)
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
      
      console.log(`✅ STEP 6: Chat payment added to transactions/ file with source='chat'`);
      
      res.status(201).json({
        message: 'Chat transaction added successfully',
        transaction: newTransaction.toJSON(),
        newBF: newBF
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
          // FIXED: Chat folder NO LONGER used for payments (only text messages)
          // All payments (including chat payments) are in transactions/ folder
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
          // FIXED: Use only transactions (chat payments are already in transactions/)
          const allPayments = transactions;
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
        
        // STEP 8 FIX: Load archived renewals using internalId (NO timestamp suffix)
        const archivedRenewals = fileManager.readJSON(
          `deleted_renewals/${lineId}/${day}/${deletedInternalId}.json`
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
      
      // STEP 8 FIX: Load archived transactions using internalId (NO timestamp suffix)
      const archivedTransactions = fileManager.readJSON(`deleted_transactions/${lineId}/${day}/${deletedInternalId}.json`) || [];
      
      res.json({ transactions: archivedTransactions });
    } catch (error) {
      next(error);
    }
  }

  // Get archived chat for deleted customer
  // STEP 8 FIX: SIMPLIFIED - NO chain walking, NO migration logic
  // Just load the archived files for the requested deleted customer
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
      
      // STEP 8 FIX: Simple load from archived files (NO timestamp suffix)
      const chat = fileManager.readJSON(`deleted_chat/${lineId}/${day}/${deletedInternalId}.json`) || [];
      const transactions = fileManager.readJSON(`deleted_transactions/${lineId}/${day}/${deletedInternalId}.json`) || [];
      const renewals = fileManager.readJSON(`deleted_renewals/${lineId}/${day}/${deletedInternalId}.json`) || [];
      
      console.log(`✅ STEP 8: Loaded ${transactions.length} transactions, ${chat.length} chat, ${renewals.length} renewals`);
      
      // STEP 8 FIX: Create simple timeline (NO chain walking, NO migration logic)
      const timeline = [];
      
      // Add customer's initial loan
      const customerTimestamp = deletedCustomer.createdAt 
        ? new Date(deletedCustomer.createdAt).getTime()
        : new Date(deletedCustomer.date).getTime();
      
      timeline.push({
        type: 'loan',
        date: deletedCustomer.date,
        amount: deletedCustomer.takenAmount,
        timestamp: customerTimestamp,
        createdAt: deletedCustomer.createdAt || deletedCustomer.date,
        customerName: deletedCustomer.name,
        tag: 'LOAN',
        isArchived: true
      });
      
      // Add renewals
      renewals.forEach(renewal => {
        const renewalTimestamp = renewal.renewalDate 
          ? new Date(renewal.renewalDate).getTime()
          : new Date(renewal.date).getTime();
        
        timeline.push({
          type: 'renewal',
          date: renewal.date,
          amount: renewal.takenAmount,
          timestamp: renewalTimestamp,
          createdAt: renewal.renewalDate || renewal.createdAt || renewal.date,
          customerName: renewal.customerName || deletedCustomer.name,
          tag: 'RENEWAL',
          isArchived: true
        });
      });
      
      // Add transactions (payments)
      transactions.forEach(trans => {
        const transTimestamp = trans.createdAt 
          ? new Date(trans.createdAt).getTime()
          : new Date(trans.date).getTime();
        
        const isRestoredLoan = trans.type === 'restored' || trans.isRestoredLoan === true;
        
        timeline.push({
          id: trans.id,
          type: isRestoredLoan ? 'loan' : 'payment',
          date: trans.date,
          amount: trans.amount,
          comment: trans.comment,
          timestamp: transTimestamp,
          createdAt: trans.createdAt || trans.date,
          customerName: trans.customerName || deletedCustomer.name,
          tag: isRestoredLoan ? 'RESTORED LOAN' : 'PAYMENT',
          isArchived: true,
          isEdited: trans.isEdited || false,
          editedAt: trans.editedAt || null
        });
      });
      
      // STEP 8 FIX: Chat items should only be comments (payments are in transactions)
      chat.forEach(chatItem => {
        // Skip if this is actually a payment (shouldn't happen after STEP 6, but check for backward compatibility)
        if (chatItem.amount && chatItem.type !== 'comment') {
          return;
        }
        
        const chatTimestamp = chatItem.createdAt 
          ? new Date(chatItem.createdAt).getTime()
          : new Date(chatItem.date || chatItem.timestamp).getTime();
        
        timeline.push({
          id: chatItem.id,
          type: 'comment',
          date: chatItem.date,
          message: chatItem.message,
          comment: chatItem.message,
          timestamp: chatTimestamp,
          createdAt: chatItem.createdAt || chatItem.date,
          customerName: chatItem.customerName || deletedCustomer.name,
          tag: 'COMMENT',
          isArchived: true
        });
      });
      
      // Sort timeline by timestamp (chronological order - oldest first)
      timeline.sort((a, b) => a.timestamp - b.timestamp);
      
      res.json({ 
        chat: timeline,
        customer: {
          id: deletedCustomer.id,
          name: deletedCustomer.name,
          takenAmount: deletedCustomer.takenAmount,
          date: deletedCustomer.date
        }
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
      
      // Find the deleted customer to get internalId
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const deletedCustomer = deletedCustomers.find(
        c => c.id === id && c.deletionTimestamp === parseInt(timestamp)
      );
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      const deletedInternalId = deletedCustomer.internalId || deletedCustomer.id;
      
      // STEP 8 FIX: Load archived renewals (NO timestamp suffix)
      const archivedRenewals = fileManager.readJSON(`deleted_renewals/${lineId}/${day}/${deletedInternalId}.json`) || [];
      
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
      
      // STEP 8 FIX: Use internalId for file operations
      const internalId = _getInternalId(customer);
      
      // Load all transactions and renewals
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      // STEP 8 FIX: Chat folder NO LONGER used for payments (only text messages)
      // All payments (including chat payments) are in transactions/ folder
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // Check if this customer was restored from a deleted customer
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const restoredFromDeleted = deletedCustomers.find(
        dc => dc.isRestored === true && dc.restoredAs === id && dc.deletedFrom === day
      );
      
      // STEP 8 FIX: If customer was restored, include archived data for HISTORY
      // Use internalId for archived data access (NO timestamp suffix)
      if (restoredFromDeleted && restoredFromDeleted.internalId) {
        const restoredInternalId = restoredFromDeleted.internalId || restoredFromDeleted.id;
        
        const archivedTransactions = fileManager.readJSON(
          `deleted_transactions/${lineId}/${day}/${restoredInternalId}.json`
        ) || [];
        // STEP 8 FIX: Chat folder NO LONGER used for payments (only comments)
        const archivedRenewals = fileManager.readJSON(
          `deleted_renewals/${lineId}/${day}/${restoredInternalId}.json`
        ) || [];
        
        // Mark archived items
        const markedArchivedTransactions = archivedTransactions.map(t => ({
          ...t,
          isArchived: true,
          isSettled: restoredFromDeleted.remainingAtDeletion === 0
        }));
        const markedArchivedRenewals = archivedRenewals.map(r => ({
          ...r,
          isArchived: true,
          isSettled: restoredFromDeleted.remainingAtDeletion === 0
        }));
        
        // Prepend archived data (transactions only, NO chat)
        transactions = [...markedArchivedTransactions, ...transactions];
        renewals = [...markedArchivedRenewals, ...renewals];
      }
      
      // Calculate totals (ONLY for non-settled archived items)
      // FIXED: Use only transactions (chat payments are already in transactions/)
      const allReceived = transactions;
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
