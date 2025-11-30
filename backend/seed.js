const fileManager = require('./services/fileManager');
const Customer = require('./models/Customer');
const Line = require('./models/Line');
const Transaction = require('./models/Transaction');

console.log('🌱 Starting database seeding...\n');

// Helper function to generate random date in the past 30 days
function getRandomDate(daysAgo = 30) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString().split('T')[0];
}

// Helper function to generate random amount
function getRandomAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 1. Seed Lines
console.log('📊 Creating Lines...');
const linesData = [
  {
    id: '1',
    name: 'Main Line',
    type: 'Daily',
    days: ['Monday', 'Tuesday'],
    amount: 50000,
    currentBF: 50000
  }
];

const lines = linesData.map(data => new Line(data).toJSON());
fileManager.writeJSON('lines.json', lines);
console.log(`✅ Created ${lines.length} lines\n`);

// 2. Seed Customers for each line and day
console.log('👥 Creating Customers...');
const customerNames = [
  { name: 'Rajesh Kumar', village: 'Ramapuram', phone: '9876543210' },
  { name: 'Priya Sharma', village: 'Krishnapuram', phone: '9876543211' },
  { name: 'Anil Reddy', village: 'Lakshmipur', phone: '9876543212' },
  { name: 'Lakshmi Devi', village: 'Ramapuram', phone: '9876543213' },
  { name: 'Suresh Babu', village: 'Venkateswarapuram', phone: '9876543214' },
  { name: 'Kavitha Rao', village: 'Krishnapuram', phone: '9876543215' },
  { name: 'Venkat Reddy', village: 'Lakshmipur', phone: '9876543216' },
  { name: 'Sita Lakshmi', village: 'Ramapuram', phone: '9876543217' },
  { name: 'Krishna Murthy', village: 'Venkateswarapuram', phone: '9876543218' },
  { name: 'Radha Devi', village: 'Krishnapuram', phone: '9876543219' },
  { name: 'Ramesh Kumar', village: 'Lakshmipur', phone: '9876543220' },
  { name: 'Anitha Reddy', village: 'Ramapuram', phone: '9876543221' },
  { name: 'Srinivas Rao', village: 'Venkateswarapuram', phone: '9876543222' },
  { name: 'Padma Lakshmi', village: 'Krishnapuram', phone: '9876543223' },
  { name: 'Narayana Swamy', village: 'Lakshmipur', phone: '9876543224' }
];

lines.forEach((line, lineIndex) => {
  // Create customers for EACH day in the line
  line.days.forEach((day, dayIndex) => {
    const customersPerDay = 3; // 3 customers per day
    const startIdx = (lineIndex * line.days.length * customersPerDay) + (dayIndex * customersPerDay);
    const dayCustomers = [];

    for (let i = 0; i < customersPerDay; i++) {
      const customerInfo = customerNames[(startIdx + i) % customerNames.length];
      const customer = new Customer({
        id: `C${lineIndex + 1}${dayIndex + 1}${String(i + 1).padStart(2, '0')}`,
        name: customerInfo.name,
        village: customerInfo.village,
        phone: customerInfo.phone,
        takenAmount: getRandomAmount(10000, 50000),
        interest: getRandomAmount(5, 15),
        pc: getRandomAmount(100, 500),
        date: getRandomDate(60),
        weeks: [12, 16, 20, 24][Math.floor(Math.random() * 4)]
      }).toJSON();
      
      dayCustomers.push(customer);
    }

    // Store customers by line and day: /customers/{lineId}/{day}.json
    fileManager.writeJSON(`customers/${line.id}/${day}.json`, dayCustomers);
    console.log(`✅ Created ${dayCustomers.length} customers for ${line.name} - ${day}`);
  });
});
console.log();

