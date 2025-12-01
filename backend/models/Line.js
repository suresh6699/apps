class Line {
  constructor(data) {
    this.id = data.id || Date.now().toString();
    this.name = data.name;
    this.type = data.type; // 'Daily' or 'Weekly'
    this.days = data.days || []; // Array of day names
    this.amount = parseFloat(data.amount) || 0; // Initial BF amount
    this.currentBF = parseFloat(data.currentBF) || parseFloat(data.amount) || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      days: this.days,
      amount: this.amount,
      currentBF: this.currentBF,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Line;
