class Customer {
  constructor(data) {
    // STEP 1: NEW CUSTOMER + FIRST LOAN
    // Customer ID: User-facing identifier (can be reused, for display only)
    // Internal ID: Permanent unique backend identifier (NEVER reused)
    this.id = data.id; // User-facing ID (can be non-unique, for display)
    this.internalId = data.internalId || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // Backend unique ID
    this.name = data.name;
    this.village = data.village || '';
    this.phone = data.phone || '';
    
    // STEP 1: First loan details
    // takenAmount: Total amount customer receives (includes interest + pc)
    // interest: Interest amount (profit)
    // pc: Processing charge (profit)
    // principal: Actual cash given = takenAmount - interest - pc
    this.takenAmount = parseFloat(data.takenAmount) || 0;
    // Use nullish coalescing to allow 0 values for interest and pc
    this.interest = data.interest !== undefined && data.interest !== null ? data.interest : '';
    this.pc = data.pc !== undefined && data.pc !== null ? data.pc : '';
    this.date = data.date;
    this.weeks = parseInt(data.weeks) || 12;
    this.profileImage = data.profileImage || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    
    // Restoration flags - preserve these if present (NOT used for NEW customers)
    // These flags are ONLY set when restoring a deleted customer
    // NEW customers will NOT have these flags
    if (data.isRestoredCustomer) {
      this.isRestoredCustomer = data.isRestoredCustomer;
      this.restoredFromId = data.restoredFromId;
      this.restoredFromInternalId = data.restoredFromInternalId;
      this.restoredFromTimestamp = data.restoredFromTimestamp;
    }
  }

  toJSON() {
    const json = {
      id: this.id,
      internalId: this.internalId, // Include internal ID in JSON
      name: this.name,
      village: this.village,
      phone: this.phone,
      takenAmount: this.takenAmount,
      interest: this.interest,
      pc: this.pc,
      date: this.date,
      weeks: this.weeks,
      profileImage: this.profileImage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
    
    // Include restoration flags if this is a restored customer
    if (this.isRestoredCustomer) {
      json.isRestoredCustomer = this.isRestoredCustomer;
      json.restoredFromId = this.restoredFromId;
      json.restoredFromInternalId = this.restoredFromInternalId;
      json.restoredFromTimestamp = this.restoredFromTimestamp;
    }
    
    return json;
  }
}

module.exports = Customer;
