const Alert = require('../models/Alert');
const User = require('../models/User');
const cryptoService = require('./cryptoService');
const notificationService = require('./notificationService');
const { setCache, getCache } = require('../config/database');

class AlertService {
  constructor() {
    this.activeAlerts = new Map();
    this.priceCache = new Map();
    this.monitoringIntervals = new Map();
    this.isMonitoring = false;
  }

  // Start monitoring all active alerts
  async startMonitoring(io) {
    if (this.isMonitoring) {
      console.log('Alert monitoring is already running');
      return;
    }

    this.io = io;
    this.isMonitoring = true;
    
    console.log('🚨 Starting alert monitoring system...');
    
    // Load all active alerts
    await this.loadActiveAlerts();
    
    // Start price monitoring
    this.startPriceMonitoring();
    
    // Start alert processing
    this.startAlertProcessing();
    
    console.log(`✅ Alert monitoring started with ${this.activeAlerts.size} active alerts`);
  }

  // Stop monitoring
  stopMonitoring() {
    this.isMonitoring = false;
    
    // Clear all intervals
    this.monitoringIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.monitoringIntervals.clear();
    
    console.log('🛑 Alert monitoring stopped');
  }

  // Load all active alerts from database
  async loadActiveAlerts() {
    try {
      const alerts = await Alert.find({
        isActive: true,
        isTriggered: false,
        $or: [
          { 'metadata.expiresAt': { $exists: false } },
          { 'metadata.expiresAt': { $gt: new Date() } }
        ]
      }).populate('userId', 'email phoneNumber preferences');

      this.activeAlerts.clear();
      
      alerts.forEach(alert => {
        this.activeAlerts.set(alert._id.toString(), alert);
      });

      console.log(`📊 Loaded ${alerts.length} active alerts`);
    } catch (error) {
      console.error('❌ Error loading active alerts:', error);
    }
  }

  // Start price monitoring
  startPriceMonitoring() {
    const interval = setInterval(async () => {
      try {
        await this.updatePrices();
      } catch (error) {
        console.error('❌ Error in price monitoring:', error);
      }
    }, parseInt(process.env.PRICE_CHECK_INTERVAL) || 30000);

    this.monitoringIntervals.set('price_monitoring', interval);
  }

  // Start alert processing
  startAlertProcessing() {
    const interval = setInterval(async () => {
      try {
        await this.processAlerts();
      } catch (error) {
        console.error('❌ Error in alert processing:', error);
      }
    }, 5000); // Check every 5 seconds

    this.monitoringIntervals.set('alert_processing', interval);
  }

  // Update prices for all monitored cryptocurrencies
  async updatePrices() {
    if (this.activeAlerts.size === 0) return;

    // Get unique symbols from active alerts
    const symbols = [...new Set(Array.from(this.activeAlerts.values()).map(alert => alert.symbol.toLowerCase()))];
    
    if (symbols.length === 0) return;

    try {
      const priceData = await cryptoService.getCurrentPrices(symbols);
      
      // Update price cache
      Object.keys(priceData).forEach(symbol => {
        const data = priceData[symbol];
        this.priceCache.set(symbol, {
          price: data.usd,
          change24h: data.usd_24h_change || 0,
          volume: data.usd_24h_vol || 0,
          marketCap: data.usd_market_cap || 0,
          lastUpdated: new Date()
        });
      });

      // Emit price updates to connected clients
      if (this.io) {
        this.io.emit('priceUpdate', priceData);
      }

      console.log(`📈 Updated prices for ${symbols.length} cryptocurrencies`);
    } catch (error) {
      console.error('❌ Error updating prices:', error);
    }
  }

  // Process all active alerts
  async processAlerts() {
    if (this.activeAlerts.size === 0) return;

    const alertsToProcess = Array.from(this.activeAlerts.values());
    
    for (const alert of alertsToProcess) {
      try {
        await this.processAlert(alert);
      } catch (error) {
        console.error(`❌ Error processing alert ${alert._id}:`, error);
      }
    }
  }

