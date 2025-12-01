const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const customerController = require('../controllers/customerController');
const validate = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get all pending customers for a line (across all days) - MUST BE BEFORE /:id
router.get(
  '/pending/lines/:lineId',
  [
    param('lineId').notEmpty()
  ],
  validate,
  customerController.getPendingCustomers
);

// Get all deleted customers for a line - MUST BE BEFORE /:id
router.get(
  '/deleted/lines/:lineId',
  [
    param('lineId').notEmpty()
  ],
  validate,
  customerController.getDeletedCustomers
);

// Get next available customer ID for a line/day - MUST BE BEFORE /:id
router.get(
  '/next-id/lines/:lineId/days/:day',
  [
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  customerController.getNextCustomerId
);

// Get all customers for a line/day
router.get(
  '/lines/:lineId/days/:day',
  [
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  customerController.getCustomersByLineAndDay
);

// Get deleted customer by ID and timestamp
router.get(
  '/:id/deleted/lines/:lineId',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    query('timestamp').optional()
  ],
  validate,
  customerController.getDeletedCustomerById
);

// Get archived transactions for deleted customer
router.get(
  '/:id/deleted-transactions/lines/:lineId',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    query('timestamp').notEmpty().withMessage('timestamp is required'),
    query('day').notEmpty().withMessage('day is required')
  ],
  validate,
  customerController.getDeletedCustomerTransactions
);

// Get archived chat for deleted customer
router.get(
  '/:id/deleted-chat/lines/:lineId',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    query('timestamp').notEmpty().withMessage('timestamp is required'),
    query('day').notEmpty().withMessage('day is required')
  ],
  validate,
  customerController.getDeletedCustomerChat
);

// Get archived renewals for deleted customer
router.get(
  '/:id/deleted-renewals/lines/:lineId',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    query('timestamp').notEmpty().withMessage('timestamp is required'),
    query('day').notEmpty().withMessage('day is required')
  ],
  validate,
  customerController.getDeletedCustomerRenewals
);

// Get specific customer
router.get('/:id', param('id').notEmpty(), validate, customerController.getCustomerById);

// Create customer
router.post(
  '/lines/:lineId/days/:day',
  [
    param('lineId').notEmpty(),
    param('day').notEmpty(),
    body('id').trim().notEmpty().withMessage('Customer ID is required'),
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('takenAmount').isFloat({ min: 0 }).withMessage('Valid taken amount is required'),
    body('date').notEmpty().withMessage('Date is required')
  ],
  validate,
  customerController.createCustomer
);

// Update customer
router.put(
  '/:id/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  customerController.updateCustomer
);

// Delete/archive customer
router.delete(
  '/:id/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  customerController.deleteCustomer
);

// Restore deleted customer
router.post(
  '/:id/restore/lines/:lineId',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    body('newId').trim().notEmpty().withMessage('New ID is required'),
    body('takenAmount').isFloat({ min: 0 }).withMessage('Valid taken amount is required'),
    body('deletedFrom').notEmpty().withMessage('Original day is required')
  ],
  validate,
  customerController.restoreCustomer
);

// Get customer transactions
router.get(
  '/:id/transactions/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  customerController.getCustomerTransactions
);


// Get customer print data with pre-calculated statement
router.get(
  '/:id/print-data/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  customerController.getCustomerPrintData
);

// Get customer renewals
router.get(
  '/:id/renewals/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  customerController.getCustomerRenewals
);

// Create renewal for customer
router.post(
  '/:id/renewals/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty(),
    body('takenAmount').isFloat({ min: 0 }).withMessage('Valid taken amount is required'),
    body('date').notEmpty().withMessage('Date is required')
  ],
  validate,
  customerController.createRenewal
);

// Get customer chat
router.get(
  '/:id/chat/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  customerController.getCustomerChat
);

// Add chat transaction or comment
router.post(
  '/:id/chat/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
    // amount and date are now optional - can be either transaction or comment
  ],
  validate,
  customerController.addChatTransaction
);

module.exports = router;
