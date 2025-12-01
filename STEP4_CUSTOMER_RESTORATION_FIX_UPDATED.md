# STEP 4 — CUSTOMER RESTORATION LOGIC FIX (UPDATED WITH "restored" TAG)

## Problem Statement

The old restore logic caused BF corruption by:
- Recalculating old history
- Walking restoration chains
- Applying migration/archive logic
- Incorrectly reapplying previous loans or payments

All of that complexity has been removed.

---

## ✅ REQUIRED RESTORE BEHAVIOR

Restoring a customer must ONLY do the following:

### 1. Re-create the customer in active list

- Load deleted entry
- Use SAME `internalId`
- Assign a NEW visible `customerId` (if available)
- Clear deleted flags
- Set:
  - `isRestoredCustomer = true`
  - `restoredAt = <timestamp>`
  - `restoredFrom = <day>`

### 2. Create ONE new loan for the restored customer

This is the ONLY transaction created during restore.

**Loan fields MUST include:**
- `type: "restored"` (NOT "loan")
- `loanType: "restoredLoan"`
- `isRestoredLoan: true`
- `restoredAt: <timestamp>`
- `customerId: <newId>`
- `amount: <takenAmount>`
- `date: <date>`
- `comment: "Restored customer - New loan of ₹{amount}"`

### 3. BF update on restore

Compute principal:
```
principal = Amount – Interest – PC
BF = BF – principal
```

**NO other BF logic should run.**

### 4. History rules (IMPORTANT)

- ❌ Do NOT modify old transactions
- ❌ Do NOT delete or rewrite old files
- ✅ Old loans/payments remain exactly as they are
- ✅ Old items must NOT be tagged as restored
- ✅ Only the NEW restore loan gets `type: "restored"`

### 5. File storage

- Append only the new restore loan to: `transactions/{lineId}/{day}/{internalId}.json`

**Do NOT modify:**
- Old chat files
- Old loan entries
- Old renewals
- Timestamps
- IDs

---

## ❌ BLOCK ALL OTHER LOGIC

**STRICTLY DISABLE during restore:**
- ❌ BF recalculation (beyond simple principal subtraction)
- ❌ Settlement logic
- ❌ Restoration-chain logic
- ❌ Timestamp filtering
- ❌ Archived logic
- ❌ Migration logic
- ❌ Merging logic
- ❌ Renewal logic
- ❌ `remainingAtDeletion` logic
- ❌ Replay/reapply old loans or payments
- ❌ Generating new `internalId`
- ❌ Modifying old history files

**Restore = SIMPLE:**
Bring back customer + make one "restored loan".

---

## 🧱 RESTORE FLOW (FINAL)

`restoreCustomer()` must do exactly:

1. **Find customer in deleted_customers**
   ```javascript
   const deletedCustomer = deletedCustomers.find(c => 
     c.id === id && 
     c.deletedFrom === deletedFrom && 
     c.deletionTimestamp === parseInt(deletionTimestamp)
   );
   ```

2. **Create new active customer object:**
   ```javascript
   const restoredCustomer = {
     id: newId,                        // New visible customerId
     internalId: oldInternalId,        // SAME internalId (CRITICAL)
     name: deletedCustomer.name,
     village: deletedCustomer.village,
     phone: deletedCustomer.phone,
     profileImage: deletedCustomer.profileImage,
     takenAmount: parseFloat(takenAmount),
     interest: interestValue,
     pc: pcValue,
     date: date || new Date().toISOString().split('T')[0],
     weeks: weeks || deletedCustomer.weeks,
     isRestoredCustomer: true,         // Flag for restored customer
     restoredAt: Date.now(),           // Timestamp
     restoredFrom: deletedFrom         // Day file
   };
   ```

3. **Save in active customers**
   ```javascript
   activeCustomers.push(restoredCustomer);
   fileManager.writeJSON(`customers/${lineId}/${deletedFrom}.json`, activeCustomers);
   ```

