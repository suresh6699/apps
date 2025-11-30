# Database Seeding Guide

## Overview
This seed script populates the Finance Management application with realistic dummy data for testing purposes.

## What Gets Created

### 1. **Lines (3 items)**
- **Main Line**: Daily line operating Monday-Friday with ₹50,000 BF
- **Weekly Line A**: Weekly line operating Monday & Thursday with ₹30,000 BF
- **Weekend Line**: Weekly line operating Saturday & Sunday with ₹25,000 BF

### 2. **Customers (27 items - 3 per day per line)**
Each customer includes:
- Unique ID (e.g., C1001, C2001, C3001)
- Name (Indian names)
- Village (Ramapuram, Krishnapuram, Lakshmipur, etc.)
- Phone number
- Taken amount (₹10,000 - ₹50,000)
- Interest rate (5% - 15%)
- PC amount (₹100 - ₹500)
- Start date (within last 60 days)
- Duration (12, 16, 20, or 24 weeks)

Sample customers:
- Rajesh Kumar, Ramapuram
- Priya Sharma, Krishnapuram
- Anil Reddy, Lakshmipur
- And more...

### 3. **Transactions (10-15 per line)**
Various transaction types:
- Daily collection (₹500 - ₹2,000)
- Weekly settlement (₹5,000 - ₹10,000)
- Partial payment (₹1,000 - ₹3,000)
- Interest payment (₹200 - ₹800)
- Loan disbursement (₹10,000 - ₹30,000)

All transactions are dated within the last 30 days.

### 4. **Accounts (3-5 per line)**
Account types include:
- Bank Account
- Cash Reserve
- Investment Fund
- Emergency Fund
- Operating Account

### 5. **Account Transactions (5-10 per account)**
Each account has multiple transactions with:
- Credit entries: Deposits, Interest Received, Collections
- Debit entries: Withdrawals, Expenses, Loan Disbursements
- All dated within the last 30 days

### 6. **Days (per line)**
- Main Line: Monday-Friday
- Weekly Line A: Monday, Thursday
- Weekend Line: Saturday, Sunday

### 7. **Renewals (2-3 per line)**
Customer renewals with:
- Original loan amount
- Renewed amount (increased)
- Renewal date
- Active status

## How to Run

### First Time Setup (Already Done)
```bash
cd /app/backend
node seed.js
```

### Re-seed Database (Clear and Repopulate)
If you want to clear existing data and create fresh dummy data:

```bash
cd /app/backend

# Delete existing data (be careful!)
rm -rf data/customers/*.json
rm -rf data/transactions/*.json
rm -rf data/accounts/*.json
rm -rf data/account_transactions/*/*.json
rm -rf data/renewals/*.json
rm data/lines.json

# Run seed script
node seed.js
```

## Verification

After seeding, you can verify the data:

```bash
# Check lines
cat data/lines.json | jq '.'

# Check customers for line 1 - Monday
cat data/customers/1/Monday.json | jq '.'

# List all days for line 1
ls data/customers/1/

# Check transactions for first customer on line 1 - Monday
ls data/transactions/1/Monday/

# Check accounts for line 1
cat data/accounts/1.json | jq '.'

# Check account transactions
ls data/account_transactions/1/
cat data/account_transactions/1/*.json | jq '.'
```

## Testing with API

To test with the API, you'll need to:

1. Login first (default admin credentials):
   - Username: `admin`
   - Password: `admin123`

2. Get the JWT token from the login response

3. Use the token in subsequent API calls:
```bash
TOKEN="your-jwt-token-here"

# Get all lines
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/lines

# Get customers for line 1
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/customers/1

# Get accounts for line 1
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/accounts/1
```

## Customization

To modify the seed data, edit `/app/backend/seed.js`:

- **Add more customers**: Increase the `customersPerLine` variable
- **Add more transactions**: Change the `numTransactions` range
- **Modify amounts**: Adjust the `getRandomAmount()` parameters
- **Change date range**: Modify the `getRandomDate()` function

## Notes

- All amounts are in Indian Rupees (₹)
- Dates are in ISO format (YYYY-MM-DD)
- Customer IDs follow the pattern: C[LineNumber][CustomerNumber]
- All data is randomly generated but realistic
- Phone numbers start with 9876543xxx

## File Structure

After seeding, the data directory will contain:

```
/app/backend/data/
├── lines.json
├── customers/
│   ├── 1/           (Main Line)
│   │   ├── Monday.json
│   │   ├── Tuesday.json
│   │   ├── Wednesday.json
│   │   ├── Thursday.json
│   │   └── Friday.json
│   ├── 2/           (Weekly Line A)
│   │   ├── Monday.json
│   │   └── Thursday.json
│   └── 3/           (Weekend Line)
│       ├── Saturday.json
│       └── Sunday.json
├── transactions/
│   ├── 1/           (Main Line)
│   │   ├── Monday/
│   │   │   └── {customerInternalId}.json
│   │   ├── Tuesday/
│   │   └── ...
│   ├── 2/
│   └── 3/
├── accounts/
│   ├── 1.json
│   ├── 2.json
│   └── 3.json
├── account_transactions/
│   ├── 1/ (Line 1 accounts)
│   ├── 2/ (Line 2 accounts)
│   └── 3/ (Line 3 accounts)
├── days/
│   ├── 1.json
│   ├── 2.json
│   └── 3.json
└── renewals/
    ├── 1/           (Main Line)
    │   ├── Monday/
    │   │   └── {customerInternalId}.json
    │   └── ...
    ├── 2/
    └── 3/
```

## Support

If you encounter any issues with the seed script:
1. Check that all dependencies are installed (`npm install`)
2. Ensure the backend server is running
3. Verify file permissions in the data directory
4. Check the console output for specific errors
