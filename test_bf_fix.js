const bfCalculation = require('./backend/services/bfCalculation');

// Test the BF calculation for line 1764405739103
console.log('\n🧪 Testing BF Calculation Fix...\n');

const lineId = '1764405739103';
const result = bfCalculation.calculateBF(lineId);

console.log('\n📊 BF Calculation Result:');
console.log('═'.repeat(50));
console.log(`Line ID: ${lineId}`);
console.log(`BF Amount: ${result.bfAmount}`);
console.log('\nBreakdown:');
console.log(`  Initial Amount: ${result.breakdown.initialAmount}`);
console.log(`  Total Net Given: ${result.breakdown.totalNetGiven}`);
console.log(`  Total Collected: ${result.breakdown.totalCollected}`);
console.log(`  Total Net Renewals: ${result.breakdown.totalNetRenewals}`);
console.log(`  Account Net: ${result.breakdown.accountNet}`);
console.log(`  Settled Cycles Adjustment: ${result.breakdown.settledCyclesAdjustment}`);
console.log('═'.repeat(50));

console.log('\n✅ Expected BF: 43,000');
console.log(`✅ Actual BF: ${result.bfAmount.toLocaleString()}`);
console.log(`${result.bfAmount === 43000 ? '✅ TEST PASSED!' : '❌ TEST FAILED!'}\n`);
