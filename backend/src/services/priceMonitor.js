const cryptoService = require('./cryptoService');

let monitoringInterval;

const startPriceMonitoring = (io) => {
  console.log('📊 Starting price monitoring service...');
  
  monitoringInterval = setInterval(async () => {
    try {
      const topCoins = ['bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana'];
      const prices = await cryptoService.getCurrentPrices(topCoins);
      
      if (io) {
        io.emit('priceUpdate', prices);
      }
    } catch (error) {
      console.error('Price monitoring error:', error.message);
    }
  }, 30000);
};

const stopPriceMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    console.log('🛑 Price monitoring stopped');
  }
};

module.exports = {
  startPriceMonitoring,
  stopPriceMonitoring
};