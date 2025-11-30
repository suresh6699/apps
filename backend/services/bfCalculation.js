const fileManager = require('./fileManager');

/**
 * INCREMENTAL-ONLY BF Calculation Service
 * 
 * BF is updated ONLY when NEW transactions occur:
 * - NEW loan: BF -= principal
 * - NEW payment: BF += payment
 * - NEW renewal: BF -= principal (treated as new loan)
 * 
 * BF is NEVER updated on:
 * - Delete customer
 * - Restore customer
 * - Update customer
 * 
 * NO recalculation from historical data
 * NO cycle settlement logic
 * NO merge chain walking
 * NO restoration chain processing
 */
class BFCalculationService {
  /**
   * Get current BF for a line
   */
  getCurrentBF(lineId) {
    const lines = fileManager.readJSON('lines.json') || [];
    const line = lines.find(l => l.id === lineId);
    return line ? (parseFloat(line.currentBF) || parseFloat(line.amount) || 0) : 0;
  }

  /**
   * Decrement BF (for NEW loans and renewals)
   * @param {string} lineId - Line ID
   * @param {number} principal - Principal amount (takenAmount - interest - pc)
   */
  decrementBF(lineId, principal) {
    const lines = fileManager.readJSON('lines.json') || [];
    const lineIndex = lines.findIndex(l => l.id === lineId);
    
    if (lineIndex === -1) {
      throw new Error('Line not found');
    }
    
    const currentBF = this.getCurrentBF(lineId);
    const newBF = currentBF - parseFloat(principal);
    
    lines[lineIndex].currentBF = newBF;
    fileManager.writeJSON('lines.json', lines);
    
    console.log(`💰 BF Decremented: ${currentBF} - ${principal} = ${newBF}`);
    
    return {
      bfAmount: newBF,
      previousBF: currentBF,
      change: -parseFloat(principal)
    };
  }

  /**
   * Increment BF (for NEW payments)
   * @param {string} lineId - Line ID
   * @param {number} payment - Payment amount
   */
  incrementBF(lineId, payment) {
    const lines = fileManager.readJSON('lines.json') || [];
    const lineIndex = lines.findIndex(l => l.id === lineId);
    
    if (lineIndex === -1) {
      throw new Error('Line not found');
    }
    
    const currentBF = this.getCurrentBF(lineId);
    const newBF = currentBF + parseFloat(payment);
    
    lines[lineIndex].currentBF = newBF;
    fileManager.writeJSON('lines.json', lines);
    
    console.log(`💰 BF Incremented: ${currentBF} + ${payment} = ${newBF}`);
    
    return {
      bfAmount: newBF,
      previousBF: currentBF,
      change: parseFloat(payment)
    };
  }

  /**
   * Adjust BF for account transactions (credit/debit)
   * @param {string} lineId - Line ID
   * @param {number} amount - Amount (positive for credit, negative for debit)
   */
  adjustBFForAccount(lineId, amount) {
    const lines = fileManager.readJSON('lines.json') || [];
    const lineIndex = lines.findIndex(l => l.id === lineId);
    
    if (lineIndex === -1) {
      throw new Error('Line not found');
    }
    
    const currentBF = this.getCurrentBF(lineId);
    const newBF = currentBF + parseFloat(amount);
    
    lines[lineIndex].currentBF = newBF;
    fileManager.writeJSON('lines.json', lines);
    
    console.log(`💰 BF Adjusted (Account): ${currentBF} + ${amount} = ${newBF}`);
    
    return {
      bfAmount: newBF,
      previousBF: currentBF,
      change: parseFloat(amount)
    };
  }

  /**
   * Legacy method - now just returns current BF without recalculation
   * Kept for backward compatibility but does NOT recalculate
   */
  updateBF(lineId) {
    const currentBF = this.getCurrentBF(lineId);
    console.log(`ℹ️ BF Read (no recalculation): ${currentBF}`);
    return {
      bfAmount: currentBF
    };
  }
}

module.exports = new BFCalculationService();
