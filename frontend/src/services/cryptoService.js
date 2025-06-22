import axios from 'axios';

class CryptoService {
  constructor() {
    this.coingeckoAPI = 'https://api.coingecko.com/api/v3';
    this.mockAPI = 'http://localhost:4000/api/v1';
    this.useRealAPI = true;
    this.rateLimit = {
      lastCall: 0,
      minInterval: 10000 // 10 seconds between calls
    };
  }

  // Check if we should use real API or mock
  async checkAPIAvailability() {
    try {
      const response = await axios.get(`${this.coingeckoAPI}/ping`, { timeout: 5000 });
      this.useRealAPI = response.status === 200;
      return this.useRealAPI;
    } catch (error) {
      console.warn('CoinGecko API unavailable, using mock API');
      this.useRealAPI = false;
      return false;
    }
  }

  // Rate limiting for CoinGecko API
  canMakeAPICall() {
    const now = Date.now();
    if (now - this.rateLimit.lastCall < this.rateLimit.minInterval) {
      return false;
    }
    this.rateLimit.lastCall = now;
    return true;
  }

  // Get current prices for multiple coins
  async getCurrentPrices(coinIds = ['bitcoin', 'ethereum', 'solana', 'cardano', 'chainlink']) {
    try {
      if (this.useRealAPI && this.canMakeAPICall()) {
        const response = await axios.get(`${this.coingeckoAPI}/simple/price`, {
          params: {
            ids: coinIds.join(','),
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_24hr_vol: true,
            include_market_cap: true,
            include_last_updated_at: true
          },
          timeout: 8000
        });

        // Transform CoinGecko data to our format
        const transformedData = {};
        Object.entries(response.data).forEach(([coinId, data]) => {
          transformedData[coinId] = {
            id: coinId,
            current_price: data.usd,
            price_change_percentage_24h: data.usd_24h_change || 0,
            market_cap: data.usd_market_cap || 0,
            total_volume: data.usd_24h_vol || 0,
            last_updated: data.last_updated_at ? new Date(data.last_updated_at * 1000).toISOString() : new Date().toISOString()
          };
        });

        return transformedData;
      } else {
        // Fallback to mock API
        return await this.getMockPrices(coinIds);
      }
    } catch (error) {
      console.error('Error fetching real prices:', error);
      // Fallback to mock API
      return await this.getMockPrices(coinIds);
    }
  }

  // Get mock prices from local API
  async getMockPrices(coinIds) {
    try {
      const promises = coinIds.map(async (coinId) => {
        const response = await axios.get(`${this.mockAPI}/coins/${coinId}`, { timeout: 3000 });
        return [coinId, response.data];
      });

      const results = await Promise.all(promises);
      const mockData = {};
      results.forEach(([coinId, data]) => {
        mockData[coinId] = data;
      });

      return mockData;
    } catch (error) {
      console.error('Error fetching mock prices:', error);
      throw error;
    }
  }

  // Get detailed coin information
  async getCoinDetails(coinId) {
    try {
      if (this.useRealAPI && this.canMakeAPICall()) {
        const response = await axios.get(`${this.coingeckoAPI}/coins/${coinId}`, {
          params: {
            localization: false,
            tickers: false,
            market_data: true,
            community_data: false,
            developer_data: false,
            sparkline: true
          },
          timeout: 10000
        });

        return {
          id: response.data.id,
          name: response.data.name,
          symbol: response.data.symbol.toUpperCase(),
          current_price: response.data.market_data.current_price.usd,
          market_cap: response.data.market_data.market_cap.usd,
          total_volume: response.data.market_data.total_volume.usd,
          price_change_percentage_24h: response.data.market_data.price_change_percentage_24h,
          circulating_supply: response.data.market_data.circulating_supply,
          total_supply: response.data.market_data.total_supply,
          max_supply: response.data.market_data.max_supply,
          ath: response.data.market_data.ath.usd,
          ath_change_percentage: response.data.market_data.ath_change_percentage.usd,
          sparkline: response.data.market_data.sparkline_7d?.price || [],
          last_updated: response.data.last_updated
        };
      } else {
        // Fallback to mock API
        const response = await axios.get(`${this.mockAPI}/coins/${coinId}`);
        return response.data;
      }
    } catch (error) {
      console.error(`Error fetching details for ${coinId}:`, error);
      // Fallback to mock API
      const response = await axios.get(`${this.mockAPI}/coins/${coinId}`);
      return response.data;
    }
  }

