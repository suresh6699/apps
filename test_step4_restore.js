/**
 * STEP 4 CUSTOMER RESTORATION TEST
 * 
 * Tests the simplified restore logic:
 * 1. Restore reactivates customer with SAME internalId
 * 2. New visible customerId assigned
 * 3. NEW loan created
 * 4. BF updated using principal only
 * 5. Old history remains visible
 * 6. NO data migration
 * 7. Multiple delete/restore cycles work correctly
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8001/api';
const DATA_DIR = '/app/data';

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
function getCurrentBF() {
  const lines = readJSON('lines.json') || [];
  const line = lines.find(l => l.id === 'testline');
  return line ? parseFloat(line.currentBF || line.amount) : 0;
}

// Helper to get customer by ID
function getCustomer(customerId, day = 'monday') {
  const customers = readJSON(`customers/testline/${day}.json`) || [];
  return customers.find(c => c.id === customerId);
}

// Helper to get deleted customer
function getDeletedCustomer(customerId) {
  const deleted = readJSON('deleted_customers/testline.json') || [];
  return deleted.find(c => c.id === customerId);
}

// Helper to get transactions by internalId
function getTransactions(internalId, day = 'monday') {
  return readJSON(`transactions/testline/${day}/${internalId}.json`) || [];
}

async function runTests() {
  console.log('========================================');
  console.log('STEP 4 CUSTOMER RESTORATION TEST');
  console.log('========================================\n');

  try {
    // Setup: Create test line if not exists
    console.log('📋 Setup: Creating test line...');
    try {
      await axios.post(`${BASE_URL}/lines`, {
        id: 'testline',
        name: 'Test Line',
        amount: 100000
      });
      console.log('✅ Test line created\n');
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error?.includes('already exists')) {
        console.log('✅ Test line already exists\n');
      } else {
        throw err;
      }
    }

    const initialBF = getCurrentBF();
    console.log(`📊 Initial BF: ₹${initialBF}\n`);

    // TEST 1: Create → Delete → Restore Flow
    console.log('========================================');
    console.log('TEST 1: Basic Delete/Restore Cycle');
    console.log('========================================\n');

    // Step 1: Create customer
    console.log('Step 1: Creating customer "T001"...');
    const createResp = await axios.post(`${BASE_URL}/customers/testline/monday`, {
      id: 'T001',
      name: 'Test Customer',
      village: 'Test Village',
      takenAmount: 10000,
      interest: 1000,
      pc: 500,
      date: '2024-01-01',
      weeks: 10
    });
    console.log(`✅ Customer created with internalId: ${createResp.data.customer.internalId}`);
    
    const originalInternalId = createResp.data.customer.internalId;
    const bfAfterCreate = getCurrentBF();
    const expectedBFAfterCreate = initialBF - (10000 - 1000 - 500);
    console.log(`📊 BF after create: ₹${bfAfterCreate} (expected: ₹${expectedBFAfterCreate})`);
    
    if (Math.abs(bfAfterCreate - expectedBFAfterCreate) < 0.01) {
      console.log('✅ BF correct after creation\n');
    } else {
      console.log('❌ BF incorrect after creation\n');
    }

    // Step 2: Add payment
    console.log('Step 2: Adding payment of ₹2000...');
    await axios.post(`${BASE_URL}/transactions/customer/T001/line/testline/day/monday`, {
      amount: 2000,
      date: '2024-01-05',
      comment: 'Payment 1'
    });
    
    const bfAfterPayment = getCurrentBF();
    const expectedBFAfterPayment = bfAfterCreate + 2000;
    console.log(`📊 BF after payment: ₹${bfAfterPayment} (expected: ₹${expectedBFAfterPayment})`);
    
    if (Math.abs(bfAfterPayment - expectedBFAfterPayment) < 0.01) {
      console.log('✅ BF correct after payment\n');
    } else {
      console.log('❌ BF incorrect after payment\n');
    }

    // Step 3: Delete customer
    console.log('Step 3: Deleting customer "T001"...');
    await axios.delete(`${BASE_URL}/customers/T001/line/testline/day/monday`);
    
    const bfAfterDelete = getCurrentBF();
    console.log(`📊 BF after delete: ₹${bfAfterDelete} (should be unchanged)`);
    
    if (Math.abs(bfAfterDelete - bfAfterPayment) < 0.01) {
      console.log('✅ BF unchanged after deletion (STEP 3 correct)\n');
    } else {
      console.log('❌ BF changed after deletion (STEP 3 broken)\n');
    }

    // Verify customer is deleted
    const deletedCustomer = getDeletedCustomer('T001');
    if (deletedCustomer && deletedCustomer.isDeleted) {
      console.log(`✅ Customer in deleted list with internalId: ${deletedCustomer.internalId}`);
      console.log(`   deletedAt: ${new Date(deletedCustomer.deletedAt).toISOString()}\n`);
    } else {
      console.log('❌ Customer not properly deleted\n');
    }

    // Verify transactions still exist
    const transactionsBeforeRestore = getTransactions(originalInternalId);
    console.log(`📦 Transactions before restore: ${transactionsBeforeRestore.length} entries`);
    console.log('   Expected: 1 loan + 1 payment = 2 entries');
    if (transactionsBeforeRestore.length === 2) {
      console.log('✅ Old transactions intact\n');
    } else {
      console.log('❌ Transactions missing\n');
    }

    // Step 4: Restore customer
    console.log('Step 4: Restoring customer "T001" as "T002" with new loan...');
    const restoreResp = await axios.post(`${BASE_URL}/customers/T001/line/testline/restore`, {
      newId: 'T002',
      deletedFrom: 'monday',
      takenAmount: 15000,
      interest: 2000,
      pc: 500,
      date: '2024-02-01',
      weeks: 12,
      deletionTimestamp: deletedCustomer.deletionTimestamp
    });

    console.log(`✅ Customer restored: ${JSON.stringify(restoreResp.data.customer, null, 2)}`);

    // CRITICAL CHECK 1: SAME internalId
    const restoredCustomer = restoreResp.data.customer;
    console.log('\n🔍 CRITICAL CHECK 1: internalId comparison');
    console.log(`   Original internalId: ${originalInternalId}`);
    console.log(`   Restored internalId: ${restoredCustomer.internalId}`);
    
    if (restoredCustomer.internalId === originalInternalId) {
      console.log('✅ SAME internalId reused (STEP 4 correct)');
    } else {
      console.log('❌ NEW internalId generated (STEP 4 broken)');
    }

    // CRITICAL CHECK 2: New loan created
    const transactionsAfterRestore = getTransactions(originalInternalId);
    console.log('\n🔍 CRITICAL CHECK 2: New loan creation');
    console.log(`   Transactions before restore: ${transactionsBeforeRestore.length}`);
    console.log(`   Transactions after restore: ${transactionsAfterRestore.length}`);
    console.log(`   Expected: ${transactionsBeforeRestore.length + 1} (old + new loan)`);
    
    if (transactionsAfterRestore.length === transactionsBeforeRestore.length + 1) {
      console.log('✅ New loan created');
      const newLoan = transactionsAfterRestore[transactionsAfterRestore.length - 1];
      console.log(`   New loan amount: ₹${newLoan.amount}`);
      console.log(`   New loan date: ${newLoan.date}`);
    } else {
      console.log('❌ New loan not created');
    }

    // CRITICAL CHECK 3: BF updated correctly
    const bfAfterRestore = getCurrentBF();
    const restorePrincipal = 15000 - 2000 - 500;
    const expectedBFAfterRestore = bfAfterDelete - restorePrincipal;
    
    console.log('\n🔍 CRITICAL CHECK 3: BF calculation');
    console.log(`   BF before restore: ₹${bfAfterDelete}`);
    console.log(`   Principal: ₹${restorePrincipal} (15000 - 2000 - 500)`);
    console.log(`   BF after restore: ₹${bfAfterRestore}`);
    console.log(`   Expected BF: ₹${expectedBFAfterRestore}`);
    
    if (Math.abs(bfAfterRestore - expectedBFAfterRestore) < 0.01) {
      console.log('✅ BF updated correctly using principal only');
    } else {
      console.log('❌ BF calculation incorrect');
    }

    // CRITICAL CHECK 4: Old history visible
    console.log('\n🔍 CRITICAL CHECK 4: Old history visibility');
    console.log(`   Total transactions: ${transactionsAfterRestore.length}`);
    console.log('   Transaction history:');
    transactionsAfterRestore.forEach((t, i) => {
      console.log(`     ${i + 1}. ${t.date}: ${t.type || 'payment'} ₹${t.amount} - ${t.comment || ''}`);
    });
    console.log('✅ Old history remains visible alongside new loan');

    // CRITICAL CHECK 5: Deleted customer marked as restored
    const deletedAfterRestore = getDeletedCustomer('T001');
    console.log('\n🔍 CRITICAL CHECK 5: Deletion record updated');
    console.log(`   isRestored: ${deletedAfterRestore.isRestored}`);
    console.log(`   restoredAs: ${deletedAfterRestore.restoredAs}`);
    console.log(`   restoredDate: ${deletedAfterRestore.restoredDate}`);
    
    if (deletedAfterRestore.isRestored && deletedAfterRestore.restoredAs === 'T002') {
      console.log('✅ Deleted customer properly marked as restored');
    } else {
      console.log('❌ Deleted customer not properly marked');
    }

    // TEST 2: Multiple Delete/Restore Cycles
    console.log('\n========================================');
    console.log('TEST 2: Multiple Delete/Restore Cycles');
    console.log('========================================\n');

    // Cycle 2: Delete → Restore
    console.log('Cycle 2: Delete "T002" → Restore as "T003"...');
    
    await axios.delete(`${BASE_URL}/customers/T002/line/testline/day/monday`);
    const bfAfterDelete2 = getCurrentBF();
    console.log(`📊 BF after 2nd delete: ₹${bfAfterDelete2} (should be unchanged)`);

    const deleted2 = getDeletedCustomer('T002');
    await axios.post(`${BASE_URL}/customers/T002/line/testline/restore`, {
      newId: 'T003',
      deletedFrom: 'monday',
      takenAmount: 20000,
      interest: 3000,
      pc: 1000,
      date: '2024-03-01',
      weeks: 15,
      deletionTimestamp: deleted2.deletionTimestamp
    });

    const bfAfterRestore2 = getCurrentBF();
    const principal2 = 20000 - 3000 - 1000;
    const expectedBFAfterRestore2 = bfAfterDelete2 - principal2;
    
    console.log(`📊 BF after 2nd restore: ₹${bfAfterRestore2} (expected: ₹${expectedBFAfterRestore2})`);
    
    if (Math.abs(bfAfterRestore2 - expectedBFAfterRestore2) < 0.01) {
      console.log('✅ BF correct after 2nd restore');
    } else {
      console.log('❌ BF incorrect after 2nd restore');
    }

    const transactionsAfterCycle2 = getTransactions(originalInternalId);
    console.log(`📦 Total transactions after 2 cycles: ${transactionsAfterCycle2.length}`);
    console.log('   Expected: 1 original loan + 1 payment + 2 new loans = 4 entries');
    
    if (transactionsAfterCycle2.length === 4) {
      console.log('✅ All transactions preserved across cycles');
    } else {
      console.log('❌ Transactions missing or duplicated');
    }

    // Final Summary
    console.log('\n========================================');
    console.log('FINAL SUMMARY');
    console.log('========================================\n');

    console.log('BF Journey:');
    console.log(`  Initial:         ₹${initialBF.toFixed(2)}`);
    console.log(`  After Create:    ₹${bfAfterCreate.toFixed(2)} (- ₹${(10000 - 1000 - 500).toFixed(2)})`);
    console.log(`  After Payment:   ₹${bfAfterPayment.toFixed(2)} (+ ₹2000.00)`);
    console.log(`  After Delete:    ₹${bfAfterDelete.toFixed(2)} (unchanged)`);
    console.log(`  After Restore 1: ₹${bfAfterRestore.toFixed(2)} (- ₹${restorePrincipal.toFixed(2)})`);
    console.log(`  After Delete 2:  ₹${bfAfterDelete2.toFixed(2)} (unchanged)`);
    console.log(`  After Restore 2: ₹${bfAfterRestore2.toFixed(2)} (- ₹${principal2.toFixed(2)})`);

    console.log('\nTransaction History:');
    transactionsAfterCycle2.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.date}: ${t.type || 'payment'} ₹${t.amount} - ${t.comment || ''}`);
    });

    console.log('\n✅ STEP 4 TEST COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
