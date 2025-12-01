# STEP 7: SYSTEM TESTING — BF CALCULATION VERIFICATION

## Purpose

This document contains **5 complete test scenarios** to verify that the BF calculation logic follows Steps 1-7 correctly after the system cleanup.

**Core Rules (Steps 1-7):**
- **New Loan:** BF = BF - principal (where principal = amount - interest - pc)
- **Payment:** BF = BF + amount
- **Delete:** BF unchanged (soft delete only)
- **Restore:** Reuse SAME internalId, create new loan, BF = BF - principal
- **Renewal:** BF = BF - principal (for renewal amount)

**No Legacy Logic:**
- ❌ NO settlement logic
- ❌ NO archived folder logic
- ❌ NO chain walking
- ❌ NO migration checks
- ❌ NO remainingAtDeletion
- ❌ NO bfCalculation.updateBF() for payments/delete
- ✅ ONLY incremental BF updates

---

## SCENARIO 1: Simple Loan → Payment → Delete → Restore

**Description:** Basic flow with one loan, one payment, delete, and restore.

| Step | Action | Amount | Interest | PC | Principal | Expected BF | Actual BF | Result |
|------|--------|--------|----------|-------|-----------|-------------|-----------|--------|
| 0 | Initial BF | - | - | - | - | 50,000 | | |
| 1 | Create Customer "001" - New Loan | 12,000 | 1,200 | 800 | 10,000 | 40,000 | | |
| 2 | Add Payment (Quick Transaction) | 5,000 | - | - | - | 45,000 | | |
| 3 | Delete Customer "001" | - | - | - | - | 45,000 | | |
| 4 | Restore as "002" - New Loan | 15,000 | 1,500 | 1,000 | 12,500 | 32,500 | | |
| 5 | Add Payment (Quick Transaction) | 7,000 | - | - | - | 39,500 | | |

**API Calls:**
```bash
# Step 1: Create customer
curl -X POST http://localhost:8001/api/customers/line1/monday \
  -H "Content-Type: application/json" \
  -d '{"id":"001","name":"Test Customer","takenAmount":12000,"interest":1200,"pc":800,"date":"2024-01-01"}'

# Step 2: Add payment
curl -X POST http://localhost:8001/api/transactions/customer/001/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":5000,"date":"2024-01-05","comment":"Payment 1"}'

# Step 3: Delete customer
curl -X DELETE http://localhost:8001/api/customers/001/line/line1/day/monday

# Step 4: Restore customer (get deletionTimestamp from deleted_customers list first)
curl -X POST http://localhost:8001/api/customers/001/restore/line1 \
  -H "Content-Type: application/json" \
  -d '{"newId":"002","deletedFrom":"monday","takenAmount":15000,"interest":1500,"pc":1000,"date":"2024-01-10","deletionTimestamp":<TIMESTAMP>}'

# Step 5: Add payment
curl -X POST http://localhost:8001/api/transactions/customer/002/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":7000,"date":"2024-01-15","comment":"Payment 2"}'
```

**Expected Behavior:**
- ✅ Customer "001" created with principal = 10,000 → BF reduced by 10,000
- ✅ Payment of 5,000 → BF increased by 5,000
- ✅ Delete → BF unchanged (still 45,000)
- ✅ Restore with SAME internalId, new loan principal = 12,500 → BF reduced by 12,500
- ✅ Payment of 7,000 → BF increased by 7,000
- ✅ Final BF: 39,500

---

## SCENARIO 2: Two Payments → Delete → Restore with Different Interest/PC

**Description:** Multiple payments before deletion, restoration loan with different interest and PC values.

| Step | Action | Amount | Interest | PC | Principal | Expected BF | Actual BF | Result |
|------|--------|--------|----------|-------|-----------|-------------|-----------|--------|
| 0 | Initial BF | - | - | - | - | 50,000 | | |
| 1 | Create Customer "003" - New Loan | 20,000 | 2,000 | 1,000 | 17,000 | 33,000 | | |
| 2 | Add Payment 1 (Quick Transaction) | 8,000 | - | - | - | 41,000 | | |
| 3 | Add Payment 2 (Quick Transaction) | 6,000 | - | - | - | 47,000 | | |
| 4 | Delete Customer "003" | - | - | - | - | 47,000 | | |
| 5 | Restore as "004" - New Loan | 25,000 | 3,000 | 2,000 | 20,000 | 27,000 | | |
| 6 | Add Payment 3 (Quick Transaction) | 10,000 | - | - | - | 37,000 | | |
| 7 | Add Payment 4 (Quick Transaction) | 5,000 | - | - | - | 42,000 | | |