  // Process individual alert
  async processAlert(alert) {
    const symbol = alert.symbol.toLowerCase();
    const priceData = this.priceCache.get(symbol);
    
    if (!priceData) {
      // Try to fetch price data for this specific symbol
      try {
        const freshData = await cryptoService.getCurrentPrices([symbol]);
        if (freshData[symbol]) {
          const data = freshData[symbol];
          this.priceCache.set(symbol, {
            price: data.usd,
            change24h: data.usd_24h_change || 0,
            volume: data.usd_24h_vol || 0,
            marketCap: data.usd_market_cap || 0,
            lastUpdated: new Date()
          });
        }
      } catch (error) {
        console.error(`❌ Error fetching price for ${symbol}:`, error);
        return;
      }
    }

    const currentData = this.priceCache.get(symbol);
    if (!currentData) return;

    // Update alert's price history
    await this.updateAlertPriceHistory(alert, currentData.price);

    // Check if alert should trigger
    if (alert.shouldTrigger(currentData)) {
      await this.triggerAlert(alert, currentData);
    }
  }

  // Update alert's price history
  async updateAlertPriceHistory(alert, currentPrice) {
    try {
      alert.addPriceHistory(currentPrice);
      await alert.save();
    } catch (error) {
      console.error(`❌ Error updating price history for alert ${alert._id}:`, error);
    }
  }

  // Trigger an alert
  async triggerAlert(alert, currentData) {
    try {
      console.log(`🚨 Triggering alert: ${alert.symbol} ${alert.type} - ${currentData.price}`);
      
      // Update alert status
      await alert.trigger(currentData);
      
      // Send notifications
      await this.sendAlertNotifications(alert, currentData);
      
      // Remove from active alerts if it's a one-time alert
      if (alert.metadata.repeatInterval === 0) {
        this.activeAlerts.delete(alert._id.toString());
      }
      
      // Emit alert trigger to connected clients
      if (this.io && alert.userId) {
        this.io.to(alert.userId.toString()).emit('alertTriggered', {
          alert: alert.toJSON(),
          currentData
        });
      }
      
      // Update user statistics
      await this.updateUserStats(alert.userId, 'alert_triggered');
      
      console.log(`✅ Alert triggered successfully: ${alert._id}`);
    } catch (error) {
      console.error(`❌ Error triggering alert ${alert._id}:`, error);
    }
  }

  // Send alert notifications
  async sendAlertNotifications(alert, currentData) {
    const user = alert.userId;
    
    if (!user) {
      console.error('❌ No user found for alert');
      return;
    }

    const alertMessage = this.generateAlertMessage(alert, currentData);
    
    try {
      // Send email notification
      if (alert.notifications.email.enabled && user.preferences.notifications.email) {
        await notificationService.sendEmail({
          to: user.email,
          subject: `🚨 CryptoAlert: ${alert.symbol} Price Alert`,
          template: 'price_alert',
          data: {
            user: user,
            alert: alert,
            currentData: currentData,
            message: alertMessage
          }
        });
        
        alert.notifications.email.sent = true;
        alert.notifications.email.sentAt = new Date();
      }

      // Send SMS notification
      if (alert.notifications.sms.enabled && user.preferences.notifications.sms && user.phoneNumber) {
        await notificationService.sendSMS({
          to: user.phoneNumber,
          message: alertMessage
        });
        
        alert.notifications.sms.sent = true;
        alert.notifications.sms.sentAt = new Date();
      }

      // Send push notification
      if (alert.notifications.push.enabled && user.preferences.notifications.push) {
        await notificationService.sendPushNotification({
          userId: user._id,
          title: `${alert.symbol} Price Alert`,
          message: alertMessage,
          data: {
            alertId: alert._id,
            symbol: alert.symbol,
            price: currentData.price
          }
        });
        
        alert.notifications.push.sent = true;
        alert.notifications.push.sentAt = new Date();
      }

      await alert.save();
    } catch (error) {
      console.error('❌ Error sending alert notifications:', error);
    }
  }

  // Generate alert message
  generateAlertMessage(alert, currentData) {
    const symbol = alert.symbol;
    const price = currentData.price;
    const change = currentData.change24h;
    
    let message = '';
    
    switch (alert.type) {
      case 'price_above':
        message = `${symbol} has reached $${price.toFixed(2)}, above your target of $${alert.condition.targetPrice.toFixed(2)}`;
        break;
      case 'price_below':
        message = `${symbol} has dropped to $${price.toFixed(2)}, below your target of $${alert.condition.targetPrice.toFixed(2)}`;
        break;
      case 'price_change':
        message = `${symbol} has changed by ${change.toFixed(2)}% in the last 24h, exceeding your threshold of ${alert.condition.percentageChange.toFixed(2)}%`;
        break;
      case 'volume_spike':
        message = `${symbol} volume has spiked to $${(currentData.volume / 1000000).toFixed(2)}M, above your threshold`;
        break;
      case 'market_cap_change':
        message = `${symbol} market cap has changed significantly to $${(currentData.marketCap / 1000000000).toFixed(2)}B`;
        break;
      default:
        message = `${symbol} alert triggered at $${price.toFixed(2)}`;
    }
    
    return message;
  }