// 3. Seed Customer Transactions for each line/day/customer
console.log('💰 Creating Customer Transactions...');
lines.forEach(line => {
  line.days.forEach(day => {
    const customers = fileManager.readJSON(`customers/${line.id}/${day}.json`) || [];
    
    customers.forEach(customer => {
      const transactions = [];
      const numTransactions = getRandomAmount(3, 7); // 3-7 transactions per customer
      
      for (let i = 0; i < numTransactions; i++) {
        const transaction = new Transaction({
          amount: getRandomAmount(500, 3000),
          date: getRandomDate(30),
          comment: ['Weekly payment', 'Partial payment', 'Interest payment'][Math.floor(Math.random() * 3)],
          customerName: customer.name
        }).toJSON();
        
        transactions.push(transaction);
      }
      
      const internalId = customer.internalId || customer.id;
      fileManager.writeJSON(`transactions/${line.id}/${day}/${internalId}.json`, transactions);
    });
    
    console.log(`✅ Created transactions for ${line.name} - ${day}`);
  });
});
console.log();

// 4. Seed Accounts for each line
console.log('🏦 Creating Accounts...');
const accountTypes = [
  'Bank Account',
  'Cash Reserve',
  'Investment Fund',
  'Emergency Fund',
  'Operating Account'
];

lines.forEach(line => {
  const accounts = [];
  const numAccounts = getRandomAmount(3, 5);

  for (let i = 0; i < numAccounts; i++) {
    const account = {
      id: `${line.id}_acc_${Date.now() + i}`,
      name: accountTypes[i % accountTypes.length],
      createdAt: new Date().toISOString()
    };
    accounts.push(account);
  }

  fileManager.writeJSON(`accounts/${line.id}.json`, accounts);
  console.log(`✅ Created ${accounts.length} accounts for ${line.name}`);
});
console.log();

// 5. Seed Account Transactions
console.log('📝 Creating Account Transactions...');
lines.forEach(line => {
  const accounts = fileManager.readJSON(`accounts/${line.id}.json`) || [];
  
  accounts.forEach(account => {
    const accountTransactions = [];
    const numTransactions = getRandomAmount(5, 10);

    for (let i = 0; i < numTransactions; i++) {
      const isCredit = Math.random() > 0.5;
      const transaction = {
        id: `${Date.now()}_${i}`,
        name: isCredit ? 
          ['Deposit', 'Interest Received', 'Collection'][Math.floor(Math.random() * 3)] :
          ['Withdrawal', 'Expense', 'Loan Disbursement'][Math.floor(Math.random() * 3)],
        date: getRandomDate(30),
        creditAmount: isCredit ? getRandomAmount(1000, 10000) : 0,
        debitAmount: isCredit ? 0 : getRandomAmount(500, 5000),
        createdAt: new Date().toISOString()
      };
      accountTransactions.push(transaction);
    }

    fileManager.writeJSON(`account_transactions/${line.id}/${account.id}.json`, accountTransactions);
  });
  
  console.log(`✅ Created account transactions for ${line.name}`);
});
console.log();

// 6. Seed Days for each line (already defined in lines, but creating day files)
console.log('📅 Creating Days...');
lines.forEach(line => {
  fileManager.writeJSON(`days/${line.id}.json`, line.days);
  console.log(`✅ Created ${line.days.length} days for ${line.name}`);
});
console.log();

// 7. Renewals - Not creating any initially
// Renewals should be created through the UI when a customer's loan is actually renewed
console.log('✅ Skipping renewal seeding (renewals should be created through UI)\n');

// Summary
const totalDays = lines.reduce((sum, line) => sum + line.days.length, 0);
const totalCustomers = totalDays * 3; // 3 customers per day
console.log('✨ Database seeding completed successfully! ✨\n');
console.log('📊 Summary:');
console.log(`   - Lines: ${lines.length} (Main Line only)`);
console.log(`   - Total Days: ${totalDays} (Monday, Tuesday)`);
console.log(`   - Total Customers: ${totalCustomers} (3 per day)`);
console.log(`   - Customer Transactions: 3-7 per customer`);
console.log(`   - Accounts: ${lines.length * 3} - ${lines.length * 5}`);
console.log(`   - Account Transactions: 5-10 per account`);
console.log(`   - Renewals: 0 (create through UI)`);
console.log('\n🎉 You can now test the application with dummy data!\n');
