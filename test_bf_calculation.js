// Test BF Calculation with the double-counting fix

const bfService = require('./backend/services/bfCalculation');

console.log('\n========================================');
console.log('Testing BF Calculation with Merged Deletions Fix');
console.log('========================================\n');

// Test scenario:
// Initial: 50,000
// Customer 1 (first loan): 12,000 (interest 2,000, pc 0) → Net given = 10,000
// Customer 1 paid: 12,000 → Collected = 12,000
// Customer 1 deleted (remainingAtDeletion = 0)
// Customer 1 restored
// Customer 1 (second loan): 5,000 (interest 1,000, pc 0) → Net given = 4,000
// Customer 1 paid: 5,000 → Collected = 5,000
// Customer 1 deleted again (remainingAtDeletion = 0)
//
// Expected BF = 50,000 - 10,000 - 4,000 + 12,000 + 5,000 = 53,000
// OR simpler: 50,000 - (12,000 - 2,000) - (5,000 - 1,000) + 12,000 + 5,000 = 53,000

console.log('Expected values:');
console.log('- Initial: 50,000');
console.log('- First loan net given: 12,000 - 2,000 = 10,000');
console.log('- Second loan net given: 5,000 - 1,000 = 4,000');
console.log('- Total net given: 14,000');
console.log('- First payment: 12,000');
console.log('- Second payment: 5,000');
console.log('- Total collected: 17,000');
console.log('- Expected BF: 50,000 - 14,000 + 17,000 = 53,000');
console.log('');

const lineId = '1764405739103';
try {
  const result = bfService.calculateBF(lineId);
  
  console.log('Actual calculation result:');
  console.log(JSON.stringify(result, null, 2));
  console.log('');
  
  const expected = 53000;
  const actual = result.bfAmount;
  
  if (actual === expected) {
    console.log('✅ TEST PASSED: BF calculation is correct!');
    console.log(`   Expected: ${expected}, Actual: ${actual}`);
  } else {
    console.log('❌ TEST FAILED: BF calculation is incorrect!');
    console.log(`   Expected: ${expected}, Actual: ${actual}`);
    console.log(`   Difference: ${actual - expected}`);
  }
} catch (error) {
  console.error('Error:', error);
}

console.log('\n========================================\n');
