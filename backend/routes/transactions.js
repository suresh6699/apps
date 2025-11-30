const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const transactionController = require('../controllers/transactionController');
const validate = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get all transactions for customer
router.get(
  '/customers/:customerId/lines/:lineId/days/:day',
  [
    param('customerId').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  transactionController.getTransactions
);

// Add transaction
router.post(
  '/customers/:customerId/lines/:lineId/days/:day',
  [
    param('customerId').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty(),
    body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required'),
    body('date').notEmpty().withMessage('Date is required')
  ],
  validate,
  transactionController.addTransaction
);

// Update transaction
router.put(
  '/:id/customers/:customerId/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('customerId').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty(),
    body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required')
  ],
  validate,
  transactionController.updateTransaction
);

// Delete transaction
router.delete(
  '/:id/customers/:customerId/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('customerId').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  transactionController.deleteTransaction
);

module.exports = router;
