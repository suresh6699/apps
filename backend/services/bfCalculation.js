const fileManager = require('./fileManager');

class BFCalculationService {
  /**
   * STEP 7: SIMPLIFIED BF CALCULATION
   * Calculate BF for a specific line - ACTIVE CUSTOMERS ONLY
   * BF = InitialAmount - TotalNetGiven + TotalCollected + AccountNet
   * 
   * REMOVED IN STEP 7:
   * - Settlement cycle logic
   * - Archived folder access (transactions_deleted, chat_deleted, renewals_deleted)
   * - Chain walking logic
   * - Migration checks (isMigrated, mergedIntoTimestamp)
   * - Timestamp filtering for restored customers
   * - remainingAtDeletion logic
   * - Deleted customer processing
   * 
   * This function now ONLY processes ACTIVE customers.
   * For deleted customer history viewing, use the specific deleted customer functions.
   */
  calculateBF(lineId) {
    try {
      console.log('🧮 STEP 7: Calculating BF using simplified logic (active customers only)');
      
      // Get line's initial amount
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      const initialAmount = line ? parseFloat(line.amount) || 0 : 0;

      // Calculate total NET given to ALL ACTIVE customers across ALL days
      // NET = takenAmount - interest - pc (actual cash going out)
      let totalNetGiven = 0;
      const days = fileManager.listFiles(`customers/${lineId}`);
      
      // STEP 8 FIX: Build a set of active customer internalIds
      // We'll use this to only count transactions from ACTIVE customers
      const activeInternalIds = new Set();
      
      days.forEach(dayFile => {
        const customers = fileManager.readJSON(`customers/${lineId}/${dayFile}`) || [];
        customers.forEach(customer => {
          const takenAmount = parseFloat(customer.takenAmount) || 0;
          const interest = parseFloat(customer.interest) || 0;
          const pc = parseFloat(customer.pc) || 0;
          const netGiven = takenAmount - interest - pc;
          totalNetGiven += netGiven;
          
          // STEP 8 FIX: Track active customer internalIds
          const internalId = customer.internalId || customer.id;
          activeInternalIds.add(internalId);
        });
      });

      console.log(`📊 STEP 8: Found ${activeInternalIds.size} active customers for line ${lineId}`);

      // STEP 8 FIX: Calculate total collected from ACTIVE customer transactions ONLY
      // This prevents BF from jumping when customers are deleted
      // Deleted customer transactions remain in files but are NOT counted
      let totalCollected = 0;
      
      // Transactions
      const transDays = fileManager.listFiles(`transactions/${lineId}`);
      transDays.forEach(dayFolder => {
        const transFiles = fileManager.listFiles(`transactions/${lineId}/${dayFolder}`);
        transFiles.forEach(file => {
          // Extract internalId from filename (e.g., "123_abc.json" → "123_abc")
          const internalId = file.replace('.json', '');
          
          // STEP 8 FIX: Only count transactions if customer is ACTIVE
          if (activeInternalIds.has(internalId)) {
            const transactions = fileManager.readJSON(`transactions/${lineId}/${dayFolder}/${file}`) || [];
            transactions.forEach(trans => {
              // Count all payments (including those with type: 'payment')
              if (trans.type === 'payment' || trans.amount) {
                totalCollected += parseFloat(trans.amount) || 0;
              }
            });
          }
        });
      });

      console.log(`💰 STEP 8: Counted transactions from ${activeInternalIds.size} active customers only`);

      // FIXED: Chat folder NO LONGER used for BF calculation
      // Chat payments are now saved directly to transactions/ folder (STEP 6)
      // Chat folder contains ONLY text messages/comments (no payments)
      // This prevents double-counting of payments

      // Calculate net from Account transactions (credit - debit)
      let accountNet = 0;
      const accounts = fileManager.readJSON(`accounts/${lineId}.json`) || [];
      accounts.forEach(account => {
        const transactions = fileManager.readJSON(`account_transactions/${lineId}/${account.id}.json`) || [];
        transactions.forEach(trans => {
          accountNet += (parseFloat(trans.creditAmount) || 0) - (parseFloat(trans.debitAmount) || 0);
        });
      });

      // STEP 8: Simple BF calculation - ONLY active customers
      // NO settlement adjustment, NO deleted customer processing
      // Transactions from deleted customers are NOT counted
      const bfAmount = initialAmount - totalNetGiven + totalCollected + accountNet;

      console.log('✅ STEP 8 BF Calculation (Active Customers Only):', {
        lineId,
        activeCustomers: activeInternalIds.size,
        initialAmount,
        totalNetGiven,
        totalCollected,
        accountNet,
        bfAmount
      });

      return {
        bfAmount,
        breakdown: {
          initialAmount,
          totalNetGiven,
          totalCollected,
          accountNet
        }
      };
    } catch (error) {
      console.error('❌ Error calculating BF:', error);
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
