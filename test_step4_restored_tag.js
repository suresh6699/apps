/**
 * STEP 4 CUSTOMER RESTORATION TEST - "restored" TAG VERIFICATION
 * 
 * This test verifies that:
 * 1. Restored loans are tagged with type: "restored"
 * 2. Old loans remain with type: "loan"
 * 3. BF is correctly updated using principal only
 * 4. No old history is modified
 * 5. Multiple restore cycles work correctly
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8001/api';
const DATA_DIR = '/app/backend/data';

// Helper to read JSON file
function readJSON(filePath) {
  try {
    const fullPath = path.join(DATA_DIR, filePath);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return null;
}

// Helper to get current BF
function getCurrentBF(lineId = 'testline') {
  const lines = readJSON('lines.json') || [];
  const line = lines.find(l => l.id === lineId);
  return line ? parseFloat(line.currentBF || line.amount) : 0;
}

// Helper to get customer by ID
function getCustomer(customerId, lineId = 'testline', day = 'monday') {
  const customers = readJSON(`customers/${lineId}/${day}.json`) || [];
  return customers.find(c => c.id === customerId);
}

// Helper to get transactions by internalId
function getTransactions(internalId, lineId = 'testline', day = 'monday') {
  return readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
}

// Helper to get deleted customer
function getDeletedCustomer(customerId, lineId = 'testline') {
  const deleted = readJSON(`deleted_customers/${lineId}.json`) || [];
  // Get the most recent deletion
  const matches = deleted.filter(c => c.id === customerId);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

async function runTests() {
  console.log('========================================');
  console.log('STEP 4 - "restored" TAG VERIFICATION TEST');
  console.log('========================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Setup: Create test line
    console.log('📋 Setup: Creating test line...');
    try {
      await axios.post(`${BASE_URL}/lines`, {
        id: 'testline',
        name: 'Test Line',
        amount: 100000
      });
      console.log('✅ Test line created');
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error?.includes('already exists')) {
        console.log('✅ Test line already exists');
      } else {
        throw err;
      }
    }

    const initialBF = getCurrentBF();
    console.log(`📊 Initial BF: ₹${initialBF}\n`);

    // ========================================
    // TEST 1: Restore produces loan with "restored" tag
    // ========================================
    console.log('========================================');
    console.log('TEST 1: Restore produces "restored" tag');
    console.log('========================================\n');

    // Step 1: Create customer
    console.log('Step 1: Creating customer "T001"...');
    const createResp = await axios.post(`${BASE_URL}/customers/lines/testline/days/monday`, {
      id: 'T001',
      name: 'Test Customer',
      village: 'Test Village',
      takenAmount: 10000,
      interest: 1000,
      pc: 500,
      date: '2024-01-01',
      weeks: 10
    });

    const customer = createResp.data.customer;
    const internalId = customer.internalId;
    console.log(`✅ Customer created with internalId: ${internalId}`);

    const bfAfterCreate = getCurrentBF();
    const expectedBFAfterCreate = initialBF - (10000 - 1000 - 500);
    console.log(`📊 BF after create: ₹${bfAfterCreate} (expected: ₹${expectedBFAfterCreate})`);

    if (Math.abs(bfAfterCreate - expectedBFAfterCreate) < 0.01) {
      console.log('✅ BF correctly updated after create\n');
      testsPassed++;
    } else {
      console.log('❌ BF incorrect after create\n');
      testsFailed++;
    }

    // Step 2: Delete customer
    console.log('Step 2: Deleting customer "T001"...');
    await axios.delete(`${BASE_URL}/customers/T001/lines/testline/days/monday`);
    console.log('✅ Customer deleted');

    const bfAfterDelete = getCurrentBF();
    console.log(`📊 BF after delete: ₹${bfAfterDelete} (should be same as after create)`);

    if (Math.abs(bfAfterDelete - bfAfterCreate) < 0.01) {
      console.log('✅ BF unchanged after delete (STEP 3 behavior)\n');
      testsPassed++;
    } else {
      console.log('❌ BF changed after delete\n');
      testsFailed++;
    }

    // Step 3: Restore customer
    console.log('Step 3: Restoring customer as "T002"...');
    const deletedCustomer = getDeletedCustomer('T001');
    
    const restoreResp = await axios.post(`${BASE_URL}/customers/T001/restore/lines/testline`, {
      newId: 'T002',
      takenAmount: 5000,
      interest: 500,
      pc: 200,
      date: '2024-02-01',
      weeks: 10,
      deletedFrom: 'monday',
      deletionTimestamp: deletedCustomer.deletedAt
    });

    console.log('✅ Customer restored');

    const bfAfterRestore = getCurrentBF();
    const restorePrincipal = 5000 - 500 - 200;
    const expectedBFAfterRestore = bfAfterDelete - restorePrincipal;
    console.log(`📊 BF after restore: ₹${bfAfterRestore} (expected: ₹${expectedBFAfterRestore})`);

    if (Math.abs(bfAfterRestore - expectedBFAfterRestore) < 0.01) {
      console.log('✅ BF correctly updated after restore\n');
      testsPassed++;
    } else {
      console.log('❌ BF incorrect after restore\n');
      testsFailed++;
    }

    // Step 4: Verify transaction tags
    console.log('Step 4: Verifying transaction tags...');
    const transactions = getTransactions(internalId);

    console.log(`📋 Total transactions: ${transactions.length}`);

    // Find original loan
    const originalLoan = transactions.find(t => t.amount === 10000);
    console.log('Original loan:', {
      type: originalLoan?.type,
      amount: originalLoan?.amount,
      isRestoredLoan: originalLoan?.isRestoredLoan
    });

    // Find restored loan
    const restoredLoan = transactions.find(t => t.amount === 5000);
    console.log('Restored loan:', {
      type: restoredLoan?.type,
      amount: restoredLoan?.amount,
      isRestoredLoan: restoredLoan?.isRestoredLoan,
      loanType: restoredLoan?.loanType,
      restoredAt: restoredLoan?.restoredAt
    });

    // Verify original loan NOT modified
    if (originalLoan && originalLoan.type !== 'restored' && !originalLoan.isRestoredLoan) {
      console.log('✅ Original loan NOT tagged as "restored"');
      testsPassed++;
    } else {
      console.log('❌ Original loan incorrectly tagged');
      testsFailed++;
    }

    // Verify restored loan has correct tag
    if (restoredLoan && 
        restoredLoan.type === 'restored' && 
        restoredLoan.isRestoredLoan === true &&
        restoredLoan.loanType === 'restoredLoan' &&
        restoredLoan.restoredAt) {
      console.log('✅ Restored loan correctly tagged with type: "restored"');
      testsPassed++;
    } else {
      console.log('❌ Restored loan missing correct tags');
      testsFailed++;
    }

    console.log('\n');

    // ========================================
    // TEST 2: Old history remains untouched
    // ========================================
    console.log('========================================');
    console.log('TEST 2: Old history remains untouched');
    console.log('========================================\n');

    console.log('Verifying old transaction is unmodified...');
    const oldTransaction = transactions[0]; // First transaction
    
    console.log('First transaction details:', {
      id: oldTransaction.id,
      type: oldTransaction.type,
      amount: oldTransaction.amount,
      date: oldTransaction.date,
      createdAt: oldTransaction.createdAt
    });

    if (oldTransaction.type === 'loan' || oldTransaction.type === 'payment') {
      console.log('✅ Old transaction type preserved');
      testsPassed++;
    } else {
      console.log('❌ Old transaction type modified');
      testsFailed++;
    }

    if (oldTransaction.createdAt && oldTransaction.date) {
      console.log('✅ Old transaction timestamps preserved');
      testsPassed++;
    } else {
      console.log('❌ Old transaction timestamps missing');
      testsFailed++;
    }

    console.log('\n');

    // ========================================
    // TEST 3: Multiple restore cycles
    // ========================================
    console.log('========================================');
    console.log('TEST 3: Multiple restore cycles');
    console.log('========================================\n');

    // Delete again
    console.log('Step 1: Deleting customer "T002"...');
    await axios.delete(`${BASE_URL}/customers/T002/lines/testline/days/monday`);
    console.log('✅ Customer deleted');

    const bfBeforeSecondRestore = getCurrentBF();

    // Restore again
    console.log('Step 2: Restoring customer as "T003"...');
    const deletedCustomer2 = getDeletedCustomer('T002');
    
    const restoreResp2 = await axios.post(`${BASE_URL}/customers/T002/restore/lines/testline`, {
      newId: 'T003',
      takenAmount: 7000,
      interest: 700,
      pc: 300,
      date: '2024-03-01',
      weeks: 10,
      deletedFrom: 'monday',
      deletionTimestamp: deletedCustomer2.deletedAt
    });

    console.log('✅ Customer restored again');

    const bfAfterSecondRestore = getCurrentBF();
    const secondRestorePrincipal = 7000 - 700 - 300;
    const expectedBFAfterSecondRestore = bfBeforeSecondRestore - secondRestorePrincipal;
    console.log(`📊 BF after second restore: ₹${bfAfterSecondRestore} (expected: ₹${expectedBFAfterSecondRestore})`);

    if (Math.abs(bfAfterSecondRestore - expectedBFAfterSecondRestore) < 0.01) {
      console.log('✅ BF correctly updated after second restore');
      testsPassed++;
    } else {
      console.log('❌ BF incorrect after second restore');
      testsFailed++;
    }

    // Verify all transactions
    const allTransactions = getTransactions(internalId);
    console.log(`📋 Total transactions after 2 restores: ${allTransactions.length}`);

    const restoredLoans = allTransactions.filter(t => t.type === 'restored');
    console.log(`📋 Restored loans count: ${restoredLoans.length}`);

    if (restoredLoans.length === 2) {
      console.log('✅ Two restored loans created');
      testsPassed++;
    } else {
      console.log('❌ Incorrect number of restored loans');
      testsFailed++;
    }

    // Verify each restored loan has correct tags
    const allRestoredLoansTagged = restoredLoans.every(loan => 
      loan.type === 'restored' &&
      loan.isRestoredLoan === true &&
      loan.loanType === 'restoredLoan'
    );

    if (allRestoredLoansTagged) {
      console.log('✅ All restored loans correctly tagged');
      testsPassed++;
    } else {
      console.log('❌ Some restored loans missing tags');
      testsFailed++;
    }

    console.log('\n');

    // ========================================
    // TEST 4: Visible ID conflict check
    // ========================================
    console.log('========================================');
    console.log('TEST 4: Visible ID conflict check');
    console.log('========================================\n');

    // Try to restore with existing ID
    console.log('Step 1: Attempting to restore with existing ID "T003"...');
    try {
      await axios.post(`${BASE_URL}/customers/T003/restore/lines/testline`, {
        newId: 'T003', // Already exists
        takenAmount: 3000,
        interest: 300,
        pc: 100,
        date: '2024-04-01',
        weeks: 10,
        deletedFrom: 'monday',
        deletionTimestamp: deletedCustomer2.deletedAt
      });
      console.log('❌ Should have failed with ID conflict');
      testsFailed++;
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('✅ Correctly rejected existing ID');
        testsPassed++;
      } else {
        console.log('❌ Wrong error type');
        testsFailed++;
      }
    }

    console.log('\n');

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('========================================');
    console.log('TEST SUMMARY');
    console.log('========================================\n');

    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📊 Total Tests: ${testsPassed + testsFailed}`);

    if (testsFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! STEP 4 IMPLEMENTATION CORRECT!\n');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED. PLEASE REVIEW IMPLEMENTATION.\n');
    }

  } catch (error) {
    console.error('❌ Test Error:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
  }
}

// Run tests
runTests();