**API Calls:**
```bash
# Step 1: Create customer
curl -X POST http://localhost:8001/api/customers/line1/monday \
  -H "Content-Type: application/json" \
  -d '{"id":"003","name":"Customer Two","takenAmount":20000,"interest":2000,"pc":1000,"date":"2024-01-01"}'

# Step 2: Add payment 1
curl -X POST http://localhost:8001/api/transactions/customer/003/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":8000,"date":"2024-01-05","comment":"Payment 1"}'

# Step 3: Add payment 2
curl -X POST http://localhost:8001/api/transactions/customer/003/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":6000,"date":"2024-01-10","comment":"Payment 2"}'

# Step 4: Delete customer
curl -X DELETE http://localhost:8001/api/customers/003/line/line1/day/monday

# Step 5: Restore with different interest/PC
curl -X POST http://localhost:8001/api/customers/003/restore/line1 \
  -H "Content-Type: application/json" \
  -d '{"newId":"004","deletedFrom":"monday","takenAmount":25000,"interest":3000,"pc":2000,"date":"2024-01-15","deletionTimestamp":<TIMESTAMP>}'

# Step 6: Add payment 3
curl -X POST http://localhost:8001/api/transactions/customer/004/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":10000,"date":"2024-01-20","comment":"Payment 3"}'

# Step 7: Add payment 4
curl -X POST http://localhost:8001/api/transactions/customer/004/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":5000,"date":"2024-01-25","comment":"Payment 4"}'
```

**Expected Behavior:**
- ✅ Initial loan principal = 17,000 → BF reduced to 33,000
- ✅ Two payments (8,000 + 6,000 = 14,000) → BF increased to 47,000
- ✅ Delete → BF unchanged (47,000)
- ✅ Restore with higher interest/PC → principal = 20,000 → BF reduced to 27,000
- ✅ Two more payments (10,000 + 5,000 = 15,000) → BF increased to 42,000
- ✅ Final BF: 42,000

---

## SCENARIO 3: Loan → Payment → Renewal → Payment → Delete → Restore

**Description:** Complete cycle including renewal before deletion and restoration.

| Step | Action | Amount | Interest | PC | Principal | Expected BF | Actual BF | Result |
|------|--------|--------|----------|-------|-----------|-------------|-----------|--------|
| 0 | Initial BF | - | - | - | - | 50,000 | | |
| 1 | Create Customer "005" - New Loan | 18,000 | 1,800 | 900 | 15,300 | 34,700 | | |
| 2 | Add Payment 1 | 10,000 | - | - | - | 44,700 | | |
| 3 | Add Payment 2 | 8,000 | - | - | - | 52,700 | | |
| 4 | Create Renewal | 22,000 | 2,200 | 1,100 | 18,700 | 34,000 | | |
| 5 | Add Payment 3 | 12,000 | - | - | - | 46,000 | | |
| 6 | Add Payment 4 | 10,000 | - | - | - | 56,000 | | |
| 7 | Delete Customer "005" | - | - | - | - | 56,000 | | |
| 8 | Restore as "006" - New Loan | 30,000 | 3,000 | 1,500 | 25,500 | 30,500 | | |
| 9 | Add Payment 5 | 15,000 | - | - | - | 45,500 | | |

**API Calls:**
```bash
# Step 1: Create customer
curl -X POST http://localhost:8001/api/customers/line1/monday \
  -H "Content-Type: application/json" \
  -d '{"id":"005","name":"Customer Three","takenAmount":18000,"interest":1800,"pc":900,"date":"2024-01-01"}'

# Step 2: Add payment 1
curl -X POST http://localhost:8001/api/transactions/customer/005/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":10000,"date":"2024-01-05","comment":"Payment 1"}'

# Step 3: Add payment 2
curl -X POST http://localhost:8001/api/transactions/customer/005/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":8000,"date":"2024-01-10","comment":"Payment 2"}'

# Step 4: Create renewal (customer must have cleared balance first)
curl -X POST http://localhost:8001/api/customers/005/renewals/lines/line1/days/monday \
  -H "Content-Type: application/json" \
  -d '{"takenAmount":22000,"interest":2200,"pc":1100,"date":"2024-01-15"}'

# Step 5: Add payment 3
curl -X POST http://localhost:8001/api/transactions/customer/005/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":12000,"date":"2024-01-20","comment":"Payment 3"}'

# Step 6: Add payment 4
curl -X POST http://localhost:8001/api/transactions/customer/005/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":10000,"date":"2024-01-25","comment":"Payment 4"}'

# Step 7: Delete customer
curl -X DELETE http://localhost:8001/api/customers/005/line/line1/day/monday

# Step 8: Restore customer
curl -X POST http://localhost:8001/api/customers/005/restore/line1 \
  -H "Content-Type: application/json" \
  -d '{"newId":"006","deletedFrom":"monday","takenAmount":30000,"interest":3000,"pc":1500,"date":"2024-02-01","deletionTimestamp":<TIMESTAMP>}'

# Step 9: Add payment 5
curl -X POST http://localhost:8001/api/transactions/customer/006/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":15000,"date":"2024-02-05","comment":"Payment 5"}'
```

