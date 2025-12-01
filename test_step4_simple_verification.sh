#!/bin/bash

# STEP 4 CUSTOMER RESTORATION - "restored" TAG VERIFICATION
# Simple shell script test using direct file inspection

echo "========================================"
echo "STEP 4 - 'restored' TAG VERIFICATION"
echo "========================================"
echo ""

DATA_DIR="/app/backend/data"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Helper function to check test result
check_test() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: $2"
    PASSED=$((PASSED+1))
  else
    echo -e "${RED}❌ FAIL${NC}: $2"
    FAILED=$((FAILED+1))
  fi
}

# Create a test environment
echo "📋 Setting up test environment..."

# Check if data directory exists
if [ ! -d "$DATA_DIR" ]; then
  echo "Creating data directory..."
  mkdir -p "$DATA_DIR"
fi

# Check current implementation
echo ""
echo "========================================"
echo "TEST 1: Check restore function exists"
echo "========================================"
echo ""

if grep -q "type: 'restored'" /app/backend/controllers/customerController.js; then
  check_test 0 "Restore function uses type: 'restored'"
else
  check_test 1 "Restore function MISSING type: 'restored'"
fi

if grep -q "isRestoredLoan: true" /app/backend/controllers/customerController.js; then
  check_test 0 "Restore function sets isRestoredLoan: true"
else
  check_test 1 "Restore function MISSING isRestoredLoan flag"
fi

if grep -q "loanType: 'restoredLoan'" /app/backend/controllers/customerController.js; then
  check_test 0 "Restore function sets loanType: 'restoredLoan'"
else
  check_test 1 "Restore function MISSING loanType field"
fi

if grep -q "restoredAt: Date.now()" /app/backend/controllers/customerController.js; then
  check_test 0 "Restore function sets restoredAt timestamp"
else
  check_test 1 "Restore function MISSING restoredAt timestamp"
fi

echo ""
echo "========================================"
echo "TEST 2: Check BF update logic"
echo "========================================"
echo ""

# Check that restore uses simple principal calculation
if grep -A5 "STEP 4.9" /app/backend/controllers/customerController.js | grep -q "principal = parseFloat(takenAmount) - interestValue - pcValue"; then
  check_test 0 "BF calculation uses simple principal formula"
else
  check_test 1 "BF calculation INCORRECT"
fi

if grep -A5 "STEP 4.9" /app/backend/controllers/customerController.js | grep -q "newBF = currentBF - principal"; then
  check_test 0 "BF update formula is correct (BF = BF - principal)"
else
  check_test 1 "BF update formula INCORRECT"
fi

# Check that NO bfCalculation.updateBF() is called during restore
if grep -A50 "async restoreCustomer" /app/backend/controllers/customerController.js | grep -q "bfCalculation.updateBF"; then
  check_test 1 "Restore INCORRECTLY calls bfCalculation.updateBF() - should use direct calculation"
else
  check_test 0 "Restore does NOT call bfCalculation.updateBF() - uses direct calculation"
fi

echo ""
echo "========================================"
echo "TEST 3: Check history preservation"
echo "========================================"
echo ""

# Check that old transaction files are NOT modified
if grep -A30 "async restoreCustomer" /app/backend/controllers/customerController.js | grep -q "transactions.push(newLoanTransaction.toJSON())"; then
  check_test 0 "Restore APPENDs to transaction file (preserves old history)"
else
  check_test 1 "Restore does NOT append correctly"
fi

# Check that restore uses SAME internalId
if grep -A30 "async restoreCustomer" /app/backend/controllers/customerController.js | grep -q "internalId: oldInternalId"; then
  check_test 0 "Restore uses SAME internalId (preserves history linkage)"
else
  check_test 1 "Restore MISSING internalId preservation"
fi

echo ""
echo "========================================"
echo "TEST 4: Check blocked logic"
echo "========================================"
echo ""

# Verify NO archived logic runs
RESTORE_FUNC=$(sed -n '/async restoreCustomer/,/async [a-zA-Z]/p' /app/backend/controllers/customerController.js | head -n -1)

if echo "$RESTORE_FUNC" | grep -q "transactions_deleted"; then
  check_test 1 "Restore INCORRECTLY references transactions_deleted"
else
  check_test 0 "Restore does NOT reference archived data"
fi

if echo "$RESTORE_FUNC" | grep -q "migration"; then
  check_test 1 "Restore INCORRECTLY has migration logic"
else
  check_test 0 "Restore does NOT have migration logic"
fi

if echo "$RESTORE_FUNC" | grep -q "chain"; then
  check_test 1 "Restore INCORRECTLY has chain walking logic"
else
  check_test 0 "Restore does NOT have chain walking logic"
fi

if echo "$RESTORE_FUNC" | grep -q "settlement"; then
  check_test 1 "Restore INCORRECTLY has settlement logic"
else
  check_test 0 "Restore does NOT have settlement logic"
fi

echo ""
echo "========================================"
echo "TEST 5: Documentation verification"
echo "========================================"
echo ""

if [ -f "/app/STEP4_CUSTOMER_RESTORATION_FIX_UPDATED.md" ]; then
  check_test 0 "STEP 4 documentation exists"
  
  if grep -q "type: \"restored\"" /app/STEP4_CUSTOMER_RESTORATION_FIX_UPDATED.md; then
    check_test 0 "Documentation mentions 'restored' type"
  else
    check_test 1 "Documentation MISSING 'restored' type details"
  fi
  
  if grep -q "isRestoredLoan" /app/STEP4_CUSTOMER_RESTORATION_FIX_UPDATED.md; then
    check_test 0 "Documentation mentions isRestoredLoan flag"
  else
    check_test 1 "Documentation MISSING isRestoredLoan details"
  fi
else
  check_test 1 "STEP 4 documentation NOT FOUND"
fi

echo ""
echo "========================================"
echo "FINAL SUMMARY"
echo "========================================"
echo ""
echo -e "${GREEN}✅ Tests Passed: $PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $FAILED${NC}"
echo "📊 Total Tests: $((PASSED+FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED! STEP 4 IMPLEMENTATION CORRECT!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  SOME TESTS FAILED. PLEASE REVIEW IMPLEMENTATION.${NC}"
  exit 1
fi
