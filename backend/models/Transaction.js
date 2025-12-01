class Transaction {
  constructor(data) {
    this.id = data.id || Date.now().toString();
    this.amount = parseFloat(data.amount) || 0;
    this.date = data.date;
    this.comment = data.comment || '';
    this.customerName = data.customerName || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    // STEP 6: Add type and source fields for payment tracking
    this.type = data.type || 'payment';  // payment, renewal, restored, loan, etc.
    this.source = data.source;            // 'quick' or 'chat' for payments
    
    // STEP 5: Support renewal fields
    if (data.loanType) this.loanType = data.loanType;
    if (data.isRenewal !== undefined) this.isRenewal = data.isRenewal;
    if (data.renewedAt) this.renewedAt = data.renewedAt;
    if (data.interest !== undefined) this.interest = data.interest;
    if (data.pc !== undefined) this.pc = data.pc;
    if (data.weeks) this.weeks = data.weeks;
    
    // STEP 4: Support restored loan fields
    if (data.isRestoredLoan !== undefined) this.isRestoredLoan = data.isRestoredLoan;
    if (data.restoredAt) this.restoredAt = data.restoredAt;
  }

  toJSON() {
    const json = {
      id: this.id,
      amount: this.amount,
      date: this.date,
      comment: this.comment,
      customerName: this.customerName,
      createdAt: this.createdAt,
      type: this.type
    };
    
    // STEP 6: Include source if present
    if (this.source) json.source = this.source;
    
    // STEP 5: Include renewal fields if present
    if (this.loanType) json.loanType = this.loanType;
    if (this.isRenewal !== undefined) json.isRenewal = this.isRenewal;
    if (this.renewedAt) json.renewedAt = this.renewedAt;
    if (this.interest !== undefined) json.interest = this.interest;
    if (this.pc !== undefined) json.pc = this.pc;
    if (this.weeks) json.weeks = this.weeks;
    
    // STEP 4: Include restored loan fields if present
    if (this.isRestoredLoan !== undefined) json.isRestoredLoan = this.isRestoredLoan;
    if (this.restoredAt) json.restoredAt = this.restoredAt;
    
    return json;
  }
}

module.exports = Transaction;
