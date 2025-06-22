const axios = require('axios');
const { setCache, getCache } = require('../config/database');

class CryptoService {
  constructor() {
    this.baseURL = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
    this.apiKey = process.env.COINGECKO_API_KEY;
    this.requestCount = 0;
    this.lastReset = Date.now();
    this.rateLimit = 100; // requests per minute
    
    // Initialize axios instance
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoAlert/1.0'
      }
    });

    // Add API key if available
    if (this.apiKey) {
      this.api.defaults.headers['x-cg-pro-api-key'] = this.apiKey;
      this.rateLimit = 500; // Pro API has higher limits
    }

    // Request interceptor for rate limiting
    this.api.interceptors.request.use((config) => {
      this.checkRateLimit();
      return config;
    });

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('CoinGecko API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  checkRateLimit() {
    const now = Date.now();
    const timeSinceReset = now - this.lastReset;
    
    // Reset counter every minute
    if (timeSinceReset >= 60000) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    
    // Check if we're hitting rate limits
    if (this.requestCount >= this.rateLimit) {
      const waitTime = 60000 - timeSinceReset;
      console.warn(`Rate limit approaching, waiting ${waitTime}ms`);
      return new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requestCount++;
  }

  // Get supported cryptocurrencies list
  async getSupportedCoins() {
    const cacheKey = 'coingecko:coins:list';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/coins/list');
      const coins = response.data;
      
      // Cache for 24 hours
      await setCache(cacheKey, coins, 86400);
      
      return coins;
    } catch (error) {
      console.error('Error fetching supported coins:', error.message);
      throw new Error('Failed to fetch supported cryptocurrencies');
    }
  }

  // Get current prices for multiple cryptocurrencies
  async getCurrentPrices(symbols, currencies = ['usd']) {
    const cacheKey = `coingecko:prices:${symbols.join(',')}_${currencies.join(',')}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/simple/price', {
        params: {
          ids: symbols.join(','),
          vs_currencies: currencies.join(','),
          include_market_cap: true,
          include_24hr_vol: true,
          include_24hr_change: true,
          include_last_updated_at: true
        }
      });

      const prices = response.data;
      
      // Cache for 1 minute
      await setCache(cacheKey, prices, 60);
      
      return prices;
    } catch (error) {
      console.error('Error fetching current prices:', error.message);
      throw new Error('Failed to fetch current prices');
    }
  }

  // Get detailed market data for a specific cryptocurrency
  async getCoinDetails(coinId, sparkline = false) {
    const cacheKey = `coingecko:coin:${coinId}:${sparkline}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get(`/coins/${coinId}`, {
        params: {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: false,
          developer_data: false,
          sparkline: sparkline
        }
      });

      const coinData = response.data;
      
      // Cache for 5 minutes
      await setCache(cacheKey, coinData, 300);
      
      return coinData;
    } catch (error) {
      console.error(`Error fetching coin details for ${coinId}:`, error.message);
      throw new Error(`Failed to fetch details for ${coinId}`);
    }
  }

  // Get market data for top cryptocurrencies
  async getMarketData(page = 1, perPage = 100, currency = 'usd') {
    const cacheKey = `coingecko:markets:${page}_${perPage}_${currency}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/coins/markets', {
        params: {
          vs_currency: currency,
          order: 'market_cap_desc',
          per_page: perPage,
          page: page,
          sparkline: true,
          price_change_percentage: '1h,24h,7d,14d,30d,200d,1y'
        }
      });

      const marketData = response.data;
      
      // Cache for 2 minutes
      await setCache(cacheKey, marketData, 120);
      
      return marketData;
    } catch (error) {
      console.error('Error fetching market data:', error.message);
      throw new Error('Failed to fetch market data');
    }
  }

  // Get historical price data
  async getHistoricalPrices(coinId, days = 30, currency = 'usd') {
    const cacheKey = `coingecko:history:${coinId}_${days}_${currency}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get(`/coins/${coinId}/market_chart`, {
        params: {
          vs_currency: currency,
          days: days,
          interval: days <= 1 ? 'hourly' : days <= 90 ? 'daily' : 'weekly'
        }
      });

      const historicalData = response.data;
      
      // Cache for longer periods based on days requested
      const cacheTime = days <= 1 ? 300 : days <= 7 ? 1800 : 3600; // 5min, 30min, 1hour
      await setCache(cacheKey, historicalData, cacheTime);
      
      return historicalData;
    } catch (error) {
      console.error(`Error fetching historical data for ${coinId}:`, error.message);
      throw new Error(`Failed to fetch historical data for ${coinId}`);
    }
  }

  // Get trending cryptocurrencies
  async getTrendingCoins() {
    const cacheKey = 'coingecko:trending';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/search/trending');
      const trending = response.data;
      
      // Cache for 10 minutes
      await setCache(cacheKey, trending, 600);
      
      return trending;
    } catch (error) {
      console.error('Error fetching trending coins:', error.message);
      throw new Error('Failed to fetch trending coins');
    }
  }

  // Search for cryptocurrencies
  async searchCoins(query) {
    if (!query || query.length < 2) {
      throw new Error('Search query must be at least 2 characters');
    }

    const cacheKey = `coingecko:search:${query.toLowerCase()}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/search', {
        params: { query }
      });

      const searchResults = response.data;
      
      // Cache for 1 hour
      await setCache(cacheKey, searchResults, 3600);
      
      return searchResults;
    } catch (error) {
      console.error('Error searching coins:', error.message);
      throw new Error('Failed to search cryptocurrencies');
    }
  }

  // Get global cryptocurrency statistics
  async getGlobalStats() {
    const cacheKey = 'coingecko:global';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/global');
      const globalData = response.data;
      
      // Cache for 5 minutes
      await setCache(cacheKey, globalData, 300);
      
      return globalData;
    } catch (error) {
      console.error('Error fetching global stats:', error.message);
      throw new Error('Failed to fetch global statistics');
    }
  }

  // Get price change percentages
  async getPriceChangeData(coinIds, timeframes = ['1h', '24h', '7d']) {
    const cacheKey = `coingecko:price_change:${coinIds.join(',')}_${timeframes.join(',')}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/simple/price', {
        params: {
          ids: coinIds.join(','),
          vs_currencies: 'usd',
          include_24hr_change: true,
          price_change_percentage: timeframes.join(',')
        }
      });

      const priceChangeData = response.data;
      
      // Cache for 2 minutes
      await setCache(cacheKey, priceChangeData, 120);
      
      return priceChangeData;
    } catch (error) {
      console.error('Error fetching price change data:', error.message);
      throw new Error('Failed to fetch price change data');
    }
  }

  // Get DeFi market data
  async getDefiData() {
    const cacheKey = 'coingecko:defi';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/global/decentralized_finance_defi');
      const defiData = response.data;
      
      // Cache for 10 minutes
      await setCache(cacheKey, defiData, 600);
      
      return defiData;
    } catch (error) {
      console.error('Error fetching DeFi data:', error.message);
      throw new Error('Failed to fetch DeFi data');
    }
  }

  // Format price data for frontend consumption
  formatPriceData(rawData) {
    const formatted = {};
    
    Object.keys(rawData).forEach(coinId => {
      const data = rawData[coinId];
      formatted[coinId] = {
        price: data.usd || 0,
        marketCap: data.usd_market_cap || 0,
        volume24h: data.usd_24h_vol || 0,
        change24h: data.usd_24h_change || 0,
        lastUpdated: data.last_updated_at ? new Date(data.last_updated_at * 1000) : new Date()
      };
    });
    
    return formatted;
  }

  // Get exchange rates for different currencies
  async getExchangeRates() {
    const cacheKey = 'coingecko:exchange_rates';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/exchange_rates');
      const rates = response.data;
      
      // Cache for 1 hour
      await setCache(cacheKey, rates, 3600);
      
      return rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error.message);
      throw new Error('Failed to fetch exchange rates');
    }
  }

  // Health check for the API
  async healthCheck() {
    try {
      const response = await this.api.get('/ping');
      return response.data;
    } catch (error) {
      console.error('CoinGecko API health check failed:', error.message);
      throw new Error('CoinGecko API is not available');
    }
  }

  // Get API status and usage
  getApiStatus() {
    return {
      requestCount: this.requestCount,
      rateLimit: this.rateLimit,
      hasApiKey: !!this.apiKey,
      lastReset: new Date(this.lastReset),
      timeUntilReset: Math.max(0, 60000 - (Date.now() - this.lastReset))
    };
  }
}

module.exports = new CryptoService(); 