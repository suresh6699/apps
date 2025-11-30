const fileManager = require('./fileManager');

class BFCalculationService {
  /**
   * Calculate BF for a specific line
   * BF = InitialAmount - TotalNetGiven + TotalCollected - TotalNetRenewals + AccountNet
   * Where TotalNetGiven = Sum of (takenAmount - interest - pc) for ALL customers
   * And TotalNetRenewals = Sum of (takenAmount - interest - pc) for ALL renewals
   * Note: Interest and PC are SUBTRACTED from amounts given out (they represent profit/income)
   * When customer pays back, they pay the full takenAmount, creating profit
   * Both original loans AND renewals are counted as separate cash outflows
   */
  calculateBF(lineId) {
    try {
      // Get line's initial amount
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      const initialAmount = line ? parseFloat(line.amount) || 0 : 0;

      // Calculate total NET given to ALL customers across ALL days (ACTIVE customers)
      // NET = takenAmount - interest - pc (actual cash going out)
      let totalNetGiven = 0;
      const days = fileManager.listFiles(`customers/${lineId}`);
      days.forEach(dayFile => {
        const customers = fileManager.readJSON(`customers/${lineId}/${dayFile}`) || [];
        customers.forEach(customer => {
          const takenAmount = parseFloat(customer.takenAmount) || 0;
          const interest = parseFloat(customer.interest) || 0;
          const pc = parseFloat(customer.pc) || 0;
          // NET cash given = takenAmount - interest - pc
          const netGiven = takenAmount - interest - pc;
          totalNetGiven += netGiven;
        });
      });

      // CRITICAL FIX: Calculate settled cycles adjustment (SIMPLIFIED - NO MERGE CHAIN WALKING)
      // For deleted customers with remainingAtDeletion=0 (fully settled), their net impact is PERMANENT
      // Net impact = (payments received - principal given) FOR THAT SPECIFIC CYCLE ONLY
      // IMPORTANT: Only process FINAL deletions (not merged into another)
      // DO NOT walk merge chains - this causes double-counting in multiple delete/restore scenarios
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      let settledCyclesAdjustment = 0;
      const processedSettledCycles = new Set();
      
      deletedCustomers.forEach(delCustomer => {
        // Only process SETTLED deletions (remainingAtDeletion = 0)
        // These represent completed loan cycles whose impact is permanent
        // Process ONLY the final deletion (one that's not merged into another)
        if (delCustomer.remainingAtDeletion === 0 && !delCustomer.mergedIntoTimestamp) {
          const uniqueKey = `${delCustomer.internalId}_${delCustomer.deletionTimestamp}`;
          
          if (!processedSettledCycles.has(uniqueKey)) {
            processedSettledCycles.add(uniqueKey);
            
            const day = delCustomer.deletedFrom;
            const timestamp = delCustomer.deletionTimestamp;
            const deletedInternalId = delCustomer.internalId || delCustomer.id;
            
            // SIMPLIFIED FIX: Only use THIS deletion's principal (not the entire chain)
            // The originalTakenAmount stores the loan amount for THIS specific cycle
            const originalTakenAmount = parseFloat(delCustomer.originalTakenAmount || delCustomer.takenAmount) || 0;
            const interest = parseFloat(delCustomer.interest) || 0;
            const pc = parseFloat(delCustomer.pc) || 0;
            const principal = originalTakenAmount - interest - pc;
            
            // Calculate total payments received (cash in) FOR THIS CYCLE ONLY
            // CRITICAL: Archived files may contain transactions from MULTIPLE cycles if customer was restored
            // We must only count payments made in THIS cycle (after restoration date)
            let totalPayments = 0;
            
            // Determine the start date for THIS cycle
            // If customer was restored, use the restoration date (stored in createdAt)
            // Otherwise, use the original customer creation date
            const cycleStartDate = delCustomer.wasRestoredCustomer && delCustomer.createdAt
              ? new Date(delCustomer.createdAt).getTime()
              : new Date(delCustomer.date).getTime(); // Original loan date
            
            // Load archived transactions from THIS deletion
            const archivedTransactions = fileManager.readJSON(
              `transactions_deleted/${lineId}/${day}/${deletedInternalId}_${timestamp}.json`
            ) || [];
            const archivedChat = fileManager.readJSON(
              `chat_deleted/${lineId}/${day}/${deletedInternalId}_${timestamp}.json`
            ) || [];
            
            // CRITICAL FIX: Only count payments made AFTER the cycle started (current cycle only)
            archivedTransactions.forEach(trans => {
              const transDate = new Date(trans.createdAt || trans.date).getTime();
              // Only include if transaction was made in THIS cycle
              if (transDate >= cycleStartDate) {
                totalPayments += parseFloat(trans.amount) || 0;
              }
            });
            archivedChat.forEach(chat => {
              const chatDate = new Date(chat.createdAt || chat.date).getTime();
              // Only include if chat was made in THIS cycle
              if (chatDate >= cycleStartDate) {
                totalPayments += parseFloat(chat.amount) || 0;
              }
            });
            
            // Net impact = payments - principal FOR THIS CYCLE ONLY
            // Positive means profit (customer paid more than principal in this cycle)
            const netImpact = totalPayments - principal;
            settledCyclesAdjustment += netImpact;
            
            console.log(`📊 Settled cycle for ${delCustomer.name} (${deletedInternalId}): Principal ${principal}, Payments ${totalPayments} (filtered by cycle), Net Impact ${netImpact}`);
          }
        }
      });

      // LOAN PERSPECTIVE: Count DELETED customers ONLY if they have UNPAID balance
      // remainingAtDeletion > 0 → Money still outstanding → COUNT
      const processedDeletedCustomers = new Set();
      
      deletedCustomers.forEach(delCustomer => {
        // Skip settled deletions (remainingAtDeletion = 0) - loan cycle complete
        // Their impact is now in settledCyclesAdjustment
        if (delCustomer.remainingAtDeletion === 0) {
          return;
        }
        
        // Skip if merged into next deletion - counted there instead
        if (delCustomer.mergedIntoTimestamp) {
          return;
        }
        
        // Skip if restored and migrated - counted in active customer
        if (delCustomer.isRestored && delCustomer.isMigrated) {
          return;
        }
        
        // This deleted customer has unpaid balance - count their loan
        const uniqueKey = `${delCustomer.internalId}_${delCustomer.deletionTimestamp}`;
        
        if (!processedDeletedCustomers.has(uniqueKey)) {
          processedDeletedCustomers.add(uniqueKey);
          
          const originalTakenAmount = parseFloat(delCustomer.originalTakenAmount || delCustomer.takenAmount) || 0;
          const interest = parseFloat(delCustomer.interest) || 0;
          const pc = parseFloat(delCustomer.pc) || 0;
          
          const netGiven = originalTakenAmount - interest - pc;
          totalNetGiven += netGiven;
        }
      });

      // Calculate total collected from customer transactions (ACTIVE customers ONLY)
      // LOAN PERSPECTIVE: Only count payments for CURRENT active loans
      // If customer was restored from settled deletion (remainingAtDeletion=0):
      //   - Old transactions are for CLOSED loans → DON'T count
      //   - Only count NEW transactions after restoration (for new loan)
      let totalCollected = 0;
      
      // Build map of active customers with restoration chain info
      const allActiveCustomers = {};
      days.forEach(dayFile => {
        const dayCustomers = fileManager.readJSON(`customers/${lineId}/${dayFile}`) || [];
        dayCustomers.forEach(customer => {
          const internalId = customer.internalId || customer.id;
          
          // Walk the restoration chain to find ALL settled deletions
          const settledDeletionTimestamps = [];
          if (customer.isRestoredCustomer && customer.restoredFromTimestamp) {
            let currentDeleted = deletedCustomers.find(
              dc => dc.id === customer.restoredFromId && 
                    dc.deletionTimestamp === customer.restoredFromTimestamp
            );
            
            // Walk backwards through restoration chain
            while (currentDeleted) {
              if (currentDeleted.remainingAtDeletion === 0) {
                settledDeletionTimestamps.push(currentDeleted.deletionTimestamp);
              }
              
              // Check if this was also a restored customer
              if (currentDeleted.wasRestoredCustomer && currentDeleted.restoredFromTimestamp) {
                currentDeleted = deletedCustomers.find(
                  dc => dc.internalId === currentDeleted.restoredFromInternalId &&
                        dc.deletionTimestamp === currentDeleted.restoredFromTimestamp
                );
              } else {
                break;
              }
            }
          }
          
          allActiveCustomers[internalId] = {
            isRestoredCustomer: customer.isRestoredCustomer || false,
            createdAt: customer.createdAt,
            settledDeletionTimestamps: settledDeletionTimestamps
          };
        });
      });
      
      // Transactions
      const transDays = fileManager.listFiles(`transactions/${lineId}`);
      transDays.forEach(dayFolder => {
        const transFiles = fileManager.listFiles(`transactions/${lineId}/${dayFolder}`);
        transFiles.forEach(file => {
          const transactions = fileManager.readJSON(`transactions/${lineId}/${dayFolder}/${file}`) || [];
          // Extract internalId from filename (format: internalId.json)
          const internalId = file.replace('.json', '');
          const customerInfo = allActiveCustomers[internalId];
          
          transactions.forEach(trans => {
            const customerInfo = allActiveCustomers[internalId];
            
            // LOAN PERSPECTIVE: Only count transactions for ACTIVE loans
            // If customer has settled restoration chain, only count NEW transactions
            if (customerInfo && customerInfo.settledDeletionTimestamps.length > 0) {
              const transDate = new Date(trans.createdAt || trans.date).getTime();
              const restorationDate = new Date(customerInfo.createdAt).getTime();
              
              // Only count if transaction is AFTER the customer was restored
              // Old transactions are for closed/settled loans
              if (transDate >= restorationDate) {
                totalCollected += parseFloat(trans.amount) || 0;
              }
            } else {
              // Normal customer - count all transactions
              totalCollected += parseFloat(trans.amount) || 0;
            }
          });
        });
      });

      // Chat transactions
      const chatDays = fileManager.listFiles(`chat/${lineId}`);
      chatDays.forEach(dayFolder => {
        const chatFiles = fileManager.listFiles(`chat/${lineId}/${dayFolder}`);
        chatFiles.forEach(file => {
          const chats = fileManager.readJSON(`chat/${lineId}/${dayFolder}/${file}`) || [];
          // Extract internalId from filename (format: internalId.json)
          const internalId = file.replace('.json', '');
          const customerInfo = allActiveCustomers[internalId];
          
          chats.forEach(chat => {
            const customerInfo = allActiveCustomers[internalId];
            
            // LOAN PERSPECTIVE: Only count chat for ACTIVE loans
            if (customerInfo && customerInfo.settledDeletionTimestamps.length > 0) {
              const chatDate = new Date(chat.createdAt || chat.date).getTime();
              const restorationDate = new Date(customerInfo.createdAt).getTime();
              
              // Only count if chat is AFTER the customer was restored
              if (chatDate >= restorationDate) {
                totalCollected += parseFloat(chat.amount) || 0;
              }
            } else {
              // Normal customer - count all chat
              totalCollected += parseFloat(chat.amount) || 0;
            }
          });
        });
      });

      // LOAN PERSPECTIVE: Count archived transactions ONLY for unsettled deletions
      // If remainingAtDeletion = 0 → Loan closed → DON'T count archived transactions
      // If remainingAtDeletion > 0 → Money outstanding → COUNT archived transactions
      deletedCustomers.forEach(delCustomer => {
        // Skip settled deletions - their loan cycle is complete
        if (delCustomer.remainingAtDeletion === 0) {
          return;
        }
        
        // Skip if merged - transactions counted in merged file
        if (delCustomer.mergedIntoTimestamp) {
          return;
        }
        
        // Skip if restored and migrated - transactions in active files
        if (delCustomer.isRestored && delCustomer.isMigrated) {
          return;
        }
        
        const day = delCustomer.deletedFrom;
        const timestamp = delCustomer.deletionTimestamp;
        // CRITICAL: Use internalId (not id) because archived files are saved with internalId
        const deletedInternalId = delCustomer.internalId || delCustomer.id;
        
        // Load archived transactions
        const archivedTransactions = fileManager.readJSON(
          `transactions_deleted/${lineId}/${day}/${deletedInternalId}_${timestamp}.json`
        ) || [];
        archivedTransactions.forEach(trans => {
          totalCollected += parseFloat(trans.amount) || 0;
        });
        
        // Load archived chat transactions
        const archivedChat = fileManager.readJSON(
          `chat_deleted/${lineId}/${day}/${deletedInternalId}_${timestamp}.json`
        ) || [];
        archivedChat.forEach(chat => {
          totalCollected += parseFloat(chat.amount) || 0;
        });
      });

      // Calculate total NET renewals - Count ALL renewals (ACTIVE customers)
      // NET = takenAmount - interest - pc (actual cash going out for renewal)
      // Note: Each renewal represents an actual cash outflow
      // CRITICAL: For restored customers with migrated data, only count NEW renewals (after restoration)
      let totalNetRenewals = 0;
      const renewalDayFolders = fileManager.listFiles(`renewals/${lineId}`);
      renewalDayFolders.forEach(dayFolder => {
        const renewalFiles = fileManager.listFiles(`renewals/${lineId}/${dayFolder}`);
        renewalFiles.forEach(file => {
          const renewals = fileManager.readJSON(`renewals/${lineId}/${dayFolder}/${file}`) || [];
          // Extract internalId from filename (format: internalId.json)
          const internalId = file.replace('.json', '');
          const customerInfo = allActiveCustomers[internalId];
          
          // Count renewals
          renewals.forEach(renewal => {
            const customerInfo = allActiveCustomers[internalId];
            
            // LOAN PERSPECTIVE: Only count renewals for ACTIVE loans
            if (customerInfo && customerInfo.settledDeletionTimestamps.length > 0) {
              const renewalDate = new Date(renewal.renewalDate || renewal.date || renewal.createdAt).getTime();
              const restorationDate = new Date(customerInfo.createdAt).getTime();
              
              // Only count if renewal is AFTER the customer was restored
              if (renewalDate >= restorationDate) {
                const takenAmount = parseFloat(renewal.takenAmount) || 0;
                const interest = parseFloat(renewal.interest) || 0;
                const pc = parseFloat(renewal.pc) || 0;
                const netRenewal = takenAmount - interest - pc;
                totalNetRenewals += netRenewal;
              }
            } else {
              // Normal customer - count all renewals
              const takenAmount = parseFloat(renewal.takenAmount) || 0;
              const interest = parseFloat(renewal.interest) || 0;
              const pc = parseFloat(renewal.pc) || 0;
              const netRenewal = takenAmount - interest - pc;
              totalNetRenewals += netRenewal;
            }
          });
        });
      });

      // LOAN PERSPECTIVE: Count archived renewals ONLY for unsettled deletions
      // If remainingAtDeletion = 0 → Loan closed → DON'T count archived renewals
      // If remainingAtDeletion > 0 → Money outstanding → COUNT archived renewals
      deletedCustomers.forEach(delCustomer => {
        // Skip settled deletions - their loan cycle is complete
        if (delCustomer.remainingAtDeletion === 0) {
          return;
        }
        
        // Skip if merged - renewals counted in merged file
        if (delCustomer.mergedIntoTimestamp) {
          return;
        }
        
        // Skip if restored and migrated - renewals in active files
        if (delCustomer.isRestored && delCustomer.isMigrated) {
          return;
        }
        
        const day = delCustomer.deletedFrom;
        const timestamp = delCustomer.deletionTimestamp;
        // CRITICAL: Use internalId (not id) because archived files are saved with internalId
        const deletedInternalId = delCustomer.internalId || delCustomer.id;
        
        // Load archived renewals
        const archivedRenewals = fileManager.readJSON(
          `renewals_deleted/${lineId}/${day}/${deletedInternalId}_${timestamp}.json`
        ) || [];
        archivedRenewals.forEach(renewal => {
          const takenAmount = parseFloat(renewal.takenAmount) || 0;
          const interest = parseFloat(renewal.interest) || 0;
          const pc = parseFloat(renewal.pc) || 0;
          // NET cash given = takenAmount - interest - pc
          const netRenewal = takenAmount - interest - pc;
          totalNetRenewals += netRenewal;
        });
      });

      // Calculate net from Account transactions (credit - debit)
      let accountNet = 0;
      const accounts = fileManager.readJSON(`accounts/${lineId}.json`) || [];
      accounts.forEach(account => {
        const transactions = fileManager.readJSON(`account_transactions/${lineId}/${account.id}.json`) || [];
        transactions.forEach(trans => {
          accountNet += (parseFloat(trans.creditAmount) || 0) - (parseFloat(trans.debitAmount) || 0);
        });
      });

      // BF = Initial Amount - Total Net Given + Total Collected - Total Net Renewals + Account Net + Settled Cycles Adjustment
      // NET Given/Renewals = takenAmount - interest - pc (actual cash out)
      // Total Collected = full payments received (actual cash in)
      // Settled Cycles Adjustment = net impact of all completed loan cycles (payments - principal)
      // Only the LATEST renewal per customer is counted (old renewals were settled)
      const bfAmount = initialAmount - totalNetGiven + totalCollected - totalNetRenewals + accountNet + settledCyclesAdjustment;

      console.log('BF Calculation Debug:', {
        initialAmount,
        totalNetGiven,
        totalCollected,
        totalNetRenewals,
        accountNet,
        settledCyclesAdjustment,
        bfAmount
      });

      return {
        bfAmount,
        breakdown: {
          initialAmount,
          totalNetGiven,
          totalCollected,
          totalNetRenewals,
          accountNet,
          settledCyclesAdjustment
        }
      };
    } catch (error) {
      console.error('Error calculating BF:', error);
      throw error;
    }
  }

  /**
   * Update BF for a line (stores in line data)
   */
  updateBF(lineId) {
    const result = this.calculateBF(lineId);
    
    // Update line with new BF
    const lines = fileManager.readJSON('lines.json') || [];
    const updatedLines = lines.map(line => {
      if (line.id === lineId) {
        return { ...line, currentBF: result.bfAmount };
      }
      return line;
    });
    
    fileManager.writeJSON('lines.json', updatedLines);
    return result;
  }
}

module.exports = new BFCalculationService();