  // Get market data for multiple coins
  async getMarketData(limit = 10) {
    try {
      if (this.useRealAPI && this.canMakeAPICall()) {
        const response = await axios.get(`${this.coingeckoAPI}/coins/markets`, {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: limit,
            page: 1,
            sparkline: true,
            price_change_percentage: '24h'
          },
          timeout: 10000
        });

        return response.data.map(coin => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol.toUpperCase(),
          current_price: coin.current_price,
          market_cap: coin.market_cap,
          total_volume: coin.total_volume,
          price_change_percentage_24h: coin.price_change_percentage_24h,
          circulating_supply: coin.circulating_supply,
          total_supply: coin.total_supply,
          max_supply: coin.max_supply,
          image: coin.image,
          sparkline_in_7d: coin.sparkline_in_7d?.price || [],
          last_updated: coin.last_updated
        }));
      } else {
        // Fallback to mock API
        const response = await axios.get(`${this.mockAPI}/coins/markets`);
        return response.data;
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      // Fallback to mock API
      const response = await axios.get(`${this.mockAPI}/coins/markets`);
      return response.data;
    }
  }

  // Get historical data for charts
  async getHistoricalData(coinId, days = 7, interval = 'daily') {
    try {
      if (this.useRealAPI && this.canMakeAPICall()) {
        const response = await axios.get(`${this.coingeckoAPI}/coins/${coinId}/market_chart`, {
          params: {
            vs_currency: 'usd',
            days: days,
            interval: interval
          },
          timeout: 10000
        });

        // Transform CoinGecko format to our chart format
        const prices = response.data.prices || [];
        const volumes = response.data.total_volumes || [];
        
        return prices.map((price, index) => ({
          timestamp: price[0],
          date: new Date(price[0]).toISOString().split('T')[0],
          price: parseFloat(price[1].toFixed(2)),
          volume: volumes[index] ? parseFloat(volumes[index][1].toFixed(0)) : 0,
          high: parseFloat((price[1] * 1.02).toFixed(2)), // Approximate high
          low: parseFloat((price[1] * 0.98).toFixed(2)),  // Approximate low
          open: index > 0 ? prices[index - 1][1] : price[1],
          close: price[1]
        }));
      } else {
        // Generate mock historical data
        return this.generateMockHistoricalData(coinId, days);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return this.generateMockHistoricalData(coinId, days);
    }
  }

  // Generate mock historical data
  generateMockHistoricalData(coinId, days) {
    const data = [];
    const now = new Date();
    const basePrice = this.getBasePriceForCoin(coinId);
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const volatility = 0.05 + Math.random() * 0.1; // 5-15% daily volatility
      const change = (Math.random() - 0.5) * volatility;
      const price = basePrice * (1 + change * (i / days));
      
      data.push({
        timestamp: date.getTime(),
        date: date.toISOString().split('T')[0],
        price: parseFloat(price.toFixed(2)),
        volume: Math.floor(price * (Math.random() * 1000000 + 500000)),
        high: parseFloat((price * (1 + Math.random() * 0.03)).toFixed(2)),
        low: parseFloat((price * (1 - Math.random() * 0.03)).toFixed(2)),
        open: parseFloat((price * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
        close: price
      });
    }
    
    return data;
  }

  // Get base prices for different coins
  getBasePriceForCoin(coinId) {
    const basePrices = {
      bitcoin: 65000,
      ethereum: 3500,
      solana: 140,
      cardano: 0.85,
      chainlink: 18
    };
    return basePrices[coinId] || 100;
  }

  // Check if using real API
  isUsingRealAPI() {
    return this.useRealAPI;
  }

  // Force switch to real API
  async enableRealAPI() {
    const available = await this.checkAPIAvailability();
    if (available) {
      this.useRealAPI = true;
      return true;
    }
    return false;
  }

  // Force switch to mock API
  enableMockAPI() {
    this.useRealAPI = false;
  }
}

export default new CryptoService(); 