**Expected Behavior:**
- ✅ Initial loan principal = 15,300 → BF = 34,700
- ✅ Payments clear the loan (10,000 + 8,000) → BF = 52,700
- ✅ Renewal principal = 18,700 → BF = 34,000
- ✅ Payments clear renewal (12,000 + 10,000) → BF = 56,000
- ✅ Delete → BF unchanged (56,000)
- ✅ Restore principal = 25,500 → BF = 30,500
- ✅ Payment → BF = 45,500
- ✅ Final BF: 45,500

---

## SCENARIO 4: Mixed Payment Sources (Chat + Quick Transaction)

**Description:** Verify that payments from both Chat and Quick Transaction have identical BF impact (STEP 6 unified payments).

| Step | Action | Amount | Interest | PC | Principal | Expected BF | Actual BF | Result |
|------|--------|--------|----------|-------|-----------|-------------|-----------|--------|
| 0 | Initial BF | - | - | - | - | 50,000 | | |
| 1 | Create Customer "007" - New Loan | 16,000 | 1,600 | 800 | 13,600 | 36,400 | | |
| 2 | Add Payment (Quick Transaction) | 4,000 | - | - | - | 40,400 | | |
| 3 | Add Payment (Chat - Customer Chat Page) | 3,000 | - | - | - | 43,400 | | |
| 4 | Add Payment (Quick Transaction) | 5,000 | - | - | - | 48,400 | | |
| 5 | Add Payment (Chat - Customer Chat Page) | 4,000 | - | - | - | 52,400 | | |
| 6 | Delete Customer "007" | - | - | - | - | 52,400 | | |
| 7 | Restore as "008" - New Loan | 20,000 | 2,000 | 1,000 | 17,000 | 35,400 | | |
| 8 | Add Payment (Quick Transaction) | 6,000 | - | - | - | 41,400 | | |
| 9 | Add Payment (Chat - Customer Chat Page) | 8,000 | - | - | - | 49,400 | | |

**API Calls:**
```bash
# Step 1: Create customer
curl -X POST http://localhost:8001/api/customers/line1/monday \
  -H "Content-Type: application/json" \
  -d '{"id":"007","name":"Customer Four","takenAmount":16000,"interest":1600,"pc":800,"date":"2024-01-01"}'

# Step 2: Quick transaction payment
curl -X POST http://localhost:8001/api/transactions/customer/007/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":4000,"date":"2024-01-05","comment":"Quick Payment 1"}'

# Step 3: Chat payment
curl -X POST http://localhost:8001/api/customers/007/line/line1/day/monday/chat \
  -H "Content-Type: application/json" \
  -d '{"amount":3000,"date":"2024-01-08","comment":"Chat Payment 1"}'

# Step 4: Quick transaction payment
curl -X POST http://localhost:8001/api/transactions/customer/007/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":5000,"date":"2024-01-12","comment":"Quick Payment 2"}'

# Step 5: Chat payment
curl -X POST http://localhost:8001/api/customers/007/line/line1/day/monday/chat \
  -H "Content-Type: application/json" \
  -d '{"amount":4000,"date":"2024-01-15","comment":"Chat Payment 2"}'

# Step 6: Delete customer
curl -X DELETE http://localhost:8001/api/customers/007/line/line1/day/monday

# Step 7: Restore customer
curl -X POST http://localhost:8001/api/customers/007/restore/line1 \
  -H "Content-Type: application/json" \
  -d '{"newId":"008","deletedFrom":"monday","takenAmount":20000,"interest":2000,"pc":1000,"date":"2024-01-20","deletionTimestamp":<TIMESTAMP>}'

# Step 8: Quick transaction payment
curl -X POST http://localhost:8001/api/transactions/customer/008/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":6000,"date":"2024-01-25","comment":"Quick Payment 3"}'

# Step 9: Chat payment
curl -X POST http://localhost:8001/api/customers/008/line/line1/day/monday/chat \
  -H "Content-Type: application/json" \
  -d '{"amount":8000,"date":"2024-01-28","comment":"Chat Payment 3"}'
```

