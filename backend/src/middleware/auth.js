const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and attach to request
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token - user not found' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

// Admin role verification middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }

  next();
};

// Account verification middleware
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Email verification required',
      requiresVerification: true
    });
  }

  next();
};

// Resource ownership middleware
const requireOwnership = (resourceModel, resourceIdParam = 'id', userIdField = 'userId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json({ 
          success: false, 
          message: 'Resource not found' 
        });
      }

      // Check ownership or admin access
      const isOwner = resource[userIdField].toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied - insufficient permissions' 
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership verification error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Permission verification failed' 
      });
    }
  };
};

// Subscription plan verification middleware
const requireSubscription = (requiredPlan = 'premium') => {
  const planHierarchy = {
    'free': 0,
    'premium': 1,
    'enterprise': 2
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const userPlanLevel = planHierarchy[req.user.subscription.plan] || 0;
    const requiredPlanLevel = planHierarchy[requiredPlan] || 1;

    if (userPlanLevel < requiredPlanLevel) {
      return res.status(403).json({ 
        success: false, 
        message: `${requiredPlan} subscription required`,
        currentPlan: req.user.subscription.plan,
        requiredPlan: requiredPlan
      });
    }

    next();
  };
};

// Rate limiting middleware for user actions
const userActionRateLimit = (action, limit = 10, windowMs = 60000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const key = `${userId}_${action}`;
    const now = Date.now();

    if (!userRequests.has(key)) {
      userRequests.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userData = userRequests.get(key);

    if (now > userData.resetTime) {
      userData.count = 1;
      userData.resetTime = now + windowMs;
      return next();
    }

    if (userData.count >= limit) {
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded for ${action}`,
        retryAfter: Math.ceil((userData.resetTime - now) / 1000)
      });
    }

    userData.count++;
    next();
  };
};

// Generate JWT token
const generateToken = (userId, expiresIn = process.env.JWT_EXPIRES_IN || '7d') => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Verify token without middleware (utility function)
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Check if user has permission for specific action
const hasPermission = (user, action, resource = null) => {
  // Admin users have all permissions
  if (user.role === 'admin') {
    return true;
  }

  // Define permission rules
  const permissions = {
    'create_alert': (user) => {
      const alertCount = user.stats.totalAlerts || 0;
      return alertCount < user.subscription.maxAlerts;
    },
    'create_portfolio': (user) => {
      // Would need to check current portfolio count
      return true; // Simplified for now
    },
    'access_api': (user) => user.isActive && user.isEmailVerified,
    'admin_panel': (user) => user.role === 'admin',
    'premium_features': (user) => ['premium', 'enterprise'].includes(user.subscription.plan)
  };

  const permissionCheck = permissions[action];
  return permissionCheck ? permissionCheck(user, resource) : false;
};

// Middleware to check specific permission
const requirePermission = (action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!hasPermission(req.user, action, req.resource)) {
      return res.status(403).json({ 
        success: false, 
        message: `Permission denied for action: ${action}`,
        action: action
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireEmailVerification,
  requireOwnership,
  requireSubscription,
  userActionRateLimit,
  requirePermission,
  generateToken,
  verifyToken,
  hasPermission
}; 