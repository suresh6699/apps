#!/usr/bin/env node

/**
 * STEP 8: BF JUMP DEBUG TEST
 * Test exact scenario from problem statement:
 * 1. Initial BF = 50,000
 * 2. Create loan 12,000 (Principal = 10,000) → BF = 40,000
 * 3. Pay 12,000 → BF = 52,000
 * 4. Delete customer → BF must stay = 52,000
 */

const http = require('http');

const API_BASE = 'http://localhost:8001/api';

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 8: BF JUMP DEBUG TEST');
  console.log('='.repeat(70) + '\n');

  try {
    // Use existing line "sad" with id "1764602063844"
    const lineId = '1764602063844';
    const day = 'Sun';

    console.log('📊 Test Configuration:');
    console.log(`   Line ID: ${lineId}`);
    console.log(`   Day: ${day}`);
    console.log('');

    // Step 0: Get initial BF
    console.log('Step 0: Check initial BF');
    let lineResponse = await makeRequest('GET', `/lines/${lineId}`);
    const initialBF = lineResponse.data.line.currentBF;
    console.log(`   ✅ Initial BF: ${initialBF}`);
    console.log('');

    // Step 1: Create customer with loan 12,000
    console.log('Step 1: Create customer with loan 12,000');
    console.log('   Principal = 10,000 (12,000 - 1,500 interest - 500 pc)');
    const customerData = {
      id: 'TEST_CUSTOMER_' + Date.now(),
      name: 'Test Customer',
      address: '123 Test St',
      mobile: '1234567890',
      lineId: lineId,
      day: day,
      takenAmount: 12000,
      interest: 1500,
      pc: 500,
      weeks: 10,
      date: new Date().toISOString().split('T')[0]
    };

    let createResponse = await makeRequest('POST', '/customers', customerData);
    if (createResponse.status !== 201) {
      console.error('   ❌ Failed to create customer:', createResponse.data);
      process.exit(1);
    }
    const customerId = createResponse.data.customer.id;
    const internalId = createResponse.data.customer.internalId || customerId;
    const bfAfterCreate = createResponse.data.newBF;
    console.log(`   ✅ Customer created: ${customerId} (internalId: ${internalId})`);
    console.log(`   ✅ BF after create: ${bfAfterCreate}`);
    console.log(`   Expected: ${initialBF - 10000}, Actual: ${bfAfterCreate}`);
    console.log('');

    // Verify transaction file exists
    console.log('   📁 Checking transaction file...');
    const fs = require('fs');
    const transFile = `/app/backend/data/transactions/${lineId}/${day}/${internalId}.json`;
    console.log(`   File path: ${transFile}`);
    console.log(`   Exists: ${fs.existsSync(transFile)}`);
    console.log('');

    // Step 2: Make payment of 12,000
    console.log('Step 2: Make payment of 12,000');
    const paymentData = {
      lineId: lineId,
      day: day,
      customerId: customerId,
      amount: 12000,
      type: 'payment',
      date: new Date().toISOString()
    };

    let paymentResponse = await makeRequest('POST', '/transactions', paymentData);
    if (paymentResponse.status !== 201) {
      console.error('   ❌ Failed to create payment:', paymentResponse.data);
      process.exit(1);
    }
    console.log(`   ✅ Payment created: ₹12,000`);

    // Get BF after payment
    lineResponse = await makeRequest('GET', `/lines/${lineId}`);
    const bfAfterPayment = lineResponse.data.line.currentBF;
    console.log(`   ✅ BF after payment: ${bfAfterPayment}`);
    console.log(`   Expected: ${bfAfterCreate + 12000}, Actual: ${bfAfterPayment}`);
    console.log('');

    // Step 2.5: List files before deletion
    console.log('Step 2.5: List transaction files BEFORE deletion');
    if (fs.existsSync(transFile)) {
      const content = fs.readFileSync(transFile, 'utf8');
      const transactions = JSON.parse(content);
      console.log(`   ✅ Transaction file exists with ${transactions.length} transaction(s)`);
    } else {
      console.log(`   ❌ Transaction file NOT found!`);
    }
    console.log('');

    // Step 3: Delete customer
    console.log('Step 3: Delete customer');
    console.log('   ⚠️  CRITICAL: BF should NOT change after deletion!');
    let deleteResponse = await makeRequest('DELETE', `/customers/${customerId}/lines/${lineId}/days/${day}`);
    if (deleteResponse.status !== 200) {
      console.error('   ❌ Failed to delete customer:', deleteResponse.data);
      process.exit(1);
    }
    console.log(`   ✅ Customer deleted`);
    console.log('');

    // Step 3.5: Check if transaction file still exists
    console.log('Step 3.5: List transaction files AFTER deletion');
    if (fs.existsSync(transFile)) {
      const content = fs.readFileSync(transFile, 'utf8');
      const transactions = JSON.parse(content);
      console.log(`   ✅ Transaction file STILL EXISTS with ${transactions.length} transaction(s)`);
    } else {
      console.log(`   ❌ Transaction file DELETED! This is the BUG!`);
    }
    console.log('');

    // Step 4: Get BF after deletion
    console.log('Step 4: Check BF after deletion');
    lineResponse = await makeRequest('GET', `/lines/${lineId}`);
    const bfAfterDelete = lineResponse.data.line.currentBF;
    console.log(`   BF before delete: ${bfAfterPayment}`);
    console.log(`   BF after delete: ${bfAfterDelete}`);
    
    const bfChange = bfAfterDelete - bfAfterPayment;
    if (bfChange === 0) {
      console.log(`   ✅ SUCCESS: BF remained stable (no change)`);
    } else {
      console.log(`   ❌ FAILURE: BF jumped by ${bfChange}`);
      console.log(`   Expected: ${bfAfterPayment}`);
      console.log(`   Actual: ${bfAfterDelete}`);
    }
    console.log('');

    // Summary
    console.log('='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Initial BF:        ${initialBF}`);
    console.log(`After create:      ${bfAfterCreate} (change: ${bfAfterCreate - initialBF})`);
    console.log(`After payment:     ${bfAfterPayment} (change: ${bfAfterPayment - bfAfterCreate})`);
    console.log(`After delete:      ${bfAfterDelete} (change: ${bfAfterDelete - bfAfterPayment})`);
    console.log('');
    
    if (bfAfterDelete === bfAfterPayment) {
      console.log('✅ TEST PASSED: BF remained stable after deletion');
    } else {
      console.log('❌ TEST FAILED: BF jumped after deletion');
      console.log('');
      console.log('🔍 ROOT CAUSE: Transaction files were likely deleted or moved,');
      console.log('   causing calculateBF() to exclude the payments.');
    }
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

runTest();