4. **Remove from deleted_customers**
   ```javascript
   // Mark as restored
   deletedCustomers = deletedCustomers.map(c => {
     if (c.id === id && c.deletionTimestamp === deletedCustomer.deletionTimestamp) {
       return { ...c, isRestored: true, restoredAs: newId, restoredDate: new Date().toISOString() };
     }
     return c;
   });
   fileManager.writeJSON(`deleted_customers/${lineId}.json`, deletedCustomers);
   ```

5. **Create new loan object with "restored" type:**
   ```javascript
   const newLoanTransaction = new Transaction({
     customerId: newId,
     amount: parseFloat(takenAmount),
     date: date || new Date().toISOString().split('T')[0],
     comment: `Restored customer - New loan of ₹${takenAmount}`,
     type: 'restored',              // STEP 4: Use "restored" type
     loanType: 'restoredLoan',      // Additional marker
     isRestoredLoan: true,          // Flag for restored loan
     restoredAt: Date.now()         // Timestamp of restoration
   });
   ```

6. **Append ONLY this loan to transactions file**
   ```javascript
   const transactionPath = `transactions/${lineId}/${deletedFrom}/${oldInternalId}.json`;
   let transactions = fileManager.readJSON(transactionPath) || [];
   transactions.push(newLoanTransaction.toJSON());
   fileManager.writeJSON(transactionPath, transactions);
   ```

7. **Update BF = BF – principal**
   ```javascript
   const principal = parseFloat(takenAmount) - interestValue - pcValue;
   const newBF = currentBF - principal;
   
   // Update line
   const updatedLines = lines.map(l => {
     if (l.id === lineId) {
       return { ...l, currentBF: newBF };
     }
     return l;
   });
   fileManager.writeJSON('lines.json', updatedLines);
   ```

8. **Done — no other logic MUST run.**

---

## 🧪 REQUIRED TESTS

### ✔️ Test 1 — Restore produces a loan with correct tag

**Scenario:**
- Delete customer → Restore with amount=5000, interest=1000

**Expected:**
Transactions file must append:
```json
{
  "type": "restored",
  "loanType": "restoredLoan",
  "isRestoredLoan": true,
  "principal": 4000,
  "amount": 5000,
  "interest": 1000,
  "pc": 0
}
```

**Verification:**
- No old transaction is changed
- Old loans remain with `type: "loan"`

---

### ✔️ Test 2 — Old history untouched

**Scenario:**
- Customer has old loans with `type: "loan"`
- Delete → Restore

**Expected:**
Old loans must remain:
- Same timestamps
- Same `type: "loan"` (NOT rewritten to "restored")
- NOT relabeled
- NOT modified in any way

---

### ✔️ Test 3 — Multiple restore cycles

**Scenario:**
- Create → Delete → Restore → Delete → Restore

**Expected:**
- Each restore creates ONE new "restored" loan
- BF reduces ONLY by that loan's principal each time
- Old history accumulates but is never modified

---

### ✔️ Test 4 — Visible ID conflict check

**Scenario:**
- Restore into an ID that is taken

**Expected:**
- ❌ Restore FAILS with error

**Scenario:**
- Restore into a free ID

**Expected:**
- ✅ Restore succeeds
- New visible customerId assigned
- SAME internalId preserved

---

## 📄 IMPLEMENTATION SUMMARY

### Files Modified

#### 1. `/app/backend/controllers/customerController.js`

**Function:** `restoreCustomer()` (Lines 477-634)

**Key Changes:**
- Transaction `type` changed from `"loan"` to `"restored"`
- Added `loanType: "restoredLoan"`
- Added `isRestoredLoan: true`
- Added `restoredAt: Date.now()`

**Before:**
```javascript
const newLoanTransaction = new Transaction({
  customerId: newId,
  amount: parseFloat(takenAmount),
  date: date || new Date().toISOString().split('T')[0],
  comment: `Restored customer - New loan of ₹${takenAmount}`,
  type: 'loan'  // ❌ Wrong type
});
```