**Expected Behavior (STEP 6 Validation):**
- ✅ Quick Transaction payment → writes to transactions/ file → BF increases
- ✅ Chat payment → writes to transactions/ file (NOT chat/ file) → BF increases
- ✅ BOTH payment types have IDENTICAL BF impact
- ✅ NO difference in BF calculation between payment sources
- ✅ All payments stored in transactions/ file with source='quick' or source='chat'
- ✅ Final BF: 49,400

---

## SCENARIO 5: Two Delete/Restore Cycles (Complex)

**Description:** Customer deleted and restored twice with multiple loans and payments. Tests SAME internalId reuse across multiple cycles.

| Step | Action | Amount | Interest | PC | Principal | Expected BF | Actual BF | Result |
|------|--------|--------|----------|-------|-----------|-------------|-----------|--------|
| 0 | Initial BF | - | - | - | - | 50,000 | | |
| 1 | Create Customer "009" - Loan 1 | 14,000 | 1,400 | 700 | 11,900 | 38,100 | | |
| 2 | Add Payment 1 | 6,000 | - | - | - | 44,100 | | |
| 3 | Add Payment 2 | 8,000 | - | - | - | 52,100 | | |
| 4 | **Delete Customer "009" (Cycle 1)** | - | - | - | - | 52,100 | | |
| 5 | **Restore as "010" - Loan 2** | 18,000 | 1,800 | 900 | 15,300 | 36,800 | | |
| 6 | Add Payment 3 | 9,000 | - | - | - | 45,800 | | |
| 7 | Add Payment 4 | 9,000 | - | - | - | 54,800 | | |
| 8 | **Delete Customer "010" (Cycle 2)** | - | - | - | - | 54,800 | | |
| 9 | **Restore as "011" - Loan 3** | 24,000 | 2,400 | 1,200 | 20,400 | 34,400 | | |
| 10 | Add Payment 5 | 12,000 | - | - | - | 46,400 | | |
| 11 | Add Payment 6 | 12,000 | - | - | - | 58,400 | | |

**API Calls:**
```bash
# Step 1: Create customer (Loan 1)
curl -X POST http://localhost:8001/api/customers/line1/monday \
  -H "Content-Type: application/json" \
  -d '{"id":"009","name":"Customer Five","takenAmount":14000,"interest":1400,"pc":700,"date":"2024-01-01"}'

# Step 2-3: Add payments
curl -X POST http://localhost:8001/api/transactions/customer/009/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":6000,"date":"2024-01-05","comment":"Payment 1"}'

curl -X POST http://localhost:8001/api/transactions/customer/009/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":8000,"date":"2024-01-10","comment":"Payment 2"}'

# Step 4: Delete (Cycle 1)
curl -X DELETE http://localhost:8001/api/customers/009/line/line1/day/monday

# Step 5: Restore (Loan 2) - SAME internalId reused
curl -X POST http://localhost:8001/api/customers/009/restore/line1 \
  -H "Content-Type: application/json" \
  -d '{"newId":"010","deletedFrom":"monday","takenAmount":18000,"interest":1800,"pc":900,"date":"2024-01-15","deletionTimestamp":<TIMESTAMP1>}'

# Step 6-7: Add payments
curl -X POST http://localhost:8001/api/transactions/customer/010/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":9000,"date":"2024-01-20","comment":"Payment 3"}'

curl -X POST http://localhost:8001/api/transactions/customer/010/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":9000,"date":"2024-01-25","comment":"Payment 4"}'

# Step 8: Delete (Cycle 2)
curl -X DELETE http://localhost:8001/api/customers/010/line/line1/day/monday

# Step 9: Restore (Loan 3) - SAME internalId reused again
curl -X POST http://localhost:8001/api/customers/010/restore/line1 \
  -H "Content-Type: application/json" \
  -d '{"newId":"011","deletedFrom":"monday","takenAmount":24000,"interest":2400,"pc":1200,"date":"2024-02-01","deletionTimestamp":<TIMESTAMP2>}'

# Step 10-11: Add payments
curl -X POST http://localhost:8001/api/transactions/customer/011/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":12000,"date":"2024-02-05","comment":"Payment 5"}'

curl -X POST http://localhost:8001/api/transactions/customer/011/line/line1/day/monday \
  -H "Content-Type: application/json" \
  -d '{"amount":12000,"date":"2024-02-10","comment":"Payment 6"}'
```

