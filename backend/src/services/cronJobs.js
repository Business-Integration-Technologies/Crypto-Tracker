const cron = require('node-cron');

const setupCronJobs = () => {
  console.log('⏰ Setting up cron jobs...');
  
  cron.schedule('0 2 * * *', () => {
    console.log('🧹 Running daily cleanup...');
  });
  
  cron.schedule('0 9 * * 0', () => {
    console.log('📊 Generating weekly portfolio reports...');
  });
};

module.exports = { setupCronJobs };