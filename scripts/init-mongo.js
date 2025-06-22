// MongoDB initialization script
db = db.getSiblingDB('cryptoalert');

// Create collections
db.createCollection('users');
db.createCollection('portfolios');
db.createCollection('alerts');
db.createCollection('priceHistory');
db.createCollection('notifications');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: 1 });

db.portfolios.createIndex({ userId: 1 });
db.portfolios.createIndex({ createdAt: 1 });

db.alerts.createIndex({ userId: 1 });
db.alerts.createIndex({ symbol: 1 });
db.alerts.createIndex({ isActive: 1 });
db.alerts.createIndex({ createdAt: 1 });

db.priceHistory.createIndex({ symbol: 1, timestamp: 1 });
db.priceHistory.createIndex({ timestamp: 1 });

db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ isRead: 1 });

// Insert sample data
db.priceHistory.insertOne({
  symbol: 'bitcoin',
  price: 43000,
  change24h: 2.5,
  volume: 25000000000,
  marketCap: 850000000000,
  timestamp: new Date()
});

print('MongoDB initialized successfully for CryptoAlert application!'); 