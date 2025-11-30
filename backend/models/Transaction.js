class Transaction {
  constructor(data) {
    this.id = data.id || Date.now().toString();
    this.amount = parseFloat(data.amount) || 0;
    this.date = data.date;
    this.comment = data.comment || '';
    this.customerName = data.customerName || '';
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      amount: this.amount,
      date: this.date,
      comment: this.comment,
      customerName: this.customerName,
      createdAt: this.createdAt
    };
  }
}

module.exports = Transaction;
