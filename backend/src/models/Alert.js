const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: [true, 'Cryptocurrency symbol is required'],
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Cryptocurrency name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['price_above', 'price_below', 'price_change', 'volume_spike', 'market_cap_change'],
    required: [true, 'Alert type is required']
  },
  condition: {
    // For price alerts
    targetPrice: {
      type: Number,
      min: [0, 'Target price must be positive']
    },
    currentPrice: {
      type: Number,
      min: [0, 'Current price must be positive']
    },
    
    // For percentage change alerts
    percentageChange: {
      type: Number,
      min: [-100, 'Percentage change cannot be less than -100%'],
      max: [1000, 'Percentage change cannot exceed 1000%']
    },
    timeframe: {
      type: String,
      enum: ['1h', '24h', '7d', '30d'],
      default: '24h'
    },
    
    // For volume alerts
    volumeThreshold: {
      type: Number,
      min: [0, 'Volume threshold must be positive']
    },
    
    // For market cap alerts
    marketCapThreshold: {
      type: Number,
      min: [0, 'Market cap threshold must be positive']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isTriggered: {
    type: Boolean,
    default: false
  },
  triggerCount: {
    type: Number,
    default: 0
  },
  lastTriggered: Date,
  notifications: {
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date
    },
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date
    },
    push: {
      enabled: {
        type: Boolean,
        default: true
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: Date
    }
  },
  metadata: {
    description: String,
    tags: [String],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    repeatInterval: {
      type: Number,
      default: 0, // 0 means no repeat, value in minutes
      min: [0, 'Repeat interval cannot be negative']
    },
    maxTriggers: {
      type: Number,
      default: 1,
      min: [1, 'Max triggers must be at least 1']
    },
    expiresAt: Date
  },
  priceHistory: [{
    price: Number,
    timestamp: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      default: 'coingecko'
    }
  }],
  executionLog: [{
    action: {
      type: String,
      enum: ['created', 'triggered', 'email_sent', 'sms_sent', 'push_sent', 'paused', 'resumed', 'deleted']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed,
    success: {
      type: Boolean,
      default: true
    },
    error: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for alert status
alertSchema.virtual('status').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.isTriggered) return 'triggered';
  if (this.metadata.expiresAt && this.metadata.expiresAt < Date.now()) return 'expired';
  return 'active';
});

// Virtual for progress percentage (for price alerts)
alertSchema.virtual('progress').get(function() {
  if (this.type === 'price_above' || this.type === 'price_below') {
    const { targetPrice, currentPrice } = this.condition;
    if (!targetPrice || !currentPrice) return 0;
    
    if (this.type === 'price_above') {
      return Math.min(100, (currentPrice / targetPrice) * 100);
    } else {
      return Math.min(100, (targetPrice / currentPrice) * 100);
    }
  }
  return 0;
});

// Method to check if alert should trigger
alertSchema.methods.shouldTrigger = function(currentData) {
  if (!this.isActive || this.isTriggered) return false;
  
  // Check expiration
  if (this.metadata.expiresAt && this.metadata.expiresAt < Date.now()) {
    return false;
  }
  
  // Check max triggers
  if (this.triggerCount >= this.metadata.maxTriggers) {
    return false;
  }
  
  const { price, change24h, volume, marketCap } = currentData;
  
  switch (this.type) {
    case 'price_above':
      return price >= this.condition.targetPrice;
    
    case 'price_below':
      return price <= this.condition.targetPrice;
    
    case 'price_change':
      return Math.abs(change24h) >= Math.abs(this.condition.percentageChange);
    
    case 'volume_spike':
      return volume >= this.condition.volumeThreshold;
    
    case 'market_cap_change':
      return marketCap >= this.condition.marketCapThreshold;
    
    default:
      return false;
  }
};

// Method to trigger alert
alertSchema.methods.trigger = async function(currentData) {
  this.isTriggered = true;
  this.triggerCount += 1;
  this.lastTriggered = Date.now();
  
  // Update current price
  if (currentData.price) {
    this.condition.currentPrice = currentData.price;
  }
  
  // Add to execution log
  this.executionLog.push({
    action: 'triggered',
    details: {
      triggerData: currentData,
      triggerCount: this.triggerCount
    }
  });
  
  // Reset triggered status if repeat is enabled
  if (this.metadata.repeatInterval > 0) {
    setTimeout(() => {
      this.isTriggered = false;
      this.save();
    }, this.metadata.repeatInterval * 60 * 1000);
  }
  
  return this.save();
};

// Method to pause alert
alertSchema.methods.pause = function() {
  this.isActive = false;
  this.executionLog.push({
    action: 'paused'
  });
  return this.save();
};

// Method to resume alert
alertSchema.methods.resume = function() {
  this.isActive = true;
  this.isTriggered = false;
  this.executionLog.push({
    action: 'resumed'
  });
  return this.save();
};

// Method to add price history
alertSchema.methods.addPriceHistory = function(price, source = 'coingecko') {
  this.priceHistory.push({ price, source });
  
  // Keep only last 100 entries
  if (this.priceHistory.length > 100) {
    this.priceHistory = this.priceHistory.slice(-100);
  }
  
  return this;
};

// Static method to find active alerts for a symbol
alertSchema.statics.findActiveBySymbol = function(symbol) {
  return this.find({
    symbol: symbol.toUpperCase(),
    isActive: true,
    isTriggered: false,
    $or: [
      { 'metadata.expiresAt': { $exists: false } },
      { 'metadata.expiresAt': { $gt: Date.now() } }
    ]
  }).populate('userId', 'email phoneNumber preferences');
};

// Static method to find user's alerts
alertSchema.statics.findByUserId = function(userId, options = {}) {
  const query = { userId };
  
  if (options.isActive !== undefined) {
    query.isActive = options.isActive;
  }
  
  if (options.symbol) {
    query.symbol = options.symbol.toUpperCase();
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Indexes
alertSchema.index({ userId: 1, createdAt: -1 });
alertSchema.index({ symbol: 1, isActive: 1 });
alertSchema.index({ type: 1 });
alertSchema.index({ isActive: 1, isTriggered: 1 });
alertSchema.index({ 'metadata.expiresAt': 1 });
alertSchema.index({ lastTriggered: -1 });

module.exports = mongoose.model('Alert', alertSchema); 