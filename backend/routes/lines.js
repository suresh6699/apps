const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const lineController = require('../controllers/lineController');
const validate = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get all lines with calculated BF
router.get('/', lineController.getAllLines);

// Get specific line
router.get('/:id', param('id').notEmpty(), validate, lineController.getLineById);

// Create new line
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Line name is required'),
    body('type').isIn(['Daily', 'Weekly']).withMessage('Type must be Daily or Weekly'),
    body('days').isArray({ min: 1 }).withMessage('At least one day is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number')
  ],
  validate,
  lineController.createLine
);

// Update line
router.put('/:id', param('id').notEmpty(), validate, lineController.updateLine);

// Delete line (and all related data)
router.delete('/:id', param('id').notEmpty(), validate, lineController.deleteLine);

// Get calculated BF for a line
router.get('/:id/bf', param('id').notEmpty(), validate, lineController.getLineBF);

module.exports = router;
