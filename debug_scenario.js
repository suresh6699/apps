const fileManager = require('./backend/services/fileManager');

const lineId = '1764405739103';

console.log('\n=== SCENARIO ANALYSIS ===\n');

// Get deleted customers
const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
console.log('Deleted Customers:');
deletedCustomers.forEach((dc, idx) => {
  console.log(`\n${idx + 1}. internalId: ${dc.internalId}`);
  console.log(`   takenAmount: ${dc.takenAmount}, interest: ${dc.interest}`);
  console.log(`   Net given: ${dc.takenAmount - (dc.interest || 0)}`);
  console.log(`   remainingAtDeletion: ${dc.remainingAtDeletion}`);
  console.log(`   isRestored: ${dc.isRestored}`);
  console.log(`   mergedIntoTimestamp: ${dc.mergedIntoTimestamp || 'none'}`);
  console.log(`   deletionTimestamp: ${dc.deletionTimestamp}`);
});

// Get active customers
const activeCustomers = fileManager.readJSON(`customers/${lineId}/mon.json`) || [];
console.log('\n\nActive Customers:');
activeCustomers.forEach((ac, idx) => {
  console.log(`\n${idx + 1}. internalId: ${ac.internalId}`);
  console.log(`   takenAmount: ${ac.takenAmount}, interest: ${ac.interest}`);
  console.log(`   Net given: ${ac.takenAmount - (ac.interest || 0)}`);
  console.log(`   isRestoredCustomer: ${ac.isRestoredCustomer}`);
  console.log(`   restoredFromInternalId: ${ac.restoredFromInternalId || 'none'}`);
  console.log(`   restoredFromTimestamp: ${ac.restoredFromTimestamp || 'none'}`);
  console.log(`   createdAt: ${ac.createdAt}`);
  
  // Get transactions
  const transactions = fileManager.readJSON(`transactions/${lineId}/mon/${ac.internalId}.json`) || [];
  console.log(`   Transactions:`);
  transactions.forEach(t => {
    console.log(`     - ${t.amount} at ${t.createdAt}`);
  });
});

console.log('\n\n=== WHAT SHOULD BE COUNTED ===\n');
console.log('Based on delete → restore → delete → restore chain:');
console.log('- First loan (10k net): CLOSED/SETTLED, restored → DO NOT COUNT');
console.log('- Second loan (4k net): CLOSED/SETTLED, restored → DO NOT COUNT');  
console.log('- Third loan (10k net): ACTIVE → COUNT');
console.log('- Transactions (17k): All collected → COUNT');
console.log('');
console.log('Expected: BF = 50k - 10k + 17k = 57k');
console.log('But user expects: 53k');
console.log('Difference: 4k (second loan net)');
console.log('');
console.log('User wants: Only count CURRENT active loan, not intermediate loans!');

