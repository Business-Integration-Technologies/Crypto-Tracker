const express = require('express');
const { body } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('username').trim().isLength({ min: 3 })
], asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, username } = req.body;

  const existingUser = await User.findOne({ 
    $or: [{ email }, { username }] 
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email or username'
    });
  }

  const user = new User({
    email,
    password,
    firstName,
    lastName,
    username
  });

  await user.save();

  const token = generateToken(user._id);

  await notificationService.sendEmail({
    to: user.email,
    template: 'welcome',
    data: {
      firstName: user.firstName,
      dashboardUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    }
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username
      },
      token
    }
  });
}));

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findByEmail(email).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }

  if (user.isLocked) {
    return res.status(423).json({
      success: false,
      message: 'Account temporarily locked due to too many failed login attempts'
    });
  }

  await user.resetLoginAttempts();
  await user.updateLastLogin();

  const token = generateToken(user._id);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role
      },
      token
    }
  });
}));

module.exports = router;