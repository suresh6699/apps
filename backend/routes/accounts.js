const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const accountController = require('../controllers/accountController');
const validate = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get all accounts for a line
router.get(
  '/lines/:lineId',
  param('lineId').notEmpty(),
  validate,
  accountController.getAccounts
);

// Create account
router.post(
  '/lines/:lineId',
  [
    param('lineId').notEmpty(),
    body('name').trim().notEmpty().withMessage('Account name is required')
  ],
  validate,
  accountController.createAccount
);

// Update account
router.put(
  '/:id/lines/:lineId',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    body('name').trim().notEmpty().withMessage('Account name is required')
  ],
  validate,
  accountController.updateAccount
);

// Delete account
router.delete(
  '/:id/lines/:lineId',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty()
  ],
  validate,
  accountController.deleteAccount
);

// Get account transactions
router.get(
  '/:id/transactions/lines/:lineId',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty()
  ],
  validate,
  accountController.getAccountTransactions
);

// Add account transaction
router.post(
  '/:id/transactions/lines/:lineId',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    body('date').notEmpty().withMessage('Date is required')
  ],
  validate,
  accountController.addAccountTransaction
);

// Delete account transaction
router.delete(
  '/:id/transactions/:transactionId/lines/:lineId',
  [
    param('id').notEmpty(),
    param('transactionId').notEmpty(),
    param('lineId').notEmpty()
  ],
  validate,
  accountController.deleteAccountTransaction
);

module.exports = router;