**Expected Behavior (Critical STEP 4 Validation):**
- ✅ **Cycle 1:** Loan 1 → Payments → Delete (BF unchanged) → Total: 52,100
- ✅ **Cycle 2:** Restore with SAME internalId → Loan 2 (principal 15,300) → BF = 36,800
- ✅ Payments → Delete (BF unchanged) → Total: 54,800
- ✅ **Cycle 3:** Restore with SAME internalId (3rd time) → Loan 3 (principal 20,400) → BF = 34,400
- ✅ Payments → Final BF: 58,400
- ✅ ALL data (Loan 1, 2, 3 + all payments) stored under SAME internalId
- ✅ Complete history visible in timeline
- ✅ NO chain walking, NO migration, NO settlement
- ✅ Final BF: 58,400

---

## VERIFICATION CHECKLIST

After running all 5 scenarios, verify:

### BF Calculation Rules
- ✅ New loan: BF = BF - principal
- ✅ Payment: BF = BF + amount
- ✅ Delete: BF unchanged
- ✅ Restore: BF = BF - principal (new loan)
- ✅ Renewal: BF = BF - principal

### Steps 1-6 Compliance
- ✅ Step 1: New customers create unique internalId
- ✅ Step 2: Payments use simple incremental update
- ✅ Step 3: Deletion keeps BF unchanged, data intact
- ✅ Step 4: Restoration reuses SAME internalId
- ✅ Step 5: Renewals append to transactions file
- ✅ Step 6: Chat and Quick payments have identical BF impact

### Step 7 Cleanup Verification
- ✅ NO settlement logic triggered
- ✅ NO archived folder access for active operations
- ✅ NO chain walking for active operations
- ✅ NO migration checks
- ✅ NO remainingAtDeletion logic
- ✅ NO bfCalculation.updateBF() for payments/delete
- ✅ ONLY simple incremental BF updates

### Data Integrity
- ✅ internalId preserved across delete/restore cycles
- ✅ All history accessible via internalId
- ✅ No data loss during operations
- ✅ Timeline shows complete history

---

## TESTING INSTRUCTIONS

### How to Run Tests

1. **Setup:**
   - Ensure backend is running on port 8001
   - Create a new line with initial BF = 50,000
   - Get the lineId for API calls

2. **For Each Scenario:**
   - Execute API calls in exact order
   - After each step, check BF using: `curl http://localhost:8001/api/lines`
   - Record actual BF in "Actual BF" column
   - Compare with "Expected BF"
   - Mark "Result" as PASS or FAIL

3. **Get Deletion Timestamps:**
   ```bash
   # After deleting a customer, get the timestamp:
   curl http://localhost:8001/api/deleted-customers/line1
   # Look for the customer and note the deletionTimestamp
   ```

4. **Check BF:**
   ```bash
   # Get current BF:
   curl http://localhost:8001/api/lines
   # Look for currentBF field in the line object
   ```

5. **Verify Timeline:**
   ```bash
   # Check customer timeline to verify history:
   curl http://localhost:8001/api/customers/{customerId}/line/line1/day/monday/chat
   ```

### Expected Results

**ALL scenarios should show:**
- ✅ Actual BF matches Expected BF at every step
- ✅ NO unexpected BF changes
- ✅ Consistent behavior across all operations
- ✅ Complete history visible in customer timeline

**If ANY scenario fails:**
- Document the failing step
- Record expected vs actual BF
- Check backend logs for errors
- Verify that Steps 1-7 logic is being followed

---

## SUMMARY

This testing document validates:

1. **Scenario 1:** Basic flow works correctly
2. **Scenario 2:** Multiple payments and different interest/PC values handled correctly
3. **Scenario 3:** Renewal flow integrated correctly
4. **Scenario 4:** Chat and Quick payments have identical BF impact (STEP 6)
5. **Scenario 5:** Multiple delete/restore cycles with SAME internalId work correctly (STEP 4)

**All scenarios follow Steps 1-7 logic with NO legacy complexity.**

If all tests PASS, the system cleanup (STEP 7) is successful and the finance management system is working correctly with simplified, clean logic.
