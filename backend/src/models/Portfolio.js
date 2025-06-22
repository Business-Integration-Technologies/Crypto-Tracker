const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
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
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive']
  },
  averageBuyPrice: {
    type: Number,
    required: [true, 'Average buy price is required'],
    min: [0, 'Average buy price must be positive']
  },
  currentPrice: {
    type: Number,
    default: 0,
    min: [0, 'Current price must be positive']
  },
  totalInvested: {
    type: Number,
    default: 0,
    min: [0, 'Total invested must be positive']
  },
  currentValue: {
    type: Number,
    default: 0,
    min: [0, 'Current value must be positive']
  },
  profitLoss: {
    type: Number,
    default: 0
  },
  profitLossPercentage: {
    type: Number,
    default: 0
  },
  transactions: [{
    type: {
      type: String,
      enum: ['buy', 'sell'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Transaction amount must be positive']
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Transaction price must be positive']
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Transaction total must be positive']
    },
    fee: {
      type: Number,
      default: 0,
      min: [0, 'Transaction fee cannot be negative']
    },
    exchange: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    addedAt: {
      type: Date,
      default: Date.now
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    priceAlerts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert'
    }],
    tags: [String],
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
  }
}, {
  timestamps: true
});

const portfolioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Portfolio name is required'],
    trim: true,
    maxlength: [100, 'Portfolio name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  holdings: [holdingSchema],
  summary: {
    totalInvested: {
      type: Number,
      default: 0,
      min: [0, 'Total invested cannot be negative']
    },
    currentValue: {
      type: Number,
      default: 0,
      min: [0, 'Current value cannot be negative']
    },
    totalProfitLoss: {
      type: Number,
      default: 0
    },
    totalProfitLossPercentage: {
      type: Number,
      default: 0
    },
    dayChange: {
      type: Number,
      default: 0
    },
    dayChangePercentage: {
      type: Number,
      default: 0
    },
    diversificationScore: {
      type: Number,
      default: 0,
      min: [0, 'Diversification score cannot be negative'],
      max: [100, 'Diversification score cannot exceed 100']
    },
    riskScore: {
      type: String,
      enum: ['low', 'medium', 'high', 'very_high'],
      default: 'medium'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  settings: {
    autoUpdate: {
      type: Boolean,
      default: true
    },
    updateInterval: {
      type: Number,
      default: 300, // 5 minutes in seconds
      min: [60, 'Update interval must be at least 60 seconds']
    },
    showBalances: {
      type: Boolean,
      default: true
    },
    showProfitLoss: {
      type: Boolean,
      default: true
    },
    notifications: {
      priceAlerts: {
        type: Boolean,
        default: true
      },
      portfolioUpdates: {
        type: Boolean,
        default: false
      },
      weeklyReport: {
        type: Boolean,
        default: false
      }
    }
  },
  analytics: {
    performanceHistory: [{
      date: {
        type: Date,
        default: Date.now
      },
      totalValue: Number,
      profitLoss: Number,
      profitLossPercentage: Number,
      holdings: [{
        symbol: String,
        value: Number,
        price: Number,
        amount: Number
      }]
    }],
    bestPerformer: {
      symbol: String,
      profitLossPercentage: Number
    },
    worstPerformer: {
      symbol: String,
      profitLossPercentage: Number
    },
    averageHoldingTime: Number, // in days
    totalTransactions: {
      type: Number,
      default: 0
    },
    totalFees: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for portfolio allocation
portfolioSchema.virtual('allocation').get(function() {
  if (!this.holdings || this.holdings.length === 0) return [];
  
  const totalValue = this.summary.currentValue;
  if (totalValue === 0) return [];
  
  return this.holdings.map(holding => ({
    symbol: holding.symbol,
    name: holding.name,
    value: holding.currentValue,
    percentage: (holding.currentValue / totalValue) * 100,
    amount: holding.amount
  }));
});

// Method to add holding
portfolioSchema.methods.addHolding = function(holdingData) {
  const existingHolding = this.holdings.find(h => h.symbol === holdingData.symbol.toUpperCase());
  
  if (existingHolding) {
    // Update existing holding
    const newTotalAmount = existingHolding.amount + holdingData.amount;
    const newTotalInvested = existingHolding.totalInvested + (holdingData.amount * holdingData.price);
    
    existingHolding.amount = newTotalAmount;
    existingHolding.averageBuyPrice = newTotalInvested / newTotalAmount;
    existingHolding.totalInvested = newTotalInvested;
    existingHolding.metadata.lastUpdated = Date.now();
    
    // Add transaction
    existingHolding.transactions.push({
      type: 'buy',
      amount: holdingData.amount,
      price: holdingData.price,
      total: holdingData.amount * holdingData.price,
      fee: holdingData.fee || 0,
      exchange: holdingData.exchange,
      notes: holdingData.notes
    });
  } else {
    // Add new holding
    this.holdings.push({
      symbol: holdingData.symbol.toUpperCase(),
      name: holdingData.name,
      amount: holdingData.amount,
      averageBuyPrice: holdingData.price,
      totalInvested: holdingData.amount * holdingData.price,
      transactions: [{
        type: 'buy',
        amount: holdingData.amount,
        price: holdingData.price,
        total: holdingData.amount * holdingData.price,
        fee: holdingData.fee || 0,
        exchange: holdingData.exchange,
        notes: holdingData.notes
      }],
      metadata: {
        tags: holdingData.tags || [],
        notes: holdingData.notes
      }
    });
  }
  
  return this.save();
};

// Method to remove holding
portfolioSchema.methods.removeHolding = function(symbol, amount) {
  const holding = this.holdings.find(h => h.symbol === symbol.toUpperCase());
  if (!holding) {
    throw new Error('Holding not found');
  }
  
  if (amount >= holding.amount) {
    // Remove entire holding
    this.holdings = this.holdings.filter(h => h.symbol !== symbol.toUpperCase());
  } else {
    // Reduce holding amount
    holding.amount -= amount;
    holding.totalInvested = holding.amount * holding.averageBuyPrice;
    
    // Add sell transaction
    holding.transactions.push({
      type: 'sell',
      amount: amount,
      price: holding.currentPrice,
      total: amount * holding.currentPrice,
      timestamp: Date.now()
    });
  }
  
  return this.save();
};

// Method to update holding prices
portfolioSchema.methods.updatePrices = function(priceData) {
  let totalValue = 0;
  let totalInvested = 0;
  
  this.holdings.forEach(holding => {
    const price = priceData[holding.symbol.toLowerCase()];
    if (price) {
      holding.currentPrice = price.usd;
      holding.currentValue = holding.amount * price.usd;
      holding.profitLoss = holding.currentValue - holding.totalInvested;
      holding.profitLossPercentage = holding.totalInvested > 0 
        ? (holding.profitLoss / holding.totalInvested) * 100 
        : 0;
      holding.metadata.lastUpdated = Date.now();
    }
    
    totalValue += holding.currentValue;
    totalInvested += holding.totalInvested;
  });
  
  // Update summary
  this.summary.currentValue = totalValue;
  this.summary.totalInvested = totalInvested;
  this.summary.totalProfitLoss = totalValue - totalInvested;
  this.summary.totalProfitLossPercentage = totalInvested > 0 
    ? (this.summary.totalProfitLoss / totalInvested) * 100 
    : 0;
  this.summary.lastUpdated = Date.now();
  
  // Calculate diversification score
  this.calculateDiversificationScore();
  
  return this.save();
};

// Method to calculate diversification score
portfolioSchema.methods.calculateDiversificationScore = function() {
  if (this.holdings.length === 0) {
    this.summary.diversificationScore = 0;
    return;
  }
  
  // Calculate Herfindahl-Hirschman Index (HHI) for diversification
  const totalValue = this.summary.currentValue;
  if (totalValue === 0) {
    this.summary.diversificationScore = 0;
    return;
  }
  
  let hhi = 0;
  this.holdings.forEach(holding => {
    const share = holding.currentValue / totalValue;
    hhi += share * share;
  });
  
  // Convert HHI to diversification score (0-100, where 100 is most diversified)
  const maxHHI = 1; // Maximum possible HHI (complete concentration)
  this.summary.diversificationScore = Math.round((1 - hhi) * 100);
};

// Method to add performance snapshot
portfolioSchema.methods.addPerformanceSnapshot = function() {
  const snapshot = {
    date: new Date(),
    totalValue: this.summary.currentValue,
    profitLoss: this.summary.totalProfitLoss,
    profitLossPercentage: this.summary.totalProfitLossPercentage,
    holdings: this.holdings.map(holding => ({
      symbol: holding.symbol,
      value: holding.currentValue,
      price: holding.currentPrice,
      amount: holding.amount
    }))
  };
  
  this.analytics.performanceHistory.push(snapshot);
  
  // Keep only last 365 days
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  this.analytics.performanceHistory = this.analytics.performanceHistory.filter(
    snapshot => snapshot.date > oneYearAgo
  );
  
  return this.save();
};

// Static method to find user's portfolios
portfolioSchema.statics.findByUserId = function(userId, options = {}) {
  const query = { userId };
  
  if (options.isActive !== undefined) {
    query.isActive = options.isActive;
  }
  
  return this.find(query)
    .sort({ isDefault: -1, createdAt: -1 })
    .limit(options.limit || 10);
};

// Indexes
portfolioSchema.index({ userId: 1, isActive: 1 });
portfolioSchema.index({ userId: 1, isDefault: 1 });
portfolioSchema.index({ 'holdings.symbol': 1 });
portfolioSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Portfolio', portfolioSchema); 