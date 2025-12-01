const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:8001/api';

console.log('🧪 STEP 8 DELETE FIX TEST');
console.log('='.repeat(60));

async function login() {
  const response = await axios.post(`${API_URL}/auth/login`, {
    username: 'admin',
    password: 'admin123'
  });
  return response.data.token;
}

async function test() {
  try {
    // Login
    console.log('\n1️⃣  Logging in...');
    const token = await login();
    const headers = { Authorization: `Bearer ${token}` };
    
    // Get existing line
    console.log('\n2️⃣  Getting line...');
    const linesRes = await axios.get(`${API_URL}/lines`, { headers });
    const line = linesRes.data.lines[0];
    const lineId = line.id;
    const initialBF = line.currentBF;
    console.log(`   Line: ${line.name}`);
    console.log(`   Initial BF: ₹${initialBF}`);
    
    // Get or create day
    console.log('\n3️⃣  Getting day...');
    const daysRes = await axios.get(`${API_URL}/days/${lineId}`, { headers });
    let day = daysRes.data.days && daysRes.data.days.length > 0 ? daysRes.data.days[0] : null;
    
    if (!day) {
      console.log('   Creating new day: monday');
      await axios.post(`${API_URL}/days/${lineId}`, { dayName: 'monday' }, { headers });
      day = 'monday';
    }
    console.log(`   Day: ${day}`);
    
    // Create test customer
    console.log('\n4️⃣  Creating test customer...');
    const customer = {
      id: '999',
      name: 'Test Customer for STEP 8',
      village: 'Test Village',
      phone: '9999999999',
      takenAmount: 12000,
      interest: 1000,
      pc: 1000,
      date: new Date().toISOString().split('T')[0],
      weeks: 12
    };
    
    const createRes = await axios.post(
      `${API_URL}/customers/${lineId}/${day}`,
      customer,
      { headers }
    );
    console.log(`   Customer created: ${customer.name}`);
    console.log(`   BF after loan: ₹${createRes.data.newBF}`);
    const bfAfterLoan = createRes.data.newBF;
    const principal = customer.takenAmount - customer.interest - customer.pc;
    const expectedBFAfterLoan = initialBF - principal;
    console.log(`   Expected BF: ₹${expectedBFAfterLoan} (Initial ${initialBF} - Principal ${principal})`);
    
    if (Math.abs(bfAfterLoan - expectedBFAfterLoan) < 0.01) {
      console.log('   ✅ BF calculation correct after loan');
    } else {
      console.log('   ❌ BF calculation WRONG after loan');
    }
    
    // Add payment
    console.log('\n5️⃣  Adding payment...');
    const payment = {
      amount: 12000,
      date: new Date().toISOString().split('T')[0],
      comment: 'Test payment for STEP 8'
    };
    
    const paymentRes = await axios.post(
      `${API_URL}/customers/${lineId}/${day}/${customer.id}/chat`,
      payment,
      { headers }
    );
    console.log(`   Payment added: ₹${payment.amount}`);
    console.log(`   BF after payment: ₹${paymentRes.data.newBF}`);
    const bfAfterPayment = paymentRes.data.newBF;
    const expectedBFAfterPayment = bfAfterLoan + payment.amount;
    console.log(`   Expected BF: ₹${expectedBFAfterPayment} (Previous ${bfAfterLoan} + Payment ${payment.amount})`);
    
    if (Math.abs(bfAfterPayment - expectedBFAfterPayment) < 0.01) {
      console.log('   ✅ BF calculation correct after payment');
    } else {
      console.log('   ❌ BF calculation WRONG after payment');
    }
    
    // Check transaction files exist BEFORE deletion
    console.log('\n6️⃣  Checking transaction files BEFORE deletion...');
    const customersData = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'backend/data/customers', lineId, `${day}.json`),
      'utf8'
    ));
    const createdCustomer = customersData.find(c => c.id === customer.id);
    const internalId = createdCustomer.internalId || createdCustomer.id;
    console.log(`   InternalId: ${internalId}`);
    
    const transFilePath = path.join(__dirname, 'backend/data/transactions', lineId, day, `${internalId}.json`);
    const transFileExists = fs.existsSync(transFilePath);
    console.log(`   Transaction file exists: ${transFileExists ? '✅ YES' : '❌ NO'}`);
    
    if (transFileExists) {
      const transData = JSON.parse(fs.readFileSync(transFilePath, 'utf8'));
      console.log(`   Transactions count: ${transData.length}`);
    }
    
    // Delete customer
    console.log('\n7️⃣  Deleting customer...');
    await axios.delete(`${API_URL}/customers/${lineId}/${day}/${customer.id}`, { headers });
    console.log('   Customer deleted');
    
    // Check transaction files exist AFTER deletion
    console.log('\n8️⃣  Checking transaction files AFTER deletion...');
    const transFileExistsAfter = fs.existsSync(transFilePath);
    console.log(`   Transaction file still exists: ${transFileExistsAfter ? '✅ YES (CORRECT!)' : '❌ NO (BUG!)'}`);
    
    if (!transFileExistsAfter) {
      console.log('   ❌ CRITICAL BUG: Transaction file was deleted/moved!');
      console.log('   ❌ This will cause BF to jump!');
    }
    
    // Check deleted customer files were created
    console.log('\n9️⃣  Checking deleted customer files...');
    const deletedTransFilePath = path.join(__dirname, 'backend/data/deleted_transactions', lineId, day, `${internalId}.json`);
    const deletedTransExists = fs.existsSync(deletedTransFilePath);
    console.log(`   Deleted transaction file created: ${deletedTransExists ? '✅ YES' : '❌ NO'}`);
    
    // Check BF after deletion
    console.log('\n🔟 Checking BF after deletion...');
    const linesResAfter = await axios.get(`${API_URL}/lines`, { headers });
    const lineAfter = linesResAfter.data.lines.find(l => l.id === lineId);
    const bfAfterDelete = lineAfter.currentBF;
    console.log(`   BF after delete: ₹${bfAfterDelete}`);
    console.log(`   Expected BF: ₹${bfAfterPayment} (NO CHANGE)`);
    
    if (Math.abs(bfAfterDelete - bfAfterPayment) < 0.01) {
      console.log('   ✅ BF DID NOT JUMP - FIX SUCCESSFUL!');
    } else {
      console.log(`   ❌ BF JUMPED - FIX FAILED! Difference: ₹${bfAfterDelete - bfAfterPayment}`);
    }
    
    // Try to get deleted customer
    console.log('\n1️⃣1️⃣  Testing deleted customer retrieval...');
    const deletedCustomers = await axios.get(`${API_URL}/customers/${lineId}/deleted`, { headers });
    const deletedCustomer = deletedCustomers.data.deletedCustomers.find(c => c.id === customer.id);
    
    if (deletedCustomer) {
      console.log(`   Deleted customer found: ${deletedCustomer.name}`);
      console.log(`   Deletion timestamp: ${deletedCustomer.deletionTimestamp}`);
      
      // Try to get deleted customer details
      try {
        const deletedDetailsRes = await axios.get(
          `${API_URL}/customers/${lineId}/deleted/${customer.id}?timestamp=${deletedCustomer.deletionTimestamp}&lineId=${lineId}`,
          { headers }
        );
        console.log('   ✅ Deleted customer details loaded successfully');
        console.log(`   Total owed: ₹${deletedDetailsRes.data.customer.totalOwed}`);
        console.log(`   Total paid: ₹${deletedDetailsRes.data.customer.totalPaid}`);
      } catch (err) {
        console.log(`   ❌ Failed to load deleted customer details: ${err.response?.data?.error || err.message}`);
      }
      
      // Try to get deleted customer transactions
      try {
        const deletedTransRes = await axios.get(
          `${API_URL}/customers/${lineId}/deleted/${customer.id}/transactions?timestamp=${deletedCustomer.deletionTimestamp}&day=${day}`,
          { headers }
        );
        console.log(`   ✅ Deleted customer transactions loaded: ${deletedTransRes.data.transactions.length} transactions`);
      } catch (err) {
        console.log(`   ❌ Failed to load deleted customer transactions: ${err.response?.data?.error || err.message}`);
      }
    } else {
      console.log('   ❌ Deleted customer not found in list');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Initial BF: ₹${initialBF}`);
    console.log(`BF after loan: ₹${bfAfterLoan} (Expected: ₹${expectedBFAfterLoan})`);
    console.log(`BF after payment: ₹${bfAfterPayment} (Expected: ₹${expectedBFAfterPayment})`);
    console.log(`BF after delete: ₹${bfAfterDelete} (Expected: ₹${bfAfterPayment})`);
    console.log('');
    console.log(`Transaction file preserved: ${transFileExistsAfter ? '✅' : '❌'}`);
    console.log(`Deleted files created: ${deletedTransExists ? '✅' : '❌'}`);
    console.log(`BF stable after delete: ${Math.abs(bfAfterDelete - bfAfterPayment) < 0.01 ? '✅' : '❌'}`);
    console.log(`Deleted customer viewable: ${deletedCustomer ? '✅' : '❌'}`);
    console.log('');
    
    const allPassed = 
      transFileExistsAfter &&
      deletedTransExists &&
      Math.abs(bfAfterDelete - bfAfterPayment) < 0.01 &&
      deletedCustomer;
    
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED - STEP 8 FIX SUCCESSFUL!');
    } else {
      console.log('❌ SOME TESTS FAILED - REVIEW NEEDED');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

test();