  // Create new alert
  async createAlert(userId, alertData) {
    try {
      // Validate user alert limits
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const userAlerts = await Alert.countDocuments({ userId, isActive: true });
      if (userAlerts >= user.subscription.maxAlerts) {
        throw new Error(`Alert limit reached. Maximum ${user.subscription.maxAlerts} alerts allowed.`);
      }

      // Create alert
      const alert = new Alert({
        userId,
        ...alertData
      });

      await alert.save();
      
      // Add to active alerts if it's active
      if (alert.isActive) {
        const populatedAlert = await Alert.findById(alert._id).populate('userId', 'email phoneNumber preferences');
        this.activeAlerts.set(alert._id.toString(), populatedAlert);
      }
      
      // Update user statistics
      await this.updateUserStats(userId, 'alert_created');
      
      console.log(`✅ Created new alert: ${alert._id}`);
      return alert;
    } catch (error) {
      console.error('❌ Error creating alert:', error);
      throw error;
    }
  }

  // Update alert
  async updateAlert(alertId, updateData) {
    try {
      const alert = await Alert.findByIdAndUpdate(alertId, updateData, { new: true })
        .populate('userId', 'email phoneNumber preferences');
      
      if (!alert) {
        throw new Error('Alert not found');
      }

      // Update in active alerts
      if (alert.isActive && !alert.isTriggered) {
        this.activeAlerts.set(alertId, alert);
      } else {
        this.activeAlerts.delete(alertId);
      }

      return alert;
    } catch (error) {
      console.error('❌ Error updating alert:', error);
      throw error;
    }
  }

  // Delete alert
  async deleteAlert(alertId) {
    try {
      const alert = await Alert.findByIdAndDelete(alertId);
      
      if (!alert) {
        throw new Error('Alert not found');
      }

      // Remove from active alerts
      this.activeAlerts.delete(alertId);
      
      console.log(`🗑️ Deleted alert: ${alertId}`);
      return alert;
    } catch (error) {
      console.error('❌ Error deleting alert:', error);
      throw error;
    }
  }

  // Get user alerts
  async getUserAlerts(userId, options = {}) {
    try {
      return await Alert.findByUserId(userId, options);
    } catch (error) {
      console.error('❌ Error fetching user alerts:', error);
      throw error;
    }
  }

  // Get alert statistics
  async getAlertStats() {
    try {
      const stats = await Alert.aggregate([
        {
          $group: {
            _id: null,
            totalAlerts: { $sum: 1 },
            activeAlerts: { $sum: { $cond: ['$isActive', 1, 0] } },
            triggeredAlerts: { $sum: { $cond: ['$isTriggered', 1, 0] } },
            avgTriggerCount: { $avg: '$triggerCount' }
          }
        }
      ]);

      return {
        totalAlerts: stats[0]?.totalAlerts || 0,
        activeAlerts: stats[0]?.activeAlerts || 0,
        triggeredAlerts: stats[0]?.triggeredAlerts || 0,
        avgTriggerCount: stats[0]?.avgTriggerCount || 0,
        monitoringStatus: this.isMonitoring,
        cachedPrices: this.priceCache.size
      };
    } catch (error) {
      console.error('❌ Error getting alert stats:', error);
      throw error;
    }
  }

  // Update user statistics
  async updateUserStats(userId, action) {
    try {
      const updateData = {};
      
      switch (action) {
        case 'alert_created':
          updateData['$inc'] = { 'stats.totalAlerts': 1 };
          break;
        case 'alert_triggered':
          updateData['$inc'] = { 'stats.triggeredAlerts': 1 };
          updateData['$set'] = { 'stats.lastPriceUpdate': new Date() };
          break;
      }
      
      if (Object.keys(updateData).length > 0) {
        await User.findByIdAndUpdate(userId, updateData);
      }
    } catch (error) {
      console.error('❌ Error updating user stats:', error);
    }
  }

  // Get monitoring status
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      activeAlertsCount: this.activeAlerts.size,
      cachedPricesCount: this.priceCache.size,
      monitoringIntervals: this.monitoringIntervals.size,
      lastPriceUpdate: this.priceCache.size > 0 ? 
        Math.max(...Array.from(this.priceCache.values()).map(p => p.lastUpdated)) : null
    };
  }
}

module.exports = new AlertService(); 