**After:**
```javascript
const newLoanTransaction = new Transaction({
  customerId: newId,
  amount: parseFloat(takenAmount),
  date: date || new Date().toISOString().split('T')[0],
  comment: `Restored customer - New loan of ₹${takenAmount}`,
  type: 'restored',           // ✅ Correct type
  loanType: 'restoredLoan',   // ✅ Additional marker
  isRestoredLoan: true,       // ✅ Flag for restored loan
  restoredAt: Date.now()      // ✅ Timestamp of restoration
});
```

**Result:**
- Restored loans are now correctly tagged with `type: "restored"`
- Can be distinguished from original loans (`type: "loan"`)
- Easy to identify in transaction history
- No confusion between new customer loans and restored customer loans

---

## 🎯 Key Principles (Final)

1. **ONE ACTION = Restore customer with SAME internalId**
2. **ONE NEW LOAN = Tagged as "restored"**
3. **ONE BF UPDATE = Simple principal subtraction**
4. **ZERO OLD HISTORY MODIFICATIONS = All files remain intact**
5. **ZERO COMPLEX LOGIC = No chains, no archived data, no migration**

---

## 🔍 Verification Checklist

- [x] Restore uses SAME internalId
- [x] New visible customerId assigned
- [x] ONE new loan created with `type: "restored"`
- [x] BF updated using ONLY principal
- [x] Old transactions NOT modified
- [x] Old transactions NOT tagged as "restored"
- [x] NO archived logic runs
- [x] NO chain walking logic runs
- [x] NO migration logic runs
- [x] NO settlement logic runs
- [x] NO BF recalculation logic runs
- [x] Transaction files use SAME internalId
- [x] History remains intact and visible

---

## 🚀 Testing Commands

### Test restore with correct tag:
```bash
node /app/test_step4_restore.js
```

### Verify transaction type:
```javascript
// Read transactions file
const transactions = require('/app/backend/data/transactions/{lineId}/{day}/{internalId}.json');

// Find restored loan
const restoredLoan = transactions.find(t => t.type === 'restored');

// Verify fields
console.assert(restoredLoan.type === 'restored');
console.assert(restoredLoan.isRestoredLoan === true);
console.assert(restoredLoan.loanType === 'restoredLoan');
console.assert(restoredLoan.restoredAt !== undefined);
```

---

## 📊 Expected Behavior Examples

### Example 1: First Restore
```
Initial State:
- Customer C001 deleted with internalId: "abc123"
- BF = ₹100,000

Restore Action:
- Restore as C005 with amount=₹10,000, interest=₹1,000, pc=₹500
- principal = 10,000 - 1,000 - 500 = ₹8,500

Result:
- Customer C005 created with internalId: "abc123" (SAME)
- Transaction added: { type: "restored", amount: 10000, ... }
- BF = 100,000 - 8,500 = ₹91,500
```

### Example 2: Multiple Restores
```
Cycle 1:
- Create C001 → Delete → BF unchanged
- Restore as C002 with ₹5,000 → BF reduced by principal

Cycle 2:
- Delete C002 → BF unchanged
- Restore as C003 with ₹7,000 → BF reduced by principal

Result:
- Transaction file contains:
  1. Original loan (type: "loan")
  2. First restored loan (type: "restored")
  3. Second restored loan (type: "restored")
- All loans clearly identifiable by type
- BF correctly reflects all principals
```

---

## ✅ DELIVERABLE COMPLETE

This document describes:
- ✅ Problem (old restore logic corruption)
- ✅ Clean restore logic (SAME internalId, ONE loan, simple BF)
- ✅ Exact changes (type: "restored" with flags)
- ✅ The "restored" loan tagging rules
- ✅ BF update logic (principal only)
- ✅ Disabled old logic list (no chains, no archives, no migration)
- ✅ Test cases (4 comprehensive tests)

**STEP 4 CUSTOMER RESTORATION FIX IS COMPLETE AND DOCUMENTED.**
