const bfCalculation = require('./backend/services/bfCalculation');

console.log('🔄 Triggering BF update for line 1764405739103...\n');

const lineId = '1764405739103';
const result = bfCalculation.updateBF(lineId);

console.log('✅ BF updated successfully!');
console.log(`New BF: ${result.bfAmount.toLocaleString()}`);
console.log('\nBreakdown:');
console.log(`  Initial: ${result.breakdown.initialAmount.toLocaleString()}`);
console.log(`  Settled Cycles: +${result.breakdown.settledCyclesAdjustment.toLocaleString()}`);
console.log(`  Current Loans: -${result.breakdown.totalNetGiven.toLocaleString()}`);
console.log(`  Current Payments: +${result.breakdown.totalCollected.toLocaleString()}`);
console.log(`  ─────────────────`);
console.log(`  Final BF: ${result.bfAmount.toLocaleString()}`);
