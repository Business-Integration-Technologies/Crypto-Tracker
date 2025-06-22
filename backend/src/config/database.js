const mongoose = require('mongoose');
const redis = require('redis');

let redisClient = null;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Handle MongoDB connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis Connected');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis Reconnecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis Ready');
    });

    await redisClient.connect();
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    // Don't exit process - Redis is not critical for basic functionality
  }
};

const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    console.warn('⚠️ Redis client not available');
    return null;
  }
  return redisClient;
};

// Redis helper functions
const setCache = async (key, value, expireIn = 3600) => {
  const client = getRedisClient();
  if (!client) return false;
  
  try {
    await client.setEx(key, expireIn, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('❌ Redis SET error:', error);
    return false;
  }
};

const getCache = async (key) => {
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('❌ Redis GET error:', error);
    return null;
  }
};

const deleteCache = async (key) => {
  const client = getRedisClient();
  if (!client) return false;
  
  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error('❌ Redis DELETE error:', error);
    return false;
  }
};

const flushCache = async () => {
  const client = getRedisClient();
  if (!client) return false;
  
  try {
    await client.flushAll();
    return true;
  } catch (error) {
    console.error('❌ Redis FLUSH error:', error);
    return false;
  }
};

module.exports = {
  connectDB,
  connectRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  flushCache
}; 