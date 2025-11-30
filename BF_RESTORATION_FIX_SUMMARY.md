# BF Calculation Fix for Restored Customers with New Loans

## Issue Description

When a customer was restored with a **NEW loan** after settling their old loan (remainingAtDeletion = 0), the BF (Brought Forward) calculation was incorrectly **SKIPPING** their old archived transactions and renewals, leading to incorrect BF amounts.

## Example Scenario

### Expected Behavior:
1. **Initial BF:** 50,000
2. **Old loan given:** 10,000 principal → BF: 40,000 (cash outflow)
3. **Old payment received:** 12,000 → BF: 52,000 (cash inflow, includes 2,000 profit)
4. **Customer deleted (settled):** remainingAtDeletion = 0 → BF stays: 52,000
5. **Customer restored with NEW loan:** 4,000 principal → **BF should be: 48,000**

### Calculation:
```
BF = Initial - Old Loan + Old Payments - New Loan
BF = 50,000 - 10,000 + 12,000 - 4,000 = 48,000 ✅
```

## Root Cause

In `/app/backend/services/bfCalculation.js`, the skip logic at lines 144-146 and 223-225 was:

```javascript
if (delCustomer.isRestored && delCustomer.isMigrated) {
  return; // Skip - data already in active customer files
}
```

**Problem:** This skipped **ALL** restored customers' archived data, including those with **settled loans** (remainingAtDeletion = 0).

**Why this is wrong:**
- When a customer is restored with a settled old loan, the archived transactions represent **REAL historical cash flow**
- These transactions are NOT part of the new customer's loan balance calculation
- But they MUST be counted in BF calculation because the money actually moved

## The Fix

Changed the skip condition to check `remainingAtDeletion`:

```javascript
if (delCustomer.isRestored && delCustomer.isMigrated && delCustomer.remainingAtDeletion > 0) {
  return; // Skip only if unpaid balance was carried forward
}
```

### Fixed Logic:

**Case 1: Restored with Unpaid Balance (remainingAtDeletion > 0)**
- Old transactions are **migrated** to new customer's files
- Skip archived data to avoid double counting
- New customer continues paying off the old loan

**Case 2: Restored with Settled Loan (remainingAtDeletion = 0)**
- Old transactions stay in archived files (not migrated to new customer)
- **Count archived data** in BF calculation (real historical cash flow)
- New customer starts fresh with a new loan
- Old loan and payments are separate from new loan

## Files Modified

### `/app/backend/services/bfCalculation.js`

1. **Lines 141-172:** Fixed `totalCollected` calculation for deleted customers
   - Now counts archived transactions when `remainingAtDeletion = 0`
   
2. **Lines 218-245:** Fixed `totalNetRenewals` calculation for deleted customers
   - Now counts archived renewals when `remainingAtDeletion = 0`

## How BF is Now Calculated for Restored Customers

```javascript
// Old deleted customer loan (always counted)
totalNetGiven += oldLoanAmount; // From lines 44-59

// Old deleted customer payments (NOW FIXED - counted when settled)
if (remainingAtDeletion === 0 || !isMigrated) {
  totalCollected += oldPayments; // From lines 141-172
}

// New active customer loan (always counted)
totalNetGiven += newLoanAmount; // From lines 22-34

// New active customer payments (always counted)
totalCollected += newPayments; // From lines 82-137

// Final BF
BF = Initial - totalNetGiven + totalCollected - totalNetRenewals + accountNet
```

## Testing Verification

To verify the fix works:

1. Create a customer with a loan (e.g., 10k)
2. Customer makes payments (e.g., 12k total)
3. Delete customer when settled (remaining = 0)
4. Note the BF amount
5. Restore customer with a NEW different loan amount (e.g., 4k)
6. Verify BF decreased by the new loan amount only

**Expected:** BF should properly account for both old and new cash flows

## Impact

✅ **Correct BF calculation** for restored customers with settled old loans  
✅ **No double counting** of transactions  
✅ **Accurate cash flow tracking** across delete-restore cycles  
✅ **Maintains historical data integrity**

## Related Code

- Customer restoration: `/app/backend/controllers/customerController.js` lines 773-920
- Customer balance calculation: `/app/backend/controllers/customerController.js` lines 61-93
- BF calculation service: `/app/backend/services/bfCalculation.js`
