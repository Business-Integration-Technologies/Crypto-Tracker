const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get system stats
router.get('/stats', [authenticateToken, requireAdmin], asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      users: 0,
      alerts: 0,
      uptime: process.uptime()
    }
  });
}));

module.exports = router;