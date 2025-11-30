const fileManager = require('./backend/services/fileManager');

const lineId = '1764405739103';

console.log('\n=== CURRENT STATE ANALYSIS ===\n');

// Active customer
const activeCustomers = fileManager.readJSON(`customers/${lineId}/mon.json`) || [];
console.log('Active Customer:');
activeCustomers.forEach(c => {
  console.log(`  Name: ${c.name}`);
  console.log(`  Taken: ${c.takenAmount} (Interest: ${c.interest})`);
  console.log(`  Net Given: ${c.takenAmount - c.interest}`);
  console.log(`  Created: ${c.createdAt}`);
  
  // Check transactions
  const trans = fileManager.readJSON(`transactions/${lineId}/mon/${c.internalId}.json`) || [];
  console.log(`  Transactions:`);
  trans.forEach(t => {
    console.log(`    - ${t.amount} at ${t.createdAt}`);
  });
  
  // Calculate remaining
  const totalPaid = trans.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const remaining = c.takenAmount - totalPaid;
  console.log(`  Total Paid: ${totalPaid}`);
  console.log(`  Remaining: ${remaining}`);
});

// BF Calculation
const bfService = require('./backend/services/bfCalculation');
const result = bfService.calculateBF(lineId);

console.log('\n=== BF CALCULATION ===');
console.log(JSON.stringify(result, null, 2));

console.log('\n=== EXPECTED ===');
console.log('Initial: 50,000');
console.log('Current loan net given: 10,000');
console.log('Current loan payments: 0');
console.log('Expected BF: 50,000 - 10,000 + 0 = 40,000');
console.log('\nBUT if customer already made payment, it should be higher!');

