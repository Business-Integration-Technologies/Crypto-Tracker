const express = require('express');
const { body } = require('express-validator');
const { authenticateToken, userActionRateLimit } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const alertService = require('../services/alertService');

const router = express.Router();

// Get user alerts
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, active, symbol, type } = req.query;
  
  const alerts = await alertService.getUserAlerts(req.user._id, {
    isActive: active !== undefined ? active === 'true' : undefined,
    symbol,
    type,
    limit: parseInt(limit)
  });

  res.json({
    success: true,
    data: alerts
  });
}));

// Create alert
router.post('/', [
  authenticateToken,
  userActionRateLimit('create_alert', 10, 60000),
  body('symbol').notEmpty().trim().toUpperCase(),
  body('name').notEmpty().trim(),
  body('type').isIn(['price_above', 'price_below', 'price_change', 'volume_spike']),
  body('condition').isObject()
], asyncHandler(async (req, res) => {
  const alertData = {
    ...req.body,
    symbol: req.body.symbol.toUpperCase()
  };

  const alert = await alertService.createAlert(req.user._id, alertData);

  res.status(201).json({
    success: true,
    message: 'Alert created successfully',
    data: alert
  });
}));

module.exports = router;