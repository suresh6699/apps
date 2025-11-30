const express = require('express');
const router = express.Router();
const { param, query } = require('express-validator');
const pdfController = require('../controllers/pdfController');
const validate = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Data endpoints for frontend PDF generation
router.get(
  '/data/customer-transactions/:id/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  pdfController.getCustomerTransactionData
);

router.get(
  '/data/collections/lines/:lineId',
  [
    param('lineId').notEmpty(),
    query('days').optional(),
    query('dateFrom').optional(),
    query('dateTo').optional()
  ],
  validate,
  pdfController.getCollectionsData
);

router.get(
  '/data/customer-summary/lines/:lineId',
  [
    param('lineId').notEmpty(),
    query('days').optional(),
    query('selectAllDays').optional()
  ],
  validate,
  pdfController.getCustomerSummaryData
);

// Legacy PDF generation endpoints (keeping for backward compatibility)
router.get(
  '/customer/:id/lines/:lineId/days/:day',
  [
    param('id').notEmpty(),
    param('lineId').notEmpty(),
    param('day').notEmpty()
  ],
  validate,
  pdfController.generateCustomerTransactionPDF
);

router.get(
  '/collections/lines/:lineId',
  [
    param('lineId').notEmpty(),
    query('days').optional(),
    query('dateFrom').optional(),
    query('dateTo').optional()
  ],
  validate,
  pdfController.generateCollectionsPDF
);

router.get(
  '/customer-summary/lines/:lineId',
  [
    param('lineId').notEmpty(),
    query('days').optional(),
    query('selectAllDays').optional()
  ],
  validate,
  pdfController.generateCustomerSummaryPDF
);

module.exports = router;
