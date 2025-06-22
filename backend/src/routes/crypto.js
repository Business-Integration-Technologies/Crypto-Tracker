const express = require('express');
const cryptoService = require('../services/cryptoService');
const { optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get market data
router.get('/market', optionalAuth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, currency = 'usd' } = req.query;
  
  const marketData = await cryptoService.getMarketData(
    parseInt(page), 
    parseInt(limit), 
    currency
  );

  res.json({
    success: true,
    data: marketData
  });
}));

// Get current prices
router.get('/prices', optionalAuth, asyncHandler(async (req, res) => {
  const { symbols, currencies = 'usd' } = req.query;
  
  if (!symbols) {
    return res.status(400).json({
      success: false,
      message: 'Symbols parameter is required'
    });
  }

  const symbolArray = symbols.split(',');
  const currencyArray = currencies.split(',');
  
  const prices = await cryptoService.getCurrentPrices(symbolArray, currencyArray);

  res.json({
    success: true,
    data: prices
  });
}));

// Get trending coins
router.get('/trending', optionalAuth, asyncHandler(async (req, res) => {
  const trending = await cryptoService.getTrendingCoins();

  res.json({
    success: true,
    data: trending
  });
}));

module.exports = router;