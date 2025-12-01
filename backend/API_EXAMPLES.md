# API Response Examples

## 1. Authentication

### Login Response
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1761390806241",
    "username": "admin",
    "name": "John Doe",
    "email": "johndoe@example.com",
    "role": "Super Admin"
  }
}
```

## 2. Lines

### Get All Lines Response
```json
{
  "lines": [
    {
      "id": "1",
      "name": "Main Line",
      "type": "Daily",
      "days": ["Mon", "Wed", "Fri"],
      "amount": 500000,
      "currentBF": 349130,
      "createdAt": "2025-10-25T11:13:26.241Z",
      "updatedAt": "2025-10-25T11:13:26.241Z",
      "bfBreakdown": {
        "initialAmount": 500000,
        "totalGiven": 227000,
        "totalCollected": 71130,
        "totalRenewals": 0,
        "accountNet": 5000
      }
    }
  ]
}
```

### Get Line BF Response
```json
{
  "lineId": "1",
  "lineName": "Main Line",
  "bfAmount": 349130,
  "breakdown": {
    "initialAmount": 500000,
    "totalGiven": 227000,
    "totalCollected": 71130,
    "totalRenewals": 0,
    "accountNet": 5000
  }
}
```

## 3. Customers

### Get Customers Response
```json
{
  "customers": [
    {
      "id": "C001",
      "name": "Rajesh Kumar",
      "village": "Greenfield",
      "phone": "9876543210",
      "takenAmount": 30000,
      "interest": 10,
      "pc": 5,
      "date": "2025-01-05",
      "weeks": 12,
      "profileImage": null,
      "createdAt": "2025-10-25T11:13:26.242Z",
      "updatedAt": "2025-10-25T11:13:26.242Z",
      "totalOwed": 30000,
      "totalPaid": 7500,
      "remainingAmount": 22500
    }
  ]
}
```

### Create Customer Response
```json
{
  "message": "Customer created successfully",
  "customer": {
    "id": "C011",
    "name": "New Customer",
    "village": "Test Village",
    "phone": "1234567890",
    "takenAmount": 25000,
    "interest": 10,
    "pc": 5,
    "date": "2025-02-01",
    "weeks": 12,
    "profileImage": null,
    "createdAt": "2025-10-25T11:20:00.000Z",
    "updatedAt": "2025-10-25T11:20:00.000Z"
  },
  "newBF": 324130
}
```

## 4. Transactions

### Get Transactions Response
```json
{
  "transactions": [
    {
      "id": "t1",
      "amount": 2500,
      "date": "2025-01-12",
      "comment": "Week 1",
      "customerName": "Rajesh Kumar",
      "createdAt": "2025-10-25T11:13:26.242Z"
    },
    {
      "id": "t2",
      "amount": 2500,
      "date": "2025-01-19",
      "comment": "Week 2",
      "customerName": "Rajesh Kumar",
      "createdAt": "2025-10-25T11:13:26.242Z"
    }
  ]
}
```

### Add Transaction Response
```json
{
  "message": "Transaction added successfully",
  "transaction": {
    "id": "1761390906580",
    "amount": 1000,
    "date": "2025-02-01",
    "comment": "Test payment",
    "customerName": "Rajesh Kumar",
    "createdAt": "2025-10-25T11:15:06.580Z"
  },
  "newBF": 350130
}
```

## 5. Collections

### Get Collections Response
```json
{
  "incomingTransactions": [
    {
      "id": "t1",
      "amount": 2500,
      "date": "2025-01-12",
      "comment": "Week 1",
      "customerName": "Rajesh Kumar",
      "createdAt": "2025-10-25T11:13:26.242Z",
      "customerId": "C001",
      "day": "2025-01-15",
      "type": "incoming"
    }
  ],
  "goingTransactions": [
    {
      "id": "customer_creation_C001",
      "customerId": "C001",
      "customerName": "Rajesh Kumar",
      "amount": 30000,
      "date": "2025-01-05",
      "type": "customer_creation",
      "comment": "Customer Created",
      "day": "2025-01-15"
    }
  ],
  "totals": {
    "incoming": 71130,
    "going": 227000,
    "netFlow": -155870
  },
  "filters": {
    "days": ["2025-01-15"],
    "date": null,
    "dateFrom": null,
    "dateTo": null
  }
}
```

## 6. Accounts

### Get Accounts Response
```json
{
  "accounts": [
    {
      "id": "1761390906632",
      "name": "Bank Account",
      "createdAt": "2025-10-25T11:15:06.632Z"
    }
  ]
}
```

### Get Account Transactions Response
```json
{
  "transactions": [
    {
      "id": "1761390906650",
      "name": "Test Deposit",
      "date": "2025-02-01",
      "creditAmount": 5000,
      "debitAmount": 0,
      "createdAt": "2025-10-25T11:15:06.650Z"
    }
  ]
}
```

## 7. Error Responses

### Validation Error
```json
{
  "errors": [
    {
      "msg": "Customer name is required",
      "param": "name",
      "location": "body"
    }
  ]
}
```

### Authentication Error
```json
{
  "error": "Token is not valid"
}
```

### Not Found Error
```json
{
  "error": "Customer not found"
}
```

### Business Logic Error
```json
{
  "error": "Cannot delete customer with pending amount: ₹22500.00"
}
```

## 8. Success Messages

### Delete Success
```json
{
  "message": "Customer deleted and archived successfully"
}
```

### Update Success
```json
{
  "message": "Line updated successfully",
  "line": {
    "id": "1",
    "name": "Updated Line Name",
    "type": "Daily",
    "days": ["Mon", "Wed", "Fri"],
    "amount": 150000,
    "currentBF": 349130,
    "createdAt": "2025-10-25T11:13:26.241Z",
    "updatedAt": "2025-10-25T11:25:00.000Z"
  }
}
```

## Notes

- All timestamps are in ISO 8601 format
- All amounts are in numbers (not strings)
- BF is automatically recalculated and returned after modifications
- Errors include appropriate HTTP status codes (400, 401, 404, 500)
- Success operations return relevant data for frontend updates
