const express = require('express');
const router = express.Router();
const { param, query } = require('express-validator');
const collectionController = require('../controllers/collectionController');
const validate = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get collections for a line with filters
router.get(
  '/lines/:lineId',
  param('lineId').notEmpty(),
  validate,
  collectionController.getCollections
);

module.exports = router;
