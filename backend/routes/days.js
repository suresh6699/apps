const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const dayController = require('../controllers/dayController');
const validate = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get all days for a line
router.get('/lines/:lineId', param('lineId').notEmpty(), validate, dayController.getDaysByLine);

// Create new day for a line
router.post(
  '/lines/:lineId',
  [
    param('lineId').notEmpty(),
    body('day').trim().notEmpty().withMessage('Day is required')
  ],
  validate,
  dayController.createDay
);

module.exports = router;
