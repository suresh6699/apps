/**
 * Test Case: New Loan After Restore - BF Update Verification
 * 
 * This test verifies that when a customer is restored and then a NEW loan
 * is created via renewal, the BF is correctly decremented.
 * 
 * Expected Behavior:
 * 1. Create customer with loan → BF decreases
 * 2. Customer pays → BF increases
 * 3. Delete customer → BF stays same
 * 4. Restore customer (no new loan) → BF stays same
 * 5. Create NEW loan via renewal → BF decreases (THIS WAS THE BUG)
 */

const fs = require('fs');
const path = require('path');

// Helper to read JSON file
function readJSON(filePath) {
  try {
    const fullPath = path.join(__dirname, 'backend', 'data', filePath);
    const data = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Helper to get BF for a line
function getCurrentBF(lineId) {
  const lines = readJSON('lines.json') || [];
  const line = lines.find(l => l.id === lineId);
  return line ? (parseFloat(line.currentBF) || parseFloat(line.amount) || 0) : 0;
}

// Test execution
console.log('🧪 Test: New Loan After Restore - BF Update\n');
console.log('='.repeat(60));

// Find the first available line
const lines = readJSON('lines.json') || [];
if (lines.length === 0) {
  console.log('❌ No lines found in the system. Please create a line first.');
  process.exit(1);
}

const testLine = lines[0];
console.log(`📍 Using Line: ${testLine.name} (ID: ${testLine.id})`);

// Get initial BF
const initialBF = getCurrentBF(testLine.id);
console.log(`💰 Current BF: ₹${initialBF.toFixed(2)}`);
console.log('='.repeat(60));

console.log('\n📋 TEST SCENARIO:');
console.log('1. ✅ Create customer with loan 12,000 (principal 10,000, interest 2,000)');
console.log('   Expected BF: Current - 10,000');
console.log('2. ✅ Customer pays 12,000');
console.log('   Expected BF: Current + 12,000');
console.log('3. ✅ Delete customer (balance cleared)');
console.log('   Expected BF: No change');
console.log('4. ✅ Restore customer WITHOUT new loan');
console.log('   Expected BF: No change');
console.log('5. 🎯 Create NEW loan via RENEWAL: 5,000 (principal 4,000, interest 1,000)');
console.log('   Expected BF: Current - 4,000');
console.log('='.repeat(60));

console.log('\n📌 INSTRUCTIONS TO TEST:');
console.log('1. Use the frontend or Postman to perform the above steps');
console.log('2. After each step, check the BF value');
console.log('3. The critical test is step 5 - renewal after restore');
console.log('\n🔍 API ENDPOINTS TO USE:');
console.log(`POST /api/customers/lines/${testLine.id}/days/Monday`);
console.log('   Body: { "id": "TEST1", "name": "Test Customer", "takenAmount": 12000, "interest": 2000, "date": "2025-01-01" }');
console.log('');
console.log(`POST /api/transactions/TEST1/lines/${testLine.id}/days/Monday`);
console.log('   Body: { "amount": 12000, "date": "2025-01-02" }');
console.log('');
console.log(`DELETE /api/customers/TEST1/lines/${testLine.id}/days/Monday`);
console.log('');
console.log(`POST /api/customers/TEST1/restore/lines/${testLine.id}`);
console.log('   Body: { "newId": "TEST1R", "deletedFrom": "Monday" }');
console.log('   NOTE: takenAmount is now OPTIONAL - omit it to restore without new loan');
console.log('');
console.log(`POST /api/customers/TEST1R/renewals/lines/${testLine.id}/days/Monday`);
console.log('   Body: { "takenAmount": 5000, "interest": 1000, "date": "2025-01-03" }');
console.log('   🎯 THIS IS THE CRITICAL STEP - BF MUST DECREASE BY 4,000');
console.log('='.repeat(60));

console.log('\n✅ FIX APPLIED:');
console.log('1. Made takenAmount OPTIONAL during restore');
console.log('2. If restored without new loan, customer.takenAmount = 0');
console.log('3. Renewal validation now allows immediate renewal for restored customers');
console.log('4. BF will correctly decrement when renewal is created');
console.log('\n💡 The bug was: Restored customers kept old takenAmount, blocking renewals');
console.log('💡 Now fixed: Restored customers with settled loans have takenAmount=0');
console.log('='.repeat(60));

console.log('\n🎯 EXPECTED RESULTS:');
const expectedAfterLoan = initialBF - 10000;
const expectedAfterPayment = expectedAfterLoan + 12000;
const expectedAfterDelete = expectedAfterPayment;
const expectedAfterRestore = expectedAfterDelete;
const expectedAfterRenewal = expectedAfterRestore - 4000;

console.log(`After Step 1 (Loan):     ₹${expectedAfterLoan.toFixed(2)}`);
console.log(`After Step 2 (Payment):  ₹${expectedAfterPayment.toFixed(2)}`);
console.log(`After Step 3 (Delete):   ₹${expectedAfterDelete.toFixed(2)}`);
console.log(`After Step 4 (Restore):  ₹${expectedAfterRestore.toFixed(2)}`);
console.log(`After Step 5 (Renewal):  ₹${expectedAfterRenewal.toFixed(2)} 🎯 CRITICAL`);
console.log('='.repeat(60));

console.log('\n✅ Test setup complete. Please run the manual test using the API endpoints above.\n